/**
 * Parser tolerance tests — the most important file.
 *
 * Covers:
 *  - Line-ending variants (LF, CR, mixed)
 *  - Missing VCALENDAR wrapper (bare VEVENT)
 *  - Blank / whitespace-only lines between components
 *  - Missing required properties (tolerant parse, strict toString)
 *  - Lowercase property names
 *  - Case-insensitive component types
 *  - Unknown X-* properties preserved
 *  - Unknown component types (stored as generic Component)
 *  - Real-world vendor quirks: Apple, Google, Outlook, Thunderbird
 *  - CATEGORIES comma list
 *  - Multi-ATTENDEE
 *  - DATE-only DTSTART
 *  - TZID parameter on DTSTART/DTEND
 *  - RECURRENCE-ID exception events
 *  - EXDATE (multiple values, DATE vs DATE-TIME)
 *  - RDATE
 *  - RRULE edge cases (negative BYDAY, WKST, BYSETPOS)
 *  - VTIMEZONE with STANDARD + DAYLIGHT
 *  - Multiple VCALENDAR blocks in one feed
 *  - RFC 5545 official examples
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseAll, Calendar, Event, Todo } from '../dist/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function cal(body: string): string {
  return (
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//Test//EN\r\n' +
    body +
    '\r\nEND:VCALENDAR'
  );
}

function vevent(body: string): string {
  return cal(
    'BEGIN:VEVENT\r\nUID:test@example.com\r\nDTSTAMP:20240101T000000Z\r\n' +
    body +
    '\r\nEND:VEVENT',
  );
}

// ── Line ending tolerance ─────────────────────────────────────────────────

describe('line ending tolerance', () => {
  test('bare LF', () => {
    const ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//X//X//EN\nEND:VCALENDAR\n';
    const c = parse(ics);
    assert.equal(c.version, '2.0');
  });

  test('bare CR', () => {
    const ics = 'BEGIN:VCALENDAR\rVERSION:2.0\rPRODID:-//X//X//EN\rEND:VCALENDAR\r';
    const c = parse(ics);
    assert.equal(c.version, '2.0');
  });

  test('mixed CRLF and LF', () => {
    const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\nPRODID:-//X//X//EN\r\nEND:VCALENDAR';
    const c = parse(ics);
    assert.equal(c.prodid, '-//X//X//EN');
  });
});

// ── Structural tolerance ──────────────────────────────────────────────────

describe('structural tolerance', () => {
  test('no VCALENDAR wrapper — bare VEVENT', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:bare@example.com',
      'DTSTAMP:20240101T000000Z',
      'SUMMARY:Bare event',
      'END:VEVENT',
    ].join('\r\n');
    const c = parse(ics);
    assert.equal(c.events.length, 1);
    assert.equal(c.events[0]!.summary, 'Bare event');
  });

  test('blank lines between components (common bug in producers)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//X//EN',
      '',
      'BEGIN:VEVENT',
      'UID:a@x.com',
      'DTSTAMP:20240101T000000Z',
      'SUMMARY:A',
      'END:VEVENT',
      '',
      'BEGIN:VEVENT',
      'UID:b@x.com',
      'DTSTAMP:20240101T000000Z',
      'SUMMARY:B',
      'END:VEVENT',
      '',
      'END:VCALENDAR',
    ].join('\r\n');
    const c = parse(ics);
    assert.equal(c.events.length, 2);
  });

  test('missing PRODID — parsed tolerantly', () => {
    const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
    const c = parse(ics);
    assert.equal(c.prodid, null);
  });

  test('missing VERSION — parsed tolerantly', () => {
    const ics = 'BEGIN:VCALENDAR\r\nPRODID:-//X//EN\r\nEND:VCALENDAR';
    const c = parse(ics);
    assert.equal(c.version, null);
  });

  test('missing DTSTAMP on VEVENT — parsed tolerantly', () => {
    const ics = vevent('SUMMARY:No Dtstamp');
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, 'No Dtstamp');
  });

  test('extra END:VCALENDAR (unmatched) — ignored', () => {
    const ics = cal('') + '\r\nEND:VCALENDAR';
    assert.doesNotThrow(() => parse(ics));
  });

  test('unknown component type preserved as generic', () => {
    const ics = cal(
      'BEGIN:X-CUSTOM-COMPONENT\r\nX-FOO:bar\r\nEND:X-CUSTOM-COMPONENT',
    );
    const c = parse(ics);
    assert.equal(c.components.length, 1);
    assert.equal(c.components[0]!.type, 'X-CUSTOM-COMPONENT');
  });

  test('multiple VEVENT in one VCALENDAR', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      `BEGIN:VEVENT\r\nUID:ev${i}@x.com\r\nDTSTAMP:20240101T000000Z\r\nSUMMARY:Event ${i}\r\nEND:VEVENT`,
    ).join('\r\n');
    const c = parse(cal(events));
    assert.equal(c.events.length, 5);
    assert.equal(c.events[4]!.summary, 'Event 4');
  });

  test('multiple VCALENDAR blocks — parseAll', () => {
    const ics =
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//A//EN\r\nEND:VCALENDAR\r\n' +
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//B//EN\r\nEND:VCALENDAR';
    const cals = parseAll(ics);
    assert.equal(cals.length, 2);
    assert.equal(cals[0]!.prodid, '-//A//EN');
    assert.equal(cals[1]!.prodid, '-//B//EN');
  });

  test('VTODO inside VCALENDAR', () => {
    const ics = cal(
      'BEGIN:VTODO\r\nUID:todo@x.com\r\nDTSTAMP:20240101T000000Z\r\nSUMMARY:Buy milk\r\nEND:VTODO',
    );
    const c = parse(ics);
    assert.equal(c.todos.length, 1);
    assert.equal(c.todos[0]!.summary, 'Buy milk');
  });

  test('VJOURNAL inside VCALENDAR', () => {
    const ics = cal(
      'BEGIN:VJOURNAL\r\nUID:j@x.com\r\nDTSTAMP:20240101T000000Z\r\nSUMMARY:Trip notes\r\nEND:VJOURNAL',
    );
    const c = parse(ics);
    assert.equal(c.journals.length, 1);
    assert.equal(c.journals[0]!.summary, 'Trip notes');
  });
});

// ── Property tolerance ────────────────────────────────────────────────────

describe('property tolerance', () => {
  test('lowercase property name (e.g. Outlook 2003)', () => {
    const ics = vevent('summary:Lower Case Summary');
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, 'Lower Case Summary');
  });

  test('mixed case property name', () => {
    const ics = vevent('Summary:Mixed Case');
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, 'Mixed Case');
  });

  test('X-* properties preserved', () => {
    const ics = vevent(
      'X-MICROSOFT-CDO-IMPORTANCE:2\r\n' +
      'X-APPLE-STRUCTURED-LOCATION:geo:37.386013,-122.082932\r\n' +
      'X-WR-CALNAME:Work',
    );
    const c = parse(ics);
    const e = c.events[0]!;
    assert.ok(e.getProperty('X-MICROSOFT-CDO-IMPORTANCE') !== undefined);
    assert.ok(e.getProperty('X-APPLE-STRUCTURED-LOCATION') !== undefined);
  });

  test('unknown non-X property treated as TEXT (tolerant)', () => {
    const ics = vevent('UNRECOGNIZED-PROP:some value');
    assert.doesNotThrow(() => parse(ics));
    const e = parse(ics).events[0]!;
    assert.ok(e.getProperty('UNRECOGNIZED-PROP') !== undefined);
  });

  test('property with no value (empty after colon)', () => {
    const ics = vevent('DESCRIPTION:');
    const c = parse(ics);
    assert.equal(c.events[0]!.description, '');
  });
});

// ── Text value unescaping ─────────────────────────────────────────────────

describe('text value unescaping', () => {
  test('SUMMARY with \\, (escaped comma)', () => {
    const ics = vevent('SUMMARY:Meeting\\, Dinner\\, Party');
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, 'Meeting, Dinner, Party');
  });

  test('SUMMARY with \\; (escaped semicolon)', () => {
    const ics = vevent('SUMMARY:Hello\\; World');
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, 'Hello; World');
  });

  test('DESCRIPTION with \\n (embedded newline)', () => {
    const ics = vevent('DESCRIPTION:Line 1\\nLine 2\\nLine 3');
    const c = parse(ics);
    assert.equal(c.events[0]!.description, 'Line 1\nLine 2\nLine 3');
  });

  test('DESCRIPTION with \\N (uppercase N as newline, RFC-compliant)', () => {
    const ics = vevent('DESCRIPTION:Line 1\\NLine 2');
    const c = parse(ics);
    assert.equal(c.events[0]!.description, 'Line 1\nLine 2');
  });

  test('DESCRIPTION with \\\\ (escaped backslash)', () => {
    const ics = vevent('DESCRIPTION:C:\\\\Windows\\\\System32');
    const c = parse(ics);
    assert.equal(c.events[0]!.description, 'C:\\Windows\\System32');
  });

  test('UTF-8 emoji in SUMMARY', () => {
    const ics = vevent('SUMMARY:🎉 Party Time 🎂');
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, '🎉 Party Time 🎂');
  });

  test('Japanese characters in SUMMARY', () => {
    const ics = vevent('SUMMARY:会議室の予約');
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, '会議室の予約');
  });

  test('Arabic RTL text in DESCRIPTION', () => {
    const ics = vevent('DESCRIPTION:اجتماع فريق العمل');
    const c = parse(ics);
    assert.equal(c.events[0]!.description, 'اجتماع فريق العمل');
  });
});

// ── Date/time variants ────────────────────────────────────────────────────

describe('date/time variants', () => {
  test('DATE-only DTSTART (VALUE=DATE)', () => {
    const ics = vevent('DTSTART;VALUE=DATE:20240315');
    const c = parse(ics);
    const dt = c.events[0]!.dtstart;
    assert.equal(dt?.type, 'date');
    if (dt?.type === 'date') {
      assert.equal(dt.year, 2024);
      assert.equal(dt.month, 3);
      assert.equal(dt.day, 15);
    }
  });

  test('DATE-only DTEND (VALUE=DATE)', () => {
    const ics = vevent('DTSTART;VALUE=DATE:20240315\r\nDTEND;VALUE=DATE:20240317');
    const c = parse(ics);
    const dt = c.events[0]!.dtend;
    assert.equal(dt?.type, 'date');
  });

  test('DTSTART with TZID (local time with timezone)', () => {
    const ics = vevent('DTSTART;TZID=America/New_York:20240315T090000');
    const c = parse(ics);
    const dt = c.events[0]!.dtstart;
    assert.equal(dt?.type, 'date-time');
    if (dt?.type === 'date-time') {
      assert.equal(dt.tzid, 'America/New_York');
      assert.equal(dt.utc, false);
    }
  });

  test('DTSTART UTC', () => {
    const ics = vevent('DTSTART:20240315T090000Z');
    const c = parse(ics);
    const dt = c.events[0]!.dtstart;
    assert.equal(dt?.type, 'date-time');
    if (dt?.type === 'date-time') {
      assert.equal(dt.utc, true);
    }
  });

  test('all-day event spanning multiple days (DATE)', () => {
    const ics = vevent('DTSTART;VALUE=DATE:20240101\r\nDTEND;VALUE=DATE:20240108');
    const c = parse(ics);
    assert.equal(c.events[0]!.dtstart?.type, 'date');
    assert.equal(c.events[0]!.dtend?.type, 'date');
  });
});

// ── Recurrence rules ──────────────────────────────────────────────────────

describe('recurrence rules', () => {
  test('simple RRULE', () => {
    const ics = vevent('DTSTART:20240101T100000Z\r\nRRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10');
    const e = parse(ics).events[0]!;
    const rr = e.rrules[0]!;
    assert.equal(rr.freq, 'WEEKLY');
    assert.equal(rr.count, 10);
    assert.equal(rr.byday?.[0]?.day, 'MO');
  });

  test('RRULE with negative BYDAY: -1MO (last Monday of month)', () => {
    const ics = vevent('DTSTART:20240101T100000Z\r\nRRULE:FREQ=MONTHLY;BYDAY=-1MO');
    const e = parse(ics).events[0]!;
    const rr = e.rrules[0]!;
    assert.equal(rr.byday?.[0]?.ordwk, -1);
    assert.equal(rr.byday?.[0]?.day, 'MO');
  });

  test('RRULE with UNTIL as DATE-TIME', () => {
    const ics = vevent('DTSTART:20240101T100000Z\r\nRRULE:FREQ=DAILY;UNTIL=20241231T235959Z');
    const e = parse(ics).events[0]!;
    assert.equal(e.rrules[0]!.until?.type, 'date-time');
  });

  test('RRULE with UNTIL as DATE (common in Google Calendar)', () => {
    const ics = vevent('DTSTART;VALUE=DATE:20240101\r\nRRULE:FREQ=DAILY;UNTIL=20241231');
    const e = parse(ics).events[0]!;
    assert.equal(e.rrules[0]!.until?.type, 'date');
  });

  test('RRULE with BYSETPOS (last weekday of month)', () => {
    const ics = vevent(
      'DTSTART:20240101T100000Z\r\n' +
      'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
    );
    const e = parse(ics).events[0]!;
    assert.deepEqual(e.rrules[0]!.bysetpos, [-1]);
  });

  test('EXRULE (deprecated but widely used by older iCal producers)', () => {
    const ics = vevent(
      'DTSTART:20240101T100000Z\r\n' +
      'RRULE:FREQ=DAILY;COUNT=10\r\n' +
      'EXRULE:FREQ=DAILY;INTERVAL=2',
    );
    const e = parse(ics).events[0]!;
    // EXRULE should be preserved as a property
    assert.ok(e.getProperty('EXRULE') !== undefined);
  });

  test('EXDATE single value', () => {
    const ics = vevent(
      'DTSTART:20240101T100000Z\r\n' +
      'RRULE:FREQ=DAILY;COUNT=5\r\n' +
      'EXDATE:20240103T100000Z',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.exdates.length, 1);
  });

  test('EXDATE multiple values on one line (comma-separated)', () => {
    const ics = vevent(
      'DTSTART:20240101T100000Z\r\n' +
      'RRULE:FREQ=DAILY;COUNT=10\r\n' +
      'EXDATE:20240103T100000Z,20240105T100000Z,20240107T100000Z',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.exdates.length, 3);
  });

  test('EXDATE as DATE-only (VALUE=DATE)', () => {
    const ics = vevent(
      'DTSTART;VALUE=DATE:20240101\r\n' +
      'RRULE:FREQ=DAILY;COUNT=10\r\n' +
      'EXDATE;VALUE=DATE:20240103,20240105',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.exdates.length, 2);
    assert.equal(e.exdates[0]?.type, 'date');
  });

  test('multiple EXDATE properties (different params)', () => {
    const ics = vevent(
      'DTSTART:20240101T100000Z\r\n' +
      'RRULE:FREQ=DAILY;COUNT=10\r\n' +
      'EXDATE;TZID=UTC:20240103T100000\r\n' +
      'EXDATE;TZID=UTC:20240105T100000',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.exdates.length, 2);
  });

  test('RDATE single value', () => {
    const ics = vevent('DTSTART:20240101T100000Z\r\nRDATE:20240615T100000Z');
    const e = parse(ics).events[0]!;
    assert.equal(e.rdates.length, 1);
  });

  test('RECURRENCE-ID (exception event)', () => {
    const baseIcs = vevent(
      'DTSTART:20240101T100000Z\r\n' +
      'RRULE:FREQ=WEEKLY;COUNT=10\r\n' +
      'SUMMARY:Weekly standup',
    );
    const exceptionIcs = cal(
      'BEGIN:VEVENT\r\n' +
      'UID:test@example.com\r\n' +
      'DTSTAMP:20240101T000000Z\r\n' +
      'DTSTART:20240108T110000Z\r\n' +
      'RECURRENCE-ID:20240108T100000Z\r\n' +
      'SUMMARY:Standup (moved to 11am)\r\n' +
      'END:VEVENT',
    );
    const c = parse(exceptionIcs);
    const e = c.events[0]!;
    assert.ok(e.recurrenceId !== null);
    assert.equal(e.recurrenceId?.type, 'date-time');
  });
});

// ── Attendee and organizer ────────────────────────────────────────────────

describe('attendees and organizer', () => {
  test('single ATTENDEE', () => {
    const ics = vevent('ATTENDEE:mailto:jane@example.com');
    const e = parse(ics).events[0]!;
    assert.equal(e.attendees.length, 1);
    assert.equal(e.attendees[0]!.text, 'mailto:jane@example.com');
  });

  test('multiple ATTENDEEs', () => {
    const ics = vevent(
      'ATTENDEE;CN="Alice Smith":mailto:alice@example.com\r\n' +
      'ATTENDEE;CN="Bob Jones":mailto:bob@example.com\r\n' +
      'ATTENDEE;ROLE=OPT-PARTICIPANT:mailto:charlie@example.com',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.attendees.length, 3);
  });

  test('ATTENDEE with CN containing comma (quoted)', () => {
    const ics = vevent('ATTENDEE;CN="Smith, Jane":mailto:jane@example.com');
    const e = parse(ics).events[0]!;
    assert.equal(e.attendees[0]!.params['CN'], 'Smith, Jane');
  });

  test('ATTENDEE with multiple params (ROLE, RSVP, PARTSTAT)', () => {
    const ics = vevent(
      'ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE;PARTSTAT=ACCEPTED:mailto:x@y.com',
    );
    const e = parse(ics).events[0]!;
    const a = e.attendees[0]!;
    assert.equal(a.params['ROLE'], 'REQ-PARTICIPANT');
    assert.equal(a.params['RSVP'], 'TRUE');
    assert.equal(a.params['PARTSTAT'], 'ACCEPTED');
  });

  test('ORGANIZER', () => {
    const ics = vevent('ORGANIZER;CN="Boss":mailto:boss@example.com');
    const e = parse(ics).events[0]!;
    assert.equal(e.organizer, 'mailto:boss@example.com');
  });
});

// ── CATEGORIES ────────────────────────────────────────────────────────────

describe('categories', () => {
  test('single category', () => {
    const ics = vevent('CATEGORIES:WORK');
    const e = parse(ics).events[0]!;
    assert.equal(e.categories.length, 1);
    assert.equal(e.categories[0], 'WORK');
  });

  test('multiple categories on one line', () => {
    const ics = vevent('CATEGORIES:APPOINTMENT,EDUCATION,HOLIDAY');
    const e = parse(ics).events[0]!;
    assert.equal(e.categories.length, 3);
    assert.deepEqual(e.categories, ['APPOINTMENT', 'EDUCATION', 'HOLIDAY']);
  });

  test('categories with escaped comma in a value', () => {
    // A category can contain a literal comma if it's backslash-escaped
    // This is rare but spec-compliant
    const ics = vevent('CATEGORIES:Rock\\, Roll,Jazz');
    const e = parse(ics).events[0]!;
    // 'Rock, Roll' and 'Jazz' are two categories
    assert.equal(e.categories.length, 2);
    assert.equal(e.categories[0], 'Rock, Roll');
  });
});

// ── VTIMEZONE ─────────────────────────────────────────────────────────────

describe('VTIMEZONE', () => {
  test('parse VTIMEZONE with STANDARD and DAYLIGHT', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'BEGIN:STANDARD',
      'DTSTART:19671029T020000',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'TZNAME:EST',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:19870405T020000',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'TZNAME:EDT',
      'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.timezones.length, 1);
    const tz = c.timezones[0]!;
    assert.equal(tz.tzid, 'America/New_York');
    assert.equal(tz.standardRules.length, 1);
    assert.equal(tz.daylightRules.length, 1);
    assert.equal(tz.standardRules[0]!.tzname, 'EST');
    assert.equal(tz.daylightRules[0]!.tzname, 'EDT');
    assert.ok(tz.daylightRules[0]!.rrule !== null);
  });

  test('VTIMEZONE tzoffsetfrom/tzoffsetto parsed as UTC-OFFSET', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//X//EN',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/London',
      'BEGIN:STANDARD',
      'DTSTART:19961027T010000',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const std = c.timezones[0]!.standardRules[0]!;
    assert.equal(std.tzoffsetfrom?.sign, '+');
    assert.equal(std.tzoffsetfrom?.hours, 1);
    assert.equal(std.tzoffsetto?.sign, '+');
    assert.equal(std.tzoffsetto?.hours, 0);
  });
});

// ── VALARM ────────────────────────────────────────────────────────────────

describe('VALARM', () => {
  test('AUDIO alarm inside VEVENT', () => {
    const ics = vevent(
      'DTSTART:20240101T100000Z\r\n' +
      'BEGIN:VALARM\r\nACTION:AUDIO\r\nTRIGGER:-PT15M\r\nEND:VALARM',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.alarms.length, 1);
    assert.equal(e.alarms[0]!.action, 'AUDIO');
    const trigger = e.alarms[0]!.trigger;
    assert.equal(trigger?.type, 'duration');
    if (trigger?.type === 'duration') {
      assert.equal(trigger.negative, true);
      assert.equal(trigger.minutes, 15);
    }
  });

  test('DISPLAY alarm with DESCRIPTION', () => {
    const ics = vevent(
      'BEGIN:VALARM\r\n' +
      'ACTION:DISPLAY\r\n' +
      'TRIGGER:-PT30M\r\n' +
      'DESCRIPTION:Reminder\r\n' +
      'END:VALARM',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.alarms[0]!.description, 'Reminder');
  });

  test('EMAIL alarm with absolute TRIGGER (DATE-TIME)', () => {
    const ics = vevent(
      'BEGIN:VALARM\r\n' +
      'ACTION:EMAIL\r\n' +
      'TRIGGER;VALUE=DATE-TIME:20240101T090000Z\r\n' +
      'DESCRIPTION:Email reminder\r\n' +
      'SUMMARY:Alarm\r\n' +
      'ATTENDEE:mailto:a@b.com\r\n' +
      'END:VALARM',
    );
    const e = parse(ics).events[0]!;
    const alarm = e.alarms[0]!;
    const trigger = alarm.trigger;
    assert.equal(trigger?.type, 'date-time');
  });

  test('multiple VALARMs', () => {
    const ics = vevent(
      'BEGIN:VALARM\r\nACTION:AUDIO\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\n' +
      'BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT5M\r\nDESCRIPTION:Soon!\r\nEND:VALARM',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.alarms.length, 2);
  });
});

// ── Real-world vendor quirks ──────────────────────────────────────────────

describe('vendor quirks — Apple iCal / macOS Calendar', () => {
  test('X-WR-CALNAME property on VCALENDAR', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Apple Inc.//macOS 14.0//EN',
      'X-WR-CALNAME:Work',
      'X-WR-TIMEZONE:America/Los_Angeles',
      'BEGIN:VEVENT',
      'UID:apple-event@example.com',
      'DTSTAMP:20240101T000000Z',
      'SUMMARY:Apple Event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.ok(c.getProperty('X-WR-CALNAME') !== undefined);
    assert.equal(c.getProperty('X-WR-CALNAME')!.text, 'Work');
    assert.equal(c.events[0]!.summary, 'Apple Event');
  });

  test('Apple: date-only events (no time component)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Apple Inc.//macOS//EN',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20240315',
      'DTEND;VALUE=DATE:20240316',
      'SUMMARY:All Day Event',
      'UID:alldayapple@example.com',
      'DTSTAMP:20240101T000000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const e = c.events[0]!;
    assert.equal(e.dtstart?.type, 'date');
    assert.equal(e.summary, 'All Day Event');
  });

  test('Apple: X-APPLE-STRUCTURED-LOCATION', () => {
    const ics = vevent(
      'LOCATION:Apple Park\r\n' +
      'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="1 Apple Park Way\\, Cupertino\\, CA";' +
      'X-TITLE="Apple Park":geo:37.334507,-122.009162',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.location, 'Apple Park');
    assert.ok(e.getProperty('X-APPLE-STRUCTURED-LOCATION') !== undefined);
  });
});

describe('vendor quirks — Google Calendar', () => {
  test('Google: X-GOOGLE-CALENDAR-CONTENT-TITLE', () => {
    const ics = vevent('X-GOOGLE-CALENDAR-CONTENT-TITLE:Some Title');
    const e = parse(ics).events[0]!;
    assert.ok(e.getProperty('X-GOOGLE-CALENDAR-CONTENT-TITLE') !== undefined);
  });

  test('Google: DTSTART with TZID in VEVENT', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
      'BEGIN:VEVENT',
      'DTSTART;TZID=America/Los_Angeles:20240315T090000',
      'DTEND;TZID=America/Los_Angeles:20240315T100000',
      'SUMMARY:Google Event',
      'UID:google-event@google.com',
      'DTSTAMP:20240101T000000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const e = c.events[0]!;
    assert.equal(e.dtstart?.type, 'date-time');
    if (e.dtstart?.type === 'date-time') {
      assert.equal(e.dtstart.tzid, 'America/Los_Angeles');
    }
  });

  test('Google: RRULE with EXDATE in same calendar', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Google//EN',
      'BEGIN:VEVENT',
      'DTSTART:20240101T100000Z',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE:20240108T100000Z',
      'SUMMARY:Weekly meeting',
      'UID:google-recurring@google.com',
      'DTSTAMP:20240101T000000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const e = c.events[0]!;
    assert.equal(e.rrules.length, 1);
    assert.equal(e.exdates.length, 1);
  });
});

describe('vendor quirks — Microsoft Outlook', () => {
  test('Outlook: missing DTSTAMP (older format)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN',
      'BEGIN:VEVENT',
      'UID:outlook-event@outlook.com',
      'DTSTART:20240315T090000Z',
      'DTEND:20240315T100000Z',
      'SUMMARY:Outlook Meeting',
      // No DTSTAMP — Outlook sometimes omits this
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.events[0]!.summary, 'Outlook Meeting');
    assert.equal(c.events[0]!.dtstamp, null); // missing but parse succeeds
  });

  test('Outlook: X-MICROSOFT-CDO-IMPORTANCE', () => {
    const ics = vevent(
      'X-MICROSOFT-CDO-IMPORTANCE:2\r\n' +
      'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
    );
    const e = parse(ics).events[0]!;
    assert.ok(e.getProperty('X-MICROSOFT-CDO-IMPORTANCE') !== undefined);
    assert.ok(e.getProperty('X-MICROSOFT-CDO-BUSYSTATUS') !== undefined);
  });

  test('Outlook: X-ALT-DESC for HTML content', () => {
    const ics = vevent(
      'DESCRIPTION:Plain text description\r\n' +
      'X-ALT-DESC;FMTTYPE=text/html:<html><body><b>Rich</b> text</body></html>',
    );
    const e = parse(ics).events[0]!;
    assert.equal(e.description, 'Plain text description');
    assert.ok(e.getProperty('X-ALT-DESC') !== undefined);
  });

  test('Outlook: METHOD:REQUEST in calendar (common for meeting invites)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Microsoft//EN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      'UID:invite@microsoft.com',
      'DTSTAMP:20240101T000000Z',
      'DTSTART:20240315T140000Z',
      'DTEND:20240315T150000Z',
      'SUMMARY:Meeting Invite',
      'ORGANIZER:mailto:boss@corp.com',
      'ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:you@corp.com',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.method, 'REQUEST');
    assert.equal(c.events[0]!.attendees.length, 1);
  });

  test('Outlook: ENCODING=QUOTED-PRINTABLE param (non-standard) — tolerated', () => {
    // Outlook 2003 and earlier emitted this non-standard encoding
    // We don't decode it, but we should not crash
    const ics = vevent(
      'DESCRIPTION;ENCODING=QUOTED-PRINTABLE:Caf=E9',
    );
    assert.doesNotThrow(() => parse(ics));
  });
});

describe('vendor quirks — Thunderbird / Lightning', () => {
  test('Thunderbird: long DESCRIPTION with line folding', () => {
    const longDesc =
      'This is a very long description that should be folded across multiple lines ' +
      'by the producer and then unfolded by the parser correctly.';
    // Simulate folded output (75 chars + continuation)
    let folded = 'DESCRIPTION:';
    const full = longDesc;
    folded += full.slice(0, 63); // 12 + 63 = 75
    folded += '\r\n ';
    folded += full.slice(63);
    const ics = vevent(folded);
    const e = parse(ics).events[0]!;
    assert.equal(e.description, longDesc);
  });
});

// ── RFC 5545 official examples ────────────────────────────────────────────

describe('RFC 5545 official examples', () => {
  test('§3.6.1 VEVENT example — timezone-based event', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'PRODID:-//xyz Corp//NONSGML PDA Calendar Version 1.0//EN',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTAMP:19960704T120000Z',
      'UID:uid1@example.com',
      'ORGANIZER:mailto:jsmith@example.com',
      'DTSTART:19960918T143000Z',
      'DTEND:19960920T220000Z',
      'STATUS:CONFIRMED',
      'CATEGORIES:CONFERENCE',
      'SUMMARY:Networld+Interop Conference',
      'DESCRIPTION:Networld+Interop Conference and Exhibit\\nAtlanta World Congress Center\\nAtlanta\\, Georgia',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const e = c.events[0]!;
    assert.equal(e.uid, 'uid1@example.com');
    assert.equal(e.status, 'CONFIRMED');
    assert.equal(e.categories[0], 'CONFERENCE');
    assert.ok(e.description!.includes('Atlanta, Georgia'));
  });

  test('§3.6.2 VTODO example', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ABC Corporation//NONSGML My Product//EN',
      'BEGIN:VTODO',
      'DTSTAMP:19980130T134500Z',
      'SEQUENCE:2',
      'UID:uid4@example.com',
      'ORGANIZER:mailto:unclesam@example.com',
      'ATTENDEE;PARTSTAT=ACCEPTED:mailto:jqpublic@example.com',
      'DUE:19980415T000000',
      'STATUS:NEEDS-ACTION',
      'SUMMARY:Submit Income Taxes',
      'BEGIN:VALARM',
      'ACTION:AUDIO',
      'TRIGGER:19980403T120000Z',
      'END:VALARM',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const t = c.todos[0]!;
    assert.equal(t.uid, 'uid4@example.com');
    assert.equal(t.status, 'NEEDS-ACTION');
    assert.equal(t.sequence, 2);
    assert.equal(t.alarms.length, 1);
  });

  test('§3.6.3 VJOURNAL example', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ABC Corporation//NONSGML My Product//EN',
      'BEGIN:VJOURNAL',
      'DTSTAMP:19970324T120000Z',
      'UID:uid5@example.com',
      'ORGANIZER:mailto:jsmith@example.com',
      'STATUS:DRAFT',
      'CLASS:PUBLIC',
      'CATEGORIES:Project Report\\,Weekly Meeting',
      'DESCRIPTION:Project xyz Review Meeting Minutes\\nAgenda\\n1. The market looked good.',
      'END:VJOURNAL',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const j = c.journals[0]!;
    assert.equal(j.status, 'DRAFT');
    assert.equal(j.klass, 'PUBLIC');
  });

  test('§3.6.5 VTIMEZONE example — US Eastern', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'PRODID:-//RDU Software//NONSGML HandMade Software//EN',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'LAST-MODIFIED:20050809T050000Z',
      'BEGIN:STANDARD',
      'DTSTART:19671029T020000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'TZNAME:EST',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:19870405T020000',
      'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'TZNAME:EDT',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'DTSTART;TZID=America/New_York:19980312T083000',
      'DTEND;TZID=America/New_York:19980312T093000',
      'SUMMARY:Staff Meeting',
      'UID:tz-aware@example.com',
      'DTSTAMP:19980130T000000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    const tz = c.timezones[0]!;
    assert.equal(tz.tzid, 'America/New_York');

    const e = c.events[0]!;
    if (e.dtstart?.type === 'date-time') {
      assert.equal(e.dtstart.tzid, 'America/New_York');
      assert.equal(e.dtstart.hour, 8);
      assert.equal(e.dtstart.minute, 30);
    }
  });
});

// ── GEO property ──────────────────────────────────────────────────────────

describe('GEO property', () => {
  test('parsed as latitude/longitude', () => {
    const ics = vevent('GEO:37.386013;-122.082932');
    const e = parse(ics).events[0]!;
    const geo = e.geo;
    assert.ok(geo !== null);
    assert.ok(Math.abs(geo!.latitude - 37.386013) < 0.000001);
    assert.ok(Math.abs(geo!.longitude - (-122.082932)) < 0.000001);
  });
});

// ── Calendar lookup helpers ───────────────────────────────────────────────

describe('Calendar helpers', () => {
  test('getByUid finds event', () => {
    const ics = vevent('SUMMARY:Found me');
    const c = parse(ics);
    const found = c.getByUid('test@example.com');
    assert.ok(found instanceof Event);
    assert.equal((found as Event).summary, 'Found me');
  });

  test('getByUid returns undefined for unknown UID', () => {
    const ics = vevent('SUMMARY:test');
    const c = parse(ics);
    assert.equal(c.getByUid('nonexistent@x.com'), undefined);
  });

  test('getTimezone finds by TZID', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//X//EN',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Berlin',
      'BEGIN:STANDARD',
      'DTSTART:19971026T030000',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'END:STANDARD',
      'END:VTIMEZONE',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.ok(c.getTimezone('Europe/Berlin') !== undefined);
    assert.equal(c.getTimezone('Not/Found'), undefined);
  });
});

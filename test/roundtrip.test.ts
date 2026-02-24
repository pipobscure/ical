/**
 * Round-trip tests: parse → serialize → parse → assert same structure.
 *
 * These tests are the gold standard for correctness — if a value survives
 * two parse passes with the same result, both the parser and serializer
 * are internally consistent.
 *
 * Also includes "wild" ICS samples that are real-world typical feeds.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Calendar, Event, Alarm } from '../dist/index.js';

// ── Round-trip helpers ────────────────────────────────────────────────────

function roundtrip(ics: string): Calendar {
  return parse(parse(ics).toString());
}

// ── Basic round-trips ─────────────────────────────────────────────────────

describe('basic round-trip', () => {
  test('minimal valid calendar', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-minimal@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.summary = 'Minimal';
    cal.addEvent(e);
    const reparsed = roundtrip(cal.toString());
    assert.equal(reparsed.events[0]!.summary, 'Minimal');
    assert.equal(reparsed.events[0]!.uid, 'rt-minimal@test.com');
  });

  test('event with all common scalar properties', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-full@test.com';
    e.dtstamp    = new Date('2024-01-01T00:00:00Z');
    e.dtstart    = new Date('2024-06-15T14:00:00Z');
    e.dtend      = new Date('2024-06-15T15:30:00Z');
    e.summary    = 'Full event, with comma; and semicolon';
    e.description = 'Multi-line\ndescription with special chars: \\backslash';
    e.location   = 'Room 42; Building C, Floor 3';
    e.url        = 'https://example.com/events?id=42';
    e.status     = 'CONFIRMED';
    e.transp     = 'OPAQUE';
    e.klass      = 'PRIVATE';
    e.priority   = 5;
    e.sequence   = 3;
    e.organizer  = 'mailto:boss@example.com';
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const e2 = c2.events[0]!;
    assert.equal(e2.summary, 'Full event, with comma; and semicolon');
    assert.equal(e2.description, 'Multi-line\ndescription with special chars: \\backslash');
    assert.equal(e2.location, 'Room 42; Building C, Floor 3');
    assert.equal(e2.url, 'https://example.com/events?id=42');
    assert.equal(e2.status, 'CONFIRMED');
    assert.equal(e2.klass, 'PRIVATE');
    assert.equal(e2.priority, 5);
    assert.equal(e2.sequence, 3);
    assert.equal(e2.organizer, 'mailto:boss@example.com');
  });

  test('DATE-only all-day event', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-allday@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.dtstart = { type: 'date', year: 2024, month: 12, day: 25 };
    e.dtend   = { type: 'date', year: 2024, month: 12, day: 26 };
    e.summary = 'Christmas Day';
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const dt = c2.events[0]!.dtstart;
    assert.equal(dt?.type, 'date');
    if (dt?.type === 'date') {
      assert.equal(dt.year, 2024);
      assert.equal(dt.month, 12);
      assert.equal(dt.day, 25);
    }
  });

  test('event with GEO', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-geo@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.geo = { type: 'geo', latitude: 48.8566, longitude: 2.3522 };
    cal.addEvent(e);
    const c2 = roundtrip(cal.toString());
    const geo = c2.events[0]!.geo;
    assert.ok(Math.abs(geo!.latitude - 48.8566) < 0.0001);
    assert.ok(Math.abs(geo!.longitude - 2.3522) < 0.0001);
  });
});

// ── RRULE round-trips ─────────────────────────────────────────────────────

describe('RRULE round-trip', () => {
  test('weekly with COUNT', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-rrule-weekly@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.dtstart = new Date('2024-01-01T10:00:00Z');
    e.addRrule({ type: 'recur', freq: 'WEEKLY', byday: [{ day: 'MO' }, { day: 'WE' }], count: 10 });
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const rr = c2.events[0]!.rrules[0]!;
    assert.equal(rr.freq, 'WEEKLY');
    assert.equal(rr.count, 10);
    assert.equal(rr.byday?.length, 2);
    assert.deepEqual(rr.byday?.map((d) => d.day), ['MO', 'WE']);
  });

  test('monthly with negative BYDAY (-1MO)', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-rrule-monthly@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.dtstart = new Date('2024-01-29T10:00:00Z'); // last Monday
    e.addRrule({ type: 'recur', freq: 'MONTHLY', byday: [{ day: 'MO', ordwk: -1 }] });
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const rr = c2.events[0]!.rrules[0]!;
    assert.equal(rr.byday?.[0]?.ordwk, -1);
    assert.equal(rr.byday?.[0]?.day, 'MO');
  });

  test('yearly with BYMONTH and BYDAY', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-rrule-yearly@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.dtstart = new Date('2024-06-17T10:00:00Z');
    e.addRrule({
      type: 'recur',
      freq: 'YEARLY',
      bymonth: [6],
      byday: [{ day: 'MO', ordwk: 3 }],
    });
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const rr = c2.events[0]!.rrules[0]!;
    assert.equal(rr.freq, 'YEARLY');
    assert.deepEqual(rr.bymonth, [6]);
    assert.equal(rr.byday?.[0]?.ordwk, 3);
  });

  test('with UNTIL as DATE-TIME', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-rrule-until@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.dtstart = new Date('2024-01-01T10:00:00Z');
    e.addRrule({
      type: 'recur',
      freq: 'DAILY',
      until: {
        type: 'date-time',
        year: 2024, month: 12, day: 31,
        hour: 10, minute: 0, second: 0,
        utc: true,
      },
    });
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const rr = c2.events[0]!.rrules[0]!;
    assert.equal(rr.until?.type, 'date-time');
    if (rr.until?.type === 'date-time') {
      assert.equal(rr.until.year, 2024);
      assert.equal(rr.until.month, 12);
      assert.equal(rr.until.day, 31);
    }
  });

  test('with EXDATE list', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-exdate@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.dtstart = new Date('2024-01-01T10:00:00Z');
    e.addRrule({ type: 'recur', freq: 'DAILY', count: 10 });
    e.addExdate({ type: 'date-time', year: 2024, month: 1, day: 3, hour: 10, minute: 0, second: 0, utc: true });
    e.addExdate({ type: 'date-time', year: 2024, month: 1, day: 5, hour: 10, minute: 0, second: 0, utc: true });
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const e2 = c2.events[0]!;
    assert.equal(e2.exdates.length, 2);
  });
});

// ── Attendees round-trip ──────────────────────────────────────────────────

describe('attendees round-trip', () => {
  test('ATTENDEE with CN and PARTSTAT', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-attendee@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.addAttendee('mailto:alice@example.com', {
      CN: 'Alice Smith',
      PARTSTAT: 'ACCEPTED',
      ROLE: 'REQ-PARTICIPANT',
    });
    e.addAttendee('mailto:bob@example.com', { CN: 'Bob Jones', RSVP: 'TRUE' });
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const attendees = c2.events[0]!.attendees;
    assert.equal(attendees.length, 2);
    assert.equal(attendees[0]!.text, 'mailto:alice@example.com');
    assert.equal(attendees[1]!.text, 'mailto:bob@example.com');
  });
});

// ── VALARM round-trip ─────────────────────────────────────────────────────

describe('VALARM round-trip', () => {
  test('DISPLAY alarm inside VEVENT', () => {
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'rt-alarm@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.dtstart = new Date('2024-06-01T10:00:00Z');
    const alarm = new Alarm();
    alarm.action = 'DISPLAY';
    alarm.trigger = { type: 'duration', negative: true, minutes: 30 };
    alarm.description = 'Don\'t forget!';
    e.addAlarm(alarm);
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    const a2 = c2.events[0]!.alarms[0]!;
    assert.equal(a2.action, 'DISPLAY');
    assert.equal(a2.description, "Don't forget!");
    const t = a2.trigger;
    assert.equal(t?.type, 'duration');
    if (t?.type === 'duration') {
      assert.equal(t.negative, true);
      assert.equal(t.minutes, 30);
    }
  });
});

// ── Wild ICS samples (real-world typical) ────────────────────────────────

describe('wild real-world ICS samples', () => {
  test('Google Calendar typical export', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Work Events',
      'X-WR-TIMEZONE:America/Los_Angeles',
      'X-WR-CALDESC:My work calendar',
      'BEGIN:VTIMEZONE',
      'TZID:America/Los_Angeles',
      'X-LIC-LOCATION:America/Los_Angeles',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0800',
      'TZOFFSETTO:-0700',
      'TZNAME:PDT',
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0800',
      'TZNAME:PST',
      'DTSTART:19701101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'DTSTART;TZID=America/Los_Angeles:20240315T090000',
      'DTEND;TZID=America/Los_Angeles:20240315T100000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE;TZID=America/Los_Angeles:20240325T090000',
      'DTSTAMP:20240101T000000Z',
      'ORGANIZER;CN=Alice:mailto:alice@company.com',
      'UID:google-typical@google.com',
      'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Bob:mailto:bob@company.com',
      'CREATED:20240101T000000Z',
      'DESCRIPTION:Weekly team sync.\\n\\nAgenda:\\n1. Updates\\n2. Blockers',
      'LAST-MODIFIED:20240110T000000Z',
      'LOCATION:Conference Room A\\, Building 2',
      'SEQUENCE:0',
      'STATUS:CONFIRMED',
      'SUMMARY:Weekly Standup',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.method, 'PUBLISH');
    assert.equal(c.calscale, 'GREGORIAN');
    assert.equal(c.timezones.length, 1);
    assert.equal(c.events.length, 1);

    const e = c.events[0]!;
    assert.equal(e.summary, 'Weekly Standup');
    assert.equal(e.location, 'Conference Room A, Building 2');
    assert.ok(e.description!.includes('Weekly team sync.'));
    assert.ok(e.description!.includes('Updates'));
    assert.equal(e.status, 'CONFIRMED');
    assert.equal(e.rrules.length, 1);
    assert.equal(e.exdates.length, 1);
    assert.equal(e.attendees.length, 1);
    assert.equal(e.attendees[0]!.params['CN'], 'Bob');

    // Round-trip
    const c2 = roundtrip(ics);
    assert.equal(c2.events[0]!.summary, 'Weekly Standup');
  });

  test('Apple Calendar typical export', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Apple Inc.//macOS 14.0//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'CREATED:20240101T000000Z',
      'DTEND;VALUE=DATE:20240316',
      'DTSTAMP:20240101T000000Z',
      'DTSTART;VALUE=DATE:20240315',
      'LAST-MODIFIED:20240101T000000Z',
      'SEQUENCE:0',
      'SUMMARY:Pi Day Observed',
      'TRANSP:TRANSPARENT',
      'UID:apple-allday@icloud.com',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'CREATED:20240101T000000Z',
      'DTEND:20240315T110000Z',
      'DTSTAMP:20240101T000000Z',
      'DTSTART:20240315T100000Z',
      'GEO:37.331690;-122.030780',
      'LAST-MODIFIED:20240101T000000Z',
      'LOCATION:1 Infinite Loop\\, Cupertino\\, CA 95014',
      'SEQUENCE:0',
      'SUMMARY:Offsite Meeting',
      'UID:apple-geo@icloud.com',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.events.length, 2);

    const allDay = c.events.find((e) => e.uid === 'apple-allday@icloud.com')!;
    assert.equal(allDay.dtstart?.type, 'date');
    assert.equal(allDay.transp, 'TRANSPARENT');

    const offsite = c.events.find((e) => e.uid === 'apple-geo@icloud.com')!;
    assert.equal(offsite.location, '1 Infinite Loop, Cupertino, CA 95014');
    assert.ok(offsite.geo !== null);
  });

  test('Outlook meeting invite (METHOD:REQUEST)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'METHOD:REQUEST',
      'PRODID:Microsoft Exchange Server 2010',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:Eastern Standard Time',
      'BEGIN:STANDARD',
      'DTSTART:16010101T030000',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=10',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:16010101T020000',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=3',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'ORGANIZER;CN="Philipp Dunkel":mailto:pip@example.com',
      'ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="Jane Doe":mailto:jane@example.com',
      'DESCRIPTION;LANGUAGE=en-US:Please join this meeting.',
      'SUMMARY;LANGUAGE=en-US:Project Review',
      'DTSTART;TZID="Eastern Standard Time":20240315T140000',
      'DTEND;TZID="Eastern Standard Time":20240315T150000',
      'UID:outlook-invite@outlook.com',
      'CLASS:PUBLIC',
      'PRIORITY:5',
      'DTSTAMP:20240301T000000Z',
      'TRANSP:OPAQUE',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
      'X-MICROSOFT-CDO-IMPORTANCE:1',
      'X-MICROSOFT-DISALLOW-COUNTER:FALSE',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.method, 'REQUEST');
    const e = c.events[0]!;
    assert.equal(e.summary, 'Project Review');
    assert.equal(e.priority, 5);
    assert.equal(e.status, 'CONFIRMED');
    assert.equal(e.attendees.length, 1);
    assert.equal(e.attendees[0]!.params['CN'], 'Jane Doe'); // quotes stripped by parser
    assert.ok(e.getProperty('X-MICROSOFT-CDO-BUSYSTATUS') !== undefined);
  });

  test('Thunderbird recurring event with exceptions', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN',
      'BEGIN:VEVENT',
      'CREATED:20240101T000000Z',
      'LAST-MODIFIED:20240115T000000Z',
      'DTSTAMP:20240115T000000Z',
      'UID:thunderbird-recurring@mozilla.org',
      'SUMMARY:Weekly Team Meeting',
      'DTSTART:20240101T150000Z',
      'DURATION:PT1H',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'EXDATE:20240108T150000Z',
      'SEQUENCE:1',
      'END:VEVENT',
      // Exception: week 3 moved to different time
      'BEGIN:VEVENT',
      'CREATED:20240110T000000Z',
      'LAST-MODIFIED:20240110T000000Z',
      'DTSTAMP:20240110T000000Z',
      'UID:thunderbird-recurring@mozilla.org',
      'RECURRENCE-ID:20240115T150000Z',
      'SUMMARY:Weekly Team Meeting (rescheduled)',
      'DTSTART:20240115T160000Z',
      'DURATION:PT1H',
      'SEQUENCE:1',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.events.length, 2);

    // Base event
    const base = c.events.find((e) => e.recurrenceId === null)!;
    assert.equal(base.summary, 'Weekly Team Meeting');
    assert.equal(base.rrules.length, 1);
    assert.equal(base.exdates.length, 1);
    assert.ok(base.duration !== null);

    // Exception
    const exc = c.events.find((e) => e.recurrenceId !== null)!;
    assert.equal(exc.summary, 'Weekly Team Meeting (rescheduled)');
    assert.ok(exc.recurrenceId !== null);
  });

  test('Free/busy response', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RDU Software//NONSGML HandMade Software//EN',
      'METHOD:REPLY',
      'BEGIN:VFREEBUSY',
      'ORGANIZER:mailto:jane_doe@example.com',
      'ATTENDEE:mailto:john_public@example.com',
      'DTSTART:19971015T050000Z',
      'DTEND:19971016T050000Z',
      'DTSTAMP:19970901T083000Z',
      'UID:freebusy@example.com',
      'FREEBUSY;FBTYPE=BUSY-UNAVAILABLE:19971015T133000Z/PT8H30M',
      'FREEBUSY;FBTYPE=FREE:19971015T050000Z/PT3H',
      'END:VFREEBUSY',
      'END:VCALENDAR',
    ].join('\r\n');

    const c = parse(ics);
    assert.equal(c.freebusys.length, 1);
    const fb = c.freebusys[0]!;
    assert.equal(fb.uid, 'freebusy@example.com');
    assert.equal(fb.freebusyProperties.length, 2);
    assert.equal(fb.periods.length, 2);
  });

  test('Calendar with long base64 ATTACH (BINARY)', () => {
    // A small PNG in base64 (1x1 red pixel PNG)
    const png1x1 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VEVENT',
      'UID:attach@test.com',
      'DTSTAMP:20240101T000000Z',
      'SUMMARY:Event with attachment',
      `ATTACH;ENCODING=BASE64;VALUE=BINARY;FMTTYPE=image/png:${png1x1}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // Should parse without crashing
    const c = parse(ics);
    assert.equal(c.events[0]!.summary, 'Event with attachment');
    const attach = c.events[0]!.getProperty('ATTACH');
    assert.ok(attach !== undefined);
  });

  test('VCALENDAR with no events (empty feed)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'X-WR-CALNAME:Empty Calendar',
      'END:VCALENDAR',
    ].join('\r\n');
    const c = parse(ics);
    assert.equal(c.events.length, 0);
    assert.equal(c.todos.length, 0);
    assert.equal(c.journals.length, 0);
  });

  test('very long DESCRIPTION survives round-trip', () => {
    const longDesc = 'This is a long description. '.repeat(20).trim();
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'long-desc@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.description = longDesc;
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    assert.equal(c2.events[0]!.description, longDesc);
  });

  test('Unicode-heavy SUMMARY survives round-trip', () => {
    const summary = '会議: 😀 café rendezvous أهلاً вернуться';
    const cal = Calendar.create('-//Test//EN');
    const e = new Event();
    e.uid = 'unicode@test.com';
    e.dtstamp = new Date('2024-01-01T00:00:00Z');
    e.summary = summary;
    cal.addEvent(e);

    const c2 = roundtrip(cal.toString());
    assert.equal(c2.events[0]!.summary, summary);
  });
});

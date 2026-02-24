/**
 * Serializer strict-mode tests.
 *
 * Verifies:
 *  - CRLF line endings
 *  - 75-octet line folding (ASCII and UTF-8)
 *  - TEXT value escaping
 *  - DATE-only DTSTART adds VALUE=DATE param
 *  - Required-property validation throws on toString()
 *  - ALARM validation
 *  - VTIMEZONE validation
 *  - Params are serialized correctly (quoting, ordering)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Calendar,
  Event,
  Todo,
  Journal,
  FreeBusy,
  Alarm,
  Timezone,
  Standard,
  Daylight,
} from '../dist/index.js';
import type { ICalDateTime, ICalDuration } from '../dist/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEvent(): Event {
  const e = new Event();
  e.uid = 'test@example.com';
  e.dtstamp = new Date('2024-01-01T00:00:00Z');
  return e;
}

function makeCal(): Calendar {
  return Calendar.create('-//Test//Test//EN');
}

// ── Line endings ──────────────────────────────────────────────────────────

describe('line endings', () => {
  test('output always uses CRLF', () => {
    const cal = makeCal();
    const out = cal.toString();
    // Every line break must be \r\n
    assert.ok(out.includes('\r\n'));
    // No bare LF
    const nocrLF = out.replace(/\r\n/g, '');
    assert.ok(!nocrLF.includes('\n'));
  });

  test('BEGIN and END lines use CRLF', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'Test';
    cal.addEvent(e);
    const lines = cal.toString().split('\r\n');
    assert.equal(lines[0], 'BEGIN:VCALENDAR');
    assert.equal(lines[lines.length - 1], 'END:VCALENDAR'); // no trailing CRLF
  });
});

// ── Line folding ──────────────────────────────────────────────────────────

describe('line folding', () => {
  test('lines ≤ 75 octets are not folded', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'Short';
    cal.addEvent(e);
    const lines = cal.toString().split('\r\n');
    const summaryLine = lines.find((l) => l.startsWith('SUMMARY:'))!;
    assert.ok(summaryLine.length <= 75);
    assert.ok(!summaryLine.startsWith(' '));
  });

  test('line > 75 octets (ASCII) is folded at 75', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'A'.repeat(80);
    cal.addEvent(e);
    const out = cal.toString();
    const lines = out.split('\r\n');
    const summaryLine = lines.find((l) => l.startsWith('SUMMARY:'))!;
    assert.equal(summaryLine.length, 75);
    const continuation = lines[lines.indexOf(summaryLine) + 1]!;
    assert.ok(continuation.startsWith(' '));
  });

  test('folded line: first chunk is exactly 75 octets', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'X'.repeat(100);
    cal.addEvent(e);
    const lines = cal.toString().split('\r\n');
    const idx = lines.findIndex((l) => l.startsWith('SUMMARY:'));
    assert.equal(Buffer.byteLength(lines[idx]!, 'utf8'), 75);
  });

  test('continuation lines start with single SPACE', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'B'.repeat(200);
    cal.addEvent(e);
    const lines = cal.toString().split('\r\n');
    const idx = lines.findIndex((l) => l.startsWith('SUMMARY:'));
    // Lines after the first should all start with ' '
    let i = idx + 1;
    while (i < lines.length && lines[i]!.startsWith(' ')) {
      assert.equal(lines[i]![0], ' ');
      i++;
    }
    assert.ok(i > idx + 1, 'expected at least one continuation line');
  });

  test('UTF-8 multi-byte: folds at octet boundary, not char boundary', () => {
    const cal = makeCal();
    const e = makeEvent();
    // '会' is U+4F1A = 3 bytes; use enough to force folding
    e.summary = '会'.repeat(30); // 30 × 3 = 90 bytes
    cal.addEvent(e);
    const lines = cal.toString().split('\r\n');
    const idx = lines.findIndex((l) => l.startsWith('SUMMARY:'));
    const firstChunk = lines[idx]!;
    // First line must be ≤ 75 bytes
    assert.ok(Buffer.byteLength(firstChunk, 'utf8') <= 75);
    // Continuation must exist
    assert.ok(lines[idx + 1]!.startsWith(' '));
    // Reconstruct value and verify no corruption
    let reconstructed = firstChunk.slice('SUMMARY:'.length);
    let j = idx + 1;
    while (j < lines.length && lines[j]!.startsWith(' ')) {
      reconstructed += lines[j]!.slice(1);
      j++;
    }
    assert.equal(reconstructed, '会'.repeat(30));
  });

  test('emoji (4-byte UTF-8) folds correctly', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = '🎉'.repeat(20); // 20 × 4 = 80 bytes
    cal.addEvent(e);
    const lines = cal.toString().split('\r\n');
    const idx = lines.findIndex((l) => l.startsWith('SUMMARY:'));
    const firstLen = Buffer.byteLength(lines[idx]!, 'utf8');
    assert.ok(firstLen <= 75, `first line ${firstLen} bytes > 75`);
    // Verify roundtrip via manual unfolding
    let raw = lines[idx]!.slice('SUMMARY:'.length);
    let j = idx + 1;
    while (j < lines.length && lines[j]!.startsWith(' ')) {
      raw += lines[j]!.slice(1);
      j++;
    }
    assert.equal(raw, '🎉'.repeat(20));
  });

  test('DESCRIPTION with multiline content folds each segment', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.description = 'Line 1\nLine 2\nLine 3 with lots of padding padding padding padding padding more';
    cal.addEvent(e);
    const out = cal.toString();
    // No line should exceed 75 bytes
    for (const line of out.split('\r\n')) {
      assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `Line too long: ${line}`);
    }
  });
});

// ── TEXT escaping ─────────────────────────────────────────────────────────

describe('TEXT serialization escaping', () => {
  test('SUMMARY: comma is escaped', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'A, B, C';
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('SUMMARY:A\\,'));
  });

  test('SUMMARY: semicolon is escaped', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'A; B; C';
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('\\;'));
  });

  test('SUMMARY: backslash is escaped', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.summary = 'C:\\Windows\\System32';
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('C:\\\\Windows\\\\System32'));
  });

  test('DESCRIPTION: newline → \\n', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.description = 'Line 1\nLine 2';
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('\\n'));
    // Literal newline should NOT appear inside the value (only CRLF folding)
    const descLine = out.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'))!;
    assert.ok(!descLine.includes('\n'));
  });
});

// ── DATE-only DTSTART ─────────────────────────────────────────────────────

describe('DATE-only VALUE=DATE param', () => {
  test('setting date-only dtstart adds VALUE=DATE parameter', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.dtstart = { type: 'date', year: 2024, month: 3, day: 15 };
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('DTSTART;VALUE=DATE:20240315'));
  });

  test('setting date-only dtend adds VALUE=DATE parameter', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.dtstart = { type: 'date', year: 2024, month: 3, day: 15 };
    e.dtend   = { type: 'date', year: 2024, month: 3, day: 16 };
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('DTEND;VALUE=DATE:20240316'));
  });

  test('UTC datetime DTSTART has no VALUE param', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.dtstart = new Date('2024-03-15T09:00:00Z');
    cal.addEvent(e);
    const out = cal.toString();
    // Should be plain DTSTART: without ;VALUE=DATE-TIME (that's the default)
    const line = out.split('\r\n').find((l) => l.startsWith('DTSTART'))!;
    assert.ok(!line.includes('VALUE=DATE:'));
    assert.ok(line.includes('20240315T090000Z'));
  });
});

// ── Required property validation ──────────────────────────────────────────

describe('required property validation on toString()', () => {
  test('Calendar without PRODID throws', () => {
    const cal = new Calendar();
    cal.version = '2.0';
    // No PRODID
    assert.throws(() => cal.toString(), /PRODID.*required/i);
  });

  test('Calendar without VERSION throws', () => {
    const cal = new Calendar();
    cal.prodid = '-//X//EN';
    // No VERSION
    assert.throws(() => cal.toString(), /VERSION.*required/i);
  });

  test('Event without UID throws', () => {
    const cal = makeCal();
    const e = new Event();
    e.dtstamp = new Date();
    e.summary = 'No UID';
    cal.addEvent(e);
    assert.throws(() => cal.toString(), /UID.*required/i);
  });

  test('Event without DTSTAMP throws', () => {
    const cal = makeCal();
    const e = new Event();
    e.uid = 'x@x.com';
    e.summary = 'No Dtstamp';
    cal.addEvent(e);
    assert.throws(() => cal.toString(), /DTSTAMP.*required/i);
  });

  test('Todo without UID throws', () => {
    const cal = makeCal();
    const t = new Todo();
    t.dtstamp = new Date();
    cal.addTodo(t);
    assert.throws(() => cal.toString(), /UID.*required/i);
  });

  test('Todo with both DUE and DURATION throws', () => {
    const cal = makeCal();
    const t = new Todo();
    t.uid = 'x@x.com';
    t.dtstamp = new Date();
    t.due = new Date();
    t.duration = { type: 'duration', negative: false, hours: 1 };
    cal.addTodo(t);
    assert.throws(() => cal.toString(), /DUE.*DURATION/i);
  });

  test('Alarm without ACTION throws', () => {
    const alarm = new Alarm();
    alarm.trigger = { type: 'duration', negative: true, minutes: 15 };
    assert.throws(() => alarm.toString(), /ACTION.*required/i);
  });

  test('Alarm without TRIGGER throws', () => {
    const alarm = new Alarm();
    alarm.action = 'AUDIO';
    assert.throws(() => alarm.toString(), /TRIGGER.*required/i);
  });

  test('Timezone without TZID throws', () => {
    const tz = new Timezone();
    const std = new Standard();
    std.dtstart = { type: 'date-time', year: 1967, month: 10, day: 29, hour: 2, minute: 0, second: 0, utc: false };
    std.tzoffsetfrom = { type: 'utc-offset', sign: '-', hours: 4, minutes: 0 };
    std.tzoffsetto = { type: 'utc-offset', sign: '-', hours: 5, minutes: 0 };
    tz.addStandard(std);
    assert.throws(() => tz.toString(), /TZID.*required/i);
  });

  test('Timezone without sub-components throws', () => {
    const tz = new Timezone();
    tz.tzid = 'UTC';
    assert.throws(() => tz.toString(), /STANDARD.*DAYLIGHT/i);
  });

  test('TimezoneRule without DTSTART throws', () => {
    const std = new Standard();
    std.tzoffsetfrom = { type: 'utc-offset', sign: '+', hours: 0, minutes: 0 };
    std.tzoffsetto = { type: 'utc-offset', sign: '+', hours: 0, minutes: 0 };
    assert.throws(() => std.toString(), /DTSTART.*required/i);
  });
});

// ── Calendar structure ────────────────────────────────────────────────────

describe('Calendar.create() convenience', () => {
  test('sets VERSION:2.0 and PRODID', () => {
    const cal = Calendar.create('-//My App//EN');
    const out = cal.toString();
    assert.ok(out.includes('VERSION:2.0'));
    assert.ok(out.includes('PRODID:-//My App//EN'));
  });

  test('sets METHOD when provided', () => {
    const cal = Calendar.create('-//X//EN', 'REQUEST');
    assert.ok(cal.toString().includes('METHOD:REQUEST'));
  });
});

// ── Multiple property occurrences ─────────────────────────────────────────

describe('property ordering and multiple occurrences', () => {
  test('multiple ATTENDEE properties serialized in order', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.addAttendee('mailto:a@x.com', { CN: 'Alice' });
    e.addAttendee('mailto:b@x.com', { CN: 'Bob' });
    e.addAttendee('mailto:c@x.com', { CN: 'Charlie' });
    cal.addEvent(e);
    const out = cal.toString();
    const attendeeLines = out.split('\r\n').filter((l) => l.startsWith('ATTENDEE'));
    assert.equal(attendeeLines.length, 3);
  });

  test('RRULE and EXDATE appear in output', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.dtstart = new Date('2024-01-01T10:00:00Z');
    e.addRrule({ type: 'recur', freq: 'WEEKLY', byday: [{ day: 'MO' }] });
    e.addExdate({ type: 'date-time', year: 2024, month: 1, day: 8, hour: 10, minute: 0, second: 0, utc: true });
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('RRULE:FREQ=WEEKLY'));
    assert.ok(out.includes('EXDATE:20240108T100000Z'));
  });

  test('CATEGORIES serialized as comma-separated list', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.categories = ['WORK', 'MEETING', 'IMPORTANT'];
    cal.addEvent(e);
    const out = cal.toString();
    const line = out.split('\r\n').find((l) => l.startsWith('CATEGORIES'))!;
    assert.ok(line.includes('WORK'));
    assert.ok(line.includes('MEETING'));
    assert.ok(line.includes('IMPORTANT'));
  });
});

// ── ALARM inside event ────────────────────────────────────────────────────

describe('VALARM serialization', () => {
  test('AUDIO alarm serialized inside VEVENT', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.dtstart = new Date('2024-06-01T10:00:00Z');
    const alarm = new Alarm();
    alarm.action = 'AUDIO';
    alarm.trigger = { type: 'duration', negative: true, minutes: 15 };
    e.addAlarm(alarm);
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('BEGIN:VALARM'));
    assert.ok(out.includes('ACTION:AUDIO'));
    assert.ok(out.includes('TRIGGER:-PT15M'));
    assert.ok(out.includes('END:VALARM'));
  });
});

// ── GEO property ──────────────────────────────────────────────────────────

describe('GEO serialization', () => {
  test('GEO round-trip', () => {
    const cal = makeCal();
    const e = makeEvent();
    e.geo = { type: 'geo', latitude: 37.386013, longitude: -122.082932 };
    cal.addEvent(e);
    const out = cal.toString();
    assert.ok(out.includes('GEO:37.386013;-122.082932'));
  });
});

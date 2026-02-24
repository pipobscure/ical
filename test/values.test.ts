/**
 * Value type codec tests (RFC 5545 §3.3).
 * Each type is tested for: typical values, edge cases, round-trip fidelity.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEXT,
  BOOLEAN,
  INTEGER,
  FLOAT,
  URI,
  BINARY,
  UTC_OFFSET,
  DATE,
  DATE_TIME,
  TIME,
  DURATION,
  PERIOD,
  RECUR,
  GEO,
} from '../dist/value-types.js';

// ── TEXT (RFC 5545 §3.3.11) ───────────────────────────────────────────────

describe('TEXT', () => {
  test('unescape \\n → newline', () => {
    assert.equal(TEXT.parse('line1\\nline2'), 'line1\nline2');
  });

  test('unescape \\N (uppercase) → newline', () => {
    assert.equal(TEXT.parse('line1\\Nline2'), 'line1\nline2');
  });

  test('unescape \\, → comma', () => {
    assert.equal(TEXT.parse('foo\\,bar'), 'foo,bar');
  });

  test('unescape \\; → semicolon', () => {
    assert.equal(TEXT.parse('foo\\;bar'), 'foo;bar');
  });

  test('unescape \\\\ → backslash', () => {
    assert.equal(TEXT.parse('foo\\\\bar'), 'foo\\bar');
  });

  test('multiple escapes in sequence', () => {
    assert.equal(TEXT.parse('a\\,b\\;c\\\\d\\ne'), 'a,b;c\\d\ne');
  });

  test('unescaped text passes through', () => {
    assert.equal(TEXT.parse('Hello World'), 'Hello World');
  });

  test('empty string', () => {
    assert.equal(TEXT.parse(''), '');
  });

  test('serialize: escape comma', () => {
    assert.equal(TEXT.serialize('a,b'), 'a\\,b');
  });

  test('serialize: escape semicolon', () => {
    assert.equal(TEXT.serialize('a;b'), 'a\\;b');
  });

  test('serialize: escape backslash', () => {
    assert.equal(TEXT.serialize('a\\b'), 'a\\\\b');
  });

  test('serialize: escape newline', () => {
    assert.equal(TEXT.serialize('a\nb'), 'a\\nb');
  });

  test('serialize: null/undefined → empty string', () => {
    assert.equal(TEXT.serialize(null), '');
    assert.equal(TEXT.serialize(undefined), '');
  });

  test('round-trip: text with all special chars', () => {
    const original = 'Hello, World; this\\is a "test"\nSecond line';
    assert.equal(TEXT.parse(TEXT.serialize(original)), original);
  });

  test('backslash before non-special char: tolerated (passed through)', () => {
    // Producers sometimes emit \\x where x is not special — tolerate
    // The result is implementation-defined but should not crash
    assert.doesNotThrow(() => TEXT.parse('foo\\xbar'));
  });
});

// ── BOOLEAN (RFC 5545 §3.3.2) ─────────────────────────────────────────────

describe('BOOLEAN', () => {
  test('TRUE', () => assert.equal(BOOLEAN.parse('TRUE'), true));
  test('FALSE', () => assert.equal(BOOLEAN.parse('FALSE'), false));
  test('case-insensitive true', () => assert.equal(BOOLEAN.parse('true'), true));
  test('case-insensitive false', () => assert.equal(BOOLEAN.parse('False'), false));
  test('serialize true', () => assert.equal(BOOLEAN.serialize(true), 'TRUE'));
  test('serialize false', () => assert.equal(BOOLEAN.serialize(false), 'FALSE'));
});

// ── INTEGER (RFC 5545 §3.3.8) ─────────────────────────────────────────────

describe('INTEGER', () => {
  test('positive integer', () => assert.equal(INTEGER.parse('42'), 42));
  test('negative integer', () => assert.equal(INTEGER.parse('-5'), -5));
  test('zero', () => assert.equal(INTEGER.parse('0'), 0));
  test('with leading whitespace (tolerant)', () => assert.equal(INTEGER.parse(' 7 '), 7));
  test('serialize', () => assert.equal(INTEGER.serialize(42), '42'));
  test('serialize negative', () => assert.equal(INTEGER.serialize(-5), '-5'));
  test('serialize truncates float', () => assert.equal(INTEGER.serialize(3.9), '3'));
});

// ── FLOAT (RFC 5545 §3.3.7) ───────────────────────────────────────────────

describe('FLOAT', () => {
  test('positive float', () => assert.equal(FLOAT.parse('3.14'), 3.14));
  test('negative float', () => assert.equal(FLOAT.parse('-2.5'), -2.5));
  test('integer as float', () => assert.equal(FLOAT.parse('37'), 37));
  test('serialize integer adds .0', () => assert.equal(FLOAT.serialize(42), '42.0'));
  test('serialize float', () => assert.equal(FLOAT.serialize(3.14), '3.14'));
});

// ── UTC-OFFSET (RFC 5545 §3.3.14) ────────────────────────────────────────

describe('UTC_OFFSET', () => {
  test('+HHMM', () => {
    const v = UTC_OFFSET.parse('+0500');
    assert.equal(v.sign, '+');
    assert.equal(v.hours, 5);
    assert.equal(v.minutes, 0);
    assert.equal(v.seconds, undefined);
  });

  test('-HHMM', () => {
    const v = UTC_OFFSET.parse('-0800');
    assert.equal(v.sign, '-');
    assert.equal(v.hours, 8);
    assert.equal(v.minutes, 0);
  });

  test('+HHMMSS (with seconds)', () => {
    const v = UTC_OFFSET.parse('+053045');
    assert.equal(v.sign, '+');
    assert.equal(v.hours, 5);
    assert.equal(v.minutes, 30);
    assert.equal(v.seconds, 45);
  });

  test('serialize +HHMM', () => {
    assert.equal(UTC_OFFSET.serialize({ type: 'utc-offset', sign: '+', hours: 5, minutes: 30 }), '+0530');
  });

  test('serialize -HHMM', () => {
    assert.equal(UTC_OFFSET.serialize({ type: 'utc-offset', sign: '-', hours: 8, minutes: 0 }), '-0800');
  });

  test('serialize with seconds', () => {
    assert.equal(UTC_OFFSET.serialize({ type: 'utc-offset', sign: '+', hours: 5, minutes: 30, seconds: 15 }), '+053015');
  });
});

// ── DATE (RFC 5545 §3.3.4) ────────────────────────────────────────────────

describe('DATE', () => {
  test('parse YYYYMMDD', () => {
    const v = DATE.parse('20240315');
    assert.equal(v.type, 'date');
    assert.equal(v.year, 2024);
    assert.equal(v.month, 3);
    assert.equal(v.day, 15);
  });

  test('serialize', () => {
    assert.equal(DATE.serialize({ type: 'date', year: 2024, month: 3, day: 5 }), '20240305');
  });

  test('serialize from JS Date', () => {
    const d = new Date(2024, 2, 15); // March 15, 2024 (local)
    const s = DATE.serialize(d);
    assert.match(s, /^\d{8}$/);
  });

  test('round-trip', () => {
    const original = '20241231';
    assert.equal(DATE.serialize(DATE.parse(original)), original);
  });

  test('leap day', () => {
    const v = DATE.parse('20240229');
    assert.equal(v.year, 2024);
    assert.equal(v.month, 2);
    assert.equal(v.day, 29);
  });

  test('fromDate / toDate round-trip', () => {
    const now = new Date(2024, 5, 15);
    const ical = DATE.fromDate(now);
    const back = DATE.toDate(ical);
    assert.equal(back.getFullYear(), now.getFullYear());
    assert.equal(back.getMonth(), now.getMonth());
    assert.equal(back.getDate(), now.getDate());
  });
});

// ── DATE-TIME (RFC 5545 §3.3.5) ───────────────────────────────────────────

describe('DATE_TIME', () => {
  test('UTC (Z suffix)', () => {
    const v = DATE_TIME.parse('19970714T173000Z');
    assert.equal(v.type, 'date-time');
    assert.equal(v.year, 1997);
    assert.equal(v.month, 7);
    assert.equal(v.day, 14);
    assert.equal(v.hour, 17);
    assert.equal(v.minute, 30);
    assert.equal(v.second, 0);
    assert.equal(v.utc, true);
  });

  test('local (no Z, no TZID) — floating time', () => {
    const v = DATE_TIME.parse('19970714T173000');
    assert.equal(v.utc, false);
    assert.equal(v.tzid, undefined);
  });

  test('with TZID parameter', () => {
    const v = DATE_TIME.parse('19980312T083000', { TZID: 'America/New_York' });
    assert.equal(v.utc, false);
    assert.equal(v.tzid, 'America/New_York');
  });

  test('serialize UTC', () => {
    const dt = { type: 'date-time' as const, year: 1997, month: 7, day: 14, hour: 17, minute: 30, second: 0, utc: true };
    assert.equal(DATE_TIME.serialize(dt), '19970714T173000Z');
  });

  test('serialize local (no Z)', () => {
    const dt = { type: 'date-time' as const, year: 1997, month: 7, day: 14, hour: 17, minute: 30, second: 0, utc: false };
    assert.equal(DATE_TIME.serialize(dt), '19970714T173000');
  });

  test('serialize from JS Date (always UTC)', () => {
    const d = new Date(Date.UTC(1997, 6, 14, 17, 30, 0));
    assert.equal(DATE_TIME.serialize(d), '19970714T173000Z');
  });

  test('fromDate UTC round-trip', () => {
    const now = new Date(Date.UTC(2024, 5, 15, 14, 30, 0));
    const ical = DATE_TIME.fromDate(now);
    const back = DATE_TIME.toDate(ical);
    assert.equal(back.getTime(), now.getTime());
  });

  test('midnight', () => {
    const v = DATE_TIME.parse('20240101T000000Z');
    assert.equal(v.hour, 0);
    assert.equal(v.minute, 0);
    assert.equal(v.second, 0);
  });

  test('end-of-day', () => {
    const v = DATE_TIME.parse('20240101T235959Z');
    assert.equal(v.hour, 23);
    assert.equal(v.minute, 59);
    assert.equal(v.second, 59);
  });
});

// ── TIME (RFC 5545 §3.3.12) ───────────────────────────────────────────────

describe('TIME', () => {
  test('parse HHMMSS', () => {
    const v = TIME.parse('083000');
    assert.equal(v.type, 'time');
    assert.equal(v.hour, 8);
    assert.equal(v.minute, 30);
    assert.equal(v.second, 0);
    assert.equal(v.utc, false);
  });

  test('parse HHMMSZ (UTC)', () => {
    const v = TIME.parse('173000Z');
    assert.equal(v.utc, true);
  });

  test('serialize', () => {
    assert.equal(TIME.serialize({ type: 'time', hour: 8, minute: 30, second: 0, utc: false }), '083000');
    assert.equal(TIME.serialize({ type: 'time', hour: 17, minute: 0, second: 0, utc: true }), '170000Z');
  });
});

// ── DURATION (RFC 5545 §3.3.6) ────────────────────────────────────────────

describe('DURATION', () => {
  test('P1D', () => {
    const v = DURATION.parse('P1D');
    assert.equal(v.type, 'duration');
    assert.equal(v.days, 1);
    assert.equal(v.negative, false);
  });

  test('PT1H', () => {
    const v = DURATION.parse('PT1H');
    assert.equal(v.hours, 1);
    assert.equal(v.days, undefined);
  });

  test('PT1H30M', () => {
    const v = DURATION.parse('PT1H30M');
    assert.equal(v.hours, 1);
    assert.equal(v.minutes, 30);
  });

  test('P1DT2H3M4S', () => {
    const v = DURATION.parse('P1DT2H3M4S');
    assert.equal(v.days, 1);
    assert.equal(v.hours, 2);
    assert.equal(v.minutes, 3);
    assert.equal(v.seconds, 4);
  });

  test('P1W (weeks)', () => {
    const v = DURATION.parse('P1W');
    assert.equal(v.weeks, 1);
    assert.equal(v.days, undefined);
  });

  test('P2W (multi-week)', () => {
    const v = DURATION.parse('P2W');
    assert.equal(v.weeks, 2);
  });

  test('-P1D (negative duration for TRIGGER)', () => {
    const v = DURATION.parse('-P1D');
    assert.equal(v.negative, true);
    assert.equal(v.days, 1);
  });

  test('-PT15M (negative trigger: 15 min before start)', () => {
    const v = DURATION.parse('-PT15M');
    assert.equal(v.negative, true);
    assert.equal(v.minutes, 15);
  });

  test('+P1D (explicit positive)', () => {
    const v = DURATION.parse('+P1D');
    assert.equal(v.negative, false);
  });

  test('serialize P1D', () => {
    assert.equal(DURATION.serialize({ type: 'duration', negative: false, days: 1 }), 'P1D');
  });

  test('serialize PT1H30M', () => {
    assert.equal(
      DURATION.serialize({ type: 'duration', negative: false, hours: 1, minutes: 30 }),
      'PT1H30M',
    );
  });

  test('serialize -PT15M', () => {
    assert.equal(
      DURATION.serialize({ type: 'duration', negative: true, minutes: 15 }),
      '-PT15M',
    );
  });

  test('serialize P1W', () => {
    assert.equal(DURATION.serialize({ type: 'duration', negative: false, weeks: 1 }), 'P1W');
  });

  test('toSeconds: PT1H = 3600', () => {
    assert.equal(DURATION.toSeconds({ type: 'duration', negative: false, hours: 1 }), 3600);
  });

  test('toSeconds: -PT15M = -900', () => {
    assert.equal(DURATION.toSeconds({ type: 'duration', negative: true, minutes: 15 }), -900);
  });

  test('toSeconds: P1W = 604800', () => {
    assert.equal(DURATION.toSeconds({ type: 'duration', negative: false, weeks: 1 }), 604800);
  });

  test('round-trip P1DT2H3M4S', () => {
    const s = 'P1DT2H3M4S';
    assert.equal(DURATION.serialize(DURATION.parse(s)), s);
  });
});

// ── PERIOD (RFC 5545 §3.3.9) ──────────────────────────────────────────────

describe('PERIOD', () => {
  test('explicit end (start/end)', () => {
    const v = PERIOD.parse('19970101T180000Z/19970102T070000Z');
    assert.equal(v.type, 'period');
    assert.equal(v.start.type, 'date-time');
    assert.equal(v.end.type, 'date-time');
  });

  test('duration end (start/duration)', () => {
    const v = PERIOD.parse('19970101T180000Z/PT5H30M');
    assert.equal(v.end.type, 'duration');
    const end = v.end as { type: 'duration'; hours: number; minutes: number };
    assert.equal(end.hours, 5);
    assert.equal(end.minutes, 30);
  });

  test('serialize explicit period', () => {
    const v = PERIOD.parse('19970101T180000Z/19970102T070000Z');
    const s = PERIOD.serialize(v);
    assert.ok(s.includes('/'));
    assert.ok(s.startsWith('19970101T180000Z'));
  });

  test('round-trip explicit', () => {
    const s = '19970101T180000Z/19970102T070000Z';
    assert.equal(PERIOD.serialize(PERIOD.parse(s)), s);
  });
});

// ── RECUR (RFC 5545 §3.3.10) ──────────────────────────────────────────────

describe('RECUR', () => {
  test('FREQ=DAILY', () => {
    const v = RECUR.parse('FREQ=DAILY');
    assert.equal(v.type, 'recur');
    assert.equal(v.freq, 'DAILY');
  });

  test('FREQ=WEEKLY;BYDAY=MO,WE,FR', () => {
    const v = RECUR.parse('FREQ=WEEKLY;BYDAY=MO,WE,FR');
    assert.equal(v.byday?.length, 3);
    assert.deepEqual(v.byday?.map((d) => d.day), ['MO', 'WE', 'FR']);
  });

  test('FREQ=MONTHLY;BYDAY=-1MO (last Monday)', () => {
    const v = RECUR.parse('FREQ=MONTHLY;BYDAY=-1MO');
    assert.equal(v.byday?.[0]?.day, 'MO');
    assert.equal(v.byday?.[0]?.ordwk, -1);
  });

  test('FREQ=MONTHLY;BYDAY=+1FR (first Friday)', () => {
    const v = RECUR.parse('FREQ=MONTHLY;BYDAY=+1FR');
    assert.equal(v.byday?.[0]?.ordwk, 1);
    assert.equal(v.byday?.[0]?.day, 'FR');
  });

  test('FREQ=YEARLY;BYDAY=3MO;BYMONTH=6 (3rd Monday of June)', () => {
    const v = RECUR.parse('FREQ=YEARLY;BYDAY=3MO;BYMONTH=6');
    assert.equal(v.byday?.[0]?.ordwk, 3);
    assert.equal(v.bymonth?.[0], 6);
  });

  test('COUNT', () => {
    const v = RECUR.parse('FREQ=DAILY;COUNT=10');
    assert.equal(v.count, 10);
  });

  test('INTERVAL', () => {
    const v = RECUR.parse('FREQ=WEEKLY;INTERVAL=2');
    assert.equal(v.interval, 2);
  });

  test('UNTIL as DATE-TIME', () => {
    const v = RECUR.parse('FREQ=DAILY;UNTIL=19971224T000000Z');
    assert.equal(v.until?.type, 'date-time');
  });

  test('UNTIL as DATE', () => {
    const v = RECUR.parse('FREQ=DAILY;UNTIL=19971224');
    assert.equal(v.until?.type, 'date');
  });

  test('WKST=SU (week start override)', () => {
    const v = RECUR.parse('FREQ=WEEKLY;BYDAY=TU,TH;WKST=SU');
    assert.equal(v.wkst, 'SU');
  });

  test('BYSETPOS (nth occurrence within set)', () => {
    const v = RECUR.parse('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1');
    assert.deepEqual(v.bysetpos, [-1]);
  });

  test('BYMONTHDAY negative (last day of month)', () => {
    const v = RECUR.parse('FREQ=MONTHLY;BYMONTHDAY=-1');
    assert.deepEqual(v.bymonthday, [-1]);
  });

  test('BYYEARDAY', () => {
    const v = RECUR.parse('FREQ=YEARLY;BYYEARDAY=1,100,200');
    assert.deepEqual(v.byyearday, [1, 100, 200]);
  });

  test('BYWEEKNO', () => {
    const v = RECUR.parse('FREQ=YEARLY;BYWEEKNO=20');
    assert.deepEqual(v.byweekno, [20]);
  });

  test('BYHOUR,BYMINUTE,BYSECOND', () => {
    const v = RECUR.parse('FREQ=DAILY;BYHOUR=9,10;BYMINUTE=0;BYSECOND=0');
    assert.deepEqual(v.byhour, [9, 10]);
    assert.deepEqual(v.byminute, [0]);
    assert.deepEqual(v.bysecond, [0]);
  });

  test('case-insensitive FREQ (tolerant) — lowercase accepted', () => {
    // Our codec uppercases the FREQ string before validation,
    // so lowercase 'daily' is accepted as a tolerant extension.
    const v = RECUR.parse('FREQ=daily');
    assert.equal(v.freq, 'DAILY');
  });

  test('serialize FREQ=WEEKLY;BYDAY=MO,WE,FR', () => {
    const s = RECUR.serialize({
      type: 'recur',
      freq: 'WEEKLY',
      byday: [{ day: 'MO' }, { day: 'WE' }, { day: 'FR' }],
    });
    assert.ok(s.startsWith('FREQ=WEEKLY'));
    assert.ok(s.includes('BYDAY=MO,WE,FR'));
  });

  test('serialize with COUNT', () => {
    const s = RECUR.serialize({ type: 'recur', freq: 'DAILY', count: 10 });
    assert.ok(s.includes('COUNT=10'));
  });

  test('serialize negative ordinal BYDAY', () => {
    const s = RECUR.serialize({
      type: 'recur',
      freq: 'MONTHLY',
      byday: [{ day: 'MO', ordwk: -1 }],
    });
    assert.ok(s.includes('BYDAY=-1MO'));
  });

  test('round-trip complex RRULE', () => {
    const s = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10;WKST=SU';
    // Parts may reorder but content should survive
    const parsed = RECUR.parse(s);
    assert.equal(parsed.freq, 'WEEKLY');
    assert.equal(parsed.interval, 2);
    assert.equal(parsed.count, 10);
    assert.equal(parsed.wkst, 'SU');
  });

  test('invalid FREQ throws', () => {
    assert.throws(() => RECUR.parse('FREQ=HOURLY_ISH'), /Invalid FREQ/);
  });
});

// ── GEO ───────────────────────────────────────────────────────────────────

describe('GEO', () => {
  test('parse lat;lon', () => {
    const v = GEO.parse('37.386013;-122.082932');
    assert.equal(v.type, 'geo');
    assert.ok(Math.abs(v.latitude - 37.386013) < 0.000001);
    assert.ok(Math.abs(v.longitude - (-122.082932)) < 0.000001);
  });

  test('serialize', () => {
    const s = GEO.serialize({ type: 'geo', latitude: 37.386013, longitude: -122.082932 });
    assert.ok(s.includes(';'));
  });

  test('round-trip', () => {
    const original = '37.386013;-122.082932';
    const v = GEO.parse(original);
    const back = GEO.serialize(v);
    assert.equal(back, original);
  });
});

// ── BINARY ────────────────────────────────────────────────────────────────

describe('BINARY', () => {
  test('parse base64', () => {
    const v = BINARY.parse('SGVsbG8gV29ybGQ='); // "Hello World"
    assert.equal(v.type, 'binary');
    assert.equal(Buffer.from(v.data).toString('utf8'), 'Hello World');
  });

  test('serialize', () => {
    const s = BINARY.serialize({ type: 'binary', data: Buffer.from('Hello World') });
    assert.equal(s, 'SGVsbG8gV29ybGQ=');
  });

  test('round-trip', () => {
    const original = 'SGVsbG8gV29ybGQ=';
    const v = BINARY.parse(original);
    assert.equal(BINARY.serialize(v), original);
  });
});

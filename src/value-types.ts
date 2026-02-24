/**
 * RFC 5545 §3.3 — Value Data Types
 *
 * Each exported object has:
 *   parse(raw, params?)  → typed value (tolerant)
 *   serialize(val, params?) → string (strict)
 */

import type {
  ICalDate,
  ICalDateTime,
  ICalTime,
  ICalDuration,
  ICalPeriod,
  ICalRecur,
  ICalUtcOffset,
  ICalGeo,
  ICalBinary,
  RecurFreq,
  Weekday,
  ByDayRule,
} from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// ── TEXT (RFC 5545 §3.3.11) ───────────────────────────────────────────────

export const TEXT = {
  parse(raw: string): string {
    // Unescape: \n \N \, \; \\ → newline , ; backslash
    return raw
      .replace(/\\n/gi, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  },
  serialize(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  },
};

// ── BOOLEAN (RFC 5545 §3.3.2) ─────────────────────────────────────────────

export const BOOLEAN = {
  parse(raw: string): boolean {
    return raw.trim().toUpperCase() === 'TRUE';
  },
  serialize(val: unknown): string {
    return val ? 'TRUE' : 'FALSE';
  },
};

// ── INTEGER (RFC 5545 §3.3.8) ─────────────────────────────────────────────

export const INTEGER = {
  parse(raw: string): number {
    return parseInt(raw.trim(), 10);
  },
  serialize(val: unknown): string {
    return String(Math.trunc(Number(val)));
  },
};

// ── FLOAT (RFC 5545 §3.3.7) ───────────────────────────────────────────────

export const FLOAT = {
  parse(raw: string): number {
    return parseFloat(raw.trim());
  },
  serialize(val: unknown): string {
    const n = Number(val);
    return Number.isInteger(n) ? `${n}.0` : String(n);
  },
};

// ── URI / CAL-ADDRESS (RFC 5545 §3.3.13, §3.3.3) ─────────────────────────

export const URI = {
  parse(raw: string): string {
    return raw.trim();
  },
  serialize(val: unknown): string {
    return String(val ?? '');
  },
};

export const CAL_ADDRESS = URI;

// ── BINARY (RFC 5545 §3.3.1) ──────────────────────────────────────────────

export const BINARY = {
  parse(raw: string): ICalBinary {
    const data = Buffer.from(raw.trim(), 'base64');
    return { type: 'binary', data };
  },
  serialize(val: unknown): string {
    if (typeof val === 'object' && val !== null && 'type' in val && (val as ICalBinary).type === 'binary') {
      const bin = val as ICalBinary;
      return Buffer.from(bin.data).toString('base64');
    }
    if (val instanceof Uint8Array) return Buffer.from(val).toString('base64');
    return String(val);
  },
};

// ── UTC-OFFSET (RFC 5545 §3.3.14) ────────────────────────────────────────

export const UTC_OFFSET = {
  parse(raw: string): ICalUtcOffset {
    const s = raw.trim();
    const sign = s[0] === '-' ? '-' : '+';
    const h = parseInt(s.slice(1, 3), 10);
    const m = parseInt(s.slice(3, 5), 10);
    const sec = s.length >= 7 ? parseInt(s.slice(5, 7), 10) : undefined;
    return { type: 'utc-offset', sign, hours: h, minutes: m, seconds: sec };
  },
  serialize(val: ICalUtcOffset): string {
    const { sign, hours, minutes, seconds } = val;
    const base = `${sign}${pad2(hours)}${pad2(minutes)}`;
    return seconds !== undefined ? base + pad2(seconds) : base;
  },
};

// ── DATE (RFC 5545 §3.3.4) ────────────────────────────────────────────────

export const DATE = {
  parse(raw: string): ICalDate {
    const s = raw.trim();
    return {
      type: 'date',
      year: parseInt(s.slice(0, 4), 10),
      month: parseInt(s.slice(4, 6), 10),
      day: parseInt(s.slice(6, 8), 10),
    };
  },
  serialize(val: ICalDate | Date): string {
    if (val instanceof Date) {
      return `${pad4(val.getFullYear())}${pad2(val.getMonth() + 1)}${pad2(val.getDate())}`;
    }
    return `${pad4(val.year)}${pad2(val.month)}${pad2(val.day)}`;
  },
  fromDate(d: Date): ICalDate {
    return {
      type: 'date',
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  },
  toDate(val: ICalDate): Date {
    return new Date(val.year, val.month - 1, val.day);
  },
};

// ── DATE-TIME (RFC 5545 §3.3.5) ───────────────────────────────────────────

export const DATE_TIME = {
  parse(raw: string, params?: Readonly<Record<string, unknown>>): ICalDateTime {
    const s = raw.trim();
    const utc = s.endsWith('Z');
    const core = utc ? s.slice(0, -1) : s;
    const tzid = typeof params?.['TZID'] === 'string' ? params['TZID'] : undefined;
    return {
      type: 'date-time',
      year: parseInt(core.slice(0, 4), 10),
      month: parseInt(core.slice(4, 6), 10),
      day: parseInt(core.slice(6, 8), 10),
      hour: parseInt(core.slice(9, 11), 10),
      minute: parseInt(core.slice(11, 13), 10),
      second: parseInt(core.slice(13, 15), 10),
      utc,
      tzid,
    };
  },
  serialize(val: ICalDateTime | Date, tzid?: string): string {
    if (val instanceof Date) {
      return (
        `${pad4(val.getUTCFullYear())}${pad2(val.getUTCMonth() + 1)}${pad2(val.getUTCDate())}` +
        `T${pad2(val.getUTCHours())}${pad2(val.getUTCMinutes())}${pad2(val.getUTCSeconds())}Z`
      );
    }
    const core =
      `${pad4(val.year)}${pad2(val.month)}${pad2(val.day)}` +
      `T${pad2(val.hour)}${pad2(val.minute)}${pad2(val.second)}`;
    return val.utc ? core + 'Z' : core;
  },
  fromDate(d: Date, tzid?: string): ICalDateTime {
    if (tzid) {
      return {
        type: 'date-time',
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        minute: d.getMinutes(),
        second: d.getSeconds(),
        utc: false,
        tzid,
      };
    }
    return {
      type: 'date-time',
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      utc: true,
    };
  },
  toDate(val: ICalDateTime): Date {
    if (val.utc) {
      return new Date(
        Date.UTC(val.year, val.month - 1, val.day, val.hour, val.minute, val.second)
      );
    }
    return new Date(val.year, val.month - 1, val.day, val.hour, val.minute, val.second);
  },
};

// ── TIME (RFC 5545 §3.3.12) ───────────────────────────────────────────────

export const TIME = {
  parse(raw: string): ICalTime {
    const s = raw.trim();
    const utc = s.endsWith('Z');
    const core = utc ? s.slice(0, -1) : s;
    return {
      type: 'time',
      hour: parseInt(core.slice(0, 2), 10),
      minute: parseInt(core.slice(2, 4), 10),
      second: parseInt(core.slice(4, 6), 10),
      utc,
    };
  },
  serialize(val: ICalTime): string {
    return `${pad2(val.hour)}${pad2(val.minute)}${pad2(val.second)}${val.utc ? 'Z' : ''}`;
  },
};

// ── DURATION (RFC 5545 §3.3.6) ────────────────────────────────────────────
//
// dur-value = (["+"] / "-") "P" (dur-date / dur-time / dur-week)
// dur-date  = dur-day [dur-time]
// dur-time  = "T" (dur-hour / dur-minute / dur-second)
// dur-week  = 1*DIGIT "W"
// dur-hour  = 1*DIGIT "H" [dur-minute]
// dur-minute= 1*DIGIT "M" [dur-second]
// dur-second= 1*DIGIT "S"
// dur-day   = 1*DIGIT "D"

export const DURATION = {
  parse(raw: string): ICalDuration {
    const s = raw.trim();
    const negative = s.startsWith('-');
    const str = s.replace(/^[+-]/, '');

    // Strip leading 'P'
    if (!str.startsWith('P')) {
      return { type: 'duration', negative, days: 0 };
    }
    const body = str.slice(1);

    const weekMatch = body.match(/^(\d+)W$/);
    if (weekMatch) {
      return { type: 'duration', negative, weeks: parseInt(weekMatch[1]!, 10) };
    }

    let days: number | undefined;
    let hours: number | undefined;
    let minutes: number | undefined;
    let seconds: number | undefined;

    const dayMatch = body.match(/(\d+)D/);
    if (dayMatch) days = parseInt(dayMatch[1]!, 10);

    const tIdx = body.indexOf('T');
    if (tIdx !== -1) {
      const timePart = body.slice(tIdx + 1);
      const hourMatch = timePart.match(/(\d+)H/);
      const minMatch = timePart.match(/(\d+)M/);
      const secMatch = timePart.match(/(\d+)S/);
      if (hourMatch) hours = parseInt(hourMatch[1]!, 10);
      if (minMatch) minutes = parseInt(minMatch[1]!, 10);
      if (secMatch) seconds = parseInt(secMatch[1]!, 10);
    }

    return { type: 'duration', negative, days, hours, minutes, seconds };
  },
  serialize(val: ICalDuration): string {
    const sign = val.negative ? '-' : '';
    if (val.weeks !== undefined) return `${sign}P${val.weeks}W`;

    let s = `${sign}P`;
    if (val.days) s += `${val.days}D`;

    const hasTime = val.hours || val.minutes || val.seconds;
    if (hasTime) {
      s += 'T';
      if (val.hours) s += `${val.hours}H`;
      if (val.minutes) s += `${val.minutes}M`;
      if (val.seconds) s += `${val.seconds}S`;
    }

    return s || `${sign}P0D`;
  },
  toSeconds(val: ICalDuration): number {
    const sign = val.negative ? -1 : 1;
    return (
      sign *
      ((val.weeks ?? 0) * 7 * 86400 +
        (val.days ?? 0) * 86400 +
        (val.hours ?? 0) * 3600 +
        (val.minutes ?? 0) * 60 +
        (val.seconds ?? 0))
    );
  },
};

// ── PERIOD (RFC 5545 §3.3.9) ──────────────────────────────────────────────
//
// period = date-time "/" date-time   (explicit)
//        / date-time "/" dur-value   (start + duration)

export const PERIOD = {
  parse(raw: string): ICalPeriod {
    const slashIdx = raw.indexOf('/');
    if (slashIdx === -1) throw new Error(`Invalid PERIOD value: ${raw}`);
    const start = DATE_TIME.parse(raw.slice(0, slashIdx));
    const endStr = raw.slice(slashIdx + 1).trim();
    const end = endStr.startsWith('P') || endStr.startsWith('-P') || endStr.startsWith('+P')
      ? DURATION.parse(endStr)
      : DATE_TIME.parse(endStr);
    return { type: 'period', start, end };
  },
  serialize(val: ICalPeriod): string {
    const startStr = DATE_TIME.serialize(val.start);
    const endStr =
      val.end.type === 'duration'
        ? DURATION.serialize(val.end)
        : DATE_TIME.serialize(val.end);
    return `${startStr}/${endStr}`;
  },
};

// ── RECUR (RFC 5545 §3.3.10) ──────────────────────────────────────────────

const VALID_FREQS = new Set<string>([
  'SECONDLY', 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY',
]);

const VALID_WEEKDAYS = new Set<string>(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);

function parseByDay(raw: string): ByDayRule[] {
  return raw.split(',').map((s) => {
    const m = s.trim().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i);
    if (!m) return { day: 'MO' as Weekday };
    return {
      day: (m[2]!.toUpperCase()) as Weekday,
      ordwk: m[1] !== undefined ? parseInt(m[1], 10) : undefined,
    };
  });
}

export const RECUR = {
  parse(raw: string): ICalRecur {
    const parts = raw.trim().split(';');
    const map: Record<string, string> = {};
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      map[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }

    const freqStr = (map['FREQ'] ?? '').toUpperCase();
    if (!VALID_FREQS.has(freqStr)) {
      throw new Error(`Invalid FREQ in RRULE: ${freqStr}`);
    }
    const freq = freqStr as RecurFreq;

    const parseInts = (k: string) => map[k]?.split(',').map(Number);
    const parseWkst = (k: string): Weekday | undefined => {
      const v = map[k]?.toUpperCase();
      return v && VALID_WEEKDAYS.has(v) ? (v as Weekday) : undefined;
    };

    let until: ICalRecur['until'];
    if (map['UNTIL']) {
      const u = map['UNTIL']!;
      until = u.includes('T') ? DATE_TIME.parse(u) : DATE.parse(u);
    }

    return {
      type: 'recur',
      freq,
      until,
      count: map['COUNT'] !== undefined ? parseInt(map['COUNT']!, 10) : undefined,
      interval: map['INTERVAL'] !== undefined ? parseInt(map['INTERVAL']!, 10) : undefined,
      bysecond: parseInts('BYSECOND'),
      byminute: parseInts('BYMINUTE'),
      byhour: parseInts('BYHOUR'),
      byday: map['BYDAY'] ? parseByDay(map['BYDAY']!) : undefined,
      bymonthday: parseInts('BYMONTHDAY'),
      byyearday: parseInts('BYYEARDAY'),
      byweekno: parseInts('BYWEEKNO'),
      bymonth: parseInts('BYMONTH'),
      bysetpos: parseInts('BYSETPOS'),
      wkst: parseWkst('WKST'),
    };
  },
  serialize(val: ICalRecur): string {
    const parts: string[] = [`FREQ=${val.freq}`];
    if (val.until) {
      const u = val.until;
      parts.push(`UNTIL=${u.type === 'date' ? DATE.serialize(u) : DATE_TIME.serialize(u)}`);
    }
    if (val.count !== undefined) parts.push(`COUNT=${val.count}`);
    if (val.interval !== undefined) parts.push(`INTERVAL=${val.interval}`);
    if (val.bysecond?.length) parts.push(`BYSECOND=${val.bysecond.join(',')}`);
    if (val.byminute?.length) parts.push(`BYMINUTE=${val.byminute.join(',')}`);
    if (val.byhour?.length) parts.push(`BYHOUR=${val.byhour.join(',')}`);
    if (val.byday?.length) {
      parts.push(
        `BYDAY=${val.byday
          .map((d) => (d.ordwk !== undefined ? `${d.ordwk}${d.day}` : d.day))
          .join(',')}`,
      );
    }
    if (val.bymonthday?.length) parts.push(`BYMONTHDAY=${val.bymonthday.join(',')}`);
    if (val.byyearday?.length) parts.push(`BYYEARDAY=${val.byyearday.join(',')}`);
    if (val.byweekno?.length) parts.push(`BYWEEKNO=${val.byweekno.join(',')}`);
    if (val.bymonth?.length) parts.push(`BYMONTH=${val.bymonth.join(',')}`);
    if (val.bysetpos?.length) parts.push(`BYSETPOS=${val.bysetpos.join(',')}`);
    if (val.wkst) parts.push(`WKST=${val.wkst}`);
    return parts.join(';');
  },
};

// ── GEO — special compound property value (RFC 5545 §3.8.1.6) ────────────
// Value format: float ";" float

export const GEO = {
  parse(raw: string): ICalGeo {
    const [lat, lon] = raw.split(';');
    return {
      type: 'geo',
      latitude: parseFloat(lat ?? '0'),
      longitude: parseFloat(lon ?? '0'),
    };
  },
  serialize(val: ICalGeo): string {
    return `${val.latitude};${val.longitude}`;
  },
};

// ── Type-name → codec lookup ──────────────────────────────────────────────

type Codec = { parse(raw: string, params?: Readonly<Record<string, unknown>>): unknown; serialize(val: unknown): string };

export const CODECS: Readonly<Record<string, Codec>> = {
  'TEXT': TEXT,
  'BOOLEAN': BOOLEAN,
  'INTEGER': INTEGER,
  'FLOAT': FLOAT,
  'URI': URI,
  'CAL-ADDRESS': CAL_ADDRESS,
  'BINARY': BINARY,
  'UTC-OFFSET': UTC_OFFSET,
  'DATE': DATE,
  'DATE-TIME': DATE_TIME,
  'TIME': TIME,
  'DURATION': DURATION,
  'PERIOD': PERIOD,
  'RECUR': RECUR,
};

// Re-export isValidDate for use in serializer validation
export { isValidDate };

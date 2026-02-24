/**
 * @pipobscure/ical — Full iCalendar (RFC 5545) implementation.
 *
 * Tolerant parsing, strict generation.
 *
 * @example
 * ```ts
 * import { parse, Calendar, Event } from '@pipobscure/ical';
 *
 * // Parse
 * const cal = parse(icsString);
 * for (const event of cal.events) {
 *   console.log(event.summary, event.dtstart);
 * }
 *
 * // Build & serialize
 * const cal = Calendar.create('-//My App//EN');
 * const event = new Event();
 * event.uid = crypto.randomUUID();
 * event.dtstamp = new Date();
 * event.dtstart = new Date('2025-01-01T10:00:00Z');
 * event.dtend   = new Date('2025-01-01T11:00:00Z');
 * event.summary = 'New Year kickoff';
 * cal.addEvent(event);
 * console.log(cal.toString());
 * ```
 */

// ── Parsing ───────────────────────────────────────────────────────────────
export { parse, parseAll } from './parse.js';

// ── Components ────────────────────────────────────────────────────────────
export { Component } from './component.js';
export { Calendar } from './calendar.js';
export { Event } from './event.js';
export { Todo } from './todo.js';
export { Journal } from './journal.js';
export { FreeBusy } from './freebusy.js';
export { Timezone, Standard, Daylight, TimezoneRule } from './timezone.js';
export { Alarm } from './alarm.js';

// ── Property & value primitives ───────────────────────────────────────────
export { Property, parseProperty } from './property.js';

// ── Value type codecs (for advanced use) ─────────────────────────────────
export {
  TEXT,
  BOOLEAN,
  INTEGER,
  FLOAT,
  URI,
  CAL_ADDRESS,
  BINARY,
  UTC_OFFSET,
  DATE,
  DATE_TIME,
  TIME,
  DURATION,
  PERIOD,
  RECUR,
  GEO,
  CODECS,
} from './value-types.js';

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  ICalDate,
  ICalDateTime,
  ICalTime,
  ICalDuration,
  ICalPeriod,
  ICalRecur,
  ICalUtcOffset,
  ICalGeo,
  ICalBinary,
  ICalStructured,
  ICalValue,
  RecurFreq,
  Weekday,
  ByDayRule,
  ContentLine,
  ParsedProperty,
} from './types.js';

export type { ValueTypeName, PropertyDef } from './property-registry.js';

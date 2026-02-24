/**
 * VTODO component (RFC 5545 §3.6.2)
 *
 * UID and DTSTAMP are required.
 * DTSTART and DUE/DURATION are optional.
 * DTEND MUST NOT be present when DURATION is present.
 */

import { Component } from './component.js';
import { Property, parseProperty } from './property.js';
import { Alarm } from './alarm.js';
import type { ICalDate, ICalDateTime, ICalDuration, ICalRecur, ICalGeo, ICalValue } from './types.js';

export class Todo extends Component {
  constructor() {
    super('VTODO');
  }

  // ── Required ─────────────────────────────────────────────────────────

  get uid(): string | null {
    return this.getProperty('UID')?.text ?? null;
  }
  set uid(v: string) {
    this.setProperty('UID', v);
  }

  get dtstamp(): ICalDateTime | null {
    const v = this.getValue('DTSTAMP');
    return v && typeof v === 'object' && v.type === 'date-time' ? (v as ICalDateTime) : null;
  }
  set dtstamp(v: ICalDateTime | Date) {
    this.setProperty('DTSTAMP', v instanceof Date
      ? { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime
      : v);
  }

  // ── Date/time ─────────────────────────────────────────────────────────

  get dtstart(): ICalDateTime | ICalDate | null {
    const v = this.getValue('DTSTART');
    if (!v || typeof v !== 'object') return null;
    return v.type === 'date-time' || v.type === 'date' ? (v as ICalDateTime | ICalDate) : null;
  }
  set dtstart(v: ICalDateTime | ICalDate | Date) {
    if (v instanceof Date) {
      this.setProperty('DTSTART', { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime);
    } else if (v.type === 'date') {
      this.setProperty('DTSTART', v, { VALUE: 'DATE' });
    } else {
      this.setProperty('DTSTART', v);
    }
  }

  get due(): ICalDateTime | ICalDate | null {
    const v = this.getValue('DUE');
    if (!v || typeof v !== 'object') return null;
    return v.type === 'date-time' || v.type === 'date' ? (v as ICalDateTime | ICalDate) : null;
  }
  set due(v: ICalDateTime | ICalDate | Date) {
    if (v instanceof Date) {
      this.setProperty('DUE', { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime);
    } else if (v.type === 'date') {
      this.setProperty('DUE', v, { VALUE: 'DATE' });
    } else {
      this.setProperty('DUE', v);
    }
  }

  get completed(): ICalDateTime | null {
    const v = this.getValue('COMPLETED');
    return v && typeof v === 'object' && v.type === 'date-time' ? (v as ICalDateTime) : null;
  }
  set completed(v: ICalDateTime | Date) {
    this.setProperty('COMPLETED', v instanceof Date
      ? { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime
      : v);
  }

  get duration(): ICalDuration | null {
    const v = this.getValue('DURATION');
    return v && typeof v === 'object' && v.type === 'duration' ? (v as ICalDuration) : null;
  }
  set duration(v: ICalDuration) {
    this.setProperty('DURATION', v);
  }

  // ── Descriptive ──────────────────────────────────────────────────────

  get summary(): string | null {
    return this.getProperty('SUMMARY')?.text ?? null;
  }
  set summary(v: string) {
    this.setProperty('SUMMARY', v);
  }

  get description(): string | null {
    return this.getProperty('DESCRIPTION')?.text ?? null;
  }
  set description(v: string) {
    this.setProperty('DESCRIPTION', v);
  }

  get location(): string | null {
    return this.getProperty('LOCATION')?.text ?? null;
  }
  set location(v: string) {
    this.setProperty('LOCATION', v);
  }

  get status(): 'NEEDS-ACTION' | 'COMPLETED' | 'IN-PROCESS' | 'CANCELLED' | string | null {
    return this.getProperty('STATUS')?.text ?? null;
  }
  set status(v: string) {
    this.setProperty('STATUS', v);
  }

  get priority(): number | null {
    return this.getProperty('PRIORITY')?.number ?? null;
  }
  set priority(v: number) {
    this.setProperty('PRIORITY', Math.max(0, Math.min(9, Math.trunc(v))));
  }

  get percentComplete(): number | null {
    return this.getProperty('PERCENT-COMPLETE')?.number ?? null;
  }
  set percentComplete(v: number) {
    this.setProperty('PERCENT-COMPLETE', Math.max(0, Math.min(100, Math.trunc(v))));
  }

  get sequence(): number | null {
    return this.getProperty('SEQUENCE')?.number ?? null;
  }
  set sequence(v: number) {
    this.setProperty('SEQUENCE', Math.max(0, Math.trunc(v)));
  }

  get klass(): string | null {
    return this.getProperty('CLASS')?.text ?? null;
  }
  set klass(v: string) {
    this.setProperty('CLASS', v);
  }

  get url(): string | null {
    return this.getProperty('URL')?.text ?? null;
  }
  set url(v: string) {
    this.setProperty('URL', v);
  }

  get geo(): ICalGeo | null {
    const v = this.getValue('GEO');
    return v && typeof v === 'object' && v.type === 'geo' ? (v as ICalGeo) : null;
  }
  set geo(v: ICalGeo) {
    this.setProperty('GEO', v);
  }

  get organizer(): string | null {
    return this.getProperty('ORGANIZER')?.text ?? null;
  }
  set organizer(v: string) {
    this.setProperty('ORGANIZER', v);
  }

  get created(): ICalDateTime | null {
    const v = this.getValue('CREATED');
    return v && typeof v === 'object' && v.type === 'date-time' ? (v as ICalDateTime) : null;
  }
  set created(v: ICalDateTime | Date) {
    this.setProperty('CREATED', v instanceof Date
      ? { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime
      : v);
  }

  get lastModified(): ICalDateTime | null {
    const v = this.getValue('LAST-MODIFIED');
    return v && typeof v === 'object' && v.type === 'date-time' ? (v as ICalDateTime) : null;
  }
  set lastModified(v: ICalDateTime | Date) {
    this.setProperty('LAST-MODIFIED', v instanceof Date
      ? { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime
      : v);
  }

  // ── Multi-occurrence ──────────────────────────────────────────────────

  get attendees(): Property[] {
    return this.getProperties('ATTENDEE');
  }

  addAttendee(calAddress: string, params: Record<string, string> = {}): this {
    this.appendProperty('ATTENDEE', calAddress, params);
    return this;
  }

  get categories(): ICalValue[] {
    return this.getValues('CATEGORIES');
  }

  set categories(v: string[]) {
    this.setProperty('CATEGORIES', v);
  }

  get rrules(): ICalRecur[] {
    return this.getProperties('RRULE')
      .map((p) => p.scalar)
      .filter((v): v is ICalRecur => typeof v === 'object' && v !== null && v.type === 'recur');
  }

  addRrule(v: ICalRecur): this {
    this.appendProperty('RRULE', v);
    return this;
  }

  get alarms(): Alarm[] {
    return this.getComponents('VALARM') as Alarm[];
  }

  addAlarm(alarm: Alarm): this {
    this.addComponent(alarm);
    return this;
  }

  // ── Validation ────────────────────────────────────────────────────────

  override toString(): string {
    if (!this.uid) throw new Error('VTODO: UID is required');
    if (!this.getProperty('DTSTAMP')) throw new Error('VTODO: DTSTAMP is required');
    if (this.getProperty('DUE') && this.getProperty('DURATION')) {
      throw new Error('VTODO: DUE and DURATION MUST NOT both be present');
    }
    return super.toString();
  }

  // ── Factory ──────────────────────────────────────────────────────────

  static fromRaw(
    props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
    subcomponents: Component[] = [],
  ): Todo {
    const todo = new Todo();
    for (const { name, params, value } of props) {
      todo.addProperty(parseProperty(name, value, params));
    }
    for (const sub of subcomponents) {
      todo.addComponent(sub);
    }
    return todo;
  }
}

/**
 * VJOURNAL component (RFC 5545 §3.6.3)
 *
 * UID and DTSTAMP are required.
 */

import { Component } from './component.js';
import { Property, parseProperty } from './property.js';
import type { ICalDate, ICalDateTime, ICalRecur, ICalValue } from './types.js';

export class Journal extends Component {
  constructor() {
    super('VJOURNAL');
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

  // ── Descriptive ──────────────────────────────────────────────────────

  get summary(): string | null {
    return this.getProperty('SUMMARY')?.text ?? null;
  }
  set summary(v: string) {
    this.setProperty('SUMMARY', v);
  }

  get descriptions(): Property[] {
    return this.getProperties('DESCRIPTION');
  }

  addDescription(v: string): this {
    this.appendProperty('DESCRIPTION', v);
    return this;
  }

  get status(): 'DRAFT' | 'FINAL' | 'CANCELLED' | string | null {
    return this.getProperty('STATUS')?.text ?? null;
  }
  set status(v: string) {
    this.setProperty('STATUS', v);
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

  get organizer(): string | null {
    return this.getProperty('ORGANIZER')?.text ?? null;
  }
  set organizer(v: string) {
    this.setProperty('ORGANIZER', v);
  }

  get sequence(): number | null {
    return this.getProperty('SEQUENCE')?.number ?? null;
  }
  set sequence(v: number) {
    this.setProperty('SEQUENCE', Math.max(0, Math.trunc(v)));
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

  // ── Validation ────────────────────────────────────────────────────────

  override toString(): string {
    if (!this.uid) throw new Error('VJOURNAL: UID is required');
    if (!this.getProperty('DTSTAMP')) throw new Error('VJOURNAL: DTSTAMP is required');
    return super.toString();
  }

  // ── Factory ──────────────────────────────────────────────────────────

  static fromRaw(
    props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
  ): Journal {
    const journal = new Journal();
    for (const { name, params, value } of props) {
      journal.addProperty(parseProperty(name, value, params));
    }
    return journal;
  }
}

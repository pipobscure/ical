/**
 * VEVENT component (RFC 5545 §3.6.1)
 *
 * UID and DTSTAMP are required.
 * DTSTART is required when METHOD is not present in the calendar.
 */

import { Component } from './component.js';
import { Property, parseProperty } from './property.js';
import { Alarm } from './alarm.js';
import type {
  ICalDate,
  ICalDateTime,
  ICalDuration,
  ICalRecur,
  ICalGeo,
  ICalValue,
} from './types.js';

export class Event extends Component {
  constructor() {
    super('VEVENT');
  }

  // ── Required / very common properties ───────────────────────────────

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
    if (v instanceof Date) {
      this.setProperty('DTSTAMP', {
        type: 'date-time',
        year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(),
        hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(),
        utc: true,
      } satisfies ICalDateTime);
    } else {
      this.setProperty('DTSTAMP', v);
    }
  }

  get dtstart(): ICalDateTime | ICalDate | null {
    const v = this.getValue('DTSTART');
    if (!v || typeof v !== 'object') return null;
    return v.type === 'date-time' || v.type === 'date' ? (v as ICalDateTime | ICalDate) : null;
  }
  set dtstart(v: ICalDateTime | ICalDate | Date) {
    if (v instanceof Date) {
      this.setProperty('DTSTART', {
        type: 'date-time',
        year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(),
        hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(),
        utc: true,
      } satisfies ICalDateTime);
    } else if (v.type === 'date') {
      this.setProperty('DTSTART', v, { VALUE: 'DATE' });
    } else {
      this.setProperty('DTSTART', v);
    }
  }

  get dtend(): ICalDateTime | ICalDate | null {
    const v = this.getValue('DTEND');
    if (!v || typeof v !== 'object') return null;
    return v.type === 'date-time' || v.type === 'date' ? (v as ICalDateTime | ICalDate) : null;
  }
  set dtend(v: ICalDateTime | ICalDate | Date) {
    if (v instanceof Date) {
      this.setProperty('DTEND', {
        type: 'date-time',
        year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(),
        hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(),
        utc: true,
      } satisfies ICalDateTime);
    } else if (v.type === 'date') {
      this.setProperty('DTEND', v, { VALUE: 'DATE' });
    } else {
      this.setProperty('DTEND', v);
    }
  }

  get duration(): ICalDuration | null {
    const v = this.getValue('DURATION');
    return v && typeof v === 'object' && v.type === 'duration' ? (v as ICalDuration) : null;
  }
  set duration(v: ICalDuration) {
    this.setProperty('DURATION', v);
  }

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

  get url(): string | null {
    return this.getProperty('URL')?.text ?? null;
  }
  set url(v: string) {
    this.setProperty('URL', v);
  }

  get status(): string | null {
    return this.getProperty('STATUS')?.text ?? null;
  }
  set status(v: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED' | string) {
    this.setProperty('STATUS', v);
  }

  get transp(): 'OPAQUE' | 'TRANSPARENT' | string | null {
    return this.getProperty('TRANSP')?.text ?? null;
  }
  set transp(v: 'OPAQUE' | 'TRANSPARENT' | string) {
    this.setProperty('TRANSP', v);
  }

  get klass(): string | null {
    return this.getProperty('CLASS')?.text ?? null;
  }
  set klass(v: 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | string) {
    this.setProperty('CLASS', v);
  }

  get priority(): number | null {
    return this.getProperty('PRIORITY')?.number ?? null;
  }
  set priority(v: number) {
    this.setProperty('PRIORITY', Math.max(0, Math.min(9, Math.trunc(v))));
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

  get recurrenceId(): ICalDateTime | ICalDate | null {
    const v = this.getValue('RECURRENCE-ID');
    if (!v || typeof v !== 'object') return null;
    return v.type === 'date-time' || v.type === 'date' ? (v as ICalDateTime | ICalDate) : null;
  }
  set recurrenceId(v: ICalDateTime | ICalDate) {
    const params: Record<string, string> = v.type === 'date' ? { VALUE: 'DATE' } : {};
    this.setProperty('RECURRENCE-ID', v, params);
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

  // ── Multi-occurrence properties ──────────────────────────────────────

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

  get comments(): Property[] {
    return this.getProperties('COMMENT');
  }

  addComment(v: string): this {
    this.appendProperty('COMMENT', v);
    return this;
  }

  get contacts(): Property[] {
    return this.getProperties('CONTACT');
  }

  addContact(v: string): this {
    this.appendProperty('CONTACT', v);
    return this;
  }

  get exdates(): ICalValue[] {
    return this.getProperties('EXDATE').flatMap((p) => p.list);
  }

  addExdate(v: ICalDateTime | ICalDate): this {
    const params: Record<string, string> = v.type === 'date' ? { VALUE: 'DATE' } : {};
    this.appendProperty('EXDATE', v, params);
    return this;
  }

  get rdates(): ICalValue[] {
    return this.getProperties('RDATE').flatMap((p) => p.list);
  }

  addRdate(v: ICalDateTime | ICalDate): this {
    const params: Record<string, string> = v.type === 'date' ? { VALUE: 'DATE' } : {};
    this.appendProperty('RDATE', v, params);
    return this;
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

  // ── Strict validation ────────────────────────────────────────────────

  override toString(): string {
    if (!this.uid) throw new Error('VEVENT: UID is required');
    if (!this.getProperty('DTSTAMP')) throw new Error('VEVENT: DTSTAMP is required');
    return super.toString();
  }

  // ── Factory ──────────────────────────────────────────────────────────

  static fromRaw(
    props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
    subcomponents: Component[] = [],
  ): Event {
    const event = new Event();
    for (const { name, params, value } of props) {
      event.addProperty(parseProperty(name, value, params));
    }
    for (const sub of subcomponents) {
      event.addComponent(sub);
    }
    return event;
  }
}

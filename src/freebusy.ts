/**
 * VFREEBUSY component (RFC 5545 §3.6.4)
 *
 * UID and DTSTAMP are required.
 * FREEBUSY properties list free/busy time periods.
 */

import { Component } from './component.js';
import { Property, parseProperty } from './property.js';
import type { ICalDateTime, ICalPeriod } from './types.js';

export class FreeBusy extends Component {
  constructor() {
    super('VFREEBUSY');
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

  // ── Date/time span ───────────────────────────────────────────────────

  get dtstart(): ICalDateTime | null {
    const v = this.getValue('DTSTART');
    return v && typeof v === 'object' && v.type === 'date-time' ? (v as ICalDateTime) : null;
  }
  set dtstart(v: ICalDateTime | Date) {
    this.setProperty('DTSTART', v instanceof Date
      ? { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime
      : v);
  }

  get dtend(): ICalDateTime | null {
    const v = this.getValue('DTEND');
    return v && typeof v === 'object' && v.type === 'date-time' ? (v as ICalDateTime) : null;
  }
  set dtend(v: ICalDateTime | Date) {
    this.setProperty('DTEND', v instanceof Date
      ? { type: 'date-time', year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate(), hour: v.getUTCHours(), minute: v.getUTCMinutes(), second: v.getUTCSeconds(), utc: true } satisfies ICalDateTime
      : v);
  }

  // ── Participants ──────────────────────────────────────────────────────

  get organizer(): string | null {
    return this.getProperty('ORGANIZER')?.text ?? null;
  }
  set organizer(v: string) {
    this.setProperty('ORGANIZER', v);
  }

  get attendees(): Property[] {
    return this.getProperties('ATTENDEE');
  }

  addAttendee(calAddress: string, params: Record<string, string> = {}): this {
    this.appendProperty('ATTENDEE', calAddress, params);
    return this;
  }

  get url(): string | null {
    return this.getProperty('URL')?.text ?? null;
  }
  set url(v: string) {
    this.setProperty('URL', v);
  }

  get comment(): string | null {
    return this.getProperty('COMMENT')?.text ?? null;
  }
  set comment(v: string) {
    this.setProperty('COMMENT', v);
  }

  // ── FREEBUSY periods ─────────────────────────────────────────────────

  /** All FREEBUSY properties (may have multiple, each with FBTYPE parameter). */
  get freebusyProperties(): Property[] {
    return this.getProperties('FREEBUSY');
  }

  /** Flat list of all PERIOD values across all FREEBUSY properties. */
  get periods(): ICalPeriod[] {
    return this.getProperties('FREEBUSY')
      .flatMap((p) => p.list)
      .filter((v): v is ICalPeriod => typeof v === 'object' && v !== null && v.type === 'period');
  }

  /**
   * Add a FREEBUSY property containing one or more periods.
   * @param periods - Array of periods for this FREEBUSY property.
   * @param fbtype - FBTYPE parameter value (FREE, BUSY, BUSY-UNAVAILABLE, BUSY-TENTATIVE).
   */
  addFreebusy(periods: ICalPeriod[], fbtype = 'BUSY'): this {
    this.appendProperty('FREEBUSY', periods, { FBTYPE: fbtype });
    return this;
  }

  // ── Validation ────────────────────────────────────────────────────────

  override toString(): string {
    if (!this.uid) throw new Error('VFREEBUSY: UID is required');
    if (!this.getProperty('DTSTAMP')) throw new Error('VFREEBUSY: DTSTAMP is required');
    return super.toString();
  }

  // ── Factory ──────────────────────────────────────────────────────────

  static fromRaw(
    props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
  ): FreeBusy {
    const fb = new FreeBusy();
    for (const { name, params, value } of props) {
      fb.addProperty(parseProperty(name, value, params));
    }
    return fb;
  }
}

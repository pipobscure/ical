/**
 * VALARM component (RFC 5545 §3.6.6)
 *
 * ACTION is required.  TRIGGER is required.
 * Three alarm types: AUDIO, DISPLAY, EMAIL.
 */

import { Component } from './component.js';
import { Property, parseProperty } from './property.js';
import type { ICalDuration, ICalDateTime } from './types.js';

export type AlarmAction = 'AUDIO' | 'DISPLAY' | 'EMAIL' | string;

export class Alarm extends Component {
  constructor() {
    super('VALARM');
  }

  // ── Required properties ──────────────────────────────────────────────

  get action(): AlarmAction | null {
    return this.getProperty('ACTION')?.text ?? null;
  }
  set action(v: AlarmAction) {
    this.setProperty('ACTION', v);
  }

  /** TRIGGER: relative (DURATION) or absolute (DATE-TIME). */
  get trigger(): ICalDuration | ICalDateTime | null {
    const p = this.getProperty('TRIGGER');
    if (!p) return null;
    const v = p.scalar;
    if (typeof v === 'object' && v !== null && (v.type === 'duration' || v.type === 'date-time')) {
      return v as ICalDuration | ICalDateTime;
    }
    return null;
  }
  set trigger(v: ICalDuration | ICalDateTime) {
    const params: Record<string, string> =
      v.type === 'date-time' ? { VALUE: 'DATE-TIME' } : {};
    this.setProperty('TRIGGER', v, params);
  }

  // ── Optional properties ──────────────────────────────────────────────

  get description(): string | null {
    return this.getProperty('DESCRIPTION')?.text ?? null;
  }
  set description(v: string) {
    this.setProperty('DESCRIPTION', v);
  }

  get summary(): string | null {
    return this.getProperty('SUMMARY')?.text ?? null;
  }
  set summary(v: string) {
    this.setProperty('SUMMARY', v);
  }

  get repeat(): number | null {
    return this.getProperty('REPEAT')?.number ?? null;
  }
  set repeat(v: number) {
    this.setProperty('REPEAT', v);
  }

  get duration(): ICalDuration | null {
    const v = this.getValue('DURATION');
    return typeof v === 'object' && v !== null && v.type === 'duration'
      ? (v as ICalDuration)
      : null;
  }
  set duration(v: ICalDuration) {
    this.setProperty('DURATION', v);
  }

  get attendees(): Property[] {
    return this.getProperties('ATTENDEE');
  }

  addAttendee(calAddress: string, params: Record<string, string> = {}): this {
    this.appendProperty('ATTENDEE', calAddress, params);
    return this;
  }

  // ── Strict validation before serialization ───────────────────────────

  override toString(): string {
    if (!this.action) throw new Error('VALARM: ACTION is required');
    if (!this.getProperty('TRIGGER')) throw new Error('VALARM: TRIGGER is required');
    return super.toString();
  }

  // ── Factory ──────────────────────────────────────────────────────────

  static fromRaw(
    props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
  ): Alarm {
    const alarm = new Alarm();
    for (const { name, params, value } of props) {
      alarm.addProperty(parseProperty(name, value, params));
    }
    return alarm;
  }
}

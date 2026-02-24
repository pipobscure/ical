/**
 * VTIMEZONE, DAYLIGHT, and STANDARD components (RFC 5545 §3.6.5)
 *
 * VTIMEZONE contains one or more DAYLIGHT or STANDARD sub-components that
 * define the UTC offset rules.
 */

import { Component } from './component.js';
import { parseProperty } from './property.js';
import type { ICalDateTime, ICalUtcOffset, ICalRecur } from './types.js';

// ── STANDARD / DAYLIGHT ──────────────────────────────────────────────────

export class TimezoneRule extends Component {
  constructor(type: 'STANDARD' | 'DAYLIGHT') {
    super(type);
  }

  get dtstart(): ICalDateTime | null {
    const v = this.getValue('DTSTART');
    return typeof v === 'object' && v !== null && v.type === 'date-time'
      ? (v as ICalDateTime)
      : null;
  }
  set dtstart(v: ICalDateTime) {
    this.setProperty('DTSTART', v);
  }

  get tzoffsetfrom(): ICalUtcOffset | null {
    const v = this.getValue('TZOFFSETFROM');
    return typeof v === 'object' && v !== null && v.type === 'utc-offset'
      ? (v as ICalUtcOffset)
      : null;
  }
  set tzoffsetfrom(v: ICalUtcOffset) {
    this.setProperty('TZOFFSETFROM', v);
  }

  get tzoffsetto(): ICalUtcOffset | null {
    const v = this.getValue('TZOFFSETTO');
    return typeof v === 'object' && v !== null && v.type === 'utc-offset'
      ? (v as ICalUtcOffset)
      : null;
  }
  set tzoffsetto(v: ICalUtcOffset) {
    this.setProperty('TZOFFSETTO', v);
  }

  get tzname(): string | null {
    return this.getProperty('TZNAME')?.text ?? null;
  }
  set tzname(v: string) {
    this.setProperty('TZNAME', v);
  }

  get rrule(): ICalRecur | null {
    const v = this.getValue('RRULE');
    return typeof v === 'object' && v !== null && v.type === 'recur' ? (v as ICalRecur) : null;
  }
  set rrule(v: ICalRecur) {
    this.setProperty('RRULE', v);
  }

  // ── Strict validation ────────────────────────────────────────────────

  override toString(): string {
    if (!this.dtstart) throw new Error(`${this.type}: DTSTART is required`);
    if (!this.tzoffsetfrom) throw new Error(`${this.type}: TZOFFSETFROM is required`);
    if (!this.tzoffsetto) throw new Error(`${this.type}: TZOFFSETTO is required`);
    return super.toString();
  }
}

export class Standard extends TimezoneRule {
  constructor() { super('STANDARD'); }
}

export class Daylight extends TimezoneRule {
  constructor() { super('DAYLIGHT'); }
}

// ── VTIMEZONE ─────────────────────────────────────────────────────────────

export class Timezone extends Component {
  constructor() {
    super('VTIMEZONE');
  }

  /** TZID is required (RFC 5545 §3.6.5). */
  get tzid(): string | null {
    return this.getProperty('TZID')?.text ?? null;
  }
  set tzid(v: string) {
    this.setProperty('TZID', v);
  }

  get tzurl(): string | null {
    return this.getProperty('TZURL')?.text ?? null;
  }
  set tzurl(v: string) {
    this.setProperty('TZURL', v);
  }

  get lastModified(): ICalDateTime | null {
    const v = this.getValue('LAST-MODIFIED');
    return typeof v === 'object' && v !== null && v.type === 'date-time'
      ? (v as ICalDateTime)
      : null;
  }
  set lastModified(v: ICalDateTime) {
    this.setProperty('LAST-MODIFIED', v);
  }

  get standardRules(): TimezoneRule[] {
    return this.getComponents('STANDARD') as TimezoneRule[];
  }

  get daylightRules(): TimezoneRule[] {
    return this.getComponents('DAYLIGHT') as TimezoneRule[];
  }

  addStandard(rule: Standard): this {
    this.addComponent(rule);
    return this;
  }

  addDaylight(rule: Daylight): this {
    this.addComponent(rule);
    return this;
  }

  // ── Strict validation ────────────────────────────────────────────────

  override toString(): string {
    if (!this.tzid) throw new Error('VTIMEZONE: TZID is required');
    if (this.components.length === 0) {
      throw new Error('VTIMEZONE: at least one STANDARD or DAYLIGHT sub-component is required');
    }
    return super.toString();
  }

  // ── Factory ──────────────────────────────────────────────────────────

  static fromRaw(
    props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
    subcomponents: Component[],
  ): Timezone {
    const tz = new Timezone();
    for (const { name, params, value } of props) {
      tz.addProperty(parseProperty(name, value, params));
    }
    for (const sub of subcomponents) {
      tz.addComponent(sub);
    }
    return tz;
  }
}

/** Build a TimezoneRule (STANDARD or DAYLIGHT) from raw parsed data. */
export function buildTimezoneRule(
  type: string,
  props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
): TimezoneRule {
  const rule = type.toUpperCase() === 'DAYLIGHT' ? new Daylight() : new Standard();
  for (const { name, params, value } of props) {
    rule.addProperty(parseProperty(name, value, params));
  }
  return rule;
}

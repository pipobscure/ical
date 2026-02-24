/**
 * VCALENDAR component (RFC 5545 §3.4, §3.6)
 *
 * Top-level container.  VERSION and PRODID are required.
 * Contains VEVENT, VTODO, VJOURNAL, VFREEBUSY, and VTIMEZONE sub-components.
 */

import { Component } from './component.js';
import { parseProperty } from './property.js';
import { Event } from './event.js';
import { Todo } from './todo.js';
import { Journal } from './journal.js';
import { FreeBusy } from './freebusy.js';
import { Timezone } from './timezone.js';

export class Calendar extends Component {
  constructor() {
    super('VCALENDAR');
  }

  // ── Required properties ──────────────────────────────────────────────

  /** RFC 5545 requires VERSION:2.0 */
  get version(): string | null {
    return this.getProperty('VERSION')?.text ?? null;
  }
  set version(v: string) {
    this.setProperty('VERSION', v);
  }

  /** e.g. '-//My App//My App v1.0//EN' */
  get prodid(): string | null {
    return this.getProperty('PRODID')?.text ?? null;
  }
  set prodid(v: string) {
    this.setProperty('PRODID', v);
  }

  // ── Optional calendar properties ─────────────────────────────────────

  /** Defaults to GREGORIAN when absent */
  get calscale(): string | null {
    return this.getProperty('CALSCALE')?.text ?? null;
  }
  set calscale(v: string) {
    this.setProperty('CALSCALE', v);
  }

  /** iTIP method (REQUEST, REPLY, CANCEL, etc.) */
  get method(): string | null {
    return this.getProperty('METHOD')?.text ?? null;
  }
  set method(v: string) {
    this.setProperty('METHOD', v);
  }

  // ── Sub-component accessors ──────────────────────────────────────────

  get events(): Event[] {
    return this.getComponents('VEVENT') as Event[];
  }

  get todos(): Todo[] {
    return this.getComponents('VTODO') as Todo[];
  }

  get journals(): Journal[] {
    return this.getComponents('VJOURNAL') as Journal[];
  }

  get freebusys(): FreeBusy[] {
    return this.getComponents('VFREEBUSY') as FreeBusy[];
  }

  get timezones(): Timezone[] {
    return this.getComponents('VTIMEZONE') as Timezone[];
  }

  // ── Fluent add methods ───────────────────────────────────────────────

  addEvent(event: Event): this {
    this.addComponent(event);
    return this;
  }

  addTodo(todo: Todo): this {
    this.addComponent(todo);
    return this;
  }

  addJournal(journal: Journal): this {
    this.addComponent(journal);
    return this;
  }

  addFreebusy(fb: FreeBusy): this {
    this.addComponent(fb);
    return this;
  }

  addTimezone(tz: Timezone): this {
    this.addComponent(tz);
    return this;
  }

  // ── Lookup helpers ───────────────────────────────────────────────────

  /** Find an event/todo/journal by UID. */
  getByUid(uid: string): Event | Todo | Journal | undefined {
    const all: Array<Event | Todo | Journal> = [...this.events, ...this.todos, ...this.journals];
    return all.find((c) => c.uid === uid);
  }

  /** Look up a VTIMEZONE by TZID. */
  getTimezone(tzid: string): Timezone | undefined {
    return this.timezones.find((tz) => tz.tzid === tzid);
  }

  // ── Strict serialization ─────────────────────────────────────────────

  override toString(): string {
    if (!this.prodid) throw new Error('VCALENDAR: PRODID is required');
    if (!this.version) throw new Error('VCALENDAR: VERSION is required');
    return super.toString();
  }

  // ── Factory ──────────────────────────────────────────────────────────

  static fromRaw(
    props: ReadonlyArray<{ name: string; params: Record<string, string>; value: string }>,
    subcomponents: Component[],
  ): Calendar {
    const cal = new Calendar();
    for (const { name, params, value } of props) {
      cal.addProperty(parseProperty(name, value, params));
    }
    for (const sub of subcomponents) {
      cal.addComponent(sub);
    }
    return cal;
  }

  /**
   * Create a minimal valid VCALENDAR with sensible defaults.
   */
  static create(prodid: string, method?: string): Calendar {
    const cal = new Calendar();
    cal.version = '2.0';
    cal.prodid = prodid;
    if (method) cal.method = method;
    return cal;
  }
}

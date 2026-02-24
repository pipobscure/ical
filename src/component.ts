/**
 * Base Component class for all iCalendar components.
 *
 * Stores properties as an ordered list (preserving parse order) and also
 * indexes them by name for O(1) lookup.  Supports multiple occurrences of
 * the same property name (e.g. ATTENDEE, RDATE, EXDATE).
 *
 * Serialization is strict: outputs CRLF line endings, folds at 75 octets.
 */

import { Property } from './property.js';
import type { ICalValue } from './types.js';

// ── Line folding (RFC 5545 §3.1) ─────────────────────────────────────────

/** Count UTF-8 octets in a string without allocating a Buffer. */
function octetLen(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c < 0xd800 || c >= 0xe000) n += 3;
    else { i++; n += 4; } // surrogate pair → U+10000..U+10FFFF
  }
  return n;
}

/**
 * Fold a single content-line string into RFC 5545-compliant chunks.
 * Returns the string with CRLF + SPACE inserted at 75-octet boundaries.
 */
function foldLine(line: string): string {
  if (octetLen(line) <= 75) return line;

  const chunks: string[] = [];
  let pos = 0;
  let firstLine = true;

  while (pos < line.length) {
    const maxOctets = firstLine ? 75 : 74; // continuation prefix ' ' takes 1 octet
    let end = pos;
    let octets = 0;

    while (end < line.length) {
      const c = line.charCodeAt(end);
      let charOctets: number;
      if (c < 0x80) charOctets = 1;
      else if (c < 0x800) charOctets = 2;
      else if (c < 0xd800 || c >= 0xe000) charOctets = 3;
      else { charOctets = 4; } // surrogate pair

      if (octets + charOctets > maxOctets) break;
      octets += charOctets;
      end += c >= 0xd800 && c < 0xdc00 ? 2 : 1; // advance past surrogate pairs
    }

    if (end === pos) break; // safety: single char wider than budget

    chunks.push((firstLine ? '' : ' ') + line.slice(pos, end));
    pos = end;
    firstLine = false;
  }

  return chunks.join('\r\n');
}

// ── Component ─────────────────────────────────────────────────────────────

export class Component {
  readonly type: string;

  /** Ordered list of properties (preserves parse order). */
  protected readonly _props: Property[] = [];
  /** Index: name → Property[] */
  private readonly _index = new Map<string, Property[]>();
  /** Child components (e.g. VALARM inside VEVENT). */
  readonly components: Component[] = [];

  constructor(type: string) {
    this.type = type.toUpperCase();
  }

  // ── Property access ──────────────────────────────────────────────────

  /** Return the first Property with the given name, or undefined. */
  getProperty(name: string): Property | undefined {
    return this._index.get(name.toUpperCase())?.[0];
  }

  /** Return all Property instances with the given name. */
  getProperties(name: string): Property[] {
    return this._index.get(name.toUpperCase()) ?? [];
  }

  /** Return the scalar value of the first property with the given name. */
  getValue(name: string): ICalValue | null | undefined {
    const p = this.getProperty(name);
    return p?.scalar;
  }

  /** Return the typed list value of the first property with the given name. */
  getValues(name: string): ICalValue[] {
    return this.getProperty(name)?.list ?? [];
  }

  // ── Property mutation ────────────────────────────────────────────────

  /** Add a Property instance (preserving insertion order). */
  addProperty(prop: Property): void {
    this._props.push(prop);
    const key = prop.name;
    const existing = this._index.get(key);
    if (existing) {
      existing.push(prop);
    } else {
      this._index.set(key, [prop]);
    }
  }

  /**
   * Replace all existing properties with the given name with a single new one.
   * If value is undefined/null the property is removed.
   */
  setProperty(
    name: string,
    value: ICalValue | readonly ICalValue[] | null | undefined,
    params: Readonly<Record<string, string | readonly string[]>> = {},
  ): void {
    const key = name.toUpperCase();
    // Remove existing
    const startLen = this._props.length;
    const idx = this._props.findIndex((p) => p.name === key);
    if (idx !== -1) this._props.splice(idx, 1);
    this._index.delete(key);

    if (value === null || value === undefined) return;

    const prop = new Property(key, value, params);
    // Insert at the position where old one was (or append)
    const insertAt = idx !== -1 && idx < this._props.length ? idx : this._props.length;
    this._props.splice(insertAt, 0, prop);
    this._index.set(key, [prop]);
  }

  /** Append an additional property (for multi-value properties). */
  appendProperty(
    name: string,
    value: ICalValue | readonly ICalValue[],
    params: Readonly<Record<string, string | readonly string[]>> = {},
  ): void {
    const prop = new Property(name.toUpperCase(), value, params);
    this.addProperty(prop);
  }

  /** Remove all properties with the given name. */
  removeProperty(name: string): void {
    const key = name.toUpperCase();
    const filtered = this._props.filter((p) => p.name !== key);
    this._props.length = 0;
    this._props.push(...filtered);
    this._index.delete(key);
  }

  // ── Component children ───────────────────────────────────────────────

  addComponent(comp: Component): void {
    this.components.push(comp);
  }

  getComponents(type: string): Component[] {
    return this.components.filter((c) => c.type === type.toUpperCase());
  }

  // ── Serialization ────────────────────────────────────────────────────

  /**
   * Serialize to an RFC 5545-compliant iCalendar string segment.
   * Uses CRLF line endings and folds at 75 octets.
   */
  toString(): string {
    const lines: string[] = [];
    lines.push(`BEGIN:${this.type}`);
    for (const prop of this._props) {
      lines.push(foldLine(prop.toContentLine()));
    }
    for (const child of this.components) {
      lines.push(child.toString());
    }
    lines.push(`END:${this.type}`);
    return lines.join('\r\n');
  }
}

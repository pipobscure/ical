/**
 * Property — a named, parametered, typed iCalendar property.
 *
 * Strict on construction (required for serialization).
 * Tolerant when created from raw parsed data.
 */

import type { ICalValue, ParsedProperty } from './types.js';
import { CODECS, GEO } from './value-types.js';
import { getPropertyDef, resolveValueType } from './property-registry.js';
import type { ValueTypeName } from './property-registry.js';

export class Property implements ParsedProperty {
  readonly name: string;
  readonly params: Readonly<Record<string, string | readonly string[]>>;
  readonly value: ICalValue | readonly ICalValue[];
  readonly rawValue: string;

  constructor(
    name: string,
    value: ICalValue | readonly ICalValue[],
    params: Readonly<Record<string, string | readonly string[]>> = {},
    rawValue = '',
  ) {
    this.name = name.toUpperCase();
    this.value = value;
    this.params = params;
    this.rawValue = rawValue;
  }

  /** Get the first (or only) value as a plain value (null when the list is empty). */
  get scalar(): ICalValue | null {
    const v = this.value;
    if (Array.isArray(v)) return (v as ICalValue[])[0] ?? null;
    return v as ICalValue;
  }

  /** Get the value as an array (always). */
  get list(): ICalValue[] {
    const v = this.value;
    if (Array.isArray(v)) return [...(v as ICalValue[])];
    return [v as ICalValue];
  }

  /** Convenience: get value as string (or null). */
  get text(): string | null {
    const v = this.scalar;
    return typeof v === 'string' ? v : null;
  }

  /** Convenience: get value as number (or null). */
  get number(): number | null {
    const v = this.scalar;
    return typeof v === 'number' ? v : null;
  }

  /** Convenience: get value as boolean. */
  get boolean(): boolean | null {
    const v = this.scalar;
    return typeof v === 'boolean' ? v : null;
  }

  /**
   * Serialize this property to a single (unfolded) content line string.
   * Throws if the value type cannot be serialized.
   */
  toContentLine(): string {
    const paramStr = serializeParams(this.params);
    const valueStr = this.serializeValue();
    return `${this.name}${paramStr}:${valueStr}`;
  }

  private serializeValue(): string {
    const def = getPropertyDef(this.name);
    const typeName = resolveValueType(this.name, this.params);

    if (typeName === 'GEO') {
      const v = this.scalar as { type: 'geo'; latitude: number; longitude: number };
      return GEO.serialize(v);
    }

    const codec = CODECS[typeName];

    const serialize = (v: ICalValue): string => {
      if (codec) return codec.serialize(v);
      // Unknown / X- property: convert to string
      return String(v ?? '');
    };

    if (def?.multi && Array.isArray(this.value)) {
      return this.value.map(serialize).join(',');
    }
    return serialize(Array.isArray(this.value) ? (this.value[0] ?? '') : this.value);
  }
}

function serializeParams(
  params: Readonly<Record<string, string | readonly string[]>>,
): string {
  let result = '';
  for (const [key, val] of Object.entries(params)) {
    const valStr = Array.isArray(val) ? val.join(',') : val;
    // Quote if contains special characters
    const needsQuote = /[;:,]/.test(valStr as string);
    result += `;${key}=${needsQuote ? `"${valStr}"` : valStr}`;
  }
  return result;
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * Parse a raw content-line value string into a typed Property.
 * Tolerant: unknown value types fall back to TEXT.
 */
export function parseProperty(
  name: string,
  rawValue: string,
  params: Readonly<Record<string, string | readonly string[]>>,
): Property {
  const typeName = resolveValueType(name, params) as ValueTypeName;
  const def = getPropertyDef(name);

  try {
    if (typeName === 'GEO') {
      return new Property(name, GEO.parse(rawValue), params, rawValue);
    }

    const codec = CODECS[typeName] ?? CODECS['TEXT']!;

    if (def?.multi) {
      // Split on unescaped commas
      const parts = splitMultiValue(rawValue);
      const values = parts.map((p) => codec.parse(p, params) as ICalValue);
      return new Property(name, values, params, rawValue);
    }

    const value = codec.parse(rawValue, params) as ICalValue;
    return new Property(name, value, params, rawValue);
  } catch {
    // Tolerant fallback: store as raw string
    return new Property(name, rawValue, params, rawValue);
  }
}

/** Split a comma-separated multi-value string, respecting backslash escapes. */
function splitMultiValue(raw: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      current += raw[i]! + raw[i + 1]!;
      i++;
    } else if (raw[i] === ',') {
      parts.push(current);
      current = '';
    } else {
      current += raw[i]!;
    }
  }
  parts.push(current);
  return parts;
}

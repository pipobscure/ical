/**
 * RFC 5545 property registry.
 *
 * Maps property names to their default value type, allowed alternative types,
 * whether they accept a list of values, and which components they belong to.
 */

export type ValueTypeName =
  | 'TEXT'
  | 'INTEGER'
  | 'FLOAT'
  | 'BOOLEAN'
  | 'URI'
  | 'CAL-ADDRESS'
  | 'BINARY'
  | 'UTC-OFFSET'
  | 'DATE'
  | 'DATE-TIME'
  | 'TIME'
  | 'DURATION'
  | 'PERIOD'
  | 'RECUR'
  | 'GEO';

export interface PropertyDef {
  /** Default value type when no VALUE= parameter is present */
  readonly defaultType: ValueTypeName;
  /** Additional allowed value types selectable via VALUE= parameter */
  readonly allowedTypes?: readonly ValueTypeName[];
  /**
   * true  → value is a comma-separated list of the same type
   * false → single value
   */
  readonly multi?: boolean;
}

/**
 * RFC 5545 §3.8 — Component Properties
 * Includes deprecated but commonly encountered properties (EXRULE).
 */
export const PROPERTY_REGISTRY: Readonly<Record<string, PropertyDef>> = {
  // ── Calendar Properties (§3.7) ─────────────────────────────────────────
  CALSCALE:         { defaultType: 'TEXT' },
  METHOD:           { defaultType: 'TEXT' },
  PRODID:           { defaultType: 'TEXT' },
  VERSION:          { defaultType: 'TEXT' },

  // ── Descriptive Component Properties (§3.8.1) ──────────────────────────
  ATTACH:           { defaultType: 'URI', allowedTypes: ['BINARY'] },
  CATEGORIES:       { defaultType: 'TEXT', multi: true },
  CLASS:            { defaultType: 'TEXT' },
  COMMENT:          { defaultType: 'TEXT' },
  DESCRIPTION:      { defaultType: 'TEXT' },
  GEO:              { defaultType: 'GEO' },
  LOCATION:         { defaultType: 'TEXT' },
  'PERCENT-COMPLETE': { defaultType: 'INTEGER' },
  PRIORITY:         { defaultType: 'INTEGER' },
  RESOURCES:        { defaultType: 'TEXT', multi: true },
  STATUS:           { defaultType: 'TEXT' },
  SUMMARY:          { defaultType: 'TEXT' },

  // ── Date and Time Component Properties (§3.8.2) ───────────────────────
  COMPLETED:        { defaultType: 'DATE-TIME' },
  DTEND:            { defaultType: 'DATE-TIME', allowedTypes: ['DATE'] },
  DUE:              { defaultType: 'DATE-TIME', allowedTypes: ['DATE'] },
  DTSTART:          { defaultType: 'DATE-TIME', allowedTypes: ['DATE'] },
  DURATION:         { defaultType: 'DURATION' },
  FREEBUSY:         { defaultType: 'PERIOD', multi: true },
  TRANSP:           { defaultType: 'TEXT' },

  // ── Time Zone Component Properties (§3.8.3) ───────────────────────────
  TZID:             { defaultType: 'TEXT' },
  TZNAME:           { defaultType: 'TEXT' },
  TZOFFSETFROM:     { defaultType: 'UTC-OFFSET' },
  TZOFFSETTO:       { defaultType: 'UTC-OFFSET' },
  TZURL:            { defaultType: 'URI' },

  // ── Relationship Component Properties (§3.8.4) ────────────────────────
  ATTENDEE:         { defaultType: 'CAL-ADDRESS' },
  CONTACT:          { defaultType: 'TEXT' },
  ORGANIZER:        { defaultType: 'CAL-ADDRESS' },
  'RECURRENCE-ID':  { defaultType: 'DATE-TIME', allowedTypes: ['DATE'] },
  'RELATED-TO':     { defaultType: 'TEXT' },
  URL:              { defaultType: 'URI' },
  UID:              { defaultType: 'TEXT' },

  // ── Recurrence Component Properties (§3.8.5) ──────────────────────────
  EXDATE:           { defaultType: 'DATE-TIME', allowedTypes: ['DATE'], multi: true },
  RDATE:            { defaultType: 'DATE-TIME', allowedTypes: ['DATE', 'PERIOD'], multi: true },
  RRULE:            { defaultType: 'RECUR' },
  EXRULE:           { defaultType: 'RECUR' }, // deprecated, still common

  // ── Alarm Component Properties (§3.8.6) ───────────────────────────────
  ACTION:           { defaultType: 'TEXT' },
  REPEAT:           { defaultType: 'INTEGER' },
  TRIGGER:          { defaultType: 'DURATION', allowedTypes: ['DATE-TIME'] },

  // ── Change Management Component Properties (§3.8.7) ──────────────────
  CREATED:          { defaultType: 'DATE-TIME' },
  DTSTAMP:          { defaultType: 'DATE-TIME' },
  'LAST-MODIFIED':  { defaultType: 'DATE-TIME' },
  SEQUENCE:         { defaultType: 'INTEGER' },

  // ── Miscellaneous Component Properties (§3.8.8) ───────────────────────
  'REQUEST-STATUS': { defaultType: 'TEXT' },
};

/** Look up a property definition; returns undefined for X- and unknown properties. */
export function getPropertyDef(name: string): PropertyDef | undefined {
  return PROPERTY_REGISTRY[name];
}

/**
 * Determine the effective value type for a content line.
 * Respects VALUE= parameter override.
 */
export function resolveValueType(
  name: string,
  params: Readonly<Record<string, string | readonly string[]>>,
): ValueTypeName {
  const override = typeof params['VALUE'] === 'string' ? params['VALUE'].toUpperCase() : undefined;
  if (override) return override as ValueTypeName;
  return PROPERTY_REGISTRY[name]?.defaultType ?? 'TEXT';
}

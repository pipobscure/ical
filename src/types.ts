/** All structured value types produced by the parser and consumed by the serializer. */

export interface ICalDate {
  readonly type: 'date';
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface ICalDateTime {
  readonly type: 'date-time';
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  /** true when value ends with 'Z' (UTC) */
  readonly utc: boolean;
  /** TZID parameter value when present */
  readonly tzid?: string;
}

export interface ICalTime {
  readonly type: 'time';
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly utc: boolean;
}

export interface ICalDuration {
  readonly type: 'duration';
  readonly negative: boolean;
  readonly weeks?: number;
  readonly days?: number;
  readonly hours?: number;
  readonly minutes?: number;
  readonly seconds?: number;
}

export interface ICalPeriod {
  readonly type: 'period';
  readonly start: ICalDateTime;
  readonly end: ICalDateTime | ICalDuration;
}

export type RecurFreq =
  | 'SECONDLY'
  | 'MINUTELY'
  | 'HOURLY'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY';

export type Weekday = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

export interface ByDayRule {
  readonly day: Weekday;
  /** ordinal week number, e.g. +1 = first, -1 = last */
  readonly ordwk?: number;
}

export interface ICalRecur {
  readonly type: 'recur';
  readonly freq: RecurFreq;
  readonly until?: ICalDate | ICalDateTime;
  readonly count?: number;
  readonly interval?: number;
  readonly bysecond?: readonly number[];
  readonly byminute?: readonly number[];
  readonly byhour?: readonly number[];
  readonly byday?: readonly ByDayRule[];
  readonly bymonthday?: readonly number[];
  readonly byyearday?: readonly number[];
  readonly byweekno?: readonly number[];
  readonly bymonth?: readonly number[];
  readonly bysetpos?: readonly number[];
  readonly wkst?: Weekday;
}

export interface ICalUtcOffset {
  readonly type: 'utc-offset';
  readonly sign: '+' | '-';
  readonly hours: number;
  readonly minutes: number;
  readonly seconds?: number;
}

export interface ICalGeo {
  readonly type: 'geo';
  readonly latitude: number;
  readonly longitude: number;
}

/** BINARY value — base64-encoded data wrapped in a tagged type for discriminated union safety */
export interface ICalBinary {
  readonly type: 'binary';
  readonly data: Uint8Array;
}

/** Union of all structured iCal values — every member has a `type` discriminant */
export type ICalStructured =
  | ICalDate
  | ICalDateTime
  | ICalTime
  | ICalDuration
  | ICalPeriod
  | ICalRecur
  | ICalUtcOffset
  | ICalGeo
  | ICalBinary;

/** Full iCal value union (scalars + structured) */
export type ICalValue =
  | string
  | number
  | boolean
  | ICalStructured;

/** A parsed content line before value interpretation */
export interface ContentLine {
  readonly name: string;
  readonly params: Readonly<Record<string, string | readonly string[]>>;
  readonly value: string;
}

/** A fully parsed property with typed value */
export interface ParsedProperty {
  readonly name: string;
  readonly params: Readonly<Record<string, string | readonly string[]>>;
  readonly value: ICalValue | readonly ICalValue[];
  readonly rawValue: string;
}

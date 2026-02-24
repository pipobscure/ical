# @pipobscure/ical

A complete RFC 5545 iCalendar parser and serializer for Node.js, written in TypeScript.

**Tolerant on input.** Accepts real-world calendar data from Google Calendar, Apple Calendar, Microsoft Outlook, Thunderbird, and other producers that deviate from the specification — bare LF line endings, missing VCALENDAR wrappers, lowercase property names, non-standard parameters, folded lines in unusual places.

**Strict on output.** Generated iCalendar data uses canonical CRLF line endings, RFC 5545-compliant 75-octet UTF-8 line folding, proper parameter quoting, and required-property validation that throws before producing invalid data.

---

## Installation

```sh
npm install @pipobscure/ical
```

Requires Node.js 22 or later. The package is pure ESM.

---

## Quick start

### Parsing

```typescript
import { parse } from '@pipobscure/ical';

const cal = parse(icsString);

for (const event of cal.events) {
  console.log(event.summary);
  console.log(event.dtstart);   // ICalDateTime | ICalDate | null
  console.log(event.dtend);
  console.log(event.rrules);    // ICalRecur[]
}
```

### Building

```typescript
import { Calendar, Event, Alarm } from '@pipobscure/ical';

const cal = Calendar.create('-//My App//My App v1.0//EN');

const event = new Event();
event.uid = crypto.randomUUID();
event.dtstamp = new Date();
event.dtstart = new Date('2025-06-01T09:00:00Z');
event.dtend   = new Date('2025-06-01T10:00:00Z');
event.summary = 'Team standup';
event.description = 'Daily sync with the engineering team.';

cal.addEvent(event);

console.log(cal.toString());   // RFC 5545-compliant ICS string
```

### Multiple calendars in a single file

```typescript
import { parseAll } from '@pipobscure/ical';

const calendars = parseAll(icsString);
for (const cal of calendars) {
  console.log(cal.prodid, cal.events.length);
}
```

---

## API reference

### Parsing functions

#### `parse(src: string): Calendar`

Parses an iCalendar string and returns a single `Calendar` object. If the input contains more than one `VCALENDAR` block, the first one is returned. If the input contains no `VCALENDAR` wrapper at all, the loose components are wrapped in a synthetic `Calendar`.

The parser is fully tolerant:
- Accepts `CRLF`, `LF`, or bare `CR` line endings.
- Handles RFC 5545 line folding with space or tab continuation.
- Normalises property names and parameter names to uppercase.
- Strips outer quotes from quoted parameter values.
- Stores unknown properties as plain text without failing.
- Stores unknown components as generic `Component` objects.

#### `parseAll(src: string): Calendar[]`

Parses an iCalendar string and returns all `VCALENDAR` blocks as an array. If no `VCALENDAR` blocks are present, returns a single-element array wrapping the loose content.

---

### Calendar

The top-level container component, corresponding to `VCALENDAR`.

#### Factory

```typescript
Calendar.create(prodid: string, method?: string): Calendar
```

Creates a new `Calendar` with `VERSION:2.0` already set. `method` is optional (e.g. `'REQUEST'`, `'REPLY'`, `'CANCEL'`).

#### Properties

| Property | Type | Notes |
|----------|------|-------|
| `version` | `string \| null` | Always `'2.0'` for new calendars |
| `prodid` | `string \| null` | Required for serialisation |
| `calscale` | `string \| null` | Defaults to `GREGORIAN` if omitted |
| `method` | `string \| null` | iTIP method |

#### Sub-component accessors

```typescript
cal.events:    Event[]
cal.todos:     Todo[]
cal.journals:  Journal[]
cal.freebusys: FreeBusy[]
cal.timezones: Timezone[]
```

#### Add methods (fluent, return `this`)

```typescript
cal.addEvent(event: Event): this
cal.addTodo(todo: Todo): this
cal.addJournal(journal: Journal): this
cal.addFreebusy(fb: FreeBusy): this
cal.addTimezone(tz: Timezone): this
```

#### Lookup helpers

```typescript
cal.getByUid(uid: string): Event | Todo | Journal | undefined
cal.getTimezone(tzid: string): Timezone | undefined
```

#### Serialisation

```typescript
cal.toString(): string
```

Throws if `PRODID` or `VERSION` is missing.

---

### Event

Corresponds to `VEVENT`.

```typescript
const event = new Event();
```

#### Required properties

| Property | Type | Notes |
|----------|------|-------|
| `uid` | `string \| null` | Unique identifier; required for serialisation |
| `dtstamp` | `ICalDateTime \| null` | Accepts `Date` or `ICalDateTime` |

#### Date and time properties

| Property | Type |
|----------|------|
| `dtstart` | `ICalDateTime \| ICalDate \| null` |
| `dtend` | `ICalDateTime \| ICalDate \| null` |
| `duration` | `ICalDuration \| null` |
| `recurrenceId` | `ICalDateTime \| ICalDate \| null` |
| `created` | `ICalDateTime \| null` — accepts `Date` |
| `lastModified` | `ICalDateTime \| null` — accepts `Date` |

Setting a date-only `ICalDate` (or a plain object with `type: 'date'`) automatically adds the `VALUE=DATE` parameter on serialisation.

Setting a JavaScript `Date` converts it to a UTC `ICalDateTime`.

#### Descriptive properties

| Property | Type |
|----------|------|
| `summary` | `string \| null` |
| `description` | `string \| null` |
| `location` | `string \| null` |
| `url` | `string \| null` |
| `status` | `'TENTATIVE' \| 'CONFIRMED' \| 'CANCELLED' \| string \| null` |
| `transp` | `'OPAQUE' \| 'TRANSPARENT' \| string \| null` |
| `klass` | `'PUBLIC' \| 'PRIVATE' \| 'CONFIDENTIAL' \| string \| null` |
| `priority` | `number \| null` — 0–9 |
| `sequence` | `number \| null` |
| `geo` | `ICalGeo \| null` |
| `organizer` | `string \| null` — calendar address URI |

#### Multi-value properties

```typescript
event.attendees: Property[]
event.addAttendee(calAddress: string, params?: Record<string, string>): this

event.categories: ICalValue[]
event.categories = ['Work', 'Meeting'];   // setter accepts string[]

event.comments: Property[]
event.addComment(v: string): this

event.contacts: Property[]
event.addContact(v: string): this

event.exdates: ICalValue[]
event.addExdate(v: ICalDateTime | ICalDate): this

event.rdates: ICalValue[]
event.addRdate(v: ICalDateTime | ICalDate): this

event.rrules: ICalRecur[]
event.addRrule(v: ICalRecur): this

event.alarms: Alarm[]
event.addAlarm(alarm: Alarm): this
```

#### Serialisation

Throws if `UID` or `DTSTAMP` is missing.

---

### Todo

Corresponds to `VTODO`.

```typescript
const todo = new Todo();
```

Same required properties as `Event` (`uid`, `dtstamp`). Date and time properties:

| Property | Type |
|----------|------|
| `dtstart` | `ICalDateTime \| ICalDate \| null` |
| `due` | `ICalDateTime \| ICalDate \| null` |
| `completed` | `ICalDateTime \| null` — only DateTime, not date-only |
| `duration` | `ICalDuration \| null` — mutually exclusive with `due` |

Additional descriptive properties: `summary`, `description`, `location`, `status` (`NEEDS-ACTION` / `COMPLETED` / `IN-PROCESS` / `CANCELLED`), `priority`, `percentComplete` (0–100), `sequence`, `klass`, `url`, `geo`, `organizer`, `created`, `lastModified`.

Multi-value: `attendees`, `categories`, `rrules`, `alarms` — same API as Event.

Serialisation throws if both `DUE` and `DURATION` are present.

---

### Journal

Corresponds to `VJOURNAL`.

```typescript
const journal = new Journal();
```

Required: `uid`, `dtstamp`. Date properties: `dtstart`. Multiple descriptions are supported:

```typescript
journal.descriptions: Property[]
journal.addDescription(v: string): this
```

Other properties: `summary`, `status` (`DRAFT` / `FINAL` / `CANCELLED`), `klass`, `url`, `organizer`, `sequence`, `created`, `lastModified`. Multi-value: `attendees`, `categories`, `rrules`.

---

### FreeBusy

Corresponds to `VFREEBUSY`.

```typescript
const fb = new FreeBusy();
```

Required: `uid`, `dtstamp`. Span: `dtstart`, `dtend` (both `ICalDateTime` only, not date-only). Participants: `organizer`, `attendees`, `addAttendee()`. Other: `url`, `comment`.

#### FREEBUSY periods

```typescript
fb.freebusyProperties: Property[]   // all FREEBUSY properties with their FBTYPE params
fb.periods: ICalPeriod[]            // flat list of all period values

fb.addFreebusy(periods: ICalPeriod[], fbtype?: string): this
// fbtype defaults to 'BUSY'. Common values: 'FREE', 'BUSY', 'BUSY-UNAVAILABLE', 'BUSY-TENTATIVE'
```

---

### Timezone

Corresponds to `VTIMEZONE`.

```typescript
const tz = new Timezone();
tz.tzid = 'America/New_York';
```

Properties: `tzid` (required), `tzurl`, `lastModified`.

```typescript
tz.standardRules: TimezoneRule[]
tz.daylightRules: TimezoneRule[]
tz.addStandard(rule: Standard): this
tz.addDaylight(rule: Daylight): this
```

#### Standard and Daylight rules

Both `Standard` and `Daylight` extend `TimezoneRule`:

```typescript
const std = new Standard();
std.dtstart = { type: 'date-time', year: 1970, month: 1, day: 1, hour: 2, minute: 0, second: 0, utc: false };
std.tzoffsetfrom = { sign: '+', hours: 5, minutes: 0 };
std.tzoffsetto   = { sign: '-', hours: 5, minutes: 0 };
std.tzname = 'EST';
std.rrule = RECUR.parse('FREQ=YEARLY;BYDAY=1SU;BYMONTH=11');
```

`TimezoneRule` properties: `dtstart`, `tzoffsetfrom`, `tzoffsetto`, `tzname`, `rrule`.

Serialisation throws if `TZID` is missing or if there are no `STANDARD`/`DAYLIGHT` sub-components.

---

### Alarm

Corresponds to `VALARM`.

```typescript
const alarm = new Alarm();
alarm.action = 'DISPLAY';
alarm.trigger = DURATION.parse('-PT15M');   // 15 minutes before
alarm.description = 'Reminder';
```

Properties: `action` (required), `trigger` (required — `ICalDuration` or `ICalDateTime`), `description`, `summary`, `repeat`, `duration`. Multi-value: `attendees`, `addAttendee()`.

Serialisation throws if `ACTION` or `TRIGGER` is missing.

---

### Component (base class)

All component classes extend `Component`. The base class is available for advanced use and for working with unknown component types returned by the parser.

```typescript
// Property access
comp.getProperty(name: string): Property | undefined
comp.getProperties(name: string): Property[]
comp.getValue(name: string): ICalValue | null | undefined
comp.getValues(name: string): ICalValue[]

// Property mutation
comp.setProperty(name: string, value: ICalValue, params?: Record<string, string>): void
comp.appendProperty(name: string, value: ICalValue, params?: Record<string, string>): void
comp.addProperty(prop: Property): void
comp.removeProperty(name: string): void

// Sub-components
comp.addComponent(comp: Component): void
comp.getComponents(type: string): Component[]

comp.toString(): string
```

---

### Property

A parsed iCalendar property with name, value, and parameters.

```typescript
class Property {
  readonly name: string
  readonly value: ICalValue | readonly ICalValue[]
  readonly params: Readonly<Record<string, string | readonly string[]>>
  readonly rawValue: string

  get scalar: ICalValue | null       // first value, or null if empty
  get list: ICalValue[]              // always an array
  get text: string | null            // scalar cast to string
  get number: number | null          // scalar cast to number
  get boolean: boolean | null        // scalar cast to boolean

  toContentLine(): string            // full RFC 5545 content line
}
```

Factory function for advanced use:

```typescript
parseProperty(
  name: string,
  rawValue: string,
  params: Readonly<Record<string, string | readonly string[]>>
): Property
```

---

### Value types

All structured iCalendar values are represented as plain objects with a discriminating `type` field. The full union type is:

```typescript
type ICalValue = string | number | boolean | ICalStructured
```

where `ICalStructured` is:

```typescript
type ICalStructured =
  | ICalDate
  | ICalDateTime
  | ICalTime
  | ICalDuration
  | ICalPeriod
  | ICalRecur
  | ICalUtcOffset
  | ICalGeo
  | ICalBinary
```

#### ICalDate

```typescript
interface ICalDate {
  type: 'date';
  readonly year: number;
  readonly month: number;   // 1-12
  readonly day: number;     // 1-31
}
```

#### ICalDateTime

```typescript
interface ICalDateTime {
  type: 'date-time';
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly utc: boolean;     // true if trailing 'Z'
  readonly tzid?: string;    // from TZID parameter
}
```

#### ICalTime

```typescript
interface ICalTime {
  type: 'time';
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly utc: boolean;
}
```

#### ICalDuration

```typescript
interface ICalDuration {
  type: 'duration';
  readonly negative: boolean;
  readonly weeks?: number;
  readonly days?: number;
  readonly hours?: number;
  readonly minutes?: number;
  readonly seconds?: number;
}
```

#### ICalPeriod

```typescript
interface ICalPeriod {
  type: 'period';
  readonly start: ICalDateTime;
  readonly end: ICalDateTime | ICalDuration;
}
```

#### ICalRecur

```typescript
type RecurFreq = 'SECONDLY' | 'MINUTELY' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type Weekday   = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

interface ByDayRule {
  readonly day: Weekday;
  readonly ordwk?: number;   // e.g. 2MO means the second Monday
}

interface ICalRecur {
  type: 'recur';
  readonly freq: RecurFreq;
  readonly until?: ICalDateTime | ICalDate;
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
```

#### ICalUtcOffset

```typescript
interface ICalUtcOffset {
  type: 'utc-offset';
  readonly sign: '+' | '-';
  readonly hours: number;
  readonly minutes: number;
  readonly seconds?: number;
}
```

#### ICalGeo

```typescript
interface ICalGeo {
  type: 'geo';
  readonly latitude: number;
  readonly longitude: number;
}
```

#### ICalBinary

```typescript
interface ICalBinary {
  type: 'binary';
  readonly data: Uint8Array;
}
```

---

### Value codecs

Each RFC 5545 value type has a codec with `parse` and `serialize` methods. Codecs are available as named exports and via the `CODECS` lookup map.

```typescript
import { TEXT, BOOLEAN, INTEGER, FLOAT,
         URI, CAL_ADDRESS, BINARY,
         UTC_OFFSET, DATE, DATE_TIME, TIME,
         DURATION, PERIOD, RECUR, GEO, CODECS } from '@pipobscure/ical';

// Direct codec use
const dt = DATE_TIME.parse('20250101T100000Z');
const str = DATE_TIME.serialize(dt);   // '20250101T100000Z'

const dur = DURATION.parse('-PT1H30M');
const secs = DURATION.toSeconds(dur);  // -5400

const recur = RECUR.parse('FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10');
const rule = RECUR.serialize(recur);

// Codec lookup by RFC 5545 value type name
const codec = CODECS['DATE-TIME'];
```

#### Helper methods on DATE and DATE_TIME

```typescript
DATE.fromDate(d: Date): ICalDate
DATE.toDate(val: ICalDate): Date

DATE_TIME.fromDate(d: Date, tzid?: string): ICalDateTime
DATE_TIME.toDate(val: ICalDateTime): Date
```

#### Helper method on DURATION

```typescript
DURATION.toSeconds(val: ICalDuration): number
```

---

## Line folding

The serialiser folds long lines at 75 UTF-8 octets as required by RFC 5545. Folded continuation lines begin with a single space. Multi-byte UTF-8 characters and surrogate pairs are handled correctly — the fold never splits a multi-byte sequence.

When parsing, both space and tab continuation characters are accepted, and the continuation character is stripped from the unfolded value.

---

## TEXT escaping

The TEXT codec automatically escapes and unescapes the characters required by RFC 5545:

| Character | Escaped form |
|-----------|-------------|
| `\` (backslash) | `\\` |
| `;` (semicolon) | `\;` |
| `,` (comma) | `\,` |
| newline | `\n` |

---

## Error handling

The parser never throws on malformed input. Unknown properties and components are silently stored. Structural errors are represented as generic `Component` objects.

The serialiser throws `Error` when required properties are absent:

| Component | Required properties |
|-----------|-------------------|
| `Calendar` | `PRODID`, `VERSION` |
| `Event` | `UID`, `DTSTAMP` |
| `Todo` | `UID`, `DTSTAMP`; `DUE` and `DURATION` are mutually exclusive |
| `Journal` | `UID`, `DTSTAMP` |
| `FreeBusy` | `UID`, `DTSTAMP` |
| `Timezone` | `TZID`; at least one `STANDARD` or `DAYLIGHT` rule |
| `Alarm` | `ACTION`, `TRIGGER` |

---

## Vendor compatibility

The parser has been tested against real-world ICS files produced by:

- **Apple Calendar** — `X-WR-CALNAME`, `X-APPLE-STRUCTURED-LOCATION`, `X-APPLE-TRAVEL-ADVISORY`, date-only `VALUE=DATE` events
- **Google Calendar** — TZID parameters on RRULE/EXDATE, multiple RRULE properties, bare LF line endings
- **Microsoft Outlook** — `METHOD:REQUEST`, missing `DTSTAMP`, `X-MICROSOFT-*` properties, `ENCODING=QUOTED-PRINTABLE` parameter
- **Mozilla Thunderbird** — Folded `DESCRIPTION` lines, long UID strings, `X-MOZ-SNOOZE-TIME`, `X-MOZ-GENERATION`

---

## TypeScript

The package ships TypeScript declaration files alongside the compiled JavaScript. No `@types/` package is needed.

All exported types are pure interfaces and type aliases — there are no classes in the type exports, only in the value exports.

---

## License

MIT

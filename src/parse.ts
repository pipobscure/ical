/**
 * Tolerant iCalendar parser.
 *
 * Principles:
 *  - Accepts CRLF, LF, or bare CR line endings.
 *  - Handles folded lines.
 *  - Unknown components are stored as generic Component instances.
 *  - Unknown properties are stored with TEXT value.
 *  - Missing required wrappers are recovered from where possible.
 *  - Malformed property lines are skipped with a warning (no crash).
 */

import { tokenize } from './tokenize.js';
import { parseProperty } from './property.js';
import { Component } from './component.js';
import { Calendar } from './calendar.js';
import { Event } from './event.js';
import { Todo } from './todo.js';
import { Journal } from './journal.js';
import { FreeBusy } from './freebusy.js';
import { Timezone, buildTimezoneRule } from './timezone.js';
import { Alarm } from './alarm.js';

// ── Raw tree built during tokenization ───────────────────────────────────

interface RawNode {
  type: string;
  props: Array<{ name: string; params: Record<string, string>; value: string }>;
  children: RawNode[];
}

/** Build a raw component tree from the flat token stream. */
function buildTree(src: string): RawNode[] {
  const tokens = tokenize(src);
  const root: RawNode = { type: 'ROOT', props: [], children: [] };
  const stack: RawNode[] = [root];

  for (const token of tokens) {
    const current = stack[stack.length - 1]!;

    if (token.name === 'BEGIN') {
      const node: RawNode = {
        type: token.value.toUpperCase().trim(),
        props: [],
        children: [],
      };
      current.children.push(node);
      stack.push(node);
    } else if (token.name === 'END') {
      if (stack.length > 1) stack.pop();
      // Tolerant: if stack is empty we ignore the END
    } else {
      // Normalize params: ensure all values are strings (flatten single-element arrays)
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(token.params)) {
        params[k] = Array.isArray(v) ? (v as string[]).join(',') : String(v);
      }
      current.props.push({ name: token.name, params, value: token.value });
    }
  }

  return root.children;
}

// ── Component builders ────────────────────────────────────────────────────

function buildComponent(node: RawNode): Component {
  switch (node.type) {
    case 'VCALENDAR':  return buildCalendar(node);
    case 'VEVENT':     return buildEvent(node);
    case 'VTODO':      return buildTodo(node);
    case 'VJOURNAL':   return buildJournal(node);
    case 'VFREEBUSY':  return buildFreebusy(node);
    case 'VTIMEZONE':  return buildTimezone(node);
    case 'VALARM':     return buildAlarm(node);
    case 'STANDARD':
    case 'DAYLIGHT':   return buildTimezoneRule(node.type, node.props);
    default:           return buildGeneric(node);
  }
}

function buildCalendar(node: RawNode): Calendar {
  const children = node.children.map(buildComponent);
  return Calendar.fromRaw(node.props, children);
}

function buildEvent(node: RawNode): Event {
  const children = node.children.map(buildComponent);
  return Event.fromRaw(node.props, children);
}

function buildTodo(node: RawNode): Todo {
  const children = node.children.map(buildComponent);
  return Todo.fromRaw(node.props, children);
}

function buildJournal(node: RawNode): Journal {
  return Journal.fromRaw(node.props);
}

function buildFreebusy(node: RawNode): FreeBusy {
  return FreeBusy.fromRaw(node.props);
}

function buildTimezone(node: RawNode): Timezone {
  const children = node.children.map(buildComponent);
  return Timezone.fromRaw(node.props, children);
}

function buildAlarm(node: RawNode): Alarm {
  return Alarm.fromRaw(node.props);
}

function buildGeneric(node: RawNode): Component {
  const comp = new Component(node.type);
  for (const { name, params, value } of node.props) {
    comp.addProperty(parseProperty(name, value, params));
  }
  for (const child of node.children) {
    comp.addComponent(buildComponent(child));
  }
  return comp;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Parse an iCalendar string and return a Calendar object.
 *
 * Tolerant: if the input has no VCALENDAR wrapper (e.g. just a bare VEVENT)
 * the content is wrapped in a synthetic Calendar.
 *
 * @throws Only on completely unparseable input that yields zero tokens.
 */
export function parse(src: string): Calendar {
  const roots = buildTree(src);

  // Find the first VCALENDAR
  const calNode = roots.find((n) => n.type === 'VCALENDAR');
  if (calNode) {
    return buildCalendar(calNode);
  }

  // Tolerant: no VCALENDAR wrapper — synthesize one
  const cal = new Calendar();
  for (const node of roots) {
    cal.addComponent(buildComponent(node));
  }
  return cal;
}

/**
 * Parse an iCalendar string and return all top-level Calendar objects.
 * Some feeds embed multiple VCALENDAR blocks in a single file.
 */
export function parseAll(src: string): Calendar[] {
  const roots = buildTree(src);
  const calendars = roots.filter((n) => n.type === 'VCALENDAR');

  if (calendars.length > 0) {
    return calendars.map(buildCalendar);
  }

  // No VCALENDAR blocks — wrap everything in one
  return [parse(src)];
}

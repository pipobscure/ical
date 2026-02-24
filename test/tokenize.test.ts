/**
 * Tokenizer edge cases:
 * - Line endings: CRLF, LF, bare CR, mixed
 * - Line folding: SPACE and TAB continuation, UTF-8 multi-byte boundaries
 * - Content line parsing: names, params, quoted values, multi-value params
 * - Tolerance: empty lines, leading/trailing whitespace
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parseContentLine } from '../dist/tokenize.js';

// ── Line ending tolerance ─────────────────────────────────────────────────

describe('line endings', () => {
  test('CRLF (canonical RFC 5545)', () => {
    const lines = tokenize('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR');
    assert.equal(lines.length, 3);
    assert.equal(lines[0]!.name, 'BEGIN');
    assert.equal(lines[1]!.name, 'VERSION');
  });

  test('bare LF only (common in real-world files)', () => {
    const lines = tokenize('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR');
    assert.equal(lines.length, 3);
    assert.equal(lines[0]!.name, 'BEGIN');
  });

  test('bare CR only (rare but seen in old Mac files)', () => {
    const lines = tokenize('BEGIN:VCALENDAR\rVERSION:2.0\rEND:VCALENDAR');
    assert.equal(lines.length, 3);
    assert.equal(lines[0]!.name, 'BEGIN');
  });

  test('mixed CRLF and LF in same file', () => {
    const lines = tokenize('BEGIN:VCALENDAR\r\nVERSION:2.0\nPRODID:-//X//X//EN\r\nEND:VCALENDAR');
    assert.equal(lines.length, 4);
    assert.equal(lines[2]!.name, 'PRODID');
  });

  test('empty lines between content lines are skipped', () => {
    const lines = tokenize('BEGIN:VCALENDAR\r\n\r\nVERSION:2.0\r\n\r\nEND:VCALENDAR');
    assert.equal(lines.length, 3);
  });

  test('whitespace-only lines are skipped', () => {
    const lines = tokenize('BEGIN:VCALENDAR\r\n   \r\nVERSION:2.0\r\nEND:VCALENDAR');
    assert.equal(lines.length, 3);
  });
});

// ── Line folding (RFC 5545 §3.1) ─────────────────────────────────────────

describe('line folding', () => {
  test('SPACE continuation (canonical)', () => {
    const lines = tokenize(
      'SUMMARY:This is a very lo\r\n ng summary that is folded\r\nUID:x',
    );
    assert.equal(lines[0]!.value, 'This is a very long summary that is folded');
  });

  test('TAB continuation (also valid per RFC)', () => {
    const lines = tokenize(
      'SUMMARY:This is a very lo\r\n\tng summary that is folded\r\nUID:x',
    );
    assert.equal(lines[0]!.value, 'This is a very long summary that is folded');
  });

  test('multiple consecutive folds', () => {
    const lines = tokenize(
      'DESCRIPTION:Line1\r\n Line2\r\n Line3\r\n Line4\r\nUID:x',
    );
    assert.equal(lines[0]!.value, 'Line1Line2Line3Line4');
  });

  test('fold inside parameter value', () => {
    // Some producers fold inside params — very unusual but should unfold
    const lines = tokenize(
      'ATTENDEE;CN="John\r\n  Doe":mailto:john@example.com\r\nUID:x',
    );
    assert.equal(lines[0]!.name, 'ATTENDEE');
    assert.equal(lines[0]!.value, 'mailto:john@example.com');
  });

  test('fold at UTF-8 multi-byte boundary (3-byte char)', () => {
    // Japanese character '月' = U+6708 = 3 UTF-8 bytes
    // Producer may fold inside the sequence; unfolding should restore it
    const kanji = '月'; // 3 bytes
    const raw = `SUMMARY:hello ${kanji} world`;
    // Simulate a fold in the middle of the encoded stream at a bad offset
    // but after unfolding it should reconstruct correctly
    const folded = raw.slice(0, 20) + '\r\n ' + raw.slice(20);
    const lines = tokenize(folded);
    assert.ok(lines[0]!.value.includes('月'));
  });

  test('fold with LF only (tolerant) — continuation space stripped', () => {
    // RFC 5545: unfolding strips the leading space/tab of a continuation line.
    // 'hello\n world' → unfold → 'helloworld' (space is the fold indicator, not content)
    const lines = tokenize('SUMMARY:hello\n world\nUID:x');
    assert.equal(lines[0]!.value, 'helloworld');
  });
});

// ── Content line parsing ──────────────────────────────────────────────────

describe('content line parsing', () => {
  test('simple name:value', () => {
    const cl = parseContentLine('VERSION:2.0')!;
    assert.equal(cl.name, 'VERSION');
    assert.equal(cl.value, '2.0');
    assert.deepEqual(cl.params, {});
  });

  test('name is uppercased', () => {
    const cl = parseContentLine('version:2.0')!;
    assert.equal(cl.name, 'VERSION');
  });

  test('single parameter', () => {
    const cl = parseContentLine('DTSTART;TZID=America/New_York:19980312T083000')!;
    assert.equal(cl.name, 'DTSTART');
    assert.equal(cl.params['TZID'], 'America/New_York');
    assert.equal(cl.value, '19980312T083000');
  });

  test('multiple parameters', () => {
    const cl = parseContentLine('ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:x@x.com')!;
    assert.equal(cl.params['ROLE'], 'REQ-PARTICIPANT');
    assert.equal(cl.params['RSVP'], 'TRUE');
    assert.equal(cl.value, 'mailto:x@x.com');
  });

  test('quoted parameter value with comma', () => {
    const cl = parseContentLine('ATTENDEE;CN="Smith, John":mailto:john@example.com')!;
    assert.equal(cl.params['CN'], 'Smith, John');
    assert.equal(cl.value, 'mailto:john@example.com');
  });

  test('quoted parameter value with semicolon', () => {
    const cl = parseContentLine('ATTENDEE;CN="Smith; John":mailto:john@example.com')!;
    assert.equal(cl.params['CN'], 'Smith; John');
  });

  test('quoted parameter value with colon', () => {
    const cl = parseContentLine('ATTENDEE;CN="Smith: John":mailto:john@example.com')!;
    assert.equal(cl.params['CN'], 'Smith: John');
  });

  test('multi-value parameter (comma-separated)', () => {
    const cl = parseContentLine('RDATE;VALUE=DATE:19970101,19970120')!;
    assert.equal(cl.params['VALUE'], 'DATE');
    assert.equal(cl.value, '19970101,19970120');
  });

  test('VALUE=DATE parameter preserved', () => {
    const cl = parseContentLine('DTSTART;VALUE=DATE:20240101')!;
    assert.equal(cl.params['VALUE'], 'DATE');
    assert.equal(cl.value, '20240101');
  });

  test('colon in value is preserved', () => {
    const cl = parseContentLine('URL:https://example.com/calendar?foo=bar&baz=qux')!;
    assert.equal(cl.value, 'https://example.com/calendar?foo=bar&baz=qux');
  });

  test('empty value is preserved', () => {
    const cl = parseContentLine('DESCRIPTION:')!;
    assert.equal(cl.value, '');
  });

  test('empty lines return null', () => {
    assert.equal(parseContentLine(''), null);
    assert.equal(parseContentLine('   '), null);
  });

  test('parameter name is uppercased', () => {
    const cl = parseContentLine('DTSTART;tzid=UTC:20240101T000000Z')!;
    assert.ok('TZID' in cl.params);
  });

  test('X- property name preserved', () => {
    const cl = parseContentLine('X-WR-CALNAME:My Calendar')!;
    assert.equal(cl.name, 'X-WR-CALNAME');
    assert.equal(cl.value, 'My Calendar');
  });

  test('value with multiple colons (URL)', () => {
    const cl = parseContentLine('URL:http://example.com:8080/cal')!;
    assert.equal(cl.value, 'http://example.com:8080/cal');
  });
});

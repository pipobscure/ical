/**
 * Low-level iCalendar tokenizer.
 *
 * Handles:
 * - CRLF, LF, and bare CR line endings (tolerant)
 * - Line unfolding (RFC 5545 §3.1: lines starting with SPACE or HTAB are continuations)
 * - Content line parsing: name, parameters, value
 * - Quoted parameter values
 * - Multi-value parameters (comma-separated)
 */

import type { ContentLine } from './types.js';

/** Normalize line endings and unfold continuation lines. */
function unfold(str: string): string {
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, ''); // RFC 5545 §3.1 unfolding
}

/**
 * Parse a single content line into its name, parameters, and value.
 * Returns null for empty or unparseable lines (tolerant).
 */
export function parseContentLine(line: string): ContentLine | null {
  const len = line.length;
  if (len === 0) return null;

  let i = 0;

  // ── name ──────────────────────────────────────────────────────────────────
  // RFC 5545: name = iana-token / x-name
  // iana-token = 1*(ALPHA / DIGIT / "-")
  const nameStart = i;
  while (i < len && line[i] !== ':' && line[i] !== ';') i++;
  const name = line.slice(nameStart, i).trim().toUpperCase();
  if (!name) return null;

  // ── parameters ────────────────────────────────────────────────────────────
  const params: Record<string, string | string[]> = {};

  while (i < len && line[i] === ';') {
    i++; // consume ';'

    // param-name
    const pnStart = i;
    while (i < len && line[i] !== '=' && line[i] !== ';' && line[i] !== ':') i++;
    const paramName = line.slice(pnStart, i).trim().toUpperCase();

    const values: string[] = [];

    if (i < len && line[i] === '=') {
      i++; // consume '='

      // One or more comma-separated param-values
      do {
        if (i < len && line[i] === '"') {
          // Quoted string (DQUOTE *QSAFE-CHAR DQUOTE)
          i++; // consume opening '"'
          const vStart = i;
          while (i < len && line[i] !== '"') i++;
          values.push(line.slice(vStart, i));
          if (i < len) i++; // consume closing '"'
        } else {
          // Unquoted param-value: everything up to ',' ';' ':'
          const vStart = i;
          while (i < len && line[i] !== ',' && line[i] !== ';' && line[i] !== ':') i++;
          values.push(line.slice(vStart, i).trim());
        }
      } while (i < len && line[i] === ',' && ++i); // consume ',' between values
    }

    if (paramName) {
      params[paramName] = values.length === 1 ? (values[0] ?? '') : values;
    }
  }

  // ── value ─────────────────────────────────────────────────────────────────
  if (i < len && line[i] === ':') i++; // consume ':'
  const value = line.slice(i);

  return { name, params, value };
}

/**
 * Tokenize an iCalendar string into an array of content lines.
 * Tolerant: skips blank lines and unparseable content.
 */
export function tokenize(src: string): ContentLine[] {
  const lines = unfold(src).split('\n');
  const result: ContentLine[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseContentLine(line);
    if (parsed) result.push(parsed);
  }
  return result;
}

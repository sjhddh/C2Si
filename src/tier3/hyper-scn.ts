/**
 * Tier 3 HyperSCN encoder.
 *
 * Transforms Tier 2 SCN output into a denser notation that:
 *   - Aliases frequent predicates with 1-token Greek letters
 *   - Drops positional role prefixes (a0:, a1:, a2:) where unambiguous
 *   - Keeps modality markers (NEG:, POSS:, OBL:) unchanged (safety)
 *   - Preserves all entities, numbers, dates, proper nouns verbatim
 *
 * Deterministic: same input always produces same output.
 * Cost-guarded: if the legend overhead exceeds savings, falls back to the
 * original SCN unchanged.
 */

import { countTokens } from '../tokenizer/counter.js';
import {
  PREDICATE_ALIASES,
  MODALITY_MARKERS,
  QUANTIFIER_MARKERS,
  EXPLICIT_ROLES,
} from './vocabulary.js';

/** A parsed SCN clause. */
interface ParsedClause {
  /** Raw clause text as seen in input (for passthrough if we don't touch it). */
  raw: string;
  /** Discourse prefix if any (e.g., "→CAUSE:", "→RESULT:"). */
  discourse?: string;
  /** Modality prefix if any (e.g., "NEG", "POSS"). */
  modality?: string;
  /** The predicate stem (e.g., "RAISE", "DECLINE"). */
  predicate: string;
  /** Positional args in order: a0, a1, a2 (if present). */
  positional: string[];
  /** Remaining explicit role=value pairs (e.g., tm:Thu, lc:NYC). */
  extras: string[];
  /** True if this line is a header/comment (#...) or legend (@E...). */
  passthrough: boolean;
}

/**
 * Regex identifying a SCN predicate clause line.
 * Captures optional discourse prefix, optional modality, predicate, and body.
 *
 * Example matches:
 *   "RAISE a0:$a a1:rates a2:+50bp tm:Thu"
 *   "→CAUSE: EXCEED a0:inflation a1:target"
 *   "NEG:APPROVE a0:board a1:proposal"
 */
const CLAUSE_PATTERN =
  /^(?<discourse>→\w+:\s*)?(?:(?<mod>NEG|POSS|OBL|PERM|CONF|CONF:HIGH|CONF:LOW):)?(?<pred>[A-Z][A-Z0-9_-]*)\s+(?<body>.*)$/;

/**
 * Parse a single line from Tier 2 SCN into a structured clause.
 * Returns null for lines that aren't clauses (comments, entity defs, blanks).
 */
function parseLine(line: string): ParsedClause | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Passthrough: headers (#...), entity definitions (@E1=... or $a=...), legend lines (§...)
  if (trimmed.startsWith('#') || /^[@$]\w+\s*=/.test(trimmed) || trimmed.startsWith('§')) {
    return { raw: line, predicate: '', positional: [], extras: [], passthrough: true };
  }

  const match = trimmed.match(CLAUSE_PATTERN);
  if (!match?.groups) return null;

  const { discourse, mod, pred, body } = match.groups;

  // Only treat as predicate if it's actually an English verb stem pattern
  // (prevents matching random all-caps words)
  if (!pred || pred.length < 3) return null;

  // Parse the body — role:value pairs and positional args
  const positional: string[] = [];
  const extras: string[] = [];
  const roleRegex = /(\w+):([^\s]+(?:\s+[^\s:]+(?=\s+\w+:|$))*)/g;
  const tokens = body.trim().split(/\s+/);

  for (const tok of tokens) {
    const colonIdx = tok.indexOf(':');
    if (colonIdx > 0 && colonIdx < 5) {
      const role = tok.slice(0, colonIdx);
      const value = tok.slice(colonIdx + 1);
      if (/^a[0-9]$/.test(role)) {
        // Positional arg — a0, a1, a2...
        const idx = parseInt(role[1], 10);
        positional[idx] = value;
      } else if (EXPLICIT_ROLES.has(role)) {
        extras.push(tok);
      } else {
        // Unknown role, pass through as-is
        extras.push(tok);
      }
    } else {
      // Not a role:value pair — may be a continuation of a previous value
      extras.push(tok);
    }
  }

  // Validate modality marker if captured
  const modality =
    mod && (MODALITY_MARKERS.has(mod) || QUANTIFIER_MARKERS.has(mod)) ? mod : undefined;

  return {
    raw: line,
    discourse: discourse?.trim(),
    modality,
    predicate: pred,
    positional: positional.filter((x) => x !== undefined),
    extras,
    passthrough: false,
  };
}

/**
 * Assign Greek letter aliases to the most frequent predicates.
 * Only aliases predicates that:
 *   - Appear 2+ times (aliasing a single occurrence costs more than it saves)
 *   - Cost more than 1 token as written (no point aliasing an already-1-token word)
 *   - Are not modality/quantifier markers (those stay verbatim)
 *
 * Returns a map predicate → alias.
 */
function assignAliases(clauses: ParsedClause[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const c of clauses) {
    if (c.passthrough || !c.predicate) continue;
    counts.set(c.predicate, (counts.get(c.predicate) ?? 0) + 1);
  }

  // Sort predicates by (frequency desc, token cost desc) — most wins first
  const ranked = [...counts.entries()]
    .filter(([pred, count]) => {
      if (count < 2) return false;
      if (countTokens(pred) <= 1) return false;
      return true;
    })
    .sort((a, b) => {
      const savingsA = (countTokens(a[0]) - 1) * a[1];
      const savingsB = (countTokens(b[0]) - 1) * b[1];
      return savingsB - savingsA;
    });

  const aliases = new Map<string, string>();
  const pool = [...PREDICATE_ALIASES];
  for (const [pred] of ranked) {
    const alias = pool.shift();
    if (!alias) break;
    aliases.set(pred, alias);
  }
  return aliases;
}

/**
 * Serialize a parsed clause to HyperSCN using the alias map.
 */
function serializeClause(c: ParsedClause, aliases: Map<string, string>): string {
  if (c.passthrough) return c.raw;

  const parts: string[] = [];
  if (c.discourse) parts.push(c.discourse);

  const predSymbol = aliases.get(c.predicate) ?? c.predicate;
  if (c.modality) {
    parts.push(`${c.modality}:${predSymbol}`);
  } else {
    parts.push(predSymbol);
  }

  // Positional args (no role prefixes)
  for (const arg of c.positional) {
    if (arg) parts.push(arg);
  }

  // Explicit-role extras (tm:Thu, lc:NYC, etc.)
  for (const extra of c.extras) {
    parts.push(extra);
  }

  return parts.join(' ');
}

/**
 * Build the legend line for the predicate aliases.
 * Returns empty string if no aliases were assigned.
 */
function buildPredicateLegend(aliases: Map<string, string>): string {
  if (aliases.size === 0) return '';
  const entries = [...aliases.entries()]
    .map(([pred, alias]) => `${alias}=${pred}`)
    .join(' ');
  return `§pred ${entries}`;
}

/** Result of HyperSCN compression. */
export interface HyperSCNResult {
  /** The legend lines (predicate aliases). Empty if no aliasing was worth it. */
  legend: string;
  /** The compressed content lines. */
  content: string;
  /** Legend + content joined, ready for prompt inclusion (without preamble). */
  full: string;
  /** Token counts. */
  stats: {
    inputTokens: number;
    outputTokens: number;
    ratio: number;
    aliasesUsed: number;
  };
  /** True if Tier 3 produced output shorter than input. */
  worthIt: boolean;
}

/**
 * Compress Tier 2 SCN text into Tier 3 HyperSCN.
 *
 * If the legend overhead would exceed the savings, this function returns
 * the input unchanged (with `worthIt: false`) rather than bloating the output.
 *
 * @param scn  Tier 2 SCN formatted text (output of compressWithModel, or any SCN-style text).
 * @returns    Legend + compressed content, with stats and cost-benefit flag.
 */
export function compressToHyperSCN(scn: string): HyperSCNResult {
  const inputTokens = countTokens(scn);
  const lines = scn.split('\n');
  const parsed = lines.map(parseLine).filter((x): x is ParsedClause => x !== null);

  const aliases = assignAliases(parsed);
  const legend = buildPredicateLegend(aliases);

  const contentLines: string[] = [];
  let parsedIdx = 0;
  for (const line of lines) {
    if (!line.trim()) {
      contentLines.push('');
      continue;
    }
    const p = parsed[parsedIdx];
    if (p && p.raw === line) {
      contentLines.push(serializeClause(p, aliases));
      parsedIdx++;
    } else {
      // Shouldn't happen — fallback to raw
      contentLines.push(line);
    }
  }

  const content = contentLines.join('\n').trim();
  const full = legend ? `${legend}\n${content}` : content;
  const outputTokens = countTokens(full);

  // Cost-benefit guard: only emit HyperSCN if it's actually shorter
  if (outputTokens >= inputTokens) {
    return {
      legend: '',
      content: scn,
      full: scn,
      stats: {
        inputTokens,
        outputTokens: inputTokens,
        ratio: 1,
        aliasesUsed: 0,
      },
      worthIt: false,
    };
  }

  return {
    legend,
    content,
    full,
    stats: {
      inputTokens,
      outputTokens,
      ratio: Number((inputTokens / outputTokens).toFixed(2)),
      aliasesUsed: aliases.size,
    },
    worthIt: true,
  };
}

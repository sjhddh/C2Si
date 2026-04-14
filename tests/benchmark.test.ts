/**
 * C2Si Benchmark — Hard Requirements Gate
 *
 * Adapted from MRLVAL v0.1 (Meta Reasoning Language Validation) methodology:
 * - Phenomenon-category coverage (18 categories)
 * - Semantic invariant preservation (adapted from Smatch-like graph matching
 *   to text-level invariant checking, since C2Si is a text compressor not a
 *   semantic graph engine)
 * - Compression ratio thresholds per case
 * - Determinism requirement (same input → same output)
 * - No-regression floor (compression should never produce dramatically larger output)
 *
 * This benchmark is a CI gate: if ANY case fails, the build breaks.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C2Si } from '../src/compressor.js';
import { countTokens } from '../src/tokenizer/counter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, 'benchmark', 'fixtures.json');

/**
 * An invariant entry is either:
 *   - a string: must appear exactly (with whitespace-insensitive matching)
 *   - a string[]: semantic equivalence class — ANY of these must appear
 *     (e.g., ["revenue", "rev"] means either form preserves meaning)
 */
type InvariantEntry = string | string[];

interface BenchmarkCase {
  id: string;
  category: string;
  difficulty: number;
  raw: string;
  mustContain: InvariantEntry[];
  mustNotContain: string[];
  minRatio: number;
  domain?: string;
  note: string;
}

interface BenchmarkFixtures {
  version: string;
  description: string;
  hardThresholds: {
    minRatioOverall: number;
    invariantViolationTolerance: number;
    determinismRequired: boolean;
  };
  cases: BenchmarkCase[];
}

const fixtures: BenchmarkFixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));
const c2si = new C2Si();

/**
 * Test if a single term appears in the compressed output.
 * Whitespace-insensitive matching (handles structural reformatting).
 */
function termPresent(compressed: string, term: string): boolean {
  if (compressed.includes(term)) return true;
  const nc = compressed.replace(/\s+/g, ' ');
  const nt = term.replace(/\s+/g, ' ');
  return nc.includes(nt);
}

/**
 * Check that all mustContain invariants survive compression.
 * Returns array of missing entries (empty = pass).
 *
 * String entries: exact match (whitespace-insensitive).
 * Array entries: semantic equivalence class — any one variant must match.
 * This mirrors MRLVAL's n-best philosophy: accept any gold alternative.
 */
function checkInvariants(compressed: string, mustContain: InvariantEntry[]): string[] {
  const missing: string[] = [];
  for (const entry of mustContain) {
    if (Array.isArray(entry)) {
      // Equivalence class: at least one variant must be present
      if (!entry.some((variant) => termPresent(compressed, variant))) {
        missing.push(`(${entry.join(' | ')})`);
      }
    } else {
      if (!termPresent(compressed, entry)) {
        missing.push(entry);
      }
    }
  }
  return missing;
}

/**
 * Check that all mustNotContain terms are absent from compression.
 * Case-insensitive because verbose patterns should be compressed regardless of case.
 */
function checkForbidden(compressed: string, mustNotContain: string[]): string[] {
  const present: string[] = [];
  const lower = compressed.toLowerCase();
  for (const term of mustNotContain) {
    if (lower.includes(term.toLowerCase())) {
      present.push(term);
    }
  }
  return present;
}

// ─────────────────────────────────────────────────────────────
// Main benchmark suite
// ─────────────────────────────────────────────────────────────

describe('C2Si Benchmark (adapted MRLVAL v0.1)', () => {
  describe('fixture schema validation', () => {
    it('loads fixtures with required structure', () => {
      expect(fixtures.version).toBeTruthy();
      expect(fixtures.cases).toBeInstanceOf(Array);
      expect(fixtures.cases.length).toBeGreaterThan(20);
    });

    it('every case has required fields', () => {
      for (const c of fixtures.cases) {
        expect(c.id, `case ${c.id}`).toBeTruthy();
        expect(c.category, `case ${c.id}`).toBeTruthy();
        expect(c.raw, `case ${c.id}`).toBeTruthy();
        expect(c.mustContain, `case ${c.id}`).toBeInstanceOf(Array);
        expect(c.mustNotContain, `case ${c.id}`).toBeInstanceOf(Array);
        expect(typeof c.minRatio, `case ${c.id}`).toBe('number');
        // Validate InvariantEntry types: string or string[]
        for (const entry of c.mustContain) {
          if (Array.isArray(entry)) {
            expect(entry.length, `${c.id} equivalence class`).toBeGreaterThan(0);
            for (const v of entry) {
              expect(typeof v, `${c.id} variant`).toBe('string');
            }
          } else {
            expect(typeof entry, `${c.id} invariant`).toBe('string');
          }
        }
      }
    });
  });

  describe('invariant preservation (must survive compression)', () => {
    for (const c of fixtures.cases) {
      it(`${c.id} [${c.category}] preserves ${c.mustContain.length} invariants`, () => {
        const result = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
          typeof c2si.compressRules
        >;
        const missing = checkInvariants(result.compressed, c.mustContain);
        expect(missing, `${c.note}\nCompressed output:\n${result.compressed}`).toEqual([]);
      });
    }
  });

  describe('forbidden patterns (must be compressed away)', () => {
    for (const c of fixtures.cases) {
      if (c.mustNotContain.length === 0) continue;
      it(`${c.id} [${c.category}] removes ${c.mustNotContain.length} verbose patterns`, () => {
        const result = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
          typeof c2si.compressRules
        >;
        const present = checkForbidden(result.compressed, c.mustNotContain);
        expect(present, `${c.note}\nCompressed output:\n${result.compressed}`).toEqual([]);
      });
    }
  });

  describe('compression ratio thresholds', () => {
    for (const c of fixtures.cases) {
      it(`${c.id} [${c.category}] meets minRatio ${c.minRatio}x`, () => {
        const result = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
          typeof c2si.compressRules
        >;
        expect(
          result.stats.ratio,
          `${c.note}\nOriginal (${result.stats.originalTokens}t): ${c.raw}\nCompressed (${result.stats.compressedTokens}t): ${result.compressed}`,
        ).toBeGreaterThanOrEqual(c.minRatio);
      });
    }
  });

  describe('determinism (same input → same output)', () => {
    for (const c of fixtures.cases) {
      it(`${c.id} [${c.category}] produces identical output on repeated calls`, () => {
        const r1 = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
          typeof c2si.compressRules
        >;
        const r2 = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
          typeof c2si.compressRules
        >;
        expect(r2.compressed).toEqual(r1.compressed);
        expect(r2.stats.compressedTokens).toEqual(r1.stats.compressedTokens);
      });
    }
  });

  describe('aggregate statistics', () => {
    it('overall average compression ratio >= 1.1x', () => {
      const ratios: number[] = [];
      for (const c of fixtures.cases) {
        const result = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
          typeof c2si.compressRules
        >;
        ratios.push(result.stats.ratio);
      }
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      expect(avg, `Average ratio across ${ratios.length} cases: ${avg.toFixed(3)}`).toBeGreaterThanOrEqual(1.1);
    });

    it('no case produces output more than 1.5x the input (no catastrophic expansion)', () => {
      const violations: string[] = [];
      for (const c of fixtures.cases) {
        const result = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
          typeof c2si.compressRules
        >;
        const expansion = result.stats.compressedTokens / result.stats.originalTokens;
        if (expansion > 1.5) {
          violations.push(`${c.id}: ${expansion.toFixed(2)}x expansion`);
        }
      }
      expect(violations).toEqual([]);
    });

    it('all 18 phenomenon categories are covered', () => {
      const expected = [
        'negation',
        'modality',
        'quantification',
        'numbers_and_measurements',
        'dates_and_time',
        'named_entities',
        'conditionals',
        'comparison',
        'causal',
        'temporal_aspect',
        'coreference',
        'nested_clauses',
        'structural_ambiguity',
        'dialogue',
        'verbose_compression',
        'filler_removal',
        'connector_compression',
        'passive_voice',
      ];
      const covered = new Set(fixtures.cases.map((c) => c.category));
      const missing = expected.filter((e) => !covered.has(e));
      expect(missing).toEqual([]);
    });
  });

  describe('category-level pass rates (informational)', () => {
    // Group by category for diagnostic reporting
    const byCategory = new Map<string, BenchmarkCase[]>();
    for (const c of fixtures.cases) {
      if (!byCategory.has(c.category)) byCategory.set(c.category, []);
      byCategory.get(c.category)!.push(c);
    }

    for (const [category, cases] of byCategory) {
      it(`category: ${category} (${cases.length} cases)`, () => {
        let passInvariants = 0;
        let passForbidden = 0;
        let passRatio = 0;
        const totalRatio = { sum: 0 };

        for (const c of cases) {
          const result = c2si.compress(c.raw, { domain: c.domain }) as ReturnType<
            typeof c2si.compressRules
          >;
          if (checkInvariants(result.compressed, c.mustContain).length === 0) passInvariants++;
          if (checkForbidden(result.compressed, c.mustNotContain).length === 0) passForbidden++;
          if (result.stats.ratio >= c.minRatio) passRatio++;
          totalRatio.sum += result.stats.ratio;
        }

        const avgRatio = (totalRatio.sum / cases.length).toFixed(2);
        // Attach diagnostics to test name via expectation message
        expect({
          category,
          cases: cases.length,
          invariantPassRate: `${passInvariants}/${cases.length}`,
          forbiddenPassRate: `${passForbidden}/${cases.length}`,
          ratioPassRate: `${passRatio}/${cases.length}`,
          avgRatio: `${avgRatio}x`,
        }).toMatchObject({
          invariantPassRate: `${cases.length}/${cases.length}`,
          forbiddenPassRate: `${cases.length}/${cases.length}`,
          ratioPassRate: `${cases.length}/${cases.length}`,
        });
      });
    }
  });
});

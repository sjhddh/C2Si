/**
 * Tier 3 HyperSCN Benchmark — Hard CI Gate
 *
 * Runs the Tier 3 compressor against a fixture file of realistic Tier 2 SCN
 * inputs and verifies:
 *   1. All critical invariants survive (entities, numbers, dates, modality)
 *   2. Legend contains expected predicate aliases
 *   3. Compression ratio meets the per-case minimum
 *   4. Output is deterministic (byte-identical on repeated calls)
 *
 * This benchmark locks in the Tier 3 compression guarantees. Any regression
 * in `compressToHyperSCN` that breaks a fixture will fail the build.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compressToHyperSCN } from '../src/tier3/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, 'benchmark', 'tier3-fixtures.json');

interface Tier3Case {
  id: string;
  category: string;
  scn: string;
  mustContain: string[];
  mustContainLegend: string[];
  minRatio: number;
  note: string;
}

interface Tier3Fixtures {
  version: string;
  description: string;
  hardThresholds: {
    minRatioOverall: number;
    invariantViolationTolerance: number;
    determinismRequired: boolean;
  };
  cases: Tier3Case[];
}

const fixtures: Tier3Fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

describe('Tier 3 HyperSCN Benchmark', () => {
  describe('schema validation', () => {
    it('has at least 5 cases covering distinct categories', () => {
      expect(fixtures.cases.length).toBeGreaterThanOrEqual(5);
      const categories = new Set(fixtures.cases.map((c) => c.category));
      expect(categories.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('invariant preservation', () => {
    for (const c of fixtures.cases) {
      it(`${c.id} [${c.category}] preserves ${c.mustContain.length} invariants`, () => {
        const r = compressToHyperSCN(c.scn);
        const missing = c.mustContain.filter((term) => !r.full.includes(term));
        expect(
          missing,
          `${c.note}\nOutput:\n${r.full}`,
        ).toEqual([]);
      });
    }
  });

  describe('legend correctness', () => {
    for (const c of fixtures.cases) {
      if (c.mustContainLegend.length === 0) continue;
      it(`${c.id} [${c.category}] legend contains expected aliases`, () => {
        const r = compressToHyperSCN(c.scn);
        const missing = c.mustContainLegend.filter((term) => !r.legend.includes(term));
        expect(
          missing,
          `${c.note}\nLegend: ${r.legend}\nOutput:\n${r.full}`,
        ).toEqual([]);
      });
    }
  });

  describe('compression ratio thresholds', () => {
    for (const c of fixtures.cases) {
      it(`${c.id} [${c.category}] meets minRatio ${c.minRatio}x`, () => {
        const r = compressToHyperSCN(c.scn);
        expect(
          r.stats.ratio,
          `${c.note}\nInput (${r.stats.inputTokens}t) → Output (${r.stats.outputTokens}t)\nOutput:\n${r.full}`,
        ).toBeGreaterThanOrEqual(c.minRatio);
      });
    }
  });

  describe('determinism', () => {
    for (const c of fixtures.cases) {
      it(`${c.id} [${c.category}] is deterministic`, () => {
        const r1 = compressToHyperSCN(c.scn);
        const r2 = compressToHyperSCN(c.scn);
        expect(r2.full).toEqual(r1.full);
        expect(r2.legend).toEqual(r1.legend);
      });
    }
  });

  describe('aggregate', () => {
    it(`overall average ratio ≥ ${fixtures.hardThresholds.minRatioOverall}x`, () => {
      const ratios = fixtures.cases.map((c) => compressToHyperSCN(c.scn).stats.ratio);
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      expect(avg, `Avg ratio across ${ratios.length} cases: ${avg.toFixed(3)}`).toBeGreaterThanOrEqual(
        fixtures.hardThresholds.minRatioOverall,
      );
    });

    it('no case expands the input', () => {
      const expansions: string[] = [];
      for (const c of fixtures.cases) {
        const r = compressToHyperSCN(c.scn);
        if (r.stats.outputTokens > r.stats.inputTokens) {
          expansions.push(`${c.id}: ${r.stats.inputTokens}→${r.stats.outputTokens}`);
        }
      }
      expect(expansions).toEqual([]);
    });
  });
});

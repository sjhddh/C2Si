/**
 * Tier 3 (HyperSCN) tests.
 *
 * These tests verify:
 *   1. Determinism — same input → byte-identical output
 *   2. Invariant preservation — all entities, numbers, modality markers, negation
 *      survive through Tier 2 → Tier 3 pipeline
 *   3. Cost-benefit guard — short input falls through unchanged (no bloat)
 *   4. Predicate aliasing — Greek letters replace frequent predicates
 *   5. Modality safety — NEG:, POSS:, OBL: prefixes are never aliased
 *   6. Preamble self-description — preamble contains decoding rules
 */

import { describe, it, expect } from 'vitest';
import {
  compressToHyperSCN,
  HYPER_SCN_PREAMBLE,
  PREAMBLE_TOKEN_COST,
  withPreamble,
  PREDICATE_ALIASES,
  compressHyper,
  compressSCNToHyper,
} from '../src/index.js';

// Realistic Tier 2 SCN output (the kind of thing a model adapter returns)
const TIER2_SHORT = `RAISE a0:$a a1:rates a2:+50bp tm:Thursday mn:unexpected
→CAUSE: EXCEED a0:inflation a1:target tm:6mo
→RESULT: DECLINE a0:EUR-USD a1:-2.1%`;

const TIER2_LONG = `@E1=European-Central-Bank(type:org)
@E2=interest-rates(type:metric)

ANNOUNCE a0:$a a1:policy tm:Wednesday
RAISE a0:$a a1:$b a2:+50bp tm:Thursday mn:unexpected cs:inflation
ANNOUNCE a0:$a a1:next-meeting tm:June
STATE a0:chairman a1:concern cs:inflation
RAISE a0:Fed a1:rates a2:+25bp tm:last-month
RAISE a0:BOJ a1:yield-curve a2:+10bp tm:Friday
DECLINE a0:EUR-USD a1:-2.1% tm:Thursday
DECLINE a0:GBP-USD a1:-1.8% tm:Thursday
STATE a0:IMF a1:risk tm:October
STATE a0:World-Bank a1:outlook tm:October
→CAUSE: EXCEED a0:inflation a1:target
→RESULT: DECLINE a0:currency
NEG:APPROVE a0:committee a1:proposal tm:Monday
POSS:RAISE a0:Fed a1:rates tm:June`;

describe('compressToHyperSCN — determinism', () => {
  it('produces byte-identical output on repeated calls', () => {
    const a = compressToHyperSCN(TIER2_LONG);
    const b = compressToHyperSCN(TIER2_LONG);
    expect(b.full).toEqual(a.full);
    expect(b.legend).toEqual(a.legend);
    expect(b.stats.outputTokens).toEqual(a.stats.outputTokens);
  });
});

describe('compressToHyperSCN — cost-benefit guard', () => {
  it('falls through unchanged for non-SCN text (parser finds no clauses)', () => {
    const plain = 'This is just a plain English sentence with no SCN structure.';
    const r = compressToHyperSCN(plain);
    expect(r.worthIt).toBe(false);
    expect(r.full).toBe(plain);
    expect(r.stats.ratio).toBe(1);
  });

  it('still compresses single clauses via positional-arg rewriting (no legend needed)', () => {
    // Even without aliasing, dropping "a0:" "a1:" prefixes saves tokens
    const r = compressToHyperSCN('RAISE a0:$a a1:rates');
    expect(r.worthIt).toBe(true);
    expect(r.stats.outputTokens).toBeLessThan(r.stats.inputTokens);
    // No aliases — legend should be empty when no predicate repeats
    expect(r.stats.aliasesUsed).toBe(0);
    expect(r.legend).toBe('');
  });

  it('does not alias unique predicates but still applies positional args', () => {
    const scn = 'RAISE a0:X a1:Y\nDECLINE a0:A a1:B\nANNOUNCE a0:P a1:Q';
    const r = compressToHyperSCN(scn);
    expect(r.stats.aliasesUsed).toBe(0);
    expect(r.legend).toBe('');
    // But positional args still kicked in → net savings
    expect(r.stats.outputTokens).toBeLessThan(r.stats.inputTokens);
  });

  it('engages aliasing when predicates repeat enough to amortize legend', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.worthIt).toBe(true);
    expect(r.stats.aliasesUsed).toBeGreaterThan(0);
    expect(r.stats.ratio).toBeGreaterThan(1);
  });
});

describe('compressToHyperSCN — invariant preservation', () => {
  it('preserves entity references ($a, $b, @E1, @E2)', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.full).toContain('$a');
    expect(r.full).toContain('$b');
    expect(r.full).toContain('@E1=European-Central-Bank');
    expect(r.full).toContain('@E2=interest-rates');
  });

  it('preserves numbers exactly (+50bp, -2.1%)', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.full).toContain('+50bp');
    expect(r.full).toContain('+25bp');
    expect(r.full).toContain('+10bp');
    expect(r.full).toContain('-2.1%');
    expect(r.full).toContain('-1.8%');
  });

  it('preserves time markers (tm:Thursday, tm:June, tm:6mo)', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.full).toContain('tm:Thursday');
    expect(r.full).toContain('tm:June');
    expect(r.full).toContain('tm:October');
  });

  it('never aliases modality markers (NEG:, POSS:)', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.full).toContain('NEG:');
    expect(r.full).toContain('POSS:');
  });

  it('preserves proper nouns verbatim (Fed, BOJ, IMF, World-Bank)', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.full).toContain('Fed');
    expect(r.full).toContain('BOJ');
    expect(r.full).toContain('IMF');
    expect(r.full).toContain('World-Bank');
  });

  it('preserves discourse markers (→CAUSE:, →RESULT:)', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.full).toContain('→CAUSE:');
    expect(r.full).toContain('→RESULT:');
  });
});

describe('compressToHyperSCN — aliasing behavior', () => {
  it('aliases repeated predicates with Greek letters', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    // RAISE appears 3x and STATE appears 2x — both should get aliased
    expect(r.legend).toMatch(/[αβγδε]=RAISE/);
    expect(r.legend).toMatch(/[αβγδε]=(STATE|ANNOUNCE|DECLINE)/);
  });

  it('does not alias single-occurrence predicates', () => {
    // Only predicates appearing 2+ times should appear in the legend
    const scn = `
RAISE a0:A a1:B
RAISE a0:C a1:D
RAISE a0:E a1:F
UNIQUE_VERB a0:X a1:Y
`;
    const r = compressToHyperSCN(scn);
    expect(r.legend).toContain('=RAISE');
    expect(r.legend).not.toContain('=UNIQUE_VERB');
  });

  it('uses only verified single-token Greek letters as aliases', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    if (r.legend) {
      // Extract alias characters (before each "=")
      const aliasMatches = r.legend.match(/(\S)=[A-Z]/g) ?? [];
      for (const m of aliasMatches) {
        const alias = m[0];
        expect(PREDICATE_ALIASES as readonly string[]).toContain(alias);
      }
    }
  });
});

describe('compressToHyperSCN — compression ratio on realistic input', () => {
  it('achieves ≥1.15x on repetitive SCN (10+ clauses, 3+ repeated predicates)', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    expect(r.stats.ratio).toBeGreaterThanOrEqual(1.15);
  });

  it('output tokens strictly less than input tokens when engaged', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    if (r.worthIt) {
      expect(r.stats.outputTokens).toBeLessThan(r.stats.inputTokens);
    }
  });
});

describe('preamble', () => {
  it('HYPER_SCN_PREAMBLE describes all key notation elements', () => {
    expect(HYPER_SCN_PREAMBLE).toContain('§');
    expect(HYPER_SCN_PREAMBLE).toContain('Greek letter');
    expect(HYPER_SCN_PREAMBLE).toMatch(/\$a.*\$b/);
    expect(HYPER_SCN_PREAMBLE).toContain('positional');
    expect(HYPER_SCN_PREAMBLE).toContain('NEG');
    expect(HYPER_SCN_PREAMBLE).toContain('POSS');
    expect(HYPER_SCN_PREAMBLE).toContain('tm');
    expect(HYPER_SCN_PREAMBLE).toContain('lc');
  });

  it('PREAMBLE_TOKEN_COST is an actual token count', () => {
    expect(PREAMBLE_TOKEN_COST).toBeGreaterThan(100);
    expect(PREAMBLE_TOKEN_COST).toBeLessThan(400);
  });

  it('withPreamble prepends the preamble to content', () => {
    const result = withPreamble('§pred α=RAISE\nα $a rates +50bp');
    expect(result).toContain(HYPER_SCN_PREAMBLE);
    expect(result).toContain('§pred α=RAISE');
    expect(result.indexOf(HYPER_SCN_PREAMBLE)).toBeLessThan(result.indexOf('§pred'));
  });
});

describe('compressSCNToHyper (alias of compressToHyperSCN)', () => {
  it('produces the same result as compressToHyperSCN', () => {
    const a = compressSCNToHyper(TIER2_LONG);
    const b = compressToHyperSCN(TIER2_LONG);
    expect(a.full).toEqual(b.full);
  });
});

describe('compressHyper (end-to-end with mock adapter)', () => {
  it('runs Tier 2 via adapter, then Tier 3 post-processing', async () => {
    const mockAdapter = async () => TIER2_LONG;

    const result = await compressHyper(
      'Raw input text that the mock adapter ignores and returns TIER2_LONG',
      mockAdapter,
    );

    expect(result.text).toContain(HYPER_SCN_PREAMBLE);
    expect(result.report.tier3Aliases).toBeGreaterThan(0);
    expect(result.report.tier2Tokens).toBeGreaterThan(0);
    expect(result.preamble).toBeTruthy();
    expect(result.bodyOnly).not.toContain(HYPER_SCN_PREAMBLE);
  });

  it('supports excluding the preamble (for cached system prompts)', async () => {
    const mockAdapter = async () => TIER2_LONG;

    const result = await compressHyper('anything', mockAdapter, { includePreamble: false });

    expect(result.text).not.toContain(HYPER_SCN_PREAMBLE);
    expect(result.text).toEqual(result.bodyOnly);
  });

  it('reports correct preamble token cost', async () => {
    const mockAdapter = async () => TIER2_LONG;
    const result = await compressHyper('x', mockAdapter);
    expect(result.report.preambleTokens).toBe(PREAMBLE_TOKEN_COST);
  });
});

describe('Tier 3 cumulative compression ratio', () => {
  it('Tier 2 + Tier 3 together achieve higher compression than Tier 2 alone', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    // Tier 3 must strictly improve over its Tier 2 input when engaged
    if (r.worthIt) {
      expect(r.stats.outputTokens).toBeLessThan(r.stats.inputTokens);
    }
  });

  it('reports accurate alias count', () => {
    const r = compressToHyperSCN(TIER2_LONG);
    if (r.worthIt) {
      const aliasLines = r.legend.match(/=[A-Z]+/g) ?? [];
      expect(r.stats.aliasesUsed).toBe(aliasLines.length);
    }
  });
});

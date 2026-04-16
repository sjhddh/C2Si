# C2Si Benchmark — Hard CI Gate

This benchmark is the **mandatory correctness gate** for the C2Si library. It is adapted from **MRLVAL v0.1** (Meta Reasoning Language Validation), a research methodology for validating lossless, high-fidelity meta-language compression.

**Total: 198 assertions across all compression tiers.**

## Philosophy

MRLVAL was designed for full semantic-graph meta-languages (AMR-style, scored with Smatch F1). C2Si is a **text-level compression library**, so the benchmark adapts MRLVAL's core principles to what our library actually does:

| MRLVAL concept | C2Si adaptation |
| --- | --- |
| Smatch graph F1 scoring | Text-level invariant preservation (must-contain lists with equivalence classes) |
| n-best ambiguity handling | Equivalence classes (`["revenue", "rev"]` — any variant counts) |
| Deterministic binary serialization | Deterministic text output (same input → same output, byte-identical) |
| 18 phenomenon categories | Same 18 categories + 5 meta-categories (23 total for Tier 1/2) |
| Compression ratio measurement | Same (`originalTokens / compressedTokens`) |
| Anchor layer for fallback | `minRatio ≥ 0.8` on edge cases prevents catastrophic expansion |

## Structure

The benchmark is split across two fixture files, one per tier family:

- `fixtures.json` — **Tier 1/2** fixtures: 43 test cases across 23 categories. Runner: `../benchmark.test.ts` (165 assertions).
- `tier3-fixtures.json` — **Tier 3** fixtures: 8 test cases across 8 categories. Runner: `../tier3-benchmark.test.ts` (33 assertions).

Total: **198 assertions** that must all pass for the build to succeed.

## Invariant Types

Each case declares two types of invariants:

1. **`mustContain`** — semantic content that MUST survive compression.
   - `"not"` — exact string match (whitespace-insensitive)
   - `["revenue", "rev"]` — equivalence class: ANY variant counts as preserved (Tier 1/2)

2. **`mustNotContain`** — verbose patterns that MUST be compressed away (Tier 1/2).
   - `"due to the fact that"` — case-insensitive forbidden phrase

Tier 3 adds:

3. **`mustContainLegend`** — predicate aliases that MUST appear in the legend line.
   - `"=RAISE"` — legend must include an alias definition for RAISE

## Hard Thresholds (failing any breaks the build)

### Per-case
- `minRatio` — per-case minimum compression ratio (original/compressed tokens)

### Aggregate (Tier 1/2)
- Overall average ratio ≥ 1.1x across all cases
- Zero catastrophic expansion (no case can produce >1.5x output)
- Full determinism (same input → byte-identical output on repeated calls)
- Full phenomenon coverage (all 18 MRLVAL categories must be exercised)

### Aggregate (Tier 3)
- Overall average ratio ≥ 1.15x across all cases
- No case expands the input (strict: `outputTokens ≤ inputTokens`)
- Full determinism (same input → byte-identical output on repeated calls)
- Modality markers (`NEG:`, `POSS:`, `OBL:`) never aliased (truth-value safety)

## Running

```bash
npm run benchmark   # all 198 assertions (Tier 1/2 + Tier 3)
npm test            # full suite (304 tests)
```

## Tier 1/2 Categories Covered (MRLVAL-aligned)

1. `negation` — "not", "no", double negation
2. `modality` — might/must/should (epistemic + deontic)
3. `quantification` — all/every/some/none/numerical
4. `numbers_and_measurements` — decimal, units, magnitudes
5. `dates_and_time` — absolute + relative dates
6. `named_entities` — persons, orgs (incl. dedup stress test)
7. `conditionals` — if/unless (opposite polarity)
8. `comparison` — greater/less/multiplicative
9. `causal` — because/due to/as a result
10. `temporal_aspect` — already/not yet/still
11. `coreference` — cross-sentence entity tracking
12. `nested_clauses` — reported speech nesting
13. `structural_ambiguity` — PP-attachment ambiguity preserved
14. `dialogue` — speaker turns
15. `verbose_compression` — "in order to" → "to"
16. `filler_removal` — "basically", "actually" removed
17. `connector_compression` — "However" → "but"
18. `passive_voice` — semantic role preservation

Additional meta-categories (5):
- `technical_domain` — code abbreviations
- `finance_domain` — YoY, bp, rev
- `determinism` — repeatability check
- `no_regression` — no expansion on edge cases
- `combined_stress` — multiple phenomena in one case

## Tier 3 Categories Covered

1. `basic_aliasing` — repeated predicates get Greek letter aliases
2. `negation_preservation` — `NEG:` prefix never aliased
3. `modality_preservation` — `POSS:`, `OBL:`, `NEG:` all pass through
4. `entity_preservation` — `@E` and `$` references all survive
5. `number_preservation` — digits, percentages, units preserved exactly
6. `time_preservation` — `tm:` role prefix + date values preserved
7. `discourse_preservation` — `→CAUSE:`, `→RESULT:`, `→CONTRAST:`, `→SEQUENCE:` preserved
8. `combined_stress` — entities + numbers + dates + modality + discourse + repeated predicates

## Adding New Cases

### Tier 1/2 (add to `fixtures.json`)

1. Add a case with a unique ID following the `CAT-NNN` convention
2. Use equivalence classes (`[...]`) for anything that may be abbreviated
3. Set `minRatio` based on **actually measured** compression, not wishful thinking
4. Run `npm run benchmark` — if it passes, the case is real

### Tier 3 (add to `tier3-fixtures.json`)

1. Write the Tier 2 SCN input you want to test (this is what Tier 3 compresses)
2. List entities, numbers, modality markers in `mustContain`
3. List expected predicate aliases in `mustContainLegend` (e.g., `["=RAISE"]`)
4. Predicates that are 1 token in GPT BPE (like `STATE`, `EXPECT`) will NOT be aliased — don't require them
5. Run `npm run benchmark` — if it passes, the case is real

## Why This Matters

Text compression is easy to get wrong silently:
- A rule that removes "not" would look like compression but destroy meaning
- Aggressive entity replacement could swap agents and patients in passive voice
- Over-zealous abbreviation could drop critical numbers or dates
- Tier 3 aliasing could accidentally confuse `NEG:APPROVE` with `APPROVE`

This benchmark catches all of those regressions before they ship.

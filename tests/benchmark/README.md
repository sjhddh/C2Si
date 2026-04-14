# C2Si Benchmark — Hard CI Gate

This benchmark is the **mandatory correctness gate** for the C2Si library. It is adapted from **MRLVAL v0.1** (Meta Reasoning Language Validation), a research methodology for validating lossless, high-fidelity meta-language compression.

## Philosophy

MRLVAL was designed for full semantic-graph meta-languages (AMR-style, scored with Smatch F1). C2Si is a **text-level compression library**, so the benchmark adapts MRLVAL's core principles to what our library actually does:

| MRLVAL concept | C2Si adaptation |
| --- | --- |
| Smatch graph F1 scoring | Text-level invariant preservation (must-contain lists with equivalence classes) |
| n-best ambiguity handling | Equivalence classes (`["revenue", "rev"]` — any variant counts) |
| Deterministic binary serialization | Deterministic text output (same input → same output, byte-identical) |
| 18 phenomenon categories | Same 18 categories, each with 2–4 test cases |
| Compression ratio measurement | Same (`originalTokens / compressedTokens`) |
| Anchor layer for fallback | `minRatio ≥ 0.8` on edge cases prevents catastrophic expansion |

## Structure

- `fixtures.json` — 44 test cases across 18 phenomenon categories
- `../benchmark.test.ts` — the runner that executes 165 assertions

## Invariant Types

Each case declares two types of invariants:

1. **`mustContain`** — semantic content that MUST survive compression.
   - `"not"` — exact string match (whitespace-insensitive)
   - `["revenue", "rev"]` — equivalence class: ANY variant counts as preserved

2. **`mustNotContain`** — verbose patterns that MUST be compressed away.
   - `"due to the fact that"` — case-insensitive forbidden phrase

## Hard Thresholds (failing any breaks the build)

- `minRatio` — per-case minimum compression ratio (original/compressed tokens)
- **Overall average ratio ≥ 1.1x** across all cases
- **Zero catastrophic expansion** (no case can produce >1.5x output)
- **Full determinism** (same input → byte-identical output on repeated calls)
- **Full phenomenon coverage** (all 18 categories must be exercised)

## Running

```bash
npm run benchmark   # benchmark only
npm test            # unit tests + benchmark (full suite)
```

## Categories Covered (MRLVAL-aligned)

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

Additional meta-categories:
- `technical_domain` — code abbreviations
- `finance_domain` — YoY, bp, rev
- `determinism` — repeatability check
- `no_regression` — no expansion on edge cases
- `combined_stress` — multiple phenomena in one case

## Adding New Cases

1. Add a case to `fixtures.json` with a unique ID
2. Use equivalence classes for anything that may be abbreviated
3. Set `minRatio` based on **actually measured** compression, not wishful thinking
4. Run `npm run benchmark` — if it passes, the case is real

## Why This Matters

Text compression is easy to get wrong silently:
- A rule that removes "not" would look like compression but destroy meaning
- Aggressive entity replacement could swap agents and patients in passive voice
- Over-zealous abbreviation could drop critical numbers or dates

This benchmark catches all of those regressions before they ship.

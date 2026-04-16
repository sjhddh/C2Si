# AGENTS.md — C2Si for AI Agents

> **Read this first if you are an AI coding agent or LLM trying to use this library.**
> Everything you need is on this page. No exploration required.

## What this library does

C2Si compresses human language into token-efficient notation for LLM consumption. It removes redundant function words, filler phrases, and articles — while **guaranteeing** that all critical semantic content (negations, modalities, entities, numbers, dates) survives.

**Typical savings**: 20–40% tokens on prose, up to 60% on verbose corporate text (Tier 1); 5–9x vs raw when Tier 3 preamble is cached across calls.
**Correctness**: 198-assertion benchmark suite (165 Tier 1/2 + 33 Tier 3) across 18 phenomenon categories, MRLVAL-adapted.
**Compatibility**: pure text in → pure text out. Works with GPT, Claude, Gemini, Llama, any LLM.

## When you should use it

Use C2Si when you need to:
- Send long system prompts to an LLM API
- Inject retrieved RAG context into a prompt
- Compress conversation history approaching token limits
- Reduce API spend on repetitive or verbose user inputs

Do NOT use C2Si for:
- User-facing display text (compression output is machine-optimized, not pretty)
- Content where exact wording matters (legal contracts, quoted speech, poetry)
- Text shorter than ~50 tokens (not enough slack to compress)

## The 30-second integration

```ts
import { compress } from 'c2si';

// Before sending anything to your LLM, compress it.
const response = await yourLLMClient.complete(compress(longPrompt));
```

That's it. `compress()` is synchronous, never throws, and returns a plain string.

## Public API surface (import from `'c2si'`)

### Agent-friendly (use these by default)

| Function | Signature | Purpose |
|---|---|---|
| `compress` | `(text, options?) → string` | **Tier 1.** One-line compression. Returns compressed string directly. |
| `compressDetailed` | `(text, options?) → CompressResult` | Same but with token statistics. |
| `compressMessages` | `(messages[], options?) → messages[]` | Drop-in for OpenAI-compatible `messages` arrays. |
| `compressReport` | `(text, options?) → {text, report}` | Returns text + `{tokensSaved, ratio, percentSaved}`. |
| `compressWithModel` | `(text, adapter, options?) → Promise<string>` | **Tier 2.** Async, model-assisted (~3-5x). |
| `compressHyper` | `(text, adapter, options?) → Promise<HyperCompressResult>` | **Tier 3.** Ultra-dense HyperSCN (not human-readable). |
| `compressSCNToHyper` | `(scn: string) → HyperSCNResult` | Apply Tier 3 to already-SCN text; no model call. |
| `tokens` | `(text) → number` | GPT-4 BPE token count. |

### Stateful API

| Class | Purpose |
|---|---|
| `C2Si` | Stateful compressor. Use `new C2Si({ adapter })` to configure a model backend, or `c2si.createSession()` for cross-document entity tracking. |

### Model adapters (for `compressWithModel` or `new C2Si({ adapter })`)

| Function | Signature |
|---|---|
| `ollamaAdapter` | `({ model, host?, timeout?, temperature? }) → ModelAdapter` |
| `openaiAdapter` | `({ model, baseUrl, apiKey?, timeout?, temperature? }) → ModelAdapter` |

A `ModelAdapter` is any `(prompt: string) => Promise<string>` function — you can also pass a custom function if you have a non-standard backend.

## Options object

```ts
interface CompressOptions {
  domain?: 'finance' | 'legal' | 'code' | 'medical';  // Enables domain abbreviations
  rulesOnly?: boolean;  // Skip model-assisted path even if adapter configured
}
```

## Return types

```ts
interface CompressResult {
  compressed: string;
  stats: {
    originalTokens: number;
    compressedTokens: number;
    ratio: number;            // e.g. 1.6
    originalChars: number;
    compressedChars: number;
  };
  entities: EntityRegistry;   // Internal entity tracking state
}

interface CompressionReport {
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  ratio: number;
  percentSaved: number;
}
```

## Canonical usage patterns

### Pattern 1: Drop-in before any API call

```ts
import OpenAI from 'openai';
import { compress } from 'c2si';

const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: compress(systemPrompt) },
    { role: 'user',   content: compress(userMessage) },
  ],
});
```

### Pattern 2: Message array wrapping

```ts
import { compressMessages } from 'c2si';

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: compressMessages(conversationHistory),
});
```

`compressMessages` preserves the `role`, `name`, `tool_call_id`, and any other fields — only `content` is compressed.

### Pattern 3: RAG context compression

```ts
import { compress, tokens } from 'c2si';

const docs = await vectorStore.similaritySearch(query, k=10);
const context = docs.map(d => compress(d.pageContent)).join('\n\n');

if (tokens(context) > 8000) {
  // still too long, retrieve fewer docs
}
```

### Pattern 4: Logging savings to the user

```ts
import { compressReport } from 'c2si';

const { text, report } = compressReport(userInput);
console.log(`C2Si: ${report.tokensSaved} tokens saved (${report.ratio}x)`);
await sendToLLM(text);
```

### Pattern 5: Deep compression with a local model

```ts
import { compressWithModel, ollamaAdapter } from 'c2si';

const adapter = ollamaAdapter({ model: 'llama3.2:3b' });
const compressed = await compressWithModel(longDocument, adapter);
// → ~3-5x compression into SCN notation
```

### Pattern 6: Tier 3 HyperSCN for high-volume agents

```ts
import { compressHyper, ollamaAdapter } from 'c2si';

const adapter = ollamaAdapter({ model: 'llama3.2:3b' });

// One-shot (preamble embedded) — simplest
const r = await compressHyper(longDocument, adapter);
await openai.chat.completions.create({ messages: [{ role: 'user', content: r.text }] });

// Amortized (preamble cached) — best for repeated calls
const { preamble, bodyOnly } = await compressHyper(doc, adapter, { includePreamble: false });
await openai.chat.completions.create({
  messages: [
    { role: 'system', content: preamble },  // ~270t paid once across all calls
    { role: 'user',   content: bodyOnly },
  ],
});
```

## Safety guarantees

All guarantees are enforced by the benchmark suite: 165 assertions for Tier 1/2 (`tests/benchmark/fixtures.json`) plus 33 assertions for Tier 3 (`tests/benchmark/tier3-fixtures.json`) — **198 total**. The build breaks on any regression.

**Invariants preserved** (you can rely on these):

1. **Negation markers** — `not`, `no`, `never`, `cannot`, `without`
2. **Modality** — `must`, `might`, `should`, `could`, `would`, `may`
3. **Quantifiers** — `all`, `every`, `some`, `none`, `each`, cardinal numbers
4. **Numbers and units** — all digits, decimals, percentages, currency, dates
5. **Proper nouns** — person/place/org names preserved (first occurrence always full)
6. **Temporal aspects** — `already`, `yet`, `still`, tense markers
7. **Causal/conditional connectors** — `because`, `if`, `unless`, `since`
8. **Comparison markers** — `greater`, `less`, `more`, `fewer`, `than`
9. **Passive voice** — semantic roles (agent/patient) never swap
10. **Nested speech/belief** — reported speech structure intact

**What gets removed** (safe to drop for LLM consumption):

- Articles (`the`, `a`, `an`)
- Filler adverbs (`actually`, `basically`, `essentially`, `literally`)
- Verbose phrases (`in order to`, `due to the fact that`, `it is important to note that`)
- Hedge words (`quite`, `rather`, `somewhat`)
- Discourse connectors get shortened (`however` → `but`, `furthermore` → `+`)

**What gets abbreviated** (semantically equivalent):

- `management` → `mgmt`, `configuration` → `config`, `approximately` → `~`
- `greater than` → `>`, `versus` → `vs`, `for example` → `e.g.`
- Domain-specific: `year over year` → `YoY`, `basis points` → `bp` (finance domain)

## Determinism guarantee

`compress(x)` called twice with identical input returns byte-identical output. This is tested in the benchmark. You can safely cache compression results keyed by input hash.

## Error behavior

- Empty input (`""`) → returns `""`
- Already-tight input → returns unchanged (ratio ~1.0x, never worse than 0.8x)
- Very short input (< 10 tokens) → may not compress at all, but never expands catastrophically
- `compress()` never throws. Model adapters can throw on network errors — catch them if you care.

## Compression tiers — which to use?

| Tier | Function | Async? | Config needed | Ratio | Human-readable? | Use when |
|---|---|---|---|---|---|---|
| **1 (Rules)** | `compress()` | No | None | 1.1–1.6x | Yes | Default. Zero setup. |
| **2 (SCN)** | `compressWithModel()` | Yes | Model adapter | 3–5x | Partially | Very long docs, local model available |
| **3 (HyperSCN)** | `compressHyper()` | Yes | Model adapter | 5–9x | No | High-volume agents with cached preamble, or RAG with many chunks |

**Decision tree:**
- No adapter available → Tier 1
- Adapter available, one-shot request, prompt < 500 tokens → Tier 1 (Tier 2/3 overhead not worth it)
- Adapter available, one-shot request, prompt > 2000 tokens → Tier 2
- Adapter available, repeated calls with shared system prompt → Tier 3 (preamble caches for free)
- RAG pipeline injecting 10+ chunks per request → Tier 3 (preamble amortizes across chunks)

### Tier 3 preamble caching pattern (critical for cost savings)

Tier 3 emits a ~270-token preamble that teaches the target LLM how to decode HyperSCN. For a single request this is overhead, but if you cache it in the system prompt, the cost is paid once across all requests.

```ts
// Efficient: pay preamble cost ONCE, then many compressed calls
const { preamble, bodyOnly } = await compressHyper(doc1, adapter, { includePreamble: false });

// Cache preamble in system prompt (works with Anthropic prompt caching, OpenAI system messages)
const systemMsg = { role: 'system', content: preamble };

// Now every request pays only the body cost
await llm.chat({ messages: [systemMsg, { role: 'user', content: bodyOnly }] });
```

## What you should NOT do

- **Don't compress LLM outputs.** C2Si is for compressing *inputs* (system prompts, user messages, context). Compressing outputs destroys their readability for humans.
- **Don't compress user-facing text.** Output is optimized for machine reading, not display.
- **Don't pre-compress system prompts at build time and store them.** C2Si is cheap to run (~1ms per paragraph). Compress at request time so you can update prompts freely.
- **Don't double-compress.** Running `compress(compress(x))` gains nothing and may remove meaningful tokens on the second pass.
- **Don't manually parse the output.** The compressed format is not a stable public contract for downstream parsing — it's designed to be read by LLMs, not structured consumers.

## Debugging compression

If you suspect C2Si dropped something it shouldn't have:

```ts
import { compressDetailed } from 'c2si';

const r = compressDetailed(input);
console.log('Original :', input);
console.log('Compressed:', r.compressed);
console.log('Stats    :', r.stats);

// Diff approach
const dropped = input.split(' ').filter(w => !r.compressed.includes(w));
console.log('Dropped words:', dropped);
```

If a critical invariant was dropped, please open an issue with the input text — that's a benchmark regression.

## File map (for agents that need to read source)

| File | Purpose |
|---|---|
| `src/index.ts` | Public exports |
| `src/convenience.ts` | `compress`, `compressMessages`, etc. |
| `src/compressor.ts` | `C2Si` class + `C2SiSession` |
| `src/rules/stopwords.ts` | Stopword and filler removal rules |
| `src/rules/entities.ts` | Entity extraction and `$a` deduplication |
| `src/rules/structural.ts` | Prose → structured form patterns |
| `src/rules/abbreviations.ts` | General + domain abbreviations |
| `src/scn/prompt.ts` | System prompt for Tier 2 (model-assisted) |
| `src/scn/serializer.ts` | SCN output format |
| `src/tier3/vocabulary.ts` | Verified 1-token symbol pool (Greek letters, arrows) |
| `src/tier3/hyper-scn.ts` | Tier 3 deterministic compressor (SCN → HyperSCN) |
| `src/tier3/preamble.ts` | Self-describing LLM decoder preamble |
| `src/adapters/ollama.ts` | Ollama HTTP adapter |
| `src/adapters/openai.ts` | OpenAI-compatible HTTP adapter |
| `src/tokenizer/counter.ts` | GPT BPE token counting |
| `tests/benchmark.test.ts` | Tier 1/2 CI gate (165 assertions) |
| `tests/tier3-benchmark.test.ts` | Tier 3 CI gate (33 assertions) |
| `tests/benchmark/fixtures.json` | Tier 1/2 fixtures (43 cases, 18 categories) |
| `tests/benchmark/tier3-fixtures.json` | Tier 3 fixtures (8 cases) |

## Running the tests

```bash
npm test            # 282 tests (unit + benchmark across all tiers)
npm run benchmark   # 198-assertion CI gate (Tier 1/2 + Tier 3)
npm run build       # produces dist/index.{js,cjs,d.ts}
```

## If you are modifying this library

1. Every new rule must preserve the benchmark invariants — `npm run benchmark` is the gate.
2. Every abbreviation must be **token-cost-verified**: the shortened form must produce fewer tokens in the GPT BPE vocabulary than the original. The entity deduplication logic (`src/rules/entities.ts`) is the reference implementation — it calls `countTokens()` on both forms before deciding to replace.
3. Add test cases to `tests/benchmark/fixtures.json` for any new phenomenon you claim to handle.
4. Follow the existing coding style: strict TypeScript, pure functions where possible, no external dependencies beyond `gpt-tokenizer`.

## Quick reference card

```ts
// Import
import { compress, compressMessages, compressReport, tokens } from 'c2si';

// Compress a string
const out = compress(text);

// Compress with domain hint
const out = compress(text, { domain: 'finance' });

// Compress OpenAI-style messages
const msgs = compressMessages([{role:'system',content:text}, ...]);

// Compress with savings report
const { text: out, report } = compressReport(input);

// Count tokens
const n = tokens(text);

// Deep compression (async, needs model)
import { compressWithModel, ollamaAdapter } from 'c2si';
const out = await compressWithModel(text, ollamaAdapter({ model: 'llama3.2:3b' }));

// Tier 3: maximum compression for high-volume agents (async, needs model)
import { compressHyper } from 'c2si';
const r = await compressHyper(text, adapter);
// r.text has preamble+content ready to send; r.preamble/r.bodyOnly for caching
```

That's the entire library. No hidden APIs. No magic configuration. Drop `compress()` before your LLM call and ship it.

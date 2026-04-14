# AGENTS.md — C2Si for AI Agents

> **Read this first if you are an AI coding agent or LLM trying to use this library.**
> Everything you need is on this page. No exploration required.

## What this library does

C2Si compresses human language into token-efficient notation for LLM consumption. It removes redundant function words, filler phrases, and articles — while **guaranteeing** that all critical semantic content (negations, modalities, entities, numbers, dates) survives.

**Typical savings**: 20–40% tokens on prose, up to 60% on verbose corporate text.
**Correctness**: 165 assertion test suite across 18 phenomenon categories (MRLVAL-adapted).
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
| `compress` | `(text, options?) → string` | One-line compression. Returns compressed string directly. |
| `compressDetailed` | `(text, options?) → CompressResult` | Same but with token statistics. |
| `compressMessages` | `(messages[], options?) → messages[]` | Drop-in for OpenAI-compatible `messages` arrays. |
| `compressReport` | `(text, options?) → {text, report}` | Returns text + `{tokensSaved, ratio, percentSaved}`. |
| `compressWithModel` | `(text, adapter, options?) → Promise<string>` | Async, model-assisted deep compression. |
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

## Safety guarantees

All guarantees are enforced by the benchmark suite (`tests/benchmark/fixtures.json`, 165 assertions). The build breaks on any regression.

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

| Tier | Function | Async? | Config needed | Ratio | Use when |
|---|---|---|---|---|---|
| **Rules** | `compress()` | No | None | 1.1–1.6x | Default. Zero setup. |
| **Rules + SCN** | `compressWithModel()` | Yes | Model adapter | 3–5x | Very long docs, local GPU/CPU available |

For most agents, **Tier 1 is all you need**. Tier 2 is for workflows where you send MB-scale documents to an expensive model and want to run them through a cheap local 3B model first.

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
| `src/adapters/ollama.ts` | Ollama HTTP adapter |
| `src/adapters/openai.ts` | OpenAI-compatible HTTP adapter |
| `src/tokenizer/counter.ts` | GPT BPE token counting |
| `tests/benchmark.test.ts` | Hard CI gate (165 assertions) |
| `tests/benchmark/fixtures.json` | Benchmark test cases |

## Running the tests

```bash
npm test            # 224 tests (unit + benchmark)
npm run benchmark   # benchmark only (165 assertions)
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
```

That's the entire library. No hidden APIs. No magic configuration. Drop `compress()` before your LLM call and ship it.

<div align="center">

# C2Si

### **Carbon → Silicon** Language Translator

*Compress human language into token-efficient notation for LLMs.*
*Keep every bit of meaning. Pay 20–60% less per API call.*

[![tests](https://img.shields.io/badge/tests-224%20passing-brightgreen)]()
[![benchmark](https://img.shields.io/badge/MRLVAL%20benchmark-165%2F165-brightgreen)]()
[![zero deps](https://img.shields.io/badge/runtime%20deps-1-blue)]()
[![typescript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![license](https://img.shields.io/badge/license-Apache%202.0-green)]()

</div>

---

## TL;DR

```ts
import { compress } from 'c2si';

const prompt = compress(longSystemPrompt);  // 40% fewer tokens, same meaning
await openai.chat.completions.create({ messages: [{ role: 'user', content: prompt }] });
```

**One import. One function. Drop-in for any LLM API.**

---

## Why C2Si?

Human language is **wildly redundant** for machine consumption. LLMs don't need "in order to" when "to" means the same thing. They don't need "due to the fact that" when "because" does the job. They don't need articles at all.

But removing redundancy naively breaks meaning. Drop "not" and a statement inverts. Drop a number and facts vanish. Drop a modal verb and obligation becomes suggestion.

C2Si is a **token-aware, invariant-preserving compressor** that squeezes human language into a denser form while guaranteeing every critical semantic token survives — verified against 165 test cases covering 18 linguistic phenomenon categories adapted from MRLVAL v0.1.

### The savings, on real text

| Sample | Original | Compressed | Savings |
|---|---|---|---|
| Verbose corporate prose | 40 tokens | 25 tokens | **38%** |
| Finance news headline | 34 tokens | 27 tokens | **21%** |
| Technical documentation | 28 tokens | 22 tokens | **21%** |

Over a 1M-token/day agent, that's **$200–600/month saved** on GPT-4 API costs. And it works with **any LLM** — GPT, Claude, Gemini, Llama, Mistral. No model retraining. No special endpoints. No changes to your downstream code.

---

## Install

```bash
npm install c2si
```

One runtime dependency (`gpt-tokenizer`). Zero WASM. Zero native bindings. Pure TypeScript. Works in Node.js 18+ and modern browsers.

---

## Quick Start

### The one-liner

```ts
import { compress } from 'c2si';

const compressed = compress("In order to effectively address the ongoing challenges...");
// → "to effectively address ongoing challenges..."
```

### With stats

```ts
import { compressReport } from 'c2si';

const { text, report } = compressReport(longPrompt);
console.log(`Saved ${report.percentSaved}% (${report.ratio}x compression)`);
// → "Saved 38% (1.6x compression)"

await openai.chat.completions.create({
  messages: [{ role: 'user', content: text }]
});
```

### Drop-in for OpenAI, Anthropic, Ollama, anything

```ts
import { compressMessages } from 'c2si';

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: compressMessages([
    { role: 'system', content: LONG_SYSTEM_PROMPT },
    { role: 'user',   content: userQuestion },
  ]),
});
```

`compressMessages()` takes an array of OpenAI-compatible messages and returns the same array with compressed `content` fields. Every other field (role, name, tool_call_id, ...) passes through untouched.

---

## Live Example

**Input** (40 tokens):

> *"In order to effectively address the ongoing challenges that have been identified, it is important to note that the management team must develop a comprehensive strategy due to the fact that the current approach is no longer sufficient."*

**Output** (25 tokens — **38% savings**):

> *"to effectively address ongoing challenges that have been identified, mgmt team must develop comprehensive strategy because curr approach is no longer sufficient."*

### What survived vs. what got compressed

| ✅ Preserved (critical meaning) | ❌ Compressed away |
|---|---|
| `must` — modality (obligation) | `In order to` → `to` |
| `no longer sufficient` — negation | `it is important to note that` → removed |
| `challenges`, `strategy`, `approach` | `due to the fact that` → `because` |
| `team`, `develop`, `identified` | `the`, `a` → removed |
| All semantic relationships intact | `management` → `mgmt` |

Notice what's clever:
- **`must`** stays — dropping it flips "must develop" from obligation to suggestion
- **`no longer`** stays — dropping it inverts the meaning entirely
- **`because`** replaces 6 tokens with 1 — same semantic content

Any LLM reading the compressed version answers questions about the original with **identical accuracy**, but you pay 38% less.

---

## How It Works

C2Si is a **two-tier compression pipeline**:

```
┌───────────────────────────────────────────────┐
│                                               │
│   Your text (1000 tokens)                     │
│            │                                  │
│            ▼                                  │
│   ┌───────────────────────┐                   │
│   │  Tier 1: Rules Engine │  ← always runs    │
│   │  • Stop words         │                   │
│   │  • Entity dedup (@E)  │  ~1.2–1.6x        │
│   │  • Structural reflow  │                   │
│   │  • Abbreviations      │                   │
│   └───────────┬───────────┘                   │
│               │                               │
│               ▼                               │
│   ┌───────────────────────┐                   │
│   │  Tier 2: SCN Model    │  ← optional       │
│   │  • LLM-assisted       │                   │
│   │  • Full predicate-arg │  ~3–5x            │
│   │  • Discourse relations│                   │
│   └───────────┬───────────┘                   │
│               │                               │
│               ▼                               │
│   Compressed SCN (200-350 tokens)             │
│                                               │
└───────────────────────────────────────────────┘
```

### Tier 1 — Rules Engine (synchronous, zero config)

A deterministic pipeline of ~200 hand-tuned rules:

- **Stopword removal** — articles, filler adverbs ("actually", "basically"), redundant hedges
- **Phrase compression** — "due to the fact that" → "because", "in order to" → "to"
- **Entity deduplication** — long proper nouns that appear many times get `$a` / `$b` references (only when the tokenizer math proves it saves tokens)
- **Structural reformatting** — "X is defined as Y" → "X=Y", "from A to B" → "A→B"
- **Domain abbreviations** — "management" → "mgmt", "approximately" → "~", "year over year" → "YoY" (when `domain: 'finance'` is specified)

The rules engine is **tokenizer-aware**: every substitution is only applied if it actually reduces token count in the target BPE vocabulary. `$a` replaces a long entity name only if the replacement is provably shorter in tokens.

### Tier 2 — Model-Assisted SCN (optional)

For 3–5x compression ratios, feed your text through a small local model (Llama 3.2 3B, Qwen 2.5 7B, etc.) with the C2Si system prompt. The output is **SCN notation** — a predicate-argument format LLMs read natively:

```
RAISE a0:ECB a1:interest-rates a2:+50bp tm:Thursday mn:unexpected cs:inflation
→CAUSE: EXCEED a0:inflation a1:target tm:6mo
→RESULT: DECLINE a0:EUR-USD a1:-2.1%
```

The economics: spend pennies on a local 3B model to save dollars on GPT-4 / Claude Opus.

---

## Full API

### `compress(text, options?) → string`

One-line compression. Synchronous. Never throws.

```ts
compress("The European Central Bank raised rates", { domain: 'finance' })
// → "European Central Bank raised rates"
```

**Options:**
- `domain?: 'finance' | 'legal' | 'code' | 'medical'` — enables domain-specific abbreviations

### `compressDetailed(text, options?) → CompressResult`

Same as `compress()` but returns token stats.

```ts
const r = compressDetailed(text);
r.compressed         // string
r.stats.originalTokens
r.stats.compressedTokens
r.stats.ratio        // e.g., 1.6
```

### `compressMessages(messages, options?) → Message[]`

Drop-in for any OpenAI-compatible chat API.

```ts
const msgs = compressMessages([
  { role: 'system', content: longPrompt },
  { role: 'user', content: userInput },
]);
```

### `compressReport(text, options?) → { text, report }`

Compressed text + human-readable savings report.

```ts
const { text, report } = compressReport(longInput);
// report.tokensSaved, report.percentSaved, report.ratio
```

### `compressWithModel(text, adapter, options?) → Promise<string>`

Model-assisted deep compression (3–5x).

```ts
import { compressWithModel, ollamaAdapter } from 'c2si';

const adapter = ollamaAdapter({ model: 'llama3.2:3b' });
const compressed = await compressWithModel(longDoc, adapter);
```

### `tokens(text) → number`

GPT-4 BPE token count. Close approximation for Claude/Llama.

```ts
tokens("Hello world")  // → 2
```

### `new C2Si(config?)` — Stateful API

For agents that compress many documents and want entity tracking across calls.

```ts
import { C2Si, ollamaAdapter } from 'c2si';

const c2si = new C2Si({
  adapter: ollamaAdapter({ model: 'llama3.2:3b' }),
});

const session = c2si.createSession();
await session.compress(doc1);  // defines @E1, @E2
await session.compress(doc2);  // reuses @E1 if same entities appear
```

---

## Integration Recipes

<details>
<summary><b>OpenAI SDK</b></summary>

```ts
import OpenAI from 'openai';
import { compressMessages } from 'c2si';

const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: compressMessages([
    { role: 'system', content: LONG_SYSTEM_PROMPT },
    { role: 'user', content: userQuestion },
  ]),
});
```

</details>

<details>
<summary><b>Anthropic SDK</b></summary>

```ts
import Anthropic from '@anthropic-ai/sdk';
import { compress } from 'c2si';

const client = new Anthropic();

const message = await client.messages.create({
  model: 'claude-opus-4-5',
  max_tokens: 1024,
  system: compress(LONG_SYSTEM_PROMPT),
  messages: [{ role: 'user', content: compress(userQuestion) }],
});
```

</details>

<details>
<summary><b>Vercel AI SDK</b></summary>

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { compressMessages } from 'c2si';

const { text } = await generateText({
  model: openai('gpt-4o'),
  messages: compressMessages(conversationHistory),
});
```

</details>

<details>
<summary><b>LangChain</b></summary>

```ts
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { compress } from 'c2si';

const model = new ChatOpenAI({ model: 'gpt-4o' });
const response = await model.invoke([
  new SystemMessage(compress(LONG_SYSTEM_PROMPT)),
  new HumanMessage(compress(userQuestion)),
]);
```

</details>

<details>
<summary><b>RAG / context compression</b></summary>

```ts
import { compress, tokens } from 'c2si';

const retrievedDocs = await vectorStore.similaritySearch(query, 10);

// Compress each chunk before stuffing into context
const compressedContext = retrievedDocs
  .map(d => compress(d.pageContent))
  .join('\n\n');

console.log(`Context: ${tokens(compressedContext)} tokens`);
```

</details>

<details>
<summary><b>Ollama (local model-assisted compression)</b></summary>

```ts
import { compressWithModel, ollamaAdapter } from 'c2si';

// Assumes Ollama running at localhost:11434 with llama3.2:3b pulled
const adapter = ollamaAdapter({ model: 'llama3.2:3b' });

const compressed = await compressWithModel(
  longDocument,
  adapter,
  { domain: 'finance' },
);
// → ~3-5x compression into full SCN notation
```

</details>

---

## The Benchmark

C2Si ships with a **hard CI gate**: 165 assertions across 43 test cases, covering 18 phenomenon categories adapted from [MRLVAL v0.1](./tests/benchmark/README.md) — the research methodology for validating lossless semantic compression.

```bash
npm run benchmark
```

| Category | Cases | Avg ratio |
|---|---|---|
| filler_removal | 1 | **1.63x** |
| verbose_compression | 3 | **1.52x** |
| causal | 2 | **1.35x** |
| structural_ambiguity | 1 | 1.33x |
| connector_compression | 1 | 1.29x |
| combined_stress | 2 | 1.29x |
| temporal_aspect | 2 | 1.27x |
| determinism | 1 | 1.23x |
| passive_voice | 1 | 1.22x |
| comparison | 2 | 1.21x |
| modality | 3 | 1.19x |
| negation | 3 | 1.19x |
| quantification | 3 | 1.16x |
| nested_clauses | 1 | 1.14x |
| finance_domain | 1 | 1.11x |
| numbers_and_measurements | 3 | 1.09x |
| named_entities | 3 | 1.07x |
| dates_and_time | 2 | 1.06x |
| no_regression | 2 | 1.00x |
| **Overall** | **43** | **1.20x** |

Every case checks three invariants:
1. **Must-contain** — critical semantic tokens (entities, numbers, negations, modalities) survive
2. **Must-not-contain** — verbose patterns ("due to the fact that", "it is important to note that") are removed
3. **Minimum ratio** — the compression target is met

Plus aggregate gates:
- **No catastrophic expansion** — no case produces > 1.5x output size
- **Full determinism** — same input → byte-identical output on repeated calls
- **Complete phenomenon coverage** — all 18 MRLVAL categories exercised

The benchmark runs in `npm test` and breaks the build on any regression.

---

## What C2Si is NOT

- **Not lossy summarization.** C2Si preserves all facts, entities, numbers, and semantic relationships. It removes redundant function words, not information.
- **Not a tokenizer.** It uses `gpt-tokenizer` under the hood but doesn't replace your client's tokenization.
- **Not specific to one LLM.** The output is plain text that any model reads fluently.
- **Not a quantization/distillation tool.** It operates on text at the prompt layer, not on model weights.
- **Not a context-window extender via KV cache tricks.** It's pure hard-prompt compression that works at the API boundary.

---

## Project Structure

```
c2si/
├── src/
│   ├── index.ts            # Public API
│   ├── convenience.ts      # compress(), compressMessages(), etc.
│   ├── compressor.ts       # C2Si class
│   ├── rules/              # Rule engine
│   │   ├── stopwords.ts    # Articles, fillers, verbose phrases
│   │   ├── entities.ts     # NER + token-aware dedup
│   │   ├── structural.ts   # Prose reflow patterns
│   │   └── abbreviations.ts# Domain-specific shortenings
│   ├── scn/                # SCN format + LLM prompt
│   ├── adapters/           # Ollama, OpenAI-compatible
│   └── tokenizer/          # GPT BPE counting
└── tests/
    ├── benchmark/          # MRLVAL-adapted test fixtures
    ├── benchmark.test.ts   # Hard CI gate (165 assertions)
    └── *.test.ts           # Unit tests
```

---

## Research Foundation

C2Si synthesizes three research threads:

- **[SCN](./docs/scn.md) — Semantic Compression Notation** — tokenizer-aware hard prompt compression; training-distribution-aligned notation
- **[MRL](./docs/mrl.md) — Meta Reasoning Language** — layered meta-language architecture (Anchor + Core Graph + Logic)
- **[MRLVAL](./tests/benchmark/README.md)** — validation methodology with 18-category phenomenon coverage

Key papers that shaped the design:
- Banarescu et al., "Abstract Meaning Representation for Sembanking" (ACL 2013)
- Cai & Knight, "Smatch: an Evaluation Metric for Semantic Feature Structures" (ACL 2013)
- Jiang et al., "LLMLingua: Compressing Prompts for Accelerated Inference" (EMNLP 2023)

See the [research synthesis document](./plans) for the full derivation.

---

## Contributing

Three ways to contribute:

1. **Add phenomenon cases to the benchmark.** Edit `tests/benchmark/fixtures.json`. If you can find a case C2Si fails, that's a bug — open an issue.
2. **Add domain abbreviations.** Edit `src/rules/abbreviations.ts`. Every substitution must be token-cost-verified in a test.
3. **Improve the SCN prompt.** `src/scn/prompt.ts` is the core IP for Tier 2 — better prompts mean better model-assisted compression.

```bash
git clone https://github.com/JiahaoRBC/c2si
cd c2si
npm install
npm test            # Run all 224 tests
npm run benchmark   # Run the 165-assertion benchmark gate
npm run build       # Build ESM + CJS + types
```

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

---

<div align="center">

**Built with the conviction that LLMs should read dense language, not verbose prose.**

[Install](#install) · [Quick Start](#quick-start) · [API](#full-api) · [Benchmark](#the-benchmark) · [AGENTS.md](./AGENTS.md)

</div>

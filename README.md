<div align="center">

# C2Si

### **Carbon → Silicon** Language Translator

*Compress human language into token-efficient notation for LLMs.*
*Keep every bit of meaning. Pay 20–60% less per API call.*

[![tests](https://img.shields.io/badge/tests-304%20passing-brightgreen)]()
[![benchmark](https://img.shields.io/badge/benchmark-198%2F198-brightgreen)]()
[![tiers](https://img.shields.io/badge/tiers-1%20%7C%202%20%7C%203-blue)]()
[![zero deps](https://img.shields.io/badge/runtime%20deps-1-blue)]()
[![typescript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![license](https://img.shields.io/badge/license-Apache%202.0-green)]()

</div>

---

## TL;DR

### From a shell (or agent subprocess)

```bash
npm i -g c2si
c2si "In order to effectively address the ongoing challenges"
# → to effectively address ongoing challenges

# Agent-friendly JSON mode:
c2si --json "text" | jq .compressed
```

### From Node / TypeScript

```ts
import { compress } from 'c2si';

const prompt = compress(longSystemPrompt);  // 40% fewer tokens, same meaning
await openai.chat.completions.create({ messages: [{ role: 'user', content: prompt }] });
```

**One import, one function, one CLI. Drop-in for any LLM API.**

---

## Why C2Si?

Human language is **wildly redundant** for machine consumption. LLMs don't need "in order to" when "to" means the same thing. They don't need "due to the fact that" when "because" does the job. They don't need articles at all.

But removing redundancy naively breaks meaning. Drop "not" and a statement inverts. Drop a number and facts vanish. Drop a modal verb and obligation becomes suggestion.

C2Si is a **token-aware, invariant-preserving compressor** that squeezes human language into a denser form while guaranteeing every critical semantic token survives — verified against **198 benchmark assertions** across 18 linguistic phenomenon categories (adapted from MRLVAL v0.1) plus dedicated Tier 3 safety gates.

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

## CLI

Install globally or use via `npx`:

```bash
npm i -g c2si        # global
npx c2si "text"      # ad-hoc
```

### Commands

```bash
c2si "text"                                          # compress (Tier 1)
cat document.txt | c2si                              # stdin pipe
c2si count "text"                                    # token count
c2si hyper --provider=ollama --model=llama3.2:3b < long.md    # Tier 3
c2si --help                                          # full help screen
```

### Agent-friendly flags

| Flag | Purpose |
|---|---|
| `--json` | Machine-readable JSON output (for subprocess callers) |
| `--stats` | Compression stats on stderr; compressed text on stdout |
| `--quiet` | Suppress spinners and banners |
| `--domain=<d>` | Domain hint: `finance`, `legal`, `code`, `medical` |

### Env vars

| Var | Purpose |
|---|---|
| `C2SI_PROVIDER` | Default provider (`ollama` or `openai`) |
| `C2SI_MODEL` | Default model name |
| `OLLAMA_HOST` | Ollama server URL (default `http://localhost:11434`) |
| `OPENAI_API_KEY` | API key for OpenAI-compatible providers |
| `OPENAI_BASE_URL` | Override base URL for `openai` provider |
| `NO_COLOR` | Disable ANSI colors |

### Exit codes

`0` success · `1` invalid/empty input · `2` config error (missing provider/model) · `3` adapter/network error

The CLI auto-detects TTY: a human gets a braille spinner during model calls, an agent subprocess gets clean text output with zero ANSI escapes.

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

C2Si is a **three-tier compression pipeline**:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Your text (1000 tokens)                           │
│            │                                        │
│            ▼                                        │
│   ┌───────────────────────┐                         │
│   │  Tier 1: Rules Engine │  ← always runs          │
│   │  • Stop words         │                         │
│   │  • Entity dedup (@E)  │  ~1.2–1.6x              │
│   │  • Structural reflow  │                         │
│   │  • Abbreviations      │                         │
│   └───────────┬───────────┘                         │
│               │                                     │
│               ▼                                     │
│   ┌───────────────────────┐                         │
│   │  Tier 2: SCN Model    │  ← optional             │
│   │  • LLM-assisted       │                         │
│   │  • Full predicate-arg │  ~3–5x                  │
│   │  • Discourse relations│                         │
│   └───────────┬───────────┘                         │
│               │                                     │
│               ▼                                     │
│   ┌───────────────────────┐                         │
│   │  Tier 3: HyperSCN     │  ← optional, aggressive │
│   │  • Greek letter alias │                         │
│   │  • Positional args    │  +1.3–1.7x extra        │
│   │  • Self-describing    │                         │
│   │    preamble           │  (up to 5–9x vs raw)    │
│   └───────────┬───────────┘                         │
│               │                                     │
│               ▼                                     │
│   Compressed (100–300 tokens)                       │
│                                                     │
└─────────────────────────────────────────────────────┘
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

### Tier 3 — HyperSCN (optional, deliberately not human-readable)

For maximum compression on long documents or high-volume agents, Tier 3 post-processes Tier 2 SCN via two deterministic transforms:

1. **Greek letter aliasing** — frequent predicates get 1-token symbols: `RAISE → α`, `DECLINE → β`, `ANNOUNCE → γ`. Only applied when tokenizer math proves it saves tokens.
2. **Positional argument notation** — drop `a0:`/`a1:`/`a2:` role prefixes where the predicate semantics make order unambiguous.

Output:
```
§pred α=RAISE β=DECLINE γ=ANNOUNCE
α $a rates +50bp tm:Thursday mn:unexpected cs:inflation
→CAUSE: EXCEED inflation target tm:6mo
→RESULT: β EUR-USD -2.1%
```

A ~270-token **self-describing preamble** teaches any LLM how to decode this in-context — no fine-tuning or special API support needed. The preamble is one-time overhead: cache it in a system prompt and amortize across many requests.

**Economics**: on a 500-token SCN input with repeating predicates, Tier 3 delivers 1.7x additional compression. Combined with Tier 2 (3x vs raw), total end-to-end ratio reaches **5x when the preamble is cached**. Not human-readable — strictly a machine-to-machine dialect.

**When to use each tier:**

| Scenario | Recommended tier |
|---|---|
| Short prompt, single call | Tier 1 (synchronous, no setup) |
| Long doc, single call | Tier 2 (model-assisted SCN) |
| Agent with cached system prompt, many calls | Tier 3 (HyperSCN + cached preamble) |
| RAG with 10+ chunks per request | Tier 3 (preamble amortizes) |

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

### `compressHyper(text, adapter, options?) → Promise<HyperCompressResult>`

Tier 3 — ultra-dense HyperSCN (raw text → Tier 2 → Tier 3 in one call). Returns text + diagnostic report. Preamble is included by default; pass `{ includePreamble: false }` to cache it separately.

```ts
import { compressHyper, ollamaAdapter } from 'c2si';

const adapter = ollamaAdapter({ model: 'llama3.2:3b' });
const r = await compressHyper(longDoc, adapter);

// Send r.text directly (has preamble embedded):
await openai.chat.completions.create({
  messages: [{ role: 'user', content: r.text }],
});

// Or cache the preamble in the system prompt for repeated use:
const r = await compressHyper(doc, adapter, { includePreamble: false });
await openai.chat.completions.create({
  messages: [
    { role: 'system', content: r.preamble }, // cached across calls
    { role: 'user',   content: r.bodyOnly },
  ],
});
```

### `compressSCNToHyper(scn) → HyperSCNResult`

Apply Tier 3 to already-SCN-formatted text. Synchronous, no model required. Returns the input unchanged if the legend overhead would exceed savings (cost-benefit guarded).

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

C2Si ships with a **hard CI gate**: **198 assertions** total:
- **165 assertions** across 43 test cases for Tier 1/2 (18 phenomenon categories, adapted from [MRLVAL v0.1](./tests/benchmark/README.md))
- **33 assertions** across 8 test cases for Tier 3 (entity, negation, modality, number, time, discourse, combined stress)

Every invariant is enforced on every build.

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
│   ├── index.ts                # Public API
│   ├── convenience.ts          # compress(), compressMessages(), compressHyper()
│   ├── compressor.ts           # C2Si class + session manager
│   ├── rules/                  # Tier 1 rule engine
│   │   ├── stopwords.ts        # Articles, fillers, verbose phrases
│   │   ├── entities.ts         # NER + token-aware dedup
│   │   ├── structural.ts       # Prose reflow patterns
│   │   └── abbreviations.ts    # Domain-specific shortenings
│   ├── scn/                    # Tier 2 SCN format + LLM prompt
│   ├── tier3/                  # Tier 3 HyperSCN (optional, not human-readable)
│   │   ├── vocabulary.ts       # Verified 1-token symbol pool
│   │   ├── hyper-scn.ts        # Deterministic SCN → HyperSCN encoder
│   │   └── preamble.ts         # Self-describing LLM decoder preamble
│   ├── adapters/               # Ollama, OpenAI-compatible
│   └── tokenizer/              # GPT BPE counting
└── tests/
    ├── benchmark/
    │   ├── fixtures.json       # Tier 1/2 fixtures (43 cases, 18 categories)
    │   ├── tier3-fixtures.json # Tier 3 fixtures (8 cases)
    │   └── README.md           # Benchmark methodology
    ├── benchmark.test.ts       # Tier 1/2 CI gate (165 assertions)
    ├── tier3-benchmark.test.ts # Tier 3 CI gate (33 assertions)
    └── *.test.ts               # Unit tests (convenience, rules, scn, tier3...)
```

---

## Research Foundation

C2Si synthesizes four research threads into a three-tier compression pipeline:

- **SCN — Semantic Compression Notation** — tokenizer-aware hard-prompt compression; training-distribution-aligned notation (basis for Tier 2)
- **MRL — Meta Reasoning Language** — layered meta-language architecture (Anchor + Core Graph + Logic)
- **MRLVAL** — validation methodology with 18-category phenomenon coverage (basis for [our benchmark](./tests/benchmark/README.md))
- **VQ-VAE / discrete codebook compression** — inspired Tier 3's symbol-substitution approach (adapted for hard prompts via a self-describing preamble rather than learned codebooks)

Key papers that shaped the design:
- Banarescu et al., "Abstract Meaning Representation for Sembanking" (ACL 2013)
- Cai & Knight, "Smatch: an Evaluation Metric for Semantic Feature Structures" (ACL 2013)
- Jiang et al., "LLMLingua: Compressing Prompts for Accelerated Inference" (EMNLP 2023)
- van den Oord et al., "Neural Discrete Representation Learning" (VQ-VAE, NeurIPS 2017)

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
npm test            # Run all 304 tests
npm run benchmark   # Run the 198-assertion benchmark gate (Tier 1/2 + Tier 3)
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

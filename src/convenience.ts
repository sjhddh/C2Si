/**
 * Agent-friendly convenience API.
 *
 * Zero-config, one-line usage for AI agents and LLM clients.
 * These functions wrap the full C2Si class with sensible defaults
 * so agents can drop them in without reading the full API.
 */

import { C2Si } from './compressor.js';
import { countTokens } from './tokenizer/counter.js';
import { compressToHyperSCN, withPreamble, PREAMBLE_TOKEN_COST } from './tier3/index.js';
import type { CompressOptions, CompressResult, ModelAdapter } from './types.js';

/** Shared default instance for the module-level functions. */
const defaultInstance = new C2Si();

/**
 * Compress text and return just the compressed string.
 * Synchronous, zero-config, never throws.
 *
 * @example
 * ```ts
 * import { compress } from 'c2si';
 *
 * const prompt = compress("The European Central Bank unexpectedly raised rates...");
 * await openai.chat.completions.create({ messages: [{ role: 'user', content: prompt }] });
 * ```
 */
export function compress(text: string, options?: CompressOptions): string {
  if (!text) return text;
  const result = defaultInstance.compressRules(text, options);
  return result.compressed;
}

/**
 * Compress text and return the full result with token statistics.
 * Useful when you want to report savings to the user.
 *
 * @example
 * ```ts
 * const r = compressDetailed(longDocument);
 * console.log(`Saved ${r.stats.originalTokens - r.stats.compressedTokens} tokens (${r.stats.ratio}x)`);
 * ```
 */
export function compressDetailed(text: string, options?: CompressOptions): CompressResult {
  return defaultInstance.compressRules(text, options);
}

/**
 * Model-assisted compression for deeper ~3-5x compression.
 * Requires a ModelAdapter (Ollama, OpenAI-compatible, or custom function).
 *
 * @example
 * ```ts
 * import { compressWithModel, ollamaAdapter } from 'c2si';
 *
 * const adapter = ollamaAdapter({ model: 'llama3.2:3b' });
 * const compressed = await compressWithModel(longText, adapter);
 * ```
 */
export async function compressWithModel(
  text: string,
  adapter: ModelAdapter,
  options?: CompressOptions,
): Promise<string> {
  if (!text) return text;
  const c2si = new C2Si({ adapter });
  const result = (await c2si.compress(text, options)) as CompressResult;
  return result.compressed;
}

/**
 * Count tokens in text using GPT-4 BPE tokenizer.
 * Compatible with OpenAI models, close approximation for Claude / Llama.
 *
 * @example
 * ```ts
 * console.log(`Prompt is ${tokens(systemPrompt)} tokens`);
 * ```
 */
export function tokens(text: string): number {
  return countTokens(text);
}

/**
 * A chat message (OpenAI-compatible shape).
 * Agents pass arrays of these to `compressMessages()` to shrink whole conversations.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
  [key: string]: unknown;
}

/**
 * Compress an array of chat messages.
 * Each message's `content` is compressed individually;
 * other fields (role, name, tool_call_id, etc.) pass through unchanged.
 *
 * Drop-in for any OpenAI-compatible client (OpenAI, Anthropic, Ollama, etc).
 *
 * @example
 * ```ts
 * import { compressMessages } from 'c2si';
 *
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4o',
 *   messages: compressMessages([
 *     { role: 'system', content: LONG_SYSTEM_PROMPT },
 *     { role: 'user', content: userQuestion },
 *   ]),
 * });
 * ```
 */
export function compressMessages<T extends ChatMessage>(
  messages: T[],
  options?: CompressOptions,
): T[] {
  return messages.map((m) => ({
    ...m,
    content: compress(m.content, options),
  }));
}

/**
 * Compression savings report for a compress call.
 * Returned by `compressReport()` for agents that want to log savings.
 */
export interface CompressionReport {
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  ratio: number;
  percentSaved: number;
}

/**
 * Compress text and return a human-readable savings report.
 * Use when you want the compressed text AND the stats in one call.
 *
 * @example
 * ```ts
 * const { text, report } = compressReport(longInput);
 * console.log(`Saved ${report.percentSaved}% (${report.ratio}x)`);
 * // send `text` to your LLM
 * ```
 */
export function compressReport(
  text: string,
  options?: CompressOptions,
): { text: string; report: CompressionReport } {
  const r = compressDetailed(text, options);
  return {
    text: r.compressed,
    report: {
      originalTokens: r.stats.originalTokens,
      compressedTokens: r.stats.compressedTokens,
      tokensSaved: r.stats.originalTokens - r.stats.compressedTokens,
      ratio: r.stats.ratio,
      percentSaved: Math.round((1 - r.stats.compressedTokens / r.stats.originalTokens) * 100),
    },
  };
}

/** Options for Tier 3 (HyperSCN) compression. */
export interface HyperOptions extends CompressOptions {
  /**
   * Include the decoder preamble in the output.
   * - true  (default): safe for one-shot use with any LLM
   * - false: you will place the preamble in a cached system prompt yourself;
   *   compressHyper then returns just the legend+content (no preamble).
   */
  includePreamble?: boolean;
}

/** Result of end-to-end Tier 3 compression. */
export interface HyperCompressResult {
  /** Full prompt text (preamble + legend + content), ready to send to an LLM. */
  text: string;
  /** Just the legend + content (no preamble). Useful when preamble is cached. */
  bodyOnly: string;
  /** Decoder preamble alone. Place once in your cached system prompt. */
  preamble: string;
  report: CompressionReport & {
    /** Tokens of the decoder preamble (one-time overhead). */
    preambleTokens: number;
    /** Number of predicates that were aliased in Tier 3. */
    tier3Aliases: number;
    /** Tier 2 SCN tokens (intermediate result, for diagnostics). */
    tier2Tokens: number;
  };
}

/**
 * **Tier 3: HyperSCN compression.**
 *
 * End-to-end ultra-dense compression: raw text → Tier 2 SCN (via model) →
 * Tier 3 HyperSCN (deterministic post-processing with Greek letter aliases
 * and positional args).
 *
 * Output is NOT human-readable, but any LLM can decode it when the preamble
 * is included in the prompt. The preamble is a one-time ~270-token overhead,
 * amortized over repeated use (place it in your cached system prompt for
 * maximum savings across many requests).
 *
 * Typical ratios:
 * - Short doc (< 5 clauses): Tier 3 may not help; falls back to Tier 2.
 * - Medium doc (10-30 clauses): 1.3-1.6x on top of Tier 2 (total 4-7x vs raw).
 * - Long doc (100+ clauses, repetitive predicates): up to 2x on top of Tier 2
 *   (total 6-9x vs raw).
 *
 * @example
 * ```ts
 * import { compressHyper, ollamaAdapter } from 'c2si';
 *
 * const adapter = ollamaAdapter({ model: 'llama3.2:3b' });
 * const r = await compressHyper(longDocument, adapter);
 *
 * await openai.chat.completions.create({
 *   messages: [{ role: 'user', content: r.text }],
 * });
 * ```
 *
 * @example Caching the preamble in a system prompt
 * ```ts
 * const r = await compressHyper(longDoc, adapter, { includePreamble: false });
 *
 * await openai.chat.completions.create({
 *   messages: [
 *     { role: 'system', content: r.preamble },  // cache this across requests
 *     { role: 'user', content: r.bodyOnly },
 *   ],
 * });
 * ```
 */
export async function compressHyper(
  text: string,
  adapter: ModelAdapter,
  options?: HyperOptions,
): Promise<HyperCompressResult> {
  const includePreamble = options?.includePreamble !== false;
  const originalTokens = countTokens(text);

  // Tier 2: raw text → SCN via model
  const c2si = new C2Si({ adapter });
  const tier2 = (await c2si.compress(text, options)) as CompressResult;

  // Tier 3: SCN → HyperSCN (deterministic)
  const tier3 = compressToHyperSCN(tier2.compressed);

  const bodyOnly = tier3.full;
  const preamble = tier3.worthIt ? withPreamble('').trimEnd() : '';
  const full = tier3.worthIt && includePreamble ? withPreamble(bodyOnly) : bodyOnly;

  const finalTokens = countTokens(full);

  return {
    text: full,
    bodyOnly,
    preamble,
    report: {
      originalTokens,
      compressedTokens: finalTokens,
      tokensSaved: originalTokens - finalTokens,
      ratio: finalTokens > 0 ? Number((originalTokens / finalTokens).toFixed(2)) : 0,
      percentSaved: Math.round((1 - finalTokens / originalTokens) * 100),
      preambleTokens: PREAMBLE_TOKEN_COST,
      tier3Aliases: tier3.stats.aliasesUsed,
      tier2Tokens: tier2.stats.compressedTokens,
    },
  };
}

/**
 * Apply Tier 3 HyperSCN compression to already-SCN-formatted text.
 * Does NOT invoke a model. Safe to use on any SCN output or even on plain
 * Tier 1 rule output that contains predicate-argument clauses.
 *
 * If the legend overhead would exceed savings, returns the input unchanged.
 *
 * @example
 * ```ts
 * // You already have SCN text from a previous run
 * const { full, worthIt, stats } = compressSCNToHyper(scnText);
 * if (worthIt) console.log(`Tier 3 saved ${stats.inputTokens - stats.outputTokens} tokens`);
 * ```
 */
export function compressSCNToHyper(scn: string): ReturnType<typeof compressToHyperSCN> {
  return compressToHyperSCN(scn);
}

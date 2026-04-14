/**
 * Agent-friendly convenience API.
 *
 * Zero-config, one-line usage for AI agents and LLM clients.
 * These functions wrap the full C2Si class with sensible defaults
 * so agents can drop them in without reading the full API.
 */

import { C2Si } from './compressor.js';
import { countTokens } from './tokenizer/counter.js';
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

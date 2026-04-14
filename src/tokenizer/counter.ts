import { encode } from 'gpt-tokenizer';

/**
 * Count tokens using GPT-4 BPE tokenizer.
 * Provides accurate token counts compatible with OpenAI models.
 * For Claude/other models, this is a close approximation (~5% variance).
 */
export function countTokens(text: string): number {
  return encode(text).length;
}

/**
 * Fast heuristic token estimate without running the full tokenizer.
 * Useful for quick checks on very large texts.
 * Approximation: ~4 chars per token for English, ~2 for CJK.
 */
export function estimateTokens(text: string): number {
  let charCount = 0;
  let cjkCount = 0;
  for (const char of text) {
    charCount++;
    const code = char.codePointAt(0)!;
    // CJK Unified Ideographs + common CJK ranges
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0x3000 && code <= 0x303f) || // CJK Punctuation
      (code >= 0xff00 && code <= 0xffef)    // Fullwidth forms
    ) {
      cjkCount++;
    }
  }
  const latinCount = charCount - cjkCount;
  // English: ~4 chars/token, CJK: ~1.5 chars/token (each character is often 1-2 tokens)
  return Math.ceil(latinCount / 4 + cjkCount / 1.5);
}

import { describe, it, expect } from 'vitest';
import { countTokens, estimateTokens } from '../src/tokenizer/counter.js';

describe('countTokens', () => {
  it('counts tokens for English text', () => {
    const count = countTokens('Hello, world!');
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  it('counts tokens for longer text', () => {
    const count = countTokens(
      'The quick brown fox jumps over the lazy dog. This is a simple test sentence.',
    );
    // ~16-18 tokens for this text
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThan(25);
  });

  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('handles special characters', () => {
    const count = countTokens('@E1=European-Central-Bank(type:org)');
    expect(count).toBeGreaterThan(0);
  });
});

describe('estimateTokens', () => {
  it('estimates English text tokens', () => {
    const estimate = estimateTokens('Hello world this is a test');
    const actual = countTokens('Hello world this is a test');
    // Estimate should be in the right ballpark (within 2x)
    expect(estimate).toBeGreaterThan(actual * 0.5);
    expect(estimate).toBeLessThan(actual * 2);
  });

  it('estimates CJK text tokens', () => {
    const estimate = estimateTokens('这是一个测试句子');
    // CJK characters are typically 1-2 tokens each
    expect(estimate).toBeGreaterThan(3);
    expect(estimate).toBeLessThan(20);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  compress,
  compressDetailed,
  compressMessages,
  compressReport,
  compressWithModel,
  tokens,
} from '../src/convenience.js';

describe('compress (one-line API)', () => {
  it('returns a string directly', () => {
    const out = compress('In order to effectively address the ongoing challenges');
    expect(typeof out).toBe('string');
    expect(out).not.toContain('in order to');
  });

  it('handles empty input gracefully', () => {
    expect(compress('')).toBe('');
  });

  it('accepts domain options', () => {
    const out = compress('authentication middleware for production environment', {
      domain: 'code',
    });
    expect(out).toContain('auth');
  });
});

describe('compressDetailed', () => {
  it('returns full CompressResult with stats', () => {
    const r = compressDetailed('In order to effectively address the ongoing challenges');
    expect(r.compressed).toBeTruthy();
    expect(r.stats.originalTokens).toBeGreaterThan(0);
    expect(r.stats.compressedTokens).toBeGreaterThan(0);
    expect(r.stats.ratio).toBeGreaterThan(1);
  });
});

describe('tokens', () => {
  it('counts tokens in text', () => {
    expect(tokens('Hello world')).toBeGreaterThan(0);
    expect(tokens('')).toBe(0);
  });
});

describe('compressMessages (OpenAI-compatible drop-in)', () => {
  it('compresses each message content', () => {
    const messages = [
      {
        role: 'system' as const,
        content:
          'It is important to note that you are a helpful assistant. In order to help the user, you should provide accurate information.',
      },
      {
        role: 'user' as const,
        content: 'What is the capital of France?',
      },
    ];

    const compressed = compressMessages(messages);
    expect(compressed).toHaveLength(2);
    expect(compressed[0].role).toBe('system');
    expect(compressed[1].role).toBe('user');
    // System message should be shorter
    expect(compressed[0].content.length).toBeLessThanOrEqual(messages[0].content.length);
    // Role preserved
    expect(compressed[0].content).not.toContain('it is important to note that');
  });

  it('preserves extra fields on messages', () => {
    const messages = [
      { role: 'user', content: 'Hello', name: 'alice', metadata: { id: 42 } },
    ];
    const compressed = compressMessages(messages);
    expect(compressed[0].name).toBe('alice');
    expect(compressed[0].metadata).toEqual({ id: 42 });
  });
});

describe('compressReport', () => {
  it('returns compressed text + human-readable report', () => {
    const { text, report } = compressReport(
      'In order to effectively address the ongoing challenges that have been identified by the management team.',
    );

    expect(text).toBeTruthy();
    expect(report.originalTokens).toBeGreaterThan(0);
    expect(report.compressedTokens).toBeGreaterThan(0);
    expect(report.tokensSaved).toBe(report.originalTokens - report.compressedTokens);
    expect(report.ratio).toBeGreaterThan(1);
    expect(report.percentSaved).toBeGreaterThan(0);
    expect(report.percentSaved).toBeLessThanOrEqual(100);
  });
});

describe('compressWithModel', () => {
  it('uses the adapter for deep compression', async () => {
    let adapterCalled = false;
    const mockAdapter = async (prompt: string) => {
      adapterCalled = true;
      expect(prompt).toContain('SCN');
      return 'COMPRESSED_BY_MODEL a0:X a1:Y';
    };

    const result = await compressWithModel(
      'The European Central Bank raised rates significantly due to inflation.',
      mockAdapter,
    );
    expect(adapterCalled).toBe(true);
    expect(result).toBe('COMPRESSED_BY_MODEL a0:X a1:Y');
  });

  it('handles empty input', async () => {
    const adapter = async () => 'should not be called';
    expect(await compressWithModel('', adapter)).toBe('');
  });
});

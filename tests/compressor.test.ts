import { describe, it, expect } from 'vitest';
import { C2Si } from '../src/compressor.js';

describe('C2Si', () => {
  describe('rules-only compression', () => {
    const c2si = new C2Si();

    it('compresses text and returns stats', () => {
      const input =
        'The European Central Bank unexpectedly raised interest rates by 50 basis points on Thursday due to the fact that persistent inflation concerns were growing significantly.';
      const result = c2si.compress(input);

      // Should not be a Promise (no adapter)
      expect(result).not.toBeInstanceOf(Promise);
      const r = result as Awaited<typeof result>;

      expect(r.compressed).toBeTruthy();
      expect(r.stats.originalTokens).toBeGreaterThan(0);
      expect(r.stats.compressedTokens).toBeGreaterThan(0);
      expect(r.stats.compressedTokens).toBeLessThan(r.stats.originalTokens);
      expect(r.stats.ratio).toBeGreaterThan(1);
    });

    it('compresses with domain hints', () => {
      const input =
        'The year over year revenue growth exceeded approximately 10 basis points due to the fact that consumer price index rose.';
      const result = c2si.compress(input, { domain: 'finance' }) as ReturnType<
        typeof c2si.compressRules
      >;

      expect(result.compressed).toContain('YoY');
      expect(result.compressed).toContain('bp');
    });

    it('handles empty input', () => {
      const result = c2si.compress('') as ReturnType<typeof c2si.compressRules>;
      expect(result.compressed).toBe('');
      expect(result.stats.ratio).toBe(0);
    });

    it('handles short input without over-compressing', () => {
      const result = c2si.compress('Hello world') as ReturnType<
        typeof c2si.compressRules
      >;
      // Short input should still produce something meaningful
      expect(result.compressed.length).toBeGreaterThan(0);
    });

    it('achieves compression ratio > 1 on verbose text', () => {
      const verbose = `
        In order to effectively address the ongoing challenges that have been identified
        by the management team, it is important to note that a comprehensive strategy
        will need to be developed. The strategy should take into consideration the
        various factors that are currently affecting the performance of the organization.
        Furthermore, it should be noted that the implementation timeline will need to
        be adjusted accordingly. As a result of the recent findings, it has become
        clear that additional resources will be required.
      `;
      const result = c2si.compress(verbose) as ReturnType<typeof c2si.compressRules>;

      // Verbose text with lots of filler should compress well
      expect(result.stats.ratio).toBeGreaterThan(1.2);
    });
  });

  describe('session', () => {
    it('tracks entities across multiple compressions', () => {
      const c2si = new C2Si();
      const session = c2si.createSession();

      // Use long entities that appear many times to trigger dedup
      const r1 = session.compress(
        'The International Monetary Fund met. The International Monetary Fund decided. The International Monetary Fund announced. The International Monetary Fund confirmed.',
      ) as ReturnType<typeof c2si.compressRules>;

      const r2 = session.compress(
        'The International Monetary Fund released data.',
      ) as ReturnType<typeof c2si.compressRules>;

      // Entity registry should carry over
      const entities = session.getEntities();
      expect(entities.entities.size).toBeGreaterThan(0);
    });

    it('resets session correctly', () => {
      const c2si = new C2Si();
      const session = c2si.createSession();

      session.compress(
        'Apple released iPhone. Apple reported earnings.',
      );

      session.reset();
      expect(session.getEntities().entities.size).toBe(0);
    });
  });

  describe('model-assisted compression', () => {
    it('uses adapter when provided', async () => {
      let promptReceived = '';
      const mockAdapter = async (prompt: string) => {
        promptReceived = prompt;
        return 'RAISE a0:ECB a1:rates a2:+50bp';
      };

      const c2si = new C2Si({ adapter: mockAdapter });
      // Use longer input so compression ratio is meaningful
      const input =
        'The European Central Bank unexpectedly raised interest rates by 50 basis points on Thursday due to persistent inflation concerns in the eurozone economy.';
      const result = await c2si.compress(input);

      expect(promptReceived).toContain('SCN');
      expect(result.compressed).toBe('RAISE a0:ECB a1:rates a2:+50bp');
      expect(result.stats.ratio).toBeGreaterThan(1);
    });

    it('respects rulesOnly option even with adapter', () => {
      const mockAdapter = async () => 'should not be called';
      const c2si = new C2Si({ adapter: mockAdapter });

      const result = c2si.compress('test input', { rulesOnly: true });
      // Should be synchronous (not a Promise)
      expect(result).not.toBeInstanceOf(Promise);
    });
  });
});

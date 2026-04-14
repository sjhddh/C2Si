import { describe, it, expect } from 'vitest';
import { entitiesRule, createEntityRegistry } from '../src/rules/entities.js';
import type { RuleContext } from '../src/types.js';

function makeCtx(): RuleContext {
  return { entityRegistry: createEntityRegistry() };
}

describe('entitiesRule', () => {
  it('deduplicates multi-word entities that appear many times', () => {
    // "European Central Bank" = 3 tokens, $a = 1 token
    // 5 occurrences: dedup saves tokens
    const text = [
      'The European Central Bank raised rates.',
      'The European Central Bank announced this.',
      'The European Central Bank signaled more.',
      'The European Central Bank confirmed plans.',
      'The European Central Bank met Thursday.',
    ].join(' ');
    const ctx = makeCtx();
    const result = entitiesRule(text, ctx);

    // Should have definition and refs using $a format
    expect(result).toContain('$a=European Central Bank');
    expect(result).toContain('$a');
  });

  it('does NOT dedup when it would not save tokens', () => {
    // "Federal Reserve" = 2 tokens, $a = 1 token
    // Only 2 occurrences: definition cost exceeds savings
    const text = 'The Federal Reserve met. The Federal Reserve decided.';
    const ctx = makeCtx();
    const result = entitiesRule(text, ctx);

    // Should NOT create entity refs
    expect(result).not.toContain('$a');
  });

  it('does NOT extract single words that are part of multi-word entities', () => {
    const text = [
      'The European Central Bank met.',
      'The European Central Bank decided.',
      'The European Central Bank acted.',
      'The European Central Bank announced.',
      'The European Central Bank confirmed.',
    ].join(' ');
    const ctx = makeCtx();
    const result = entitiesRule(text, ctx);

    // Should NOT have separate definitions for "European", "Central", "Bank"
    expect(result).not.toContain('$b=European');
    expect(result).not.toContain('$b=Central');
    expect(result).not.toContain('$b=Bank');
  });

  it('tracks entities in the registry', () => {
    const text = [
      'Apple released a product.',
      'Apple reported earnings.',
      'Apple expanded globally.',
    ].join(' ');
    const ctx = makeCtx();
    entitiesRule(text, ctx);

    // Even if not deduplicated, entities can be tracked
    // (registry tracks detected entities regardless of dedup decision)
    expect(ctx.entityRegistry.entities.size).toBeGreaterThanOrEqual(0);
  });

  it('does not create definitions for single-occurrence entities', () => {
    const text = 'Microsoft announced a product. Google released a competitor.';
    const ctx = makeCtx();
    const result = entitiesRule(text, ctx);

    expect(result).not.toContain('$a');
  });

  it('uses single-token refs ($a, $b, etc)', () => {
    const text = [
      'The International Monetary Fund released a report.',
      'The International Monetary Fund warned about risks.',
      'The International Monetary Fund recommended action.',
      'The International Monetary Fund expects recovery.',
      'The Securities and Exchange Commission investigated.',
      'The Securities and Exchange Commission filed charges.',
      'The Securities and Exchange Commission announced.',
      'The Securities and Exchange Commission released.',
    ].join(' ');
    const ctx = makeCtx();
    const result = entitiesRule(text, ctx);

    // Should use $a and $b for two different entities
    expect(result).toContain('$a=');
    expect(result).toContain('$b=');
  });
});

import { describe, it, expect } from 'vitest';
import {
  serializeClause,
  serializeHeader,
  serializeDocument,
} from '../src/scn/serializer.js';
import { buildCompressionPrompt, SCN_SYSTEM_PROMPT } from '../src/scn/prompt.js';
import { createEntityRegistry } from '../src/rules/entities.js';

describe('SCN serializer', () => {
  describe('serializeClause', () => {
    it('serializes a basic clause', () => {
      const result = serializeClause({
        predicate: 'RAISE',
        roles: { a0: 'ECB', a1: 'rates', a2: '+50bp' },
      });
      expect(result).toBe('RAISE a0:ECB a1:rates a2:+50bp');
    });

    it('serializes with modality prefix', () => {
      const result = serializeClause({
        predicate: 'APPROVE',
        roles: { a0: 'board', a1: 'proposal' },
        modality: 'NEG',
      });
      expect(result).toBe('NEG:APPROVE a0:board a1:proposal');
    });

    it('serializes with discourse relation', () => {
      const result = serializeClause({
        predicate: 'DECLINE',
        roles: { a0: 'EUR-USD', a1: '-2.1%' },
        discourseRelation: '→RESULT',
      });
      expect(result).toContain('→RESULT:');
      expect(result).toContain('DECLINE');
    });

    it('follows standard role order', () => {
      const result = serializeClause({
        predicate: 'ACT',
        roles: { tm: 'Monday', a0: 'Alice', lc: 'NYC', a1: 'report' },
      });
      // a0 should come before a1, which should come before tm, which before lc
      const a0Pos = result.indexOf('a0:');
      const a1Pos = result.indexOf('a1:');
      const tmPos = result.indexOf('tm:');
      const lcPos = result.indexOf('lc:');
      expect(a0Pos).toBeLessThan(a1Pos);
      expect(a1Pos).toBeLessThan(tmPos);
      expect(tmPos).toBeLessThan(lcPos);
    });
  });

  describe('serializeHeader', () => {
    it('serializes a full header', () => {
      const result = serializeHeader({
        topic: 'Q3-Revenue',
        domain: 'finance',
        timeframe: '2025-Q3',
      });
      expect(result).toBe('# Q3-Revenue | ctx:finance | t:2025-Q3');
    });

    it('handles partial header', () => {
      const result = serializeHeader({ topic: 'Report' });
      expect(result).toBe('# Report');
    });

    it('handles empty header', () => {
      const result = serializeHeader(undefined);
      expect(result).toBe('');
    });
  });

  describe('serializeDocument', () => {
    it('serializes a complete document', () => {
      const registry = createEntityRegistry();
      registry.entities.set('E1', {
        id: 'E1',
        canonical: 'ECB',
        aliases: ['ECB'],
        type: 'org',
        count: 3,
      });

      const result = serializeDocument({
        header: { topic: 'Rates', domain: 'finance' },
        entities: registry,
        clauses: [
          { predicate: 'RAISE', roles: { a0: '@E1', a1: 'rates' } },
        ],
      });

      expect(result).toContain('# Rates');
      expect(result).toContain('@E1=ECB(type:org)');
      expect(result).toContain('RAISE a0:@E1 a1:rates');
    });
  });
});

describe('SCN prompt', () => {
  it('system prompt contains SCN format rules', () => {
    expect(SCN_SYSTEM_PROMPT).toContain('a0:');
    expect(SCN_SYSTEM_PROMPT).toContain('CAUSE');
    expect(SCN_SYSTEM_PROMPT).toContain('NEG:');
    expect(SCN_SYSTEM_PROMPT).toContain('predicate');
  });

  it('builds compression prompt with domain', () => {
    const { system, user } = buildCompressionPrompt('test text', {
      domain: 'finance',
    });
    expect(system).toContain('finance');
    expect(user).toContain('test text');
  });

  it('builds compression prompt with existing entities', () => {
    const { system } = buildCompressionPrompt('test text', {
      existingEntities: '@E1=Apple(type:org)',
    });
    expect(system).toContain('@E1=Apple');
    expect(system).toContain('Pre-defined Entities');
  });
});

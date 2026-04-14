import { describe, it, expect } from 'vitest';
import { stopwordsRule } from '../src/rules/stopwords.js';
import { structuralRule } from '../src/rules/structural.js';
import { abbreviationsRule } from '../src/rules/abbreviations.js';
import { createEntityRegistry } from '../src/rules/entities.js';
import type { RuleContext } from '../src/types.js';

function makeCtx(domain?: string): RuleContext {
  return { entityRegistry: createEntityRegistry(), domain };
}

describe('stopwordsRule', () => {
  it('removes articles', () => {
    const result = stopwordsRule('the cat sat on a mat', makeCtx());
    expect(result).not.toContain(' the ');
    expect(result).not.toContain(' a ');
    expect(result).toContain('cat');
    expect(result).toContain('mat');
  });

  it('removes filler words', () => {
    const result = stopwordsRule('I actually really just want to go', makeCtx());
    expect(result).not.toContain('actually');
    expect(result).not.toContain('really');
    expect(result).not.toContain('just');
  });

  it('compresses verbose phrases', () => {
    const result = stopwordsRule('in order to save money', makeCtx());
    expect(result).toContain('to save money');
    expect(result).not.toContain('in order to');
  });

  it('replaces "due to the fact that" with "because"', () => {
    const result = stopwordsRule('due to the fact that prices rose', makeCtx());
    expect(result).toContain('because');
  });

  it('normalizes whitespace after removals', () => {
    const result = stopwordsRule('I  actually   want   this', makeCtx());
    expect(result).not.toContain('  ');
  });
});

describe('structuralRule', () => {
  it('compresses "is able to" → "can"', () => {
    const result = structuralRule('The system is able to process data', makeCtx());
    expect(result).toContain('can');
    expect(result).not.toContain('is able to');
  });

  it('compresses "as well as" → "+"', () => {
    const result = structuralRule('cats as well as dogs', makeCtx());
    expect(result).toContain('+');
  });

  it('compresses enumeration markers', () => {
    const result = structuralRule('First, do A. Second, do B. Third, do C.', makeCtx());
    expect(result).toContain('1)');
    expect(result).toContain('2)');
    expect(result).toContain('3)');
  });

  it('compresses connector words', () => {
    const result = structuralRule('However, this is wrong. Furthermore, it fails.', makeCtx());
    expect(result).toContain('but');
    expect(result).toContain('+');
  });

  it('compresses relative clauses', () => {
    const result = structuralRule('the report that was published yesterday', makeCtx());
    expect(result).toContain('published');
    expect(result).not.toContain('that was');
  });

  it('compresses percentage expressions', () => {
    const result = structuralRule('grew by 50 percent', makeCtx());
    expect(result).toContain('50%');
  });
});

describe('abbreviationsRule', () => {
  it('abbreviates common words', () => {
    const result = abbreviationsRule('for example, the configuration is important', makeCtx());
    expect(result).toContain('e.g.');
    expect(result).toContain('config');
  });

  it('abbreviates "approximately" → "~"', () => {
    const result = abbreviationsRule('approximately 100 items', makeCtx());
    expect(result).toContain('~');
  });

  it('applies domain-specific abbreviations for finance', () => {
    const result = abbreviationsRule(
      'year over year revenue growth of 10 basis points',
      makeCtx('finance'),
    );
    expect(result).toContain('YoY');
    expect(result).toContain('bp');
  });

  it('applies domain-specific abbreviations for code', () => {
    const result = abbreviationsRule(
      'asynchronous database configuration',
      makeCtx('code'),
    );
    expect(result).toContain('async');
    expect(result).toContain('db');
  });

  it('does not apply domain abbreviations without domain', () => {
    const result = abbreviationsRule('year over year growth', makeCtx());
    // Without finance domain, "year over year" stays as-is
    expect(result).not.toContain('YoY');
  });
});

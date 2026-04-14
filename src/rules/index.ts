import type { CompressionRule, RuleContext } from '../types.js';
import { createEntityRegistry } from './entities.js';
import { stopwordsRule } from './stopwords.js';
import { entitiesRule } from './entities.js';
import { structuralRule } from './structural.js';
import { abbreviationsRule } from './abbreviations.js';

/**
 * Default rule pipeline order.
 * Order matters: structural first (big pattern matches), then stopwords,
 * then abbreviations, then entities last (needs clean text for detection).
 */
const DEFAULT_PIPELINE: CompressionRule[] = [
  structuralRule,
  stopwordsRule,
  abbreviationsRule,
  entitiesRule,
];

/**
 * Run the full rule compression pipeline on input text.
 * Returns the compressed text and the rule context (with entity registry).
 */
export function applyRules(
  text: string,
  ctx?: Partial<RuleContext>,
): { text: string; ctx: RuleContext } {
  const fullCtx: RuleContext = {
    entityRegistry: ctx?.entityRegistry ?? createEntityRegistry(),
    domain: ctx?.domain,
  };

  let result = text;
  for (const rule of DEFAULT_PIPELINE) {
    result = rule(result, fullCtx);
  }

  return { text: result, ctx: fullCtx };
}

export { createEntityRegistry } from './entities.js';
export { stopwordsRule } from './stopwords.js';
export { entitiesRule } from './entities.js';
export { structuralRule } from './structural.js';
export { abbreviationsRule } from './abbreviations.js';

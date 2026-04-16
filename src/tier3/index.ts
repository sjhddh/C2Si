/**
 * Tier 3 — HyperSCN
 *
 * Optional ultra-dense compression tier that operates on Tier 2 SCN output.
 * Substitutes frequent predicates with 1-token Greek letter aliases and drops
 * positional role prefixes, achieving an additional ~1.5-2x compression on
 * top of Tier 2. Combined with Tier 2 model compression, total end-to-end
 * ratios can reach 5-9x on long documents.
 *
 * Tier 3 output is NOT designed to be human-readable. A preamble is included
 * that teaches any LLM how to decode the notation in-context.
 */

export {
  compressToHyperSCN,
  type HyperSCNResult,
} from './hyper-scn.js';

export {
  HYPER_SCN_PREAMBLE,
  PREAMBLE_TOKEN_COST,
  withPreamble,
} from './preamble.js';

export {
  PREDICATE_ALIASES,
  DISCOURSE_ARROWS,
  ROLE_SUBSCRIPTS,
  EXPLICIT_ROLES,
  MODALITY_MARKERS,
  QUANTIFIER_MARKERS,
} from './vocabulary.js';

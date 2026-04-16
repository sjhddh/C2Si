/**
 * Tier 3 symbol vocabulary — single-token aliases used by HyperSCN.
 *
 * Every symbol in these pools has been empirically verified to tokenize to
 * exactly 1 BPE token in the GPT-4 tokenizer. Using 2-token aliases would
 * defeat the compression purpose.
 *
 * Pools are partitioned by role to avoid collisions:
 *   - PREDICATE_ALIASES: Greek letters (semantically opaque — LLMs know them
 *     as math/science variable aliases, which is exactly how we use them)
 *   - DISCOURSE_ARROWS: arrows that LLMs read as relations (cause, change)
 *   - ROLE_SUBSCRIPTS: subscripted digits for positional argument slots
 *
 * The Greek letter pool is the workhorse: 22 opaque 1-token symbols, which
 * comfortably covers the top predicates in any realistic document.
 */

/**
 * Single-token Greek letters, verified against gpt-tokenizer's GPT-4 BPE.
 * Excludes ζ (zeta) and ξ (xi) and ψ (psi) which tokenize to 2 tokens.
 * Order is roughly by how "recognizable" they are to the LLM (α β γ most familiar).
 */
export const PREDICATE_ALIASES: readonly string[] = [
  'α', 'β', 'γ', 'δ', 'ε', 'η', 'θ',
  'ι', 'κ', 'λ', 'μ', 'ν', 'ο', 'π',
  'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ω',
] as const;

/**
 * Single-token discourse/relation arrows.
 * → is the most tokenizer-friendly — safe default for CAUSE relations.
 * ↑ ↓ useful for magnitude change (INCREASE/DECREASE).
 * ← for reverse relations (rare).
 */
export const DISCOURSE_ARROWS = {
  CAUSE: '→',
  RESULT: '→', // Same arrow, context disambiguates
  INCREASE: '↑',
  DECREASE: '↓',
  REVERSE: '←',
} as const;

/**
 * Single-token subscripts used for positional role markers.
 * Only ₀ ₁ ₂ tokenize to 1 token reliably in GPT-4 BPE; higher subscripts
 * cost 2+ tokens, so we cap at 3 positional slots (agent, patient, instrument)
 * which covers the vast majority of clauses.
 */
export const ROLE_SUBSCRIPTS = ['₀', '₁', '₂'] as const;

/**
 * The set of explicit role prefixes we DO keep (less frequent, not positional).
 * These are the original SCN role labels — they stay visible in HyperSCN output
 * because they're rare enough that aliasing them would add more cost than it saves.
 */
export const EXPLICIT_ROLES = new Set([
  'tm',   // time
  'lc',   // location
  'mn',   // manner
  'cs',   // cause
  'cnd',  // condition
  'deg',  // degree
  'src',  // source
]);

/**
 * SCN modality markers that must be preserved verbatim (they change truth value).
 * These never get aliased — they always prefix the predicate literally.
 */
export const MODALITY_MARKERS = new Set([
  'NEG',   // negation
  'POSS',  // possibility
  'OBL',   // obligation
  'PERM',  // permission
  'CONF',  // confidence
]);

/**
 * Quantifier markers (always preserved verbatim).
 */
export const QUANTIFIER_MARKERS = new Set([
  'ALL',
  'EXIST',
  'MOST',
  'SOME',
  'NONE',
]);

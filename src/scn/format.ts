/**
 * SCN (Semantic Compression Notation) format constants.
 *
 * Design principles (from research synthesis):
 * 1. Tokenizer-aligned: every token exists in standard BPE vocabularies
 * 2. Training-distribution-aligned: uses Markdown, code-like syntax LLMs already know
 * 3. AMR-inspired semantics without AMR's non-standard notation
 * 4. Explicit disambiguation markers replace natural language redundancy
 */

/** Semantic role labels (PropBank-inspired, abbreviated for token efficiency) */
export const ROLE_LABELS = {
  a0: 'agent/subject',        // ARG0: who does the action
  a1: 'patient/object',       // ARG1: what is affected
  a2: 'instrument/beneficiary', // ARG2: with what / for whom
  a3: 'start/source',         // ARG3: starting point
  a4: 'end/destination',      // ARG4: ending point
  tm: 'time',                 // temporal
  lc: 'location',             // spatial
  mn: 'manner',               // how
  cs: 'cause',                // why
  cnd: 'condition',           // under what condition
  neg: 'negation',            // polarity
  mod: 'modality',            // possibility/necessity
  deg: 'degree',              // extent/quantity
  src: 'source',              // information source
} as const;

/** Discourse relation connectors (RST-inspired) */
export const DISCOURSE_RELATIONS = {
  '→CAUSE': 'causal relationship',
  '→RESULT': 'resulting consequence',
  '→CONTRAST': 'contrasting information',
  '→SEQUENCE': 'temporal/logical sequence',
  '→CONDITION': 'conditional relationship',
  '→CONCESSION': 'concessive relationship',
  '→ELABORATION': 'provides more detail',
  '→EVIDENCE': 'supporting evidence',
  '→PURPOSE': 'goal/purpose relationship',
} as const;

/** Modality prefixes */
export const MODALITY_PREFIXES = {
  'NEG:': 'negation — action did not occur',
  'POSS:': 'possibility — action may occur',
  'CONF:HIGH': 'high confidence assertion',
  'CONF:LOW': 'low confidence / uncertain',
  'OBL:': 'obligation — must occur',
  'PERM:': 'permission — allowed to occur',
} as const;

/** Quantifier markers */
export const QUANTIFIERS = {
  'ALL': 'universal quantification',
  'EXIST': 'existential quantification',
  'MOST': 'majority',
  'SOME': 'partial',
  'NONE': 'no instances',
} as const;

/** SCN document header format */
export const HEADER_FORMAT = '# [topic] | ctx: [domain] | t: [timeframe]';

/** Entity definition format */
export const ENTITY_DEF_FORMAT = '@E{id}={name}(type:{type})';

/** Predicate clause format */
export const CLAUSE_FORMAT = '{PREDICATE} a0:{agent} a1:{patient} [role:value...]';

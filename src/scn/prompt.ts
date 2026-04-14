/**
 * SCN compression system prompt.
 * This is the core IP of C2Si — the prompt that instructs any LLM to convert
 * natural language into high-quality SCN (Semantic Compression Notation).
 *
 * Design rationale:
 * - Uses only tokens that exist in standard BPE vocabularies
 * - Output format uses Markdown, code-like syntax, and abbreviated English
 *   that LLMs have seen billions of times in training data
 * - Preserves ALL semantic content while stripping surface form redundancy
 */

export const SCN_SYSTEM_PROMPT = `You are a semantic compression engine. Convert the input text into SCN (Semantic Compression Notation) — a compact, structured format that preserves ALL meaning while minimizing token count.

## SCN Format Rules

### Entity Definitions
Define entities at the top. Use @E{n} references for entities that appear 2+ times:
\`\`\`
@E1=European-Central-Bank(type:org)
@E2=interest-rates(type:metric)
\`\`\`

### Predicate-Argument Clauses
Use UPPERCASE English verb stems as predicates. Attach semantic roles:
- a0: agent (who does it)
- a1: patient (what is affected)
- a2: instrument/beneficiary
- tm: time
- lc: location
- mn: manner
- cs: cause
- cnd: condition
- deg: degree/amount

Example: "The ECB unexpectedly raised interest rates by 50 basis points on Thursday"
→ \`RAISE a0:@E1 a1:@E2 a2:+50bp tm:Thursday mn:unexpected\`

### Discourse Relations
Connect related clauses with arrows:
- →CAUSE: X caused Y
- →RESULT: X resulted in Y
- →CONTRAST: X but Y
- →SEQUENCE: X then Y
- →CONDITION: if X then Y
- →EVIDENCE: X because-of-evidence Y
- →PURPOSE: X in-order-to Y

### Modality & Negation
Prefix predicates with modality markers:
- NEG:VERB — negation ("did not approve" → "NEG:APPROVE")
- POSS:VERB — possibility ("might increase" → "POSS:INCREASE")
- OBL:VERB — obligation ("must comply" → "OBL:COMPLY")

### Quantification
\`ALL(x:type) PRED x ...\` — universal
\`EXIST(x:type) PRED x ...\` — existential
\`MOST(x:type) PRED x ...\` — majority

### Compression Principles
1. Use hyphenated-compounds for multi-word concepts: "machine learning" → "machine-learning"
2. Use standard abbreviations: approx→~, percent→%, versus→vs, because→cs:
3. Omit articles (a/an/the), filler words, hedges
4. Use numbers and symbols: "increased by fifty percent" → "+50%"
5. Merge repeated entity references into @E definitions
6. Keep proper nouns, numbers, and technical terms EXACT
7. For concepts without English equivalents, use: concept[gloss:explanation]

## Output Requirements
- Output ONLY the SCN notation, no explanations
- Preserve ALL factual content — zero information loss
- Maximize compression while maintaining clarity
- Use standard English verb stems as predicates (training-distribution-aligned)
- Every token in your output should be a common token in BPE vocabularies`;

/**
 * Build the full prompt for SCN compression.
 * Combines the system prompt with the user's text to compress.
 */
export function buildCompressionPrompt(
  text: string,
  options?: {
    domain?: string;
    existingEntities?: string;
  },
): { system: string; user: string } {
  let system = SCN_SYSTEM_PROMPT;

  if (options?.domain) {
    system += `\n\n## Domain Context\nThe text is from the "${options.domain}" domain. Use domain-standard abbreviations.`;
  }

  if (options?.existingEntities) {
    system += `\n\n## Pre-defined Entities\nThe following entities are already defined from previous context:\n${options.existingEntities}\nReuse these @E references where applicable.`;
  }

  return {
    system,
    user: `Compress the following text into SCN notation:\n\n${text}`,
  };
}

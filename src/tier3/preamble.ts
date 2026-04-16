/**
 * Self-describing preamble for HyperSCN.
 *
 * This preamble teaches any LLM how to decode HyperSCN notation in-context,
 * without any fine-tuning or special token support. It is the key to Tier 3
 * working with frozen, closed-source models (GPT-4, Claude, Gemini, etc).
 *
 * The preamble is ~60 tokens of one-time overhead. For documents long enough
 * that Tier 3 kicks in (roughly 10+ predicate clauses), the savings from the
 * compressed content easily pay for this overhead.
 *
 * For multi-call agents, the preamble can also be placed in a cached system
 * prompt — then its cost is paid once across many requests.
 */

/**
 * The decoder preamble. Prepend to any HyperSCN content when sending to an LLM.
 *
 * Design goals:
 *   1. Unambiguous — no "interpret charitably" instructions
 *   2. Concise — every line earns its token cost
 *   3. Self-contained — no references to documentation or training
 *   4. Preserves fidelity — LLM must answer questions at same accuracy as raw text
 */
export const HYPER_SCN_PREAMBLE = `The following content is in HyperSCN notation. Decode as follows:
- Lines starting with § define symbols used below (e.g., "§pred α=RAISE β=DECLINE" means α means "raise", β means "decline").
- Greek letters (α β γ ...) are predicate verb aliases; expand using the §pred line.
- $a $b $c ... are entity references; expand using the §ref line if present, otherwise treat as proper-noun placeholders.
- After a predicate, arguments are positional in this order: agent, patient, instrument. Example: "α $a rates +50bp" means predicate α with agent=$a, patient=rates, instrument=+50bp.
- Tokens of the form role:value are explicit roles (tm=time, lc=location, mn=manner, cs=cause, cnd=condition, deg=degree, src=source).
- NEG:, POSS:, OBL: prefixes indicate negation, possibility, obligation respectively — they modify the predicate's truth value and must be respected.
- Arrows → ↑ ↓ indicate causal/change relations (→ cause or result, ↑ increase, ↓ decrease).
- Numbers, percentages, dates, and proper nouns are preserved exactly — interpret them literally.
Read the content below as if it were the expanded natural-language form.`;

/**
 * Build a full HyperSCN prompt section — preamble + legend + content.
 * Suitable for embedding directly in a chat message's content field.
 *
 * @param hyperScn  Output from compressToHyperSCN (legend + content joined).
 * @returns         Complete prompt fragment ready to send to an LLM.
 */
export function withPreamble(hyperScn: string): string {
  return `${HYPER_SCN_PREAMBLE}\n\n${hyperScn}`;
}

import { countTokens } from '../tokenizer/counter.js';

/**
 * Cost of the preamble in tokens. Computed once at module load.
 * For multi-call agents, the preamble cost is paid once per session if
 * placed in a cached system prompt.
 */
export const PREAMBLE_TOKEN_COST = countTokens(HYPER_SCN_PREAMBLE);

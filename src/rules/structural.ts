import type { CompressionRule } from '../types.js';

/**
 * Structural patterns that can be compressed.
 * Converts verbose prose patterns into compact structured forms.
 */
const STRUCTURAL_PATTERNS: [RegExp, string][] = [
  // "X is defined as Y" → "X=Y"
  [/\b(\w[\w\s]*?) is defined as (.+?)(?:\.|$)/gim, '$1=$2'],

  // "X is equal to Y" / "X equals Y" → "X=$2"
  [/\b(\w[\w\s]*?) (?:is equal to|equals) (.+?)(?:\.|$)/gim, '$1=$2'],

  // "from X to Y" → "X→Y"
  [/\bfrom\s+(.+?)\s+to\s+(.+?)(?=[,.\s]|$)/gi, '$1→$2'],

  // "X percent" / "X %" → "X%"
  [/(\d+)\s+percent/gi, '$1%'],

  // "in the year YYYY" → "YYYY"
  [/\bin the year (\d{4})\b/gi, '$1'],

  // "on the date of X" → "on X"
  [/\bon the date of\b/gi, 'on'],

  // "during the period of" → "during"
  [/\bduring the period of\b/gi, 'during'],

  // "at a rate of X" → "at X"
  [/\bat a rate of\b/gi, 'at'],

  // "in the range of X to Y" → "X-Y"
  [/\bin the range of\s+(.+?)\s+to\s+(.+?)(?=[,.\s]|$)/gi, '$1-$2'],

  // "as well as" → "+"
  [/\bas well as\b/gi, '+'],

  // "such as" → "e.g."
  [/\bsuch as\b/gi, 'e.g.'],

  // "that is to say" / "in other words" → "i.e."
  [/\b(?:that is to say|in other words)\b/gi, 'i.e.'],

  // "on the other hand" → "conversely"
  [/\bon the other hand\b/gi, 'conversely'],

  // "as a consequence" / "as a result" → "consequently"
  [/\bas a (?:consequence|result)\b/gi, '→'],

  // "is responsible for" → "manages"
  [/\bis responsible for\b/gi, 'manages'],

  // "has the ability to" → "can"
  [/\bhas the ability to\b/gi, 'can'],

  // "is able to" → "can"
  [/\bis able to\b/gi, 'can'],

  // "is unable to" → "cannot"
  [/\bis unable to\b/gi, 'cannot'],

  // "make a decision" → "decide"
  [/\bmake a decision\b/gi, 'decide'],

  // "take into consideration" → "consider"
  [/\btake into consideration\b/gi, 'consider'],

  // "give rise to" → "cause"
  [/\bgive rise to\b/gi, 'cause'],

  // "come to the conclusion" → "conclude"
  [/\bcome to the conclusion\b/gi, 'conclude'],

  // "carry out" → "do"
  [/\bcarry out\b/gi, 'do'],

  // "bring about" → "cause"
  [/\bbring about\b/gi, 'cause'],
];

/**
 * Convert enumerated lists in prose to compact bullet format.
 * Only matches when followed by a comma (distinguishes enumerators from
 * ordinal adjectives like "third quarter").
 *
 * "First, do X. Second, do Y. Third, do Z." → "1) do X 2) do Y 3) do Z"
 * "Third quarter results" → unchanged (no comma after "Third")
 */
function compressEnumerations(text: string): string {
  return text
    .replace(/\bFirst(?:ly)?,\s+/g, '1) ')
    .replace(/\bSecond(?:ly)?,\s+/g, '2) ')
    .replace(/\bThird(?:ly)?,\s+/g, '3) ')
    .replace(/\bFourth(?:ly)?,\s+/g, '4) ')
    .replace(/\bFifth(?:ly)?,\s+/g, '5) ')
    .replace(/\bFinally,\s+/g, 'last) ');
}

/**
 * Remove redundant relative pronouns where safe.
 * "the report that was published" → "the report published"
 */
function compressRelativeClauses(text: string): string {
  // "that is/was/are/were [adjective/verb]" → just the adjective/verb
  return text
    .replace(/\bthat (?:is|was|are|were) (\w+(?:ed|ing|en|ly)\b)/gi, '$1')
    .replace(/\bwhich (?:is|was|are|were) (\w+(?:ed|ing|en|ly)\b)/gi, '$1');
}

/**
 * Compress redundant sentence connectors.
 */
function compressConnectors(text: string): string {
  return text
    .replace(/\b[Hh]owever,?\s+/g, 'but ')
    .replace(/\b[Tt]herefore,?\s+/g, '→ ')
    .replace(/\b[Ff]urthermore,?\s+/g, '+ ')
    .replace(/\b[Mm]oreover,?\s+/g, '+ ')
    .replace(/\b[Nn]evertheless,?\s+/g, 'but ')
    .replace(/\b[Nn]onetheless,?\s+/g, 'but ')
    .replace(/\b[Aa]dditionally,?\s+/g, '+ ')
    .replace(/\b[Cc]onsequently,?\s+/g, '→ ')
    .replace(/\b[Ss]ubsequently,?\s+/g, 'then ')
    .replace(/\b[Mm]eanwhile,?\s+/g, 'while ');
}

/**
 * Structural compression rule.
 * Converts verbose prose patterns into compact forms.
 */
export const structuralRule: CompressionRule = (text, _ctx) => {
  let result = text;

  // Apply pattern replacements
  for (const [pattern, replacement] of STRUCTURAL_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  result = compressEnumerations(result);
  result = compressRelativeClauses(result);
  result = compressConnectors(result);

  return result;
};

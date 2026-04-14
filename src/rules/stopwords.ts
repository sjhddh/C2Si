import type { CompressionRule } from '../types.js';

/**
 * Words that can be safely removed without losing semantic content.
 * Categorized by confidence level.
 */

// Articles — almost always safe to remove for LLM consumption
const ARTICLES = new Set(['a', 'an', 'the']);

// Filler words — add no semantic content
const FILLERS = new Set([
  'actually', 'basically', 'certainly', 'clearly', 'completely',
  'definitely', 'essentially', 'extremely', 'fairly', 'frankly',
  'generally', 'honestly', 'just', 'largely', 'literally',
  'merely', 'naturally', 'obviously', 'particularly', 'perhaps',
  'practically', 'presumably', 'primarily', 'probably', 'purely',
  'quite', 'rather', 'really', 'relatively', 'seemingly',
  'simply', 'slightly', 'somewhat', 'specifically', 'surely',
  'truly', 'typically', 'ultimately', 'undoubtedly', 'unfortunately',
  'virtually', 'wholly',
]);

// Multi-word phrases that can be shortened or removed
const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  // Verbose → compact
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bfor the purpose of\b/gi, 'for'],
  [/\bin the event that\b/gi, 'if'],
  [/\bin the process of\b/gi, 'while'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bat the present time\b/gi, 'now'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bwith respect to\b/gi, 'about'],
  [/\bin terms of\b/gi, 'in'],
  [/\bas a result of\b/gi, 'from'],
  [/\bin the case of\b/gi, 'for'],
  [/\bfor the reason that\b/gi, 'because'],
  [/\bon the basis of\b/gi, 'based on'],
  [/\bin the amount of\b/gi, 'of'],
  [/\ba large number of\b/gi, 'many'],
  [/\ba small number of\b/gi, 'few'],
  [/\bthe vast majority of\b/gi, 'most'],
  [/\bit is important to note that\b/gi, ''],
  [/\bit should be noted that\b/gi, ''],
  [/\bit is worth mentioning that\b/gi, ''],
  [/\bneedless to say\b/gi, ''],
  [/\bas a matter of fact\b/gi, ''],
  [/\ball things considered\b/gi, ''],
  [/\bby and large\b/gi, 'mostly'],
  [/\beach and every\b/gi, 'every'],
  [/\bfirst and foremost\b/gi, 'first'],
  [/\bone and only\b/gi, 'only'],
  [/\bover and above\b/gi, 'beyond'],
  [/\bpart and parcel\b/gi, 'part of'],
];

/**
 * Remove articles (a, an, the) from text.
 * LLMs can parse text without articles at any position — they add no
 * semantic content and are consistently droppable for compression.
 */
function removeArticles(text: string): string {
  return text.replace(/\b(a|an|the)\s+/gi, '');
}

/**
 * Remove filler/hedge words that add no semantic content.
 */
function removeFillers(text: string): string {
  return text.replace(/\b(\w+)\b/g, (match) => {
    if (FILLERS.has(match.toLowerCase())) {
      return '';
    }
    return match;
  });
}

/**
 * Replace verbose multi-word phrases with compact equivalents.
 */
function compressPhrase(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Clean up whitespace artifacts left by other removals.
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')      // Collapse multiple spaces
    .replace(/ +\n/g, '\n')       // Trailing spaces before newline
    .replace(/\n +/g, '\n')       // Leading spaces after newline
    .replace(/\n{3,}/g, '\n\n')   // Collapse 3+ newlines to 2
    .replace(/\s+([.,;:!?])/g, '$1') // Remove space before punctuation
    .replace(/,\s*,/g, ',')       // Collapse double commas
    .trim();
}

/**
 * Stopwords compression rule.
 * Removes articles, fillers, and replaces verbose phrases.
 */
export const stopwordsRule: CompressionRule = (text, _ctx) => {
  let result = text;
  result = compressPhrase(result);
  result = removeArticles(result);
  result = removeFillers(result);
  result = normalizeWhitespace(result);
  return result;
};

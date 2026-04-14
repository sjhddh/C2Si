import type { CompressionRule, Entity, EntityRegistry } from '../types.js';
import { countTokens } from '../tokenizer/counter.js';

/**
 * Create an empty entity registry.
 */
export function createEntityRegistry(): EntityRegistry {
  return {
    entities: new Map(),
    surfaceIndex: new Map(),
    nextId: 1,
  };
}

/**
 * Single-token reference symbols.
 * $a, $b, $c, $d... are each 1 BPE token in GPT tokenizers.
 * Skip $e, $g, $u, $w, $y, $z which are 2 tokens.
 */
const REF_CHARS = 'abcdfhijklmnopqrstvx'.split('');

function makeRef(index: number): string {
  if (index < REF_CHARS.length) return `$${REF_CHARS[index]}`;
  // Fallback for 20+ entities: $aa, $ab, etc.
  return `$${REF_CHARS[Math.floor(index / REF_CHARS.length) % REF_CHARS.length]}${REF_CHARS[index % REF_CHARS.length]}`;
}

/**
 * Known entity type patterns.
 */
const ORG_SUFFIXES = /\b(?:Inc|Corp|Ltd|LLC|Co|Company|Group|Bank|Foundation|Institute|University|Association)\b/i;
const PERSON_PREFIXES = /\b(?:Mr|Mrs|Ms|Dr|Prof|President|CEO|CTO|CFO|Director|Chairman|Senator|Governor)\b/i;
const PLACE_PATTERNS = /\b(?:City|State|Country|Province|District|Region|Street|Avenue|Boulevard|Road)\b/i;

function detectEntityType(name: string): Entity['type'] {
  if (PERSON_PREFIXES.test(name)) return 'person';
  if (ORG_SUFFIXES.test(name)) return 'org';
  if (PLACE_PATTERNS.test(name)) return 'place';
  if (/^\$?[\d,.]+\s*(%|basis points|bp|percent|billion|million|trillion)/i.test(name)) return 'metric';
  if (/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(name)) return 'date';
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(name)) return 'date';
  return 'other';
}

/**
 * Extract multi-word entity spans and their occurrence counts.
 */
function extractEntitySpans(text: string): { name: string; count: number }[] {
  const results: { name: string; count: number }[] = [];
  const seen = new Set<string>();
  const coveredWords = new Set<string>();
  let match;

  // Multi-word capitalized sequences
  const capsPattern = /\b[A-Z][a-z]+(?:\s+(?:of|the|and|for|in|on|de|van|von|el|la|le|al)\s+[A-Z][a-z]+|\s+[A-Z][a-z]+)+/g;
  while ((match = capsPattern.exec(text)) !== null) {
    let entity = match[0].trim().replace(/^(?:The|A|An)\s+/i, '');
    const lower = entity.toLowerCase();
    if (entity.length > 3 && !seen.has(lower)) {
      const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const count = (text.match(new RegExp(`(?:The |the |)\\b${escaped}\\b`, 'g')) || []).length;
      seen.add(lower);
      results.push({ name: entity, count });
      for (const word of entity.split(/\s+/)) {
        coveredWords.add(word.toLowerCase());
      }
    }
  }

  // Single capitalized words appearing 3+ times, NOT part of multi-word entities
  const singleCaps = /\b([A-Z][a-z]{2,})\b/g;
  const singleCount = new Map<string, number>();
  while ((match = singleCaps.exec(text)) !== null) {
    const word = match[1];
    if (coveredWords.has(word.toLowerCase())) continue;
    const before = text.slice(Math.max(0, match.index - 2), match.index);
    if (/[.!?\n]\s*$/.test(before) || match.index === 0) continue;
    singleCount.set(word, (singleCount.get(word) || 0) + 1);
  }
  for (const [word, count] of singleCount) {
    if (count >= 3 && !seen.has(word.toLowerCase())) {
      seen.add(word.toLowerCase());
      results.push({ name: word, count });
    }
  }

  // Acronyms appearing 3+ times
  const acronymPattern = /\b([A-Z]{2,})\b/g;
  while ((match = acronymPattern.exec(text)) !== null) {
    const acronym = match[1];
    if (!seen.has(acronym.toLowerCase()) && !coveredWords.has(acronym.toLowerCase()) && acronym.length <= 10) {
      const count = (text.match(new RegExp(`\\b${acronym}\\b`, 'g')) || []).length;
      if (count >= 3) {
        seen.add(acronym.toLowerCase());
        results.push({ name: acronym, count });
      }
    }
  }

  return results;
}

/**
 * Check if deduplicating saves tokens using actual BPE token counts.
 * The entity ref must cost FEWER tokens than the entity name,
 * and the net savings must overcome the definition line cost.
 */
function isWorthDeduplicating(name: string, count: number, refIndex: number): boolean {
  const ref = makeRef(refIndex);
  const refTokens = countTokens(ref);
  const nameTokens = countTokens(name);

  // Ref must be cheaper than name
  if (refTokens >= nameTokens) return false;

  const defTokens = countTokens(`${ref}=${name}`);
  // Total with dedup: definition + first occurrence (full name) + (count-1) refs
  const withDedup = defTokens + nameTokens + (count - 1) * refTokens;
  // Total without: all occurrences as full name
  const without = count * nameTokens;

  return withDedup < without;
}

/**
 * Entity extraction and deduplication rule.
 * Only deduplicates when it provably saves tokens (tokenizer-aware).
 */
export const entitiesRule: CompressionRule = (text, ctx) => {
  const spans = extractEntitySpans(text);

  // Filter to only entities worth deduplicating
  let refIndex = 0;
  const toDedup: { name: string; count: number; ref: string }[] = [];
  for (const span of spans) {
    if (isWorthDeduplicating(span.name, span.count, refIndex)) {
      const ref = makeRef(refIndex);
      toDedup.push({ ...span, ref });

      // Register in entity registry
      const id = ref.slice(1); // Remove $ prefix for registry
      ctx.entityRegistry.entities.set(id, {
        id,
        canonical: span.name,
        aliases: [span.name],
        type: detectEntityType(span.name),
        count: span.count,
      });
      ctx.entityRegistry.surfaceIndex.set(span.name.toLowerCase(), id);

      refIndex++;
    }
  }

  if (toDedup.length === 0) return text;

  // Replace repeated mentions (longest entities first to avoid partial matches)
  let result = text;
  const sorted = [...toDedup].sort((a, b) => b.name.length - a.name.length);

  for (const { name, ref } of sorted) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:The |the )?\\b${escaped}\\b`, 'g');
    let first = true;

    result = result.replace(pattern, (match) => {
      if (first) {
        first = false;
        return name; // Keep first occurrence (without article)
      }
      return ref;
    });
  }

  // Prepend definitions
  const defs = toDedup.map((e) => `${e.ref}=${e.name}`).join('\n');
  result = defs + '\n\n' + result;

  return result;
};

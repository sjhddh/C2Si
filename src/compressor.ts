import type {
  C2SiConfig,
  CompressOptions,
  CompressResult,
  CompressionStats,
  EntityRegistry,
  ModelAdapter,
} from './types.js';
import { applyRules, createEntityRegistry } from './rules/index.js';
import { buildCompressionPrompt } from './scn/prompt.js';
import { countTokens } from './tokenizer/counter.js';

/**
 * C2Si — Carbon-to-Silicon Language Compressor.
 *
 * Compresses human language into token-efficient notation for LLMs.
 * Two compression tiers:
 *   1. Rule-based (sync, zero-dep): ~1.5-2x compression
 *   2. Model-assisted SCN (async, needs adapter): ~3-5x compression
 *
 * @example
 * ```ts
 * // Rules-only (synchronous)
 * const c2si = new C2Si();
 * const result = c2si.compress("The European Central Bank...");
 *
 * // Model-assisted (asynchronous)
 * const c2si = new C2Si({ adapter: ollamaAdapter({ model: 'llama3.2:3b' }) });
 * const result = await c2si.compress(longDocument);
 * ```
 */
export class C2Si {
  private adapter?: ModelAdapter;

  constructor(config?: C2SiConfig) {
    this.adapter = config?.adapter;
  }

  /**
   * Compress text using rules only (synchronous).
   * Always available, no model needed.
   */
  compressRules(
    text: string,
    options?: CompressOptions & { entityRegistry?: EntityRegistry },
  ): CompressResult {
    const originalTokens = countTokens(text);

    const { text: compressed, ctx } = applyRules(text, {
      entityRegistry: options?.entityRegistry,
      domain: options?.domain,
    });

    const compressedTokens = countTokens(compressed);

    return {
      compressed,
      stats: buildStats(text, compressed, originalTokens, compressedTokens),
      entities: ctx.entityRegistry,
    };
  }

  /**
   * Compress text. Uses rules-only if no adapter configured,
   * or model-assisted SCN compression if adapter is available.
   *
   * Returns a Promise when adapter is configured, sync result otherwise.
   */
  compress(
    text: string,
    options?: CompressOptions & { entityRegistry?: EntityRegistry },
  ): CompressResult | Promise<CompressResult> {
    // If no adapter or explicitly rules-only, use synchronous path
    if (!this.adapter || options?.rulesOnly) {
      return this.compressRules(text, options);
    }

    // Model-assisted path (async)
    return this.compressWithModel(text, options);
  }

  /**
   * Compress using model-assisted SCN conversion.
   */
  private async compressWithModel(
    text: string,
    options?: CompressOptions & { entityRegistry?: EntityRegistry },
  ): Promise<CompressResult> {
    const originalTokens = countTokens(text);

    // Step 1: Apply rules first for preprocessing
    const { text: preprocessed, ctx } = applyRules(text, {
      entityRegistry: options?.entityRegistry,
      domain: options?.domain,
    });

    // Step 2: Build existing entity definitions for the prompt
    let existingEntities: string | undefined;
    if (ctx.entityRegistry.entities.size > 0) {
      const defs: string[] = [];
      for (const [, entity] of ctx.entityRegistry.entities) {
        const typeStr = entity.type && entity.type !== 'other' ? `(type:${entity.type})` : '';
        defs.push(`@${entity.id}=${entity.canonical}${typeStr}`);
      }
      existingEntities = defs.join('\n');
    }

    // Step 3: Build and send prompt to model
    const { system, user } = buildCompressionPrompt(preprocessed, {
      domain: options?.domain,
      existingEntities,
    });

    const fullPrompt = `${system}\n\n${user}`;
    const compressed = await this.adapter!(fullPrompt);

    const compressedTokens = countTokens(compressed);

    return {
      compressed: compressed.trim(),
      stats: buildStats(text, compressed, originalTokens, compressedTokens),
      entities: ctx.entityRegistry,
    };
  }

  /**
   * Create a session for compressing multiple related documents.
   * The session tracks entities across compressions for cross-document deduplication.
   */
  createSession(): C2SiSession {
    return new C2SiSession(this);
  }
}

/**
 * A compression session that tracks entities across multiple documents.
 */
class C2SiSession {
  private compressor: C2Si;
  private entityRegistry: EntityRegistry;

  constructor(compressor: C2Si) {
    this.compressor = compressor;
    this.entityRegistry = createEntityRegistry();
  }

  /**
   * Compress text within this session.
   * Entities are tracked and deduplicated across calls.
   */
  compress(
    text: string,
    options?: CompressOptions,
  ): CompressResult | Promise<CompressResult> {
    const result = this.compressor.compress(text, {
      ...options,
      entityRegistry: this.entityRegistry,
    });

    // Update session registry from result
    if (result instanceof Promise) {
      return result.then((r) => {
        this.entityRegistry = r.entities;
        return r;
      });
    }

    this.entityRegistry = result.entities;
    return result;
  }

  /** Get the current entity registry. */
  getEntities(): EntityRegistry {
    return this.entityRegistry;
  }

  /** Reset the session (clear all tracked entities). */
  reset(): void {
    this.entityRegistry = createEntityRegistry();
  }
}

function buildStats(
  original: string,
  compressed: string,
  originalTokens: number,
  compressedTokens: number,
): CompressionStats {
  return {
    originalTokens,
    compressedTokens,
    ratio: compressedTokens > 0 ? Number((originalTokens / compressedTokens).toFixed(2)) : 0,
    originalChars: original.length,
    compressedChars: compressed.length,
  };
}

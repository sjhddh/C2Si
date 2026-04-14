/**
 * Model adapter: a function that sends a prompt to an LLM and returns the response.
 * Used for model-assisted SCN compression.
 */
export type ModelAdapter = (prompt: string) => Promise<string>;

/**
 * Configuration for the C2Si compressor.
 */
export interface C2SiConfig {
  /** Model adapter for deep SCN compression. If omitted, only rule-based compression is used. */
  adapter?: ModelAdapter;
}

/**
 * Options for a single compress() call.
 */
export interface CompressOptions {
  /** Skip model-assisted compression even if adapter is configured. */
  rulesOnly?: boolean;
  /** Domain hint for better abbreviations (e.g., 'finance', 'legal', 'code'). */
  domain?: string;
}

/**
 * Compression statistics.
 */
export interface CompressionStats {
  /** Token count of original text. */
  originalTokens: number;
  /** Token count of compressed output. */
  compressedTokens: number;
  /** Compression ratio (original / compressed). */
  ratio: number;
  /** Character count of original text. */
  originalChars: number;
  /** Character count of compressed output. */
  compressedChars: number;
}

/**
 * Result of a compress() call.
 */
export interface CompressResult {
  /** The compressed text in SCN notation. */
  compressed: string;
  /** Compression statistics. */
  stats: CompressionStats;
  /** Entity registry from this compression (for session tracking). */
  entities: EntityRegistry;
}

/**
 * A tracked entity with an assigned reference ID.
 */
export interface Entity {
  /** Reference ID, e.g., "E1", "E2". */
  id: string;
  /** The canonical form of the entity name. */
  canonical: string;
  /** All surface forms seen for this entity. */
  aliases: string[];
  /** Entity type if detected. */
  type?: 'person' | 'org' | 'place' | 'metric' | 'date' | 'other';
  /** Number of times this entity appeared. */
  count: number;
}

/**
 * Registry of entities tracked across compressions.
 */
export interface EntityRegistry {
  /** Map of entity ID → Entity. */
  entities: Map<string, Entity>;
  /** Map of surface form → entity ID for quick lookup. */
  surfaceIndex: Map<string, string>;
  /** Next entity ID counter. */
  nextId: number;
}

/**
 * Context passed through the rule pipeline.
 */
export interface RuleContext {
  /** Entity registry (rules can add/reference entities). */
  entityRegistry: EntityRegistry;
  /** Domain hint for domain-specific rules. */
  domain?: string;
}

/**
 * A single compression rule: transforms text given a context.
 */
export type CompressionRule = (text: string, ctx: RuleContext) => string;

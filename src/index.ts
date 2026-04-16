// ─────────────────────────────────────────────────────────────
// Agent-friendly convenience API (recommended entry point)
// ─────────────────────────────────────────────────────────────
export {
  compress,
  compressDetailed,
  compressWithModel,
  compressMessages,
  compressReport,
  compressHyper,
  compressSCNToHyper,
  tokens,
} from './convenience.js';
export type {
  ChatMessage,
  CompressionReport,
  HyperOptions,
  HyperCompressResult,
} from './convenience.js';

// ─────────────────────────────────────────────────────────────
// Tier 3 — HyperSCN (optional ultra-dense compression)
// ─────────────────────────────────────────────────────────────
export {
  compressToHyperSCN,
  withPreamble,
  HYPER_SCN_PREAMBLE,
  PREAMBLE_TOKEN_COST,
  PREDICATE_ALIASES,
  DISCOURSE_ARROWS,
} from './tier3/index.js';
export type { HyperSCNResult } from './tier3/index.js';

// ─────────────────────────────────────────────────────────────
// Full class API (stateful use, sessions, custom config)
// ─────────────────────────────────────────────────────────────
export { C2Si } from './compressor.js';

// ─────────────────────────────────────────────────────────────
// Model adapters for deep SCN compression
// ─────────────────────────────────────────────────────────────
export { ollamaAdapter } from './adapters/ollama.js';
export { openaiAdapter } from './adapters/openai.js';

// ─────────────────────────────────────────────────────────────
// Low-level utilities
// ─────────────────────────────────────────────────────────────
export { countTokens, estimateTokens } from './tokenizer/counter.js';
export { buildCompressionPrompt, SCN_SYSTEM_PROMPT } from './scn/prompt.js';
export { serializeClause, serializeDocument } from './scn/serializer.js';
export { ROLE_LABELS, DISCOURSE_RELATIONS, MODALITY_PREFIXES } from './scn/format.js';
export { applyRules, createEntityRegistry } from './rules/index.js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type {
  C2SiConfig,
  CompressOptions,
  CompressResult,
  CompressionStats,
  ModelAdapter,
  Entity,
  EntityRegistry,
  RuleContext,
  CompressionRule,
} from './types.js';
export type { OllamaConfig, OpenAIConfig } from './adapters/types.js';
export type { SCNClause, SCNDocument } from './scn/serializer.js';

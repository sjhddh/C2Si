import type { ModelAdapter } from '../types.js';

/**
 * Configuration for the Ollama adapter.
 */
export interface OllamaConfig {
  /** Model name (e.g., 'llama3.2:3b', 'qwen2.5:7b'). */
  model: string;
  /** Ollama host. Default: 'http://localhost:11434'. */
  host?: string;
  /** Request timeout in ms. Default: 60000. */
  timeout?: number;
  /** Temperature for generation. Default: 0.1 (low for consistency). */
  temperature?: number;
}

/**
 * Configuration for OpenAI-compatible API adapter.
 */
export interface OpenAIConfig {
  /** Model name (e.g., 'llama3.2:3b', 'gpt-4o-mini'). */
  model: string;
  /** API base URL (e.g., 'http://localhost:11434/v1'). */
  baseUrl: string;
  /** API key (if required). */
  apiKey?: string;
  /** Request timeout in ms. Default: 60000. */
  timeout?: number;
  /** Temperature for generation. Default: 0.1. */
  temperature?: number;
}

export type { ModelAdapter };

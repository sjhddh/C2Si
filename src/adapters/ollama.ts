import type { ModelAdapter } from '../types.js';
import type { OllamaConfig } from './types.js';

/**
 * Create a model adapter for Ollama.
 * Uses Ollama's REST API (POST /api/generate).
 *
 * @example
 * ```ts
 * const adapter = ollamaAdapter({ model: 'llama3.2:3b' });
 * const c2si = new C2Si({ adapter });
 * ```
 */
export function ollamaAdapter(config: OllamaConfig): ModelAdapter {
  const host = config.host ?? 'http://localhost:11434';
  const timeout = config.timeout ?? 60_000;
  const temperature = config.temperature ?? 0.1;

  return async (prompt: string): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt,
          stream: false,
          options: {
            temperature,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${body}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response;
    } finally {
      clearTimeout(timer);
    }
  };
}

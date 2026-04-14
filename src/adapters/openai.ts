import type { ModelAdapter } from '../types.js';
import type { OpenAIConfig } from './types.js';

/**
 * Create a model adapter for any OpenAI-compatible API.
 * Works with: Ollama (OpenAI mode), vLLM, LM Studio, OpenRouter, etc.
 *
 * @example
 * ```ts
 * // Local Ollama in OpenAI-compatible mode
 * const adapter = openaiAdapter({
 *   model: 'llama3.2:3b',
 *   baseUrl: 'http://localhost:11434/v1',
 * });
 *
 * // Or any OpenAI-compatible endpoint
 * const adapter = openaiAdapter({
 *   model: 'gpt-4o-mini',
 *   baseUrl: 'https://api.openai.com/v1',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 * ```
 */
export function openaiAdapter(config: OpenAIConfig): ModelAdapter {
  const timeout = config.timeout ?? 60_000;
  const temperature = config.temperature ?? 0.1;

  return async (prompt: string): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI-compatible API error (${response.status}): ${body}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      return data.choices[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  };
}

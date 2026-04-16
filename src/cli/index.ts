/**
 * C2Si CLI entry point.
 *
 * Agent-friendly design:
 *   - TTY detection: animations only when a human is watching
 *   - `--json` mode: machine-parsable output for subprocess callers
 *   - Clean stdout (compressed text or JSON only); stderr for banners/spinners
 *   - Respects NO_COLOR, CI env vars
 *   - Clear exit codes: 0 ok, 1 input error, 2 config error, 3 adapter error
 *   - Stdin pipe support for shell pipelines
 */

import { parseArgs, type CliArgs } from './args.js';
import { readStdin } from './stdin.js';
import { renderHelp } from './help.js';
import { Spinner } from './spinner.js';
import { c } from './colors.js';
import { compressDetailed, compressHyper, tokens } from '../convenience.js';
import { ollamaAdapter } from '../adapters/ollama.js';
import { openaiAdapter } from '../adapters/openai.js';
import type { ModelAdapter } from '../types.js';

// Version is injected at build time; fall back to package.json reading at runtime
const VERSION = '0.1.0';

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  // Early exits
  if (args.command === 'help') {
    process.stdout.write(renderHelp());
    return 0;
  }
  if (args.command === 'version') {
    process.stdout.write(`c2si ${VERSION}\n`);
    return 0;
  }

  // Resolve input: positional text OR stdin
  const stdinText = args.text ? '' : await readStdin();
  const input = args.text || stdinText.trim();

  if (!input) {
    if (!args.quiet && !args.json) {
      process.stderr.write(
        `${c.yellow('⚠')} No input. Try: ${c.dim('c2si "text" | cat file.txt | c2si | c2si --help')}\n`,
      );
    }
    return 1;
  }

  switch (args.command) {
    case 'count':
      return runCount(input, args);
    case 'compress':
      return runCompress(input, args);
    case 'hyper':
      return runHyper(input, args);
    default:
      process.stderr.write(`${c.red('✗')} Unknown command: ${args.command}\n`);
      return 1;
  }
}

// ─────────────────────────────────────────────────────────────
// Subcommand: count
// ─────────────────────────────────────────────────────────────
function runCount(input: string, args: CliArgs): number {
  const n = tokens(input);
  if (args.json) {
    process.stdout.write(JSON.stringify({ tokens: n }) + '\n');
  } else {
    process.stdout.write(`${n}\n`);
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Subcommand: compress (Tier 1)
// ─────────────────────────────────────────────────────────────
function runCompress(input: string, args: CliArgs): number {
  const result = compressDetailed(input, { domain: args.domain });

  if (args.json) {
    process.stdout.write(
      JSON.stringify({
        compressed: result.compressed,
        originalTokens: result.stats.originalTokens,
        compressedTokens: result.stats.compressedTokens,
        ratio: result.stats.ratio,
        percentSaved: Math.round(
          (1 - result.stats.compressedTokens / result.stats.originalTokens) * 100,
        ),
      }) + '\n',
    );
    return 0;
  }

  process.stdout.write(result.compressed + '\n');

  if (args.stats && !args.quiet) {
    const pct = Math.round(
      (1 - result.stats.compressedTokens / result.stats.originalTokens) * 100,
    );
    process.stderr.write(
      `\n${c.dim('┈')} ${c.bold(`${result.stats.originalTokens} → ${result.stats.compressedTokens} tokens`)} ` +
        `${c.green(`(${result.stats.ratio}x · ${pct}% saved)`)}\n`,
    );
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────
// Subcommand: hyper (Tier 3)
// ─────────────────────────────────────────────────────────────
async function runHyper(input: string, args: CliArgs): Promise<number> {
  const adapter = buildAdapter(args);
  if (!adapter) {
    process.stderr.write(
      `${c.red('✗')} ${c.bold('hyper')} requires a model provider.\n\n` +
        `  Set ${c.magenta('--provider')} and ${c.magenta('--model')}, or use env vars:\n` +
        `    ${c.dim('$ C2SI_PROVIDER=ollama C2SI_MODEL=llama3.2:3b c2si hyper ...')}\n\n` +
        `  See ${c.underline('c2si --help')} for details.\n`,
    );
    return 2;
  }

  const spinner = new Spinner(!args.json && !args.quiet);
  spinner.start(c.dim(`Calling ${args.model ?? 'model'} for Tier 2 SCN…`));

  try {
    const r = await compressHyper(input, adapter, {
      domain: args.domain,
      includePreamble: !args.noPreamble,
    });
    spinner.succeed(
      c.dim(
        `${r.report.originalTokens} → ${r.report.compressedTokens} tokens ` +
          `(${r.report.ratio}x · ${r.report.percentSaved}% saved · ${r.report.tier3Aliases} aliases)`,
      ),
    );

    if (args.json) {
      process.stdout.write(
        JSON.stringify({
          text: r.text,
          bodyOnly: r.bodyOnly,
          preamble: r.preamble,
          ...r.report,
        }) + '\n',
      );
    } else {
      process.stdout.write(r.text + '\n');
    }
    return 0;
  } catch (err) {
    spinner.fail(c.red(`Adapter error: ${(err as Error).message}`));
    return 3;
  }
}

// ─────────────────────────────────────────────────────────────
// Adapter resolution from flags + env vars
// ─────────────────────────────────────────────────────────────
function buildAdapter(args: CliArgs): ModelAdapter | null {
  const provider =
    args.provider ?? (process.env.C2SI_PROVIDER as CliArgs['provider']);
  const model = args.model ?? process.env.C2SI_MODEL;

  if (!provider || !model) return null;

  if (provider === 'ollama') {
    return ollamaAdapter({
      model,
      host: process.env.OLLAMA_HOST,
    });
  }

  if (provider === 'openai') {
    const baseUrl =
      args.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    return openaiAdapter({
      model,
      baseUrl,
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────
main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`${c.red('✗')} Unexpected error: ${(err as Error).message}\n`);
    process.exit(1);
  });

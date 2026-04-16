/**
 * CLI tests.
 *
 * Two groups:
 *   1. parseArgs — pure unit tests on the argv parser
 *   2. end-to-end — spawn the built `dist/cli.cjs` and verify stdout/stderr/exit
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from '../src/cli/args.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '..', 'dist', 'cli.cjs');

describe('parseArgs', () => {
  it('defaults to compress with empty text', () => {
    const a = parseArgs([]);
    expect(a.command).toBe('compress');
    expect(a.text).toBe('');
    expect(a.json).toBe(false);
  });

  it('treats bare positional as compress text', () => {
    const a = parseArgs(['hello', 'world']);
    expect(a.command).toBe('compress');
    expect(a.text).toBe('hello world');
  });

  it('recognizes subcommand as first positional', () => {
    const a = parseArgs(['count', 'hello']);
    expect(a.command).toBe('count');
    expect(a.text).toBe('hello');
  });

  it('parses --flag=value and --flag value forms', () => {
    expect(parseArgs(['--domain=finance']).domain).toBe('finance');
    expect(parseArgs(['--domain', 'finance']).domain).toBe('finance');
  });

  it('handles boolean flags without values', () => {
    const a = parseArgs(['--json', '--stats', '--quiet']);
    expect(a.json).toBe(true);
    expect(a.stats).toBe(true);
    expect(a.quiet).toBe(true);
  });

  it('maps --help and --version to commands', () => {
    expect(parseArgs(['--help']).command).toBe('help');
    expect(parseArgs(['--version']).command).toBe('version');
  });

  it('rejects invalid domain values silently (forward-compat)', () => {
    const a = parseArgs(['--domain=nonsense', 'text']);
    expect(a.domain).toBeUndefined();
    expect(a.text).toBe('text');
  });

  it('treats -- as positional terminator', () => {
    const a = parseArgs(['--', '--json', 'literal', 'text']);
    expect(a.json).toBe(false);
    expect(a.text).toBe('--json literal text');
  });

  it('parses --no-preamble flag', () => {
    expect(parseArgs(['--no-preamble']).noPreamble).toBe(true);
  });

  it('parses provider/model/base-url', () => {
    const a = parseArgs([
      '--provider=ollama',
      '--model',
      'llama3.2:3b',
      '--base-url=http://localhost:11434/v1',
    ]);
    expect(a.provider).toBe('ollama');
    expect(a.model).toBe('llama3.2:3b');
    expect(a.baseUrl).toBe('http://localhost:11434/v1');
  });
});

describe('end-to-end CLI invocation', () => {
  beforeAll(() => {
    if (!existsSync(cliPath)) {
      throw new Error(
        `CLI binary not found at ${cliPath}. Run \`npm run build\` first.`,
      );
    }
  });

  function run(args: string[], stdin?: string) {
    return spawnSync('node', [cliPath, ...args], {
      input: stdin,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
    });
  }

  it('prints version with --version', () => {
    const r = run(['--version']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^c2si \d+\.\d+\.\d+/);
  });

  it('prints help with --help', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('USAGE');
    expect(r.stdout).toContain('COMMANDS');
    expect(r.stdout).toContain('compress');
    expect(r.stdout).toContain('hyper');
  });

  it('compresses text passed as argument', () => {
    const r = run(['In order to effectively address the ongoing challenges']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('to effectively address ongoing challenges');
  });

  it('compresses text piped via stdin', () => {
    const r = run([], 'In order to address the challenges');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('to address');
    expect(r.stdout).not.toContain('in order to');
  });

  it('emits JSON with --json', () => {
    const r = run(['--json', 'In order to address the challenges']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({
      compressed: expect.any(String),
      originalTokens: expect.any(Number),
      compressedTokens: expect.any(Number),
      ratio: expect.any(Number),
      percentSaved: expect.any(Number),
    });
    expect(parsed.compressedTokens).toBeLessThan(parsed.originalTokens);
  });

  it('writes stats to stderr, compressed text to stdout', () => {
    const r = run(['--stats', 'In order to address the challenges']);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain('tokens'); // stats stay on stderr
    expect(r.stderr).toMatch(/\d+ → \d+ tokens/);
  });

  it('count subcommand returns a number', () => {
    const r = run(['count', 'Hello world']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+$/);
    const n = Number(r.stdout.trim());
    expect(n).toBeGreaterThan(0);
  });

  it('count subcommand --json returns structured data', () => {
    const r = run(['count', '--json', 'Hello world']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ tokens: expect.any(Number) });
  });

  it('exits 1 with no input', () => {
    const r = run([]);
    expect(r.status).toBe(1);
  });

  it('exits 2 when hyper is called without provider/model', () => {
    const r = run(['hyper', 'some text']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('requires a model provider');
  });

  it('applies --domain option', () => {
    const r = run(['--domain=finance', 'year over year revenue growth']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('YoY');
  });

  it('respects NO_COLOR env var (no ANSI escapes in output)', () => {
    const r = run(['--version']);
    expect(r.stdout).not.toMatch(/\x1b\[/);
  });
});

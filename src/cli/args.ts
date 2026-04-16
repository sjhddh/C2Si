/**
 * Zero-dependency argv parser for the c2si CLI.
 */

export interface CliArgs {
  command: 'compress' | 'count' | 'hyper' | 'help' | 'version';
  text: string;
  domain?: 'finance' | 'legal' | 'code' | 'medical';
  provider?: 'ollama' | 'openai';
  model?: string;
  baseUrl?: string;
  json: boolean;
  stats: boolean;
  quiet: boolean;
  noPreamble: boolean;
}

const SUBCOMMANDS = new Set(['compress', 'count', 'hyper', 'help', 'version']);
const BOOLEAN_FLAGS = new Set(['json', 'stats', 'quiet', 'help', 'version', 'no-preamble']);

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: 'compress',
    text: '',
    json: false,
    stats: false,
    quiet: false,
    noPreamble: false,
  };

  const positional: string[] = [];
  let seenSubcommand = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eqIdx = body.indexOf('=');
      const [key, inlineValue] = eqIdx >= 0
        ? [body.slice(0, eqIdx), body.slice(eqIdx + 1)]
        : [body, undefined];

      if (BOOLEAN_FLAGS.has(key)) {
        apply(args, key, 'true');
      } else if (inlineValue !== undefined) {
        apply(args, key, inlineValue);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          apply(args, key, next);
          i++;
        }
      }
      continue;
    }

    if (!seenSubcommand && SUBCOMMANDS.has(arg)) {
      args.command = arg as CliArgs['command'];
      seenSubcommand = true;
    } else {
      positional.push(arg);
    }
  }

  args.text = positional.join(' ');
  return args;
}

function apply(args: CliArgs, key: string, value: string): void {
  switch (key) {
    case 'json':
      args.json = true;
      break;
    case 'stats':
      args.stats = true;
      break;
    case 'quiet':
      args.quiet = true;
      break;
    case 'help':
      args.command = 'help';
      break;
    case 'version':
      args.command = 'version';
      break;
    case 'no-preamble':
      args.noPreamble = true;
      break;
    case 'domain':
      if (['finance', 'legal', 'code', 'medical'].includes(value)) {
        args.domain = value as CliArgs['domain'];
      }
      break;
    case 'provider':
      if (['ollama', 'openai'].includes(value)) {
        args.provider = value as CliArgs['provider'];
      }
      break;
    case 'model':
      args.model = value;
      break;
    case 'base-url':
      args.baseUrl = value;
      break;
  }
}

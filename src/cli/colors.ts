/**
 * ANSI color utilities — no external dependencies.
 * Auto-disables when stdout isn't a TTY or NO_COLOR / CI env is set.
 */

export const colorEnabled =
  !process.env.NO_COLOR && !process.env.CI && Boolean(process.stdout.isTTY);

const wrap = (open: string, close: string) => (s: string) =>
  colorEnabled ? `${open}${s}${close}` : s;

export const c = {
  cyan: wrap('\x1b[36m', '\x1b[0m'),
  green: wrap('\x1b[32m', '\x1b[0m'),
  yellow: wrap('\x1b[33m', '\x1b[0m'),
  red: wrap('\x1b[31m', '\x1b[0m'),
  magenta: wrap('\x1b[35m', '\x1b[0m'),
  gray: wrap('\x1b[90m', '\x1b[0m'),
  bold: wrap('\x1b[1m', '\x1b[22m'),
  dim: wrap('\x1b[2m', '\x1b[22m'),
  underline: wrap('\x1b[4m', '\x1b[24m'),
};

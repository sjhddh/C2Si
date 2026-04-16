/**
 * Braille spinner for the CLI. Auto-disables when stderr is not a TTY
 * so agents reading subprocess output get clean text without escape codes.
 */

import { c, colorEnabled } from './colors.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frameIdx = 0;
  private timer: NodeJS.Timeout | null = null;
  private text = '';
  private enabled: boolean;

  constructor(enabled = Boolean(process.stderr.isTTY) && colorEnabled) {
    this.enabled = enabled;
  }

  start(text: string): void {
    this.text = text;
    if (!this.enabled) return;
    process.stderr.write('\x1b[?25l'); // hide cursor
    this.render();
    this.timer = setInterval(() => {
      this.frameIdx = (this.frameIdx + 1) % FRAMES.length;
      this.render();
    }, 80);
  }

  succeed(text: string): void {
    this.finalize();
    process.stderr.write(`${c.green('✓')} ${text}\n`);
  }

  fail(text: string): void {
    this.finalize();
    process.stderr.write(`${c.red('✗')} ${text}\n`);
  }

  private render(): void {
    process.stderr.write('\r\x1b[2K' + c.cyan(FRAMES[this.frameIdx]) + ' ' + this.text);
  }

  private finalize(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.enabled) {
      process.stderr.write('\r\x1b[2K\x1b[?25h'); // clear + show cursor
    }
  }
}

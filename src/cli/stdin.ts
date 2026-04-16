/**
 * Stdin reader — supports piped input (e.g. `cat file.txt | c2si`).
 * Returns '' if stdin is a TTY (interactive terminal, no piped data).
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

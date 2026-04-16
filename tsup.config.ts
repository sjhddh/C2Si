import { defineConfig } from 'tsup';

// Single config, two entries. Library + CLI built together so clean:true
// doesn't race. CLI gets a shebang via banner; its .cjs extension comes
// from the CJS format (we don't emit ESM or types for the CLI).
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
  },
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    clean: false,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    banner: { js: '#!/usr/bin/env node' },
  },
]);

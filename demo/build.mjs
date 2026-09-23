/**
 * Demo bundler.
 *
 * Bundles `demo/src/main.tsx` into `demo/dist/`, importing the package through
 * `dist/` — the same files npm publishes — so the demo is evidence about the
 * shipped artifact rather than about the source tree.
 *
 *   node demo/build.mjs           build once
 *   node demo/build.mjs --serve   build, watch, and serve on :5173
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'dist');
const serve = process.argv.includes('--serve');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(HERE, 'index.html'), join(OUT, 'index.html'));
cpSync(join(HERE, 'styles.css'), join(OUT, 'styles.css'));

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(HERE, 'src', 'main.tsx')],
  outfile: join(OUT, 'app.js'),
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  minify: !serve,
  sourcemap: serve,
  logLevel: 'info',
};

if (!serve) {
  await esbuild.build(options);
  console.log(`built → ${OUT}`);
} else {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: OUT, port: 5173 });
  console.log(`serving http://${hosts[0] ?? 'localhost'}:${port}`);
}

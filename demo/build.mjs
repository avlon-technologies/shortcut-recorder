/**
 * Demo bundler.
 *
 * Bundles `demo/src/main.tsx` into `demo/dist/`, importing the package through
 * `dist/` — the same files npm publishes — so the demo is evidence about the
 * shipped artifact rather than about the source tree.
 *
 *   node demo/build.mjs           build once
 *   node demo/build.mjs --serve   build, watch, and serve on :5173
 *
 * Production output is content-hashed (`app-XSK3NM7T.js`). GitHub Pages serves
 * assets with a cache lifetime, so a stable filename means a returning visitor
 * keeps running the previous deploy's bundle and sees a page that is silently
 * out of date. A hashed name makes every deploy a new URL, so there is nothing
 * to invalidate.
 */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'dist');
const serve = process.argv.includes('--serve');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/** Short, stable, filename-safe digest of a file's contents. */
function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 8);
}

// The stylesheet is copied, so hash it here. In watch mode keep the plain name
// so a reload always picks up the newest file without a rebuild of the HTML.
const cssBytes = readFileSync(join(HERE, 'styles.css'));
const cssName = serve ? 'styles.css' : `styles-${digest(cssBytes)}.css`;
writeFileSync(join(OUT, cssName), cssBytes);

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(HERE, 'src', 'main.tsx')],
  outdir: OUT,
  entryNames: serve ? 'app' : 'app-[hash]',
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  minify: !serve,
  sourcemap: serve,
  metafile: true,
  logLevel: 'info',
};

/** Point index.html at whatever the build actually emitted. */
function writeHtml(jsName) {
  const html = readFileSync(join(HERE, 'index.html'), 'utf8')
    .replace('href="styles.css"', `href="${cssName}"`)
    .replace('src="app.js"', `src="${jsName}"`);
  writeFileSync(join(OUT, 'index.html'), html);
}

/** The JS entry point esbuild produced, by name. */
function entryFrom(result) {
  const outputs = Object.keys(result.metafile.outputs);
  const js = outputs.find((o) => o.endsWith('.js'));
  if (!js) throw new Error('esbuild produced no JS entry point');
  return basename(js);
}

if (!serve) {
  const result = await esbuild.build(options);
  writeHtml(entryFrom(result));
  console.log(`built → ${OUT}`);
} else {
  cpSync(join(HERE, 'index.html'), join(OUT, 'index.html'));
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: OUT, port: 5173 });
  console.log(`serving http://${hosts[0] ?? 'localhost'}:${port}`);
}

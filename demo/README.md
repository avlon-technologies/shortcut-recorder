# Demo

The page published at
**[mikekangdev.github.io/shortcut-recorder](https://mikekangdev.github.io/shortcut-recorder/)**.

It is a keyboard-shortcuts settings panel: six commands, each with a recorder,
live conflict detection across the list, browser-reserved warnings, and a
platform switch that re-reads every shortcut without changing a single stored
value.

## Run it

```sh
npm run demo         # build the package, then watch and serve on :5173
npm run demo:build   # build once into demo/dist/
```

`npm run demo` rebuilds on change. It does **not** watch `src/` — edit the
package and re-run, or run `npm run build -- --watch` alongside it.

## What it is for

The package is headless: it ships no CSS, no class names, and no markup of its
own. That makes a demo the honest way to show what using it feels like, because
every visual decision on the page has to be made by the caller.

So read `demo/styles.css` as *the cost*: all of it is the demo's, none of it
comes from the package. And read `demo/src/App.tsx` as *the API*: about fifteen
lines of it are the library.

The demo also shows three things the README can only assert:

- **The portable `Mod`.** Flip the platform switch. `Mod+K` reads as
  `Command K` on macOS and `Ctrl K` on Windows — one stored value, shown under
  each row as `stored as Mod+K`, rendered two ways.
- **Conflicts name something a human recognizes.** Each row passes the *other*
  rows as `existing`, keyed by label rather than id, so a collision reads
  "Already assigned to "Quick search"" instead of quoting an internal id. A row
  is never in its own `existing`, or it would collide with itself.
- **Reserved is a warning, not a refusal.** "New document" ships as `Mod+N`
  and says so on load. Record `Ctrl` `T` on any row and it warns, but still
  commits — what to do about it is the caller's call, not the library's.

## How it is built

`demo/build.mjs` bundles `demo/src/main.tsx` with esbuild into `demo/dist/`.

The demo imports the package through **`dist/`**, not `src/` — the same files
npm publishes. A demo that passed against the source tree while the published
artifact was broken would be worth nothing, so `npm run demo:build` builds the
package first.

`demo/dist/` is generated and git-ignored. GitHub Pages is deployed by
`.github/workflows/pages.yml`, which runs `npm run verify` before it builds the
page: a failing test never becomes a published demo.

## It is covered by tests

`tests/demo.test.tsx` renders `demo/src/App.tsx` in jsdom and drives it —
recording, colliding, clearing, cancelling with Escape, and switching platform.
The demo is a deliverable, so it has a regression guard like anything else.

```sh
npx vitest run tests/demo.test.tsx
```

## A note on the recorder element

The demo spreads `getHandleProps()` onto a real `<button>`, so the `role` and
`tabIndex` it supplies are redundant there — harmless, and it keeps the prop bag
correct for callers who reach for a `<div>` instead. Prefer a real button in
your own code: you get focus, activation and disabled semantics for free.

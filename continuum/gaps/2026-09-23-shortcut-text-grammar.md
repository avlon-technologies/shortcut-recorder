# Gap — the canonical text form of `Shortcut` is not declared

- **date**: 2026-09-23
- **status**: **closed** — declared by `continuum/changes/2026-09-23-close-recorded-gaps.adl-change`, applied 2026-09-23
- **element**: `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.Shortcut` (TypeDefinition v1, `alias = text !identity`)
- **base**: `package open.shortcutrecorder version "package-1" state "sha256:4d2824016cdf4e787171c5dfecc127ef6b10d6613a0d35ab3751974d1ce3e71f"`

## The fact the architecture does not declare

`Shortcut` is declared as `text` and marked `!identity`, so two shortcuts are
the same shortcut exactly when their text matches. The model therefore makes
shortcut *identity* depend entirely on a textual form it never specifies: no
token separator, no modifier order, no key casing, no spelling for named keys.

`BusinessRule ModMapping` names the token `Mod`, and that is the only piece of
the grammar the model states.

## Evidence

- `RecorderApi.NormalizeShortcut` declares `out = Shortcut` with no statement of
  what the text looks like.
- `acceptance/scenarios/core-shortcut-behavior.scenario.json` pins exactly one
  point of the grammar — `recorder.normalized-value-is` expects `"Mod+Shift+P"`
  from Command+Shift+P on macOS — and `recorder.has-existing-bindings` supplies
  `"Mod+K"`. Everything else about the form is unconstrained.
- Because the alias is `!identity`, this is not cosmetic: two implementations
  that disagree on order or casing would disagree about whether two shortcuts
  collide, which is `AssignmentSafety.CollisionDetection`.

## Smallest change that would close it

Add a business rule to the `Shortcuts` bounded context stating the canonical
form — for example: *"A shortcut's canonical text is its modifier tokens in the
order Mod, Meta, Ctrl, Alt, Shift, followed by its key token, joined with `+`;
single-character keys are upper case."* That is one `business-rule` declaration
in the existing context and needs no new elements.

## What the implementation does meanwhile

`src/normalize.ts` implements exactly the grammar above and makes
`canonicalizeShortcut` the single place identity is decided; `parseShortcut`
accepts the looser spellings a caller may hand-write (`"mod+k"`,
`"Command+Shift+P"`) and folds them onto it. Every comparison in
`src/assess.ts` and `src/reserved.ts` goes through canonicalization, so the
choice is applied consistently rather than assumed at each call site.

The choice is confined to `normalize.ts`; closing the gap with a different
canonical form would change that file and the tests in
`tests/normalize.test.ts`, and nothing else.

---

## Disposition — closed 2026-09-23

`business-rule CanonicalShortcutForm` now declares the canonical text: modifier
tokens in the order Mod, Meta, Ctrl, Alt, Shift, then the key token, separated
by plus signs, with a single-character key token upper case — and states that
shortcut identity is equality of that text. `ShortcutEngine` applies it.

The grammar the implementation had already chosen is exactly the one declared,
so `src/normalize.ts` needed no change: what changed is that it is now applying
a rule rather than inventing one.

The change applied cleanly: `applicability applies`, `result valid` (0 errors),
0 design warnings, 0 findings.

| | |
|---|---|
| change | `continuum/changes/2026-09-23-close-recorded-gaps.adl-change` |
| base state | `sha256:4d2824016cdf4e787171c5dfecc127ef6b10d6613a0d35ab3751974d1ce3e71f` |
| result state | `sha256:187919c0305c3bd77f3bdee5e40577ccead8b1ee620148638574bfd22d3d2c9d` |
| attestation | `sha256:dff39a05dbd50f14293b9660f7512a58ee4696c21e56421695fa41aa2d81a704` |

# Gap — which shortcuts are "recognized browser-reserved" is not declared

- **date**: 2026-09-23
- **status**: **closed** — declared by `continuum/changes/2026-09-23-close-recorded-gaps.adl-change`, applied 2026-09-23
- **element**: `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.ReservedWarning` (BusinessRule), `::ShortcutRecorder.ShortcutConfiguration.AssignmentSafety.ReservedShortcutWarning` (Requirement)
- **base**: `package open.shortcutrecorder version "package-1" state "sha256:4d2824016cdf4e787171c5dfecc127ef6b10d6613a0d35ab3751974d1ce3e71f"`

## The fact the architecture does not declare

`ReservedWarning` states: *"A recognized browser-reserved shortcut produces a
warning rather than being treated as an ordinary unreserved assignment."* It
declares what happens to a recognized shortcut, and leaves *recognition* itself
undeclared — the model names no reserved shortcut, no source of truth for the
set, and no way for a caller to supply or extend one.

`Assessment.reserved` is a `boolean`, so the answer carries no evidence: a
caller cannot tell which browser reserves the shortcut, or why.

## Evidence

- `acceptance/scenarios/core-shortcut-behavior.scenario.json`, step
  `recorder.reserved-shortcut-warns`, takes no arguments: the scenario asserts
  that *some* recognized shortcut warns, and cannot name one, precisely because
  the model does not.
- `AssessmentInput` carries `shortcut`, `existing` and `platform` — the caller
  can supply the assigned bindings but has no way to supply reserved ones, so
  the set must be internal to the engine.

## Smallest change that would close it

Either:

1. declare the recognition set as part of the bounded context's language — a
   `business-rule` naming the source of truth (for instance, *"the shortcuts a
   mainstream browser acts on before the page observes them, per platform"*),
   leaving the enumeration to the implementation; or
2. add a field to `AssessmentInput` — `reserved: list(Shortcut)` — moving the
   set out of the engine and making the caller responsible for it.

(1) keeps the engine's current contract and is the smaller change; (2) changes
a declared record and every caller of `AssessShortcut`.

## What the implementation does meanwhile

`src/reserved.ts` carries a deliberately conservative recognition set, split
into shortcuts every mainstream browser reserves and shortcuts reserved per
platform, each entry commented with what the browser does with it. It is
exported as `reservedShortcuts(platform)` so the set is inspectable rather than
hidden, and `isReservedShortcut` is documented as one-directional evidence:
`true` means the browser is known to claim the shortcut; `false` means only
that this table does not list it.

The set is data in one module; closing the gap either way replaces that module
without touching normalization, presentation or the recorder.

---

## Disposition — closed 2026-09-23

`business-rule ReservedRecognition` now declares the source of truth: a shortcut
is recognized as browser-reserved when a mainstream browser acts on it before
the page observes the key press, on the platform being assessed; the engine owns
the set; and a shortcut the set does not name is reported as unreserved, which
is the absence of recognition rather than evidence that the shortcut is free.
`ShortcutEngine` applies it.

Option (1) was taken — the narrower one. `AssessmentInput` is unchanged, so no
caller of `AssessShortcut` is affected. `src/reserved.ts` needed no change; the
one-directional reading it already documented is now the declared one.

The change applied cleanly: `applicability applies`, `result valid` (0 errors),
0 design warnings, 0 findings.

| | |
|---|---|
| change | `continuum/changes/2026-09-23-close-recorded-gaps.adl-change` |
| base state | `sha256:4d2824016cdf4e787171c5dfecc127ef6b10d6613a0d35ab3751974d1ce3e71f` |
| result state | `sha256:187919c0305c3bd77f3bdee5e40577ccead8b1ee620148638574bfd22d3d2c9d` |
| attestation | `sha256:dff39a05dbd50f14293b9660f7512a58ee4696c21e56421695fa41aa2d81a704` |

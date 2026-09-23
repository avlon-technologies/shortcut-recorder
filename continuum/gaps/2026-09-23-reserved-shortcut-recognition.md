# Gap — which shortcuts are "recognized browser-reserved" is not declared

- **date**: 2026-09-23
- **status**: open — awaiting an architecture decision
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

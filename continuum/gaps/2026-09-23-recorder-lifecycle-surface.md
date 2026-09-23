# Gap — the recording lifecycle has behaviour but no declared surface

- **date**: 2026-09-23
- **status**: **closed** — declared by `continuum/changes/2026-09-23-close-recorded-gaps.adl-change`, applied 2026-09-23
- **element**: `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.ShortcutEngine.RecorderApi` (API), `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.EscapeCancels` (BusinessRule), `::ShortcutRecorder.ShortcutConfiguration.Recording` (Capability)
- **base**: `package open.shortcutrecorder version "package-1" state "sha256:4d2824016cdf4e787171c5dfecc127ef6b10d6613a0d35ab3751974d1ce3e71f"`

## The fact the architecture does not declare

The model declares that recording exists and how it ends:

- `ShortcutEngine` is described as providing *"recorder semantics for adapters"*
  and `realizes` the `Recording` capability;
- `EscapeCancels` states *"Escape cancels the active recording and leaves the
  committed shortcut unchanged"*, and the engine `applies` it;
- `EscapeCancellation` and `KeyboardAccessibility` are both `satisfies` claims
  of the engine.

"The active recording", "the committed shortcut" and cancellation are therefore
declared *behaviour*. But `RecorderApi` declares exactly three operations —
`NormalizeShortcut`, `FormatShortcut`, `AssessShortcut` — all of them pure
functions over a chord or a shortcut. Nothing in the model declares the states
(idle / recording), the transitions between them, or an operation an adapter
calls to start, cancel or commit. Nor is there a type for "the committed
shortcut" as distinct from a `Shortcut`.

An adapter cannot implement `EscapeCancels` from the declared API surface alone:
the three operations have no state for Escape to cancel.

## Evidence

- `acceptance/scenarios/core-shortcut-behavior.scenario.json` names four steps
  with no counterpart in `RecorderApi`: `recorder.starts`,
  `recorder.presses-chord`, `recorder.escape-cancels`, and the accessibility
  assertion inside `recorder.keycaps-are-readable`'s neighbourhood.
- `acceptance/scenarios/integration-contract.scenario.json` asserts
  `react.supports-controlled-state` and `react.supports-uncontrolled-state` —
  two ways of owning a committed shortcut — while the model declares no
  committed-shortcut state for either to own.
- `BEHAVIOUR.md` reports 0 traces: there is no declared message or workflow for
  the lifecycle to appear in.

## Smallest change that would close it

Declare the lifecycle in the `Shortcuts` bounded context: a
`RecordingState v1 = idle | recording` enumeration, and three operations on
`RecorderApi` — `StartRecording`, `CancelRecording`, and a `CommitChord` taking
`NormalizeInput` and returning `Assessment`. That is one enumeration and three
operations inside elements that already exist.

A narrower alternative is a single `business-rule` stating that the engine owns
an active-recording state and that a captured chord ends it, which would make
the existing `EscapeCancels` rule implementable without adding an API surface.

## What the implementation does meanwhile

`src/recorder.ts` implements the lifecycle as `createShortcutRecorder`, a
subscribable store layered *over* the three declared operations rather than
replacing them: `handleKeyDown` calls `normalizeShortcut` and `assessShortcut`,
and the snapshot calls `formatShortcut`. The three declared operations remain
exported as standalone pure functions, so an adapter that only needs the
declared surface never touches the store.

The keyboard contract the store implements is documented on
`createShortcutRecorder` as a state/key table, and the controlled-versus-
uncontrolled ownership of the committed shortcut follows the host platform's
own convention (React's) rather than inventing one. Both are implementation
policy, recorded here, not architecture.

---

## Disposition — closed 2026-09-23

`enum RecordingState v1 = idle | recording` was added, and `RecorderApi` gained
three operations: `StartRecording` and `CancelRecording` (out `RecordingState`)
and `CommitChord` (in `NormalizeInput`, out `Assessment`). `EscapeCancels` now
has a declared state to cancel out of.

`recorder.start()` and `recorder.cancel()` return the `RecordingState`, and
`recorder.commitChord(input)` is the declared commit that `handleKeyDown` calls.
The snapshot exposes `recordingState` as the declared vocabulary, with
`recording` retained as the boolean convenience derived from it.

The keyboard contract (which key starts, cancels or commits) remains
implementation policy: the model declares the states and the operations, not the
key bindings that drive them.

The change applied cleanly: `applicability applies`, `result valid` (0 errors),
0 design warnings, 0 findings.

| | |
|---|---|
| change | `continuum/changes/2026-09-23-close-recorded-gaps.adl-change` |
| base state | `sha256:4d2824016cdf4e787171c5dfecc127ef6b10d6613a0d35ab3751974d1ce3e71f` |
| result state | `sha256:187919c0305c3bd77f3bdee5e40577ccead8b1ee620148638574bfd22d3d2c9d` |
| attestation | `sha256:dff39a05dbd50f14293b9660f7512a58ee4696c21e56421695fa41aa2d81a704` |

# Gap — `FormatShortcut` cannot reach the platform its requirement depends on

- **date**: 2026-09-23
- **status**: open — awaiting an architecture decision
- **element**: `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.ShortcutEngine.RecorderApi.FormatShortcut` (Operation), `::ShortcutRecorder.ShortcutConfiguration.Presentation.PrettyKeycaps` (Requirement)
- **base**: `package open.shortcutrecorder version "package-1" state "sha256:4d2824016cdf4e787171c5dfecc127ef6b10d6613a0d35ab3751974d1ce3e71f"`

## The fact the architecture does not declare

`FormatShortcut` declares `in = Shortcut` and `out = KeycapDisplay`. Its
requirement, `PrettyKeycaps`, says normalized shortcuts *"can be rendered as
platform-appropriate keycap labels such as Command, Shift, and P"*.

`Command` is a macOS label. The same `Shortcut` — `Mod+Shift+P` — must render as
`Command` on macOS and as `Ctrl` elsewhere. So the operation's declared output
depends on the platform, and its declared input does not carry it. The model's
other two operations both take `platform` explicitly (`NormalizeInput`,
`AssessmentInput`); this one does not, and the model does not say where it
should come from instead.

## Evidence

- `NormalizeInput` and `AssessmentInput` each declare a `platform: Platform`
  field. `FormatShortcut` takes the bare `Shortcut` alias.
- `acceptance/scenarios/core-shortcut-behavior.scenario.json`, step
  `recorder.keycaps-are-readable`, asserts readable *platform* keycaps but
  passes no platform — the platform reaches it only through the `macos` chord
  recorded earlier in the scenario.

## Smallest change that would close it

Declare a `FormatInput v1 { shortcut: Shortcut, platform: Platform }` record in
the `Shortcuts` bounded context and change `FormatShortcut` to `in =
FormatInput` — one new record and one changed operation, matching the shape the
other two operations already use.

The alternative reading — that platform is ambient *environment* rather than
input — would instead be closed by saying so, since nothing in the model
currently does.

## What the implementation does meanwhile

`formatShortcut(shortcut, platform?)` and `keycapLabels(shortcut, platform?)`
take the platform as a second parameter that defaults to `detectPlatform()`, so
the declared shape (`in = Shortcut`) is the required part of the call and the
platform is an ambient default a caller can always override. `detectPlatform()`
reads `navigator` only behind a `typeof` guard, at call time, and answers
`'other'` where there is none — which keeps the default from breaking
`ServerRenderingSafe`.

`createShortcutRecorder` never relies on the default: it resolves the platform
once and passes it explicitly on every format call, so the ambient path is only
reachable by a caller who formats a shortcut directly.

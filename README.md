# @avlon/shortcut-recorder

[![npm](https://img.shields.io/npm/v/@avlon/shortcut-recorder.svg)](https://www.npmjs.com/package/@avlon/shortcut-recorder)
[![license](https://img.shields.io/npm/l/@avlon/shortcut-recorder.svg)](LICENSE)
[![types](https://img.shields.io/badge/types-included-blue.svg)](dist/index.d.ts)

Capture user-defined keyboard shortcuts, normalize them into a portable form,
render readable keycaps, and report assignment problems — without imposing a
visual style or a UI framework.

**[Live demo →](https://avlon-technologies.github.io/shortcut-recorder/)**

- **Framework-agnostic core.** The capture semantics are plain TypeScript with
  no DOM and no framework. The React adapter is a thin wrapper over it.
- **Headless.** The package ships no CSS, no class names and no markup of its
  own. You get behaviour props and state; the design is yours.
- **Server-safe.** Importing and rendering touch no browser global.
- **Keyboard-first.** Recording starts, commits and cancels from the keyboard,
  with an accessible contract (`role`, `aria-pressed`, `aria-keyshortcuts`, a
  live region) supplied for you.
- **Portable `Mod`.** One shortcut value means Command on macOS and Control
  everywhere else.
- **Assignment safety.** Reports both a conflicting binding and a recognized
  browser-reserved shortcut.

Key sequences (`G G`) and localization are out of scope.

## Install

```sh
npm install @avlon/shortcut-recorder
```

React is an optional peer dependency, needed only for `/react`.

## The core

```ts
import { normalizeShortcut, formatShortcut, assessShortcut } from '@avlon/shortcut-recorder';

// A captured chord becomes one portable value…
normalizeShortcut({
  chord: { key: 'P', meta: true, shift: true, control: false, alt: false },
  platform: 'macos',
});
// → 'Mod+Shift+P'   (Control+Shift+P on Windows normalizes to the same value)

// …which reads differently on each platform…
formatShortcut({ shortcut: 'Mod+Shift+P', platform: 'macos' }); // → { text: 'Command + Shift + P' }
formatShortcut({ shortcut: 'Mod+Shift+P', platform: 'other' }); // → { text: 'Ctrl + Shift + P' }

// …and can be checked before you assign it.
assessShortcut({
  shortcut: 'Mod+K',
  existing: [{ id: 'search', shortcut: 'Mod+K' }],
  platform: 'macos',
});
// → { shortcut: 'Mod+K', reserved: false, conflict: { bindingId: 'search', shortcut: 'Mod+K' } }
```

`Mod+T` on either platform, `Mod+Q` on macOS and `Alt+F4` on Windows come back
with `reserved: true`: the browser acts on them before your page ever sees the
key. That is a warning, not a refusal — the recorder still commits the shortcut
and leaves the decision to you.

## The recorder

`createShortcutRecorder` adds the recording lifecycle. It owns no DOM: feed it
key events, read its snapshot, render whatever you like.

```ts
import { createShortcutRecorder } from '@avlon/shortcut-recorder';

const recorder = createShortcutRecorder({
  defaultValue: 'Mod+K',
  existing: [{ id: 'palette', shortcut: 'Mod+Shift+P' }],
  onChange: (shortcut, assessment) => save(shortcut, assessment),
});

recorder.subscribe(render);
element.addEventListener('keydown', recorder.handleKeyDown);
element.addEventListener('keyup', recorder.handleKeyUp);
element.addEventListener('blur', recorder.handleBlur);
```

The keyboard contract:

| state | key | effect |
|---|---|---|
| idle | Enter or Space | start recording |
| recording | Escape | cancel; the committed shortcut is unchanged |
| recording | a modifier | update the live preview |
| recording | bare Tab | ignored, so focus can leave |
| recording | any other key | commit that chord |

`getSnapshot()` returns `{ recordingState, recording, value, assessment,
pressed, keycaps, display, status, platform }`, where `recordingState` is the
declared `'idle' | 'recording'` and `recording` is the boolean convenience. `getRecorderAttributes()` and
`getStatusAttributes()` return the accessibility attributes for the control and
its live region.

## React

```tsx
import { useShortcutRecorder } from '@avlon/shortcut-recorder/react';

function ShortcutField({ bindings }) {
  const { state, getHandleProps, getStatusProps } = useShortcutRecorder({
    defaultValue: 'Mod+K',
    existing: bindings,
    label: 'Search shortcut',
  });

  return (
    <>
      <button type="button" className="my-field" {...getHandleProps()}>
        {state.keycaps.map((cap) => (
          <kbd key={cap}>{cap}</kbd>
        ))}
      </button>
      <span className="my-hint" {...getStatusProps()}>
        {state.status}
      </span>
    </>
  );
}
```

Controlled and uncontrolled both work, by the usual React rule. Pass `value` and
you own the shortcut — the hook reports commits through `onChange` and never
changes `value` itself:

```tsx
const [shortcut, setShortcut] = useState('Mod+K');
useShortcutRecorder({ value: shortcut, onChange: setShortcut });
```

Pass `defaultValue`, or nothing, and the recorder keeps the shortcut internally.

`<ShortcutRecorder>` is the same thing as a render-prop component. It renders
exactly what you return and adds no wrapper element.

## API

The six operations the architecture declares:

| export | operation | what it is |
|---|---|---|
| `normalizeShortcut(input)` | `NormalizeShortcut` | chord + platform → portable `Shortcut` |
| `formatShortcut(input)` | `FormatShortcut` | shortcut + platform → `{ text }` |
| `assessShortcut(input)` | `AssessShortcut` | → `{ shortcut, conflict?, reserved }` |
| `recorder.start()` | `StartRecording` | → `RecordingState` |
| `recorder.cancel()` | `CancelRecording` | → `RecordingState` |
| `recorder.commitChord(input)` | `CommitChord` | → `Assessment` |

The first three are pure functions and stand alone; the last three are the
recording lifecycle, so they live on a recorder instance.

Everything else is convenience over those:

| export | what it is |
|---|---|
| `createShortcutRecorder(options)` | the recording lifecycle as a subscribable store |
| `keycapLabels(shortcut, platform?)` | one label per cap, rather than joined |
| `canonicalizeShortcut` / `parseShortcut` / `shortcutsEqual` | shortcut identity |
| `isReservedShortcut` / `reservedShortcuts` | the recognized browser-reserved set |
| `ariaKeyShortcuts(shortcut, platform?)` | the `aria-keyshortcuts` spelling |
| `detectPlatform()` / `hasDom()` | ambient environment, safely |
| `useShortcutRecorder` / `ShortcutRecorder` | from `@avlon/shortcut-recorder/react` |

A declared operation takes its platform as input, because the architecture says
so. Where a convenience makes `platform` optional it defaults to
`detectPlatform()`, which answers `'other'` when there is no `navigator` to ask.

## Architecture

This package is implemented against a Continuum development package in
[`continuum/`](continuum/). The semantic model
(`continuum/model/shortcut-recorder.adl`) is the authority for what the code
means; `continuum/IMPLEMENTATION.md` is the contract, and
`continuum/acceptance/` holds the executable scenarios that prove it. Decisions the model does not declare are recorded in `continuum/gaps/` rather
than made silently, and closed by an architecture change under
`continuum/changes/` rather than by drifting the code away from the model.

```sh
npm run verify      # build, typecheck, unit tests, then the acceptance scenarios
npm test            # unit tests
npm run acceptance  # build, then the acceptance scenarios against dist/
npm run demo        # the demo page, watched and served on :5173
```

## Contributing

`npm run verify` is the gate. The demo under [`demo/`](demo/) has its own
[README](demo/README.md) and is covered by `tests/demo.test.tsx`.

An architectural change goes through the model rather than around it: pin the
current checkpoint (`continuum ledger current continuum`), author an
`.adl-change`, and let the toolchain prove it applies. Decisions the model does
not declare belong in `continuum/gaps/`, not in a code comment.

## License

MIT

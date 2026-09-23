import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  detectPlatform,
  isModifierKey,
  normalizeShortcut,
  rawChordFromEvent,
  shortcutsEqual,
} from '../../dist/index.js';
import type { ExistingBinding, Platform, Shortcut } from '../../dist/index.js';
import { useShortcutRecorder } from '../../dist/react/index.js';
import { MiniApp } from './MiniApp.js';
import type { Command, MiniAppApi } from './MiniApp.js';

const INITIAL: Command[] = [
  { id: 'palette', label: 'Command palette', shortcut: 'Mod+Shift+P' },
  { id: 'search', label: 'Quick search', shortcut: 'Mod+K' },
  { id: 'save', label: 'Save', shortcut: 'Mod+S' },
  { id: 'new', label: 'New document', shortcut: 'Mod+Alt+N' },
  { id: 'sidebar', label: 'Toggle sidebar', shortcut: 'Mod+B' },
  { id: 'comment', label: 'Add comment', shortcut: 'Mod+Alt+M' },
];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'macos', label: 'macOS' },
  { value: 'other', label: 'Windows / Linux' },
];

export function App() {
  // What the keycaps *read* as — a preview the visitor can flip.
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  // What the keyboard *is*. Dispatch has to use this, or a visitor previewing
  // macOS on a PC would have to press a key their keyboard does not have.
  const realPlatform = useMemo(detectPlatform, []);

  const [commands, setCommands] = useState<Command[]>(INITIAL);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const app = useRef<MiniAppApi | null>(null);

  const assign = (id: string, shortcut: Shortcut | null) =>
    setCommands((current) => current.map((c) => (c.id === id ? { ...c, shortcut } : c)));

  useDispatch({
    commands,
    platform: realPlatform,
    // While a recorder is listening, the keyboard belongs to it.
    enabled: recordingId === null,
    onFire: (command) => {
      const api = app.current;
      if (!api) return;
      const action = {
        palette: api.openPalette,
        search: api.openSearch,
        save: api.save,
        new: api.newDoc,
        sidebar: api.toggleSidebar,
        comment: api.addComment,
      }[command.id];
      action?.();
    },
  });

  return (
    <div className="page">
      <header>
        <h1>@avlon/shortcut-recorder</h1>
        <p className="lede">
          Capture user-defined keyboard shortcuts, normalize them into one portable value, render
          readable keycaps, and report assignment problems — without imposing a visual style or a UI
          framework.
        </p>
        <nav className="links">
          <a href="https://github.com/avlon-technologies/shortcut-recorder">GitHub</a>
          <a href="https://www.npmjs.com/package/@avlon/shortcut-recorder">npm</a>
          <a href="https://github.com/avlon-technologies/shortcut-recorder#readme">Docs</a>
        </nav>
      </header>

      <section>
        <h2>A real app</h2>
        <div className="panel">
          <MiniApp commands={commands} platform={platform} apiRef={app} />
        </div>
        <p className="caption">
          A real editor, driven entirely by the shortcuts below. Toggle the sidebar, open the
          palette, save, add a document or a comment — then rebind one and it takes effect
          immediately. Matching is the application's job, not the library's: the package records
          shortcuts and never listens for them, and the nine lines that do the listening are in the
          code at the bottom of this page. Dispatch uses your <em>real</em> platform, so the
          platform switch below changes how shortcuts read without changing which keys fire them.
        </p>
      </section>

      <section>
        <h2>…and you rebind them here</h2>
        <div className="panel bindings">
          <div className="switch">
            <span className="label">Pretend I am on</span>
            <div className="seg" role="group" aria-label="Platform">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={platform === p.value}
                  onClick={() => setPlatform(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="label">— the stored value never changes, only how it reads.</span>
          </div>

          {commands.map((command) => (
            <BindingRow
              key={command.id}
              command={command}
              commands={commands}
              platform={platform}
              onAssign={assign}
              onRecordingChange={(recording) => setRecordingId(recording ? command.id : null)}
            />
          ))}
        </div>
        <p className="caption">
          Focus a shortcut and press <kbd>Enter</kbd> to record, then any combination. Escape cancels
          and leaves the old value alone. Try assigning two commands the same shortcut, or something
          the browser keeps for itself like <kbd>Ctrl</kbd> <kbd>T</kbd> — every shortcut here drives
          the app above, so a reserved one is the only way to get a warning.
        </p>
      </section>

      <section>
        <h2>All of the above, in code</h2>
        <div className="panel">
          <pre>
            <code>{SAMPLE}</code>
          </pre>
        </div>
        <p className="caption">
          Every class name on this page is the demo's. The package ships no CSS and renders no
          element of its own.
        </p>
      </section>

      <footer>
        MIT licensed. Built against a{' '}
        <a href="https://github.com/avlon-technologies/shortcut-recorder/tree/main/continuum">
          Continuum architecture package
        </a>
        , so what the code means is written down and checked.
      </footer>
    </div>
  );
}

/**
 * Fire a command when its shortcut is pressed.
 *
 * This is the piece the package deliberately does not ship: it records
 * shortcuts and never listens for them. Matching is nine lines because
 * `normalizeShortcut` already turns a live event into the same portable value
 * the recorder stored, and `shortcutsEqual` compares them by identity.
 */
function useDispatch({
  commands,
  platform,
  enabled,
  onFire,
}: {
  commands: Command[];
  platform: Platform;
  enabled: boolean;
  onFire: (command: Command) => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isModifierKey(event.key)) return;

      // Typing in a field is typing, not a shortcut — unless a modifier is
      // held. Any real dispatcher needs this; it is not the library's job.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable === true ||
        /^(input|textarea|select)$/i.test(target?.tagName ?? '');
      if (typing && !event.ctrlKey && !event.metaKey && !event.altKey) return;

      let pressed: Shortcut;
      try {
        pressed = normalizeShortcut({ chord: rawChordFromEvent(event), platform });
      } catch {
        return; // not a shortcut the vocabulary can express
      }

      const hit = commands.find((c) => c.shortcut !== null && shortcutsEqual(c.shortcut, pressed));
      if (!hit) return;

      event.preventDefault();
      onFire(hit);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands, platform, enabled, onFire]);
}

/**
 * A short-lived note under a row.
 *
 * Recording a shortcut onto a row that already holds it changes nothing on
 * screen, so without this the keypress reads as rejected. Every settled
 * recording says so, whether or not the value moved.
 */
function useNote(ms = 1600): [string | null, (text: string) => void] {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback(
    (text: string) => {
      setNote(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNote(null), ms);
    },
    [ms],
  );

  return [note, show];
}

function BindingRow({
  command,
  commands,
  platform,
  onAssign,
  onRecordingChange,
}: {
  command: Command;
  commands: Command[];
  platform: Platform;
  onAssign: (id: string, shortcut: Shortcut | null) => void;
  onRecordingChange: (recording: boolean) => void;
}) {
  // Every other assigned command, named by its label so a collision reads well.
  // A binding is never in its own `existing`, or it would collide with itself.
  const existing = useMemo<ExistingBinding[]>(
    () =>
      commands
        .filter((c) => c.id !== command.id && c.shortcut !== null)
        .map((c) => ({ id: c.label, shortcut: c.shortcut as Shortcut })),
    [commands, command.id],
  );

  const [note, showNote] = useNote();

  const { state, getHandleProps, getStatusProps, clear } = useShortcutRecorder({
    value: command.shortcut,
    existing,
    platform,
    label: `Shortcut for ${command.label}`,
    onRecordingChange,
    onChange: (shortcut) => {
      onAssign(command.id, shortcut);
      // `shortcut === command.shortcut` means the user re-recorded what was
      // already there — still a successful recording, and it must look like one.
      showNote(
        shortcut === null ? 'cleared' : shortcut === command.shortcut ? 'unchanged' : 'saved',
      );
    },
    onCancel: () => showNote('cancelled'),
  });

  const { conflict, reserved } = state.assessment ?? { conflict: undefined, reserved: false };

  return (
    <div className="row">
      <div className="name">{command.label}</div>

      <div className="control">
        {/* getHandleProps carries behaviour and ARIA only — the look is ours. */}
        <button type="button" className="recorder" {...getHandleProps()}>
          {state.keycaps.length > 0 ? (
            state.keycaps.map((cap, i) => <kbd key={i}>{cap}</kbd>)
          ) : (
            <span className="hint">{state.recording ? 'Press a shortcut…' : 'Not set'}</span>
          )}
        </button>
        <button
          type="button"
          className="clear"
          onClick={clear}
          aria-label={`Clear the shortcut for ${command.label}`}
          title="Clear"
        >
          ×
        </button>
      </div>

      <div className="portable">
        {state.value === null ? 'no shortcut assigned' : `stored as ${state.value}`}
        {note && (
          <span className={`note-flash ${note === 'cancelled' ? 'muted' : 'ok'}`}> · {note}</span>
        )}
      </div>

      {conflict && (
        <div className="note conflict">Already assigned to &ldquo;{conflict.bindingId}&rdquo;.</div>
      )}
      {reserved && (
        <div className="note reserved">
          The browser keeps this shortcut for itself — your page may never see it.
        </div>
      )}

      <span className="sr-only" {...getStatusProps()}>
        {state.status}
      </span>
    </div>
  );
}

const SAMPLE = `import { useShortcutRecorder } from '@avlon/shortcut-recorder/react';

// 1. Record a shortcut — the library's job.
function ShortcutField({ command, otherBindings, platform, onAssign }) {
  const { state, getHandleProps, getStatusProps } = useShortcutRecorder({
    value: command.shortcut,          // controlled — you own the value
    existing: otherBindings,          // what a collision would collide with
    platform,                         // 'macos' | 'other'
    label: \`Shortcut for \${command.label}\`,
    onChange: (shortcut) => onAssign(command.id, shortcut),
  });

  const { conflict, reserved } = state.assessment ?? {};

  return (
    <>
      <button type="button" className="your-styles" {...getHandleProps()}>
        {state.keycaps.map((cap, i) => <kbd key={i}>{cap}</kbd>)}
      </button>

      {conflict && <p>Already assigned to "{conflict.bindingId}".</p>}
      {reserved && <p>The browser keeps this shortcut for itself.</p>}

      <span className="sr-only" {...getStatusProps()}>{state.status}</span>
    </>
  );
}

// 2. Fire it — your job. The library never listens for keys.
import { normalizeShortcut, rawChordFromEvent, shortcutsEqual, isModifierKey }
  from '@avlon/shortcut-recorder';

window.addEventListener('keydown', (event) => {
  if (event.repeat || isModifierKey(event.key)) return;

  const pressed = normalizeShortcut({ chord: rawChordFromEvent(event), platform });
  const hit = commands.find((c) => c.shortcut && shortcutsEqual(c.shortcut, pressed));

  if (hit) { event.preventDefault(); run(hit); }
});`;

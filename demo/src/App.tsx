import { useMemo, useState } from 'react';

import { detectPlatform } from '../../dist/index.js';
import type { ExistingBinding, Platform, Shortcut } from '../../dist/index.js';
import { useShortcutRecorder } from '../../dist/react/index.js';

/** One row of the settings panel. The demo's own shape, not the package's. */
interface Command {
  id: string;
  label: string;
  shortcut: Shortcut | null;
}

const INITIAL: Command[] = [
  { id: 'palette', label: 'Command palette', shortcut: 'Mod+Shift+P' },
  { id: 'search', label: 'Quick search', shortcut: 'Mod+K' },
  { id: 'save', label: 'Save', shortcut: 'Mod+S' },
  { id: 'new', label: 'New document', shortcut: 'Mod+N' },
  { id: 'sidebar', label: 'Toggle sidebar', shortcut: 'Mod+B' },
  { id: 'comment', label: 'Add comment', shortcut: 'Mod+Alt+M' },
];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'macos', label: 'macOS' },
  { value: 'other', label: 'Windows / Linux' },
];

export function App() {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const [commands, setCommands] = useState<Command[]>(INITIAL);

  const assign = (id: string, shortcut: Shortcut | null) =>
    setCommands((current) => current.map((c) => (c.id === id ? { ...c, shortcut } : c)));

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
          <a href="https://github.com/mikekangdev/shortcut-recorder">GitHub</a>
          <a href="https://www.npmjs.com/package/@avlon/shortcut-recorder">npm</a>
          <a href="https://github.com/mikekangdev/shortcut-recorder#readme">Docs</a>
        </nav>
      </header>

      <section>
        <h2>Try it</h2>
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
            />
          ))}
        </div>
        <p className="caption">
          Focus a shortcut and press <kbd>Enter</kbd> to record, then any combination. Escape cancels
          and leaves the old value alone. Try assigning two commands the same shortcut, or something
          the browser keeps for itself like <kbd>Ctrl</kbd> <kbd>T</kbd>.
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
        <a href="https://github.com/mikekangdev/shortcut-recorder/tree/main/continuum">
          Continuum architecture package
        </a>
        , so what the code means is written down and checked.
      </footer>
    </div>
  );
}

function BindingRow({
  command,
  commands,
  platform,
  onAssign,
}: {
  command: Command;
  commands: Command[];
  platform: Platform;
  onAssign: (id: string, shortcut: Shortcut | null) => void;
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

  const { state, getHandleProps, getStatusProps, clear } = useShortcutRecorder({
    value: command.shortcut,
    existing,
    platform,
    label: `Shortcut for ${command.label}`,
    onChange: (shortcut) => onAssign(command.id, shortcut),
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

      {state.value !== null && <div className="portable">stored as {state.value}</div>}

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

function ShortcutField({ command, otherBindings, platform, onAssign }) {
  const { state, getHandleProps, getStatusProps, clear } = useShortcutRecorder({
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
}`;

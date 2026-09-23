import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import { keycapLabels } from '../../dist/index.js';
import type { Platform, Shortcut } from '../../dist/index.js';

/** A command the pretend application can run. */
export interface Command {
  id: string;
  label: string;
  shortcut: Shortcut | null;
}

interface Doc {
  id: number;
  title: string;
  body: string;
}

const FIRST_DOC: Doc = {
  id: 1,
  title: 'Welcome',
  body: 'Every shortcut in the panel above runs against this editor.\n\nChange one and it takes effect immediately — the bindings are the ones you just recorded, not a fixed list.',
};

/**
 * A small application the recorded shortcuts actually drive.
 *
 * Nothing here is the library's: it is an ordinary editor mock. It exists
 * because a demo that only prints "Save fired" is not a demonstration that
 * anything works — it is a label. Each command does the thing it names.
 */
export function MiniApp({
  commands,
  platform,
  apiRef,
}: {
  commands: Command[];
  platform: Platform;
  /** Filled in with the live action set, so dispatch acts on current state. */
  apiRef: MutableRefObject<MiniAppApi | null>;
}) {
  const [docs, setDocs] = useState<Doc[]>([FIRST_DOC]);
  const [activeId, setActiveId] = useState(FIRST_DOC.id);
  const [dirty, setDirty] = useState(false);
  const [comments, setComments] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overlay, setOverlay] = useState<'palette' | 'search' | null>(null);
  const [filter, setFilter] = useState('');

  const active = docs.find((d) => d.id === activeId) ?? docs[0]!;

  const api: MiniAppApi = {
    openPalette: () => {
      setFilter('');
      setOverlay('palette');
    },
    openSearch: () => {
      setFilter('');
      setOverlay('search');
    },
    save: () => setDirty(false),
    newDoc: () =>
      setDocs((current) => {
        const id = Math.max(...current.map((d) => d.id)) + 1;
        setActiveId(id);
        setDirty(true);
        return [...current, { id, title: `Untitled ${id}`, body: '' }];
      }),
    toggleSidebar: () => setSidebarOpen((open) => !open),
    addComment: () => setComments((c) => [...c, `Comment ${c.length + 1} on “${active.title}”`]),
  };

  // Republish the action set after every render, so a shortcut fired later
  // acts on current state rather than on a closure captured at mount.
  useEffect(() => {
    apiRef.current = api;
  });

  // Escape closes an overlay. The recorder owns Escape only while recording,
  // and dispatch is suspended then, so the two never contend.
  useEffect(() => {
    if (overlay === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOverlay(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);

  return (
    <div className="app">
      {sidebarOpen && (
        <aside className="app-sidebar">
          <p className="app-heading">Documents</p>
          <ul>
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className={doc.id === activeId ? 'doc current' : 'doc'}
                  onClick={() => setActiveId(doc.id)}
                >
                  {doc.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div className="app-main">
        <div className="app-bar">
          <strong>{active.title}</strong>
          <span className={dirty ? 'state dirty' : 'state saved'}>
            {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
        </div>

        <textarea
          className="app-editor"
          aria-label={`Body of ${active.title}`}
          value={active.body}
          onChange={(e) => {
            const body = e.target.value;
            setDocs((current) => current.map((d) => (d.id === activeId ? { ...d, body } : d)));
            setDirty(true);
          }}
        />

        {comments.length > 0 && (
          <ul className="app-comments">
            {comments.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}

        {overlay !== null && (
          <Overlay
            mode={overlay}
            commands={commands}
            platform={platform}
            docs={docs}
            filter={filter}
            onFilter={setFilter}
            onPickDoc={(id) => {
              setActiveId(id);
              setOverlay(null);
            }}
            onClose={() => setOverlay(null)}
          />
        )}
      </div>
    </div>
  );
}

/** What a shortcut can do to the pretend application. */
export interface MiniAppApi {
  openPalette(): void;
  openSearch(): void;
  save(): void;
  newDoc(): void;
  toggleSidebar(): void;
  addComment(): void;
}

function Overlay({
  mode,
  commands,
  platform,
  docs,
  filter,
  onFilter,
  onPickDoc,
  onClose,
}: {
  mode: 'palette' | 'search';
  commands: Command[];
  platform: Platform;
  docs: Doc[];
  filter: string;
  onFilter: (value: string) => void;
  onPickDoc: (id: number) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), [mode]);

  const matches = (text: string) => text.toLowerCase().includes(filter.trim().toLowerCase());

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={
      mode === 'palette' ? 'Command palette' : 'Search documents'
    }>
      <input
        ref={input}
        className="overlay-input"
        placeholder={mode === 'palette' ? 'Run a command…' : 'Find a document…'}
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
      />

      <ul className="overlay-list">
        {mode === 'palette'
          ? commands.filter((c) => matches(c.label)).map((c) => (
              <li key={c.id}>
                <span>{c.label}</span>
                <span className="overlay-keys">
                  {c.shortcut === null ? (
                    <em className="muted">unassigned</em>
                  ) : (
                    keycapLabels(c.shortcut, platform).map((cap, i) => <kbd key={i}>{cap}</kbd>)
                  )}
                </span>
              </li>
            ))
          : docs.filter((d) => matches(d.title)).map((d) => (
              <li key={d.id}>
                <button type="button" className="overlay-pick" onClick={() => onPickDoc(d.id)}>
                  {d.title}
                </button>
              </li>
            ))}
      </ul>

      <p className="overlay-foot">
        <kbd>Esc</kbd> to close
        {mode === 'palette' && ' — the keycaps here come from the same shortcuts you recorded'}
      </p>
      <button type="button" className="sr-only" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

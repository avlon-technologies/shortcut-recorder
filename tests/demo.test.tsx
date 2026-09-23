// @vitest-environment jsdom
/**
 * The published demo, driven.
 *
 * `demo/src/App.tsx` imports the package through `dist/`, so this exercises the
 * same files npm ships and GitHub Pages serves — a regression guard on the page
 * people will actually open, not on a stand-in for it.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../demo/src/App.js';

afterEach(cleanup);

/**
 * The settings panel only. The page also shows a code sample containing the
 * same sentences, so an unscoped text query would match the documentation
 * instead of the running thing.
 */
function bindings(view: RenderResult): HTMLElement {
  return view.container.querySelector('.bindings') as HTMLElement;
}

/** The recorder control belonging to a named command row. */
function recorderFor(label: string): HTMLElement {
  return screen.getByLabelText(`Shortcut for ${label}`);
}

function rowFor(label: string): HTMLElement {
  return recorderFor(label).closest('.row') as HTMLElement;
}

function capsFor(label: string): string[] {
  return [...recorderFor(label).querySelectorAll('kbd')].map((k) => k.textContent ?? '');
}

/** The overlay the palette and search commands open, if one is open. */
function overlay(): HTMLElement | null {
  return document.querySelector('.overlay');
}

/** What the editor's status bar reports — 'Saved' or 'Unsaved changes'. */
function saveState(): string {
  return document.querySelector('.app-bar .state')?.textContent ?? '';
}

/** The documents the editor currently holds, by title. */
function docTitles(): string[] {
  return [...document.querySelectorAll('.app-sidebar .doc')].map((b) => b.textContent ?? '');
}

/** Record a chord into a command's recorder the way a keyboard user would. */
function record(label: string, chord: Record<string, unknown>): void {
  const control = recorderFor(label);
  fireEvent.keyDown(control, { key: 'Enter' });
  fireEvent.keyDown(control, chord);
}

describe('the demo page renders', () => {
  it('shows every command with its shortcut', () => {
    render(<App />);

    for (const label of [
      'Command palette',
      'Quick search',
      'Save',
      'New document',
      'Toggle sidebar',
      'Add comment',
    ]) {
      expect(recorderFor(label)).toBeTruthy();
    }
  });

  it('shows the portable value alongside the keycaps', () => {
    render(<App />);
    expect(within(rowFor('Quick search')).getByText(/stored as Mod\+K/)).toBeTruthy();
  });

  it('ships no binding the browser would swallow', () => {
    // A default the browser eats could never fire, and a demo must never look
    // broken. Reserved shortcuts are discoverable by recording one instead.
    const view = render(<App />);
    expect(within(bindings(view)).queryByText(/browser keeps this shortcut/i)).toBeNull();
  });

  it('starts with no conflicts', () => {
    const view = render(<App />);
    expect(within(bindings(view)).queryByText(/Already assigned to/)).toBeNull();
  });
});

describe('the platform switch — Requirement PortableModifier', () => {
  it('re-reads every shortcut without changing any stored value', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'macOS' }));
    expect(capsFor('Quick search')).toEqual(['Command', 'K']);
    expect(capsFor('Add comment')).toEqual(['Command', 'Option', 'M']);

    fireEvent.click(screen.getByRole('button', { name: 'Windows / Linux' }));
    expect(capsFor('Quick search')).toEqual(['Ctrl', 'K']);
    expect(capsFor('Add comment')).toEqual(['Ctrl', 'Alt', 'M']);

    // The stored value is the same shortcut throughout.
    expect(within(rowFor('Quick search')).getByText(/stored as Mod\+K/)).toBeTruthy();
  });
});

describe('recording in the demo', () => {
  it('assigns a new shortcut and keeps it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Windows / Linux' }));

    record('Save', { key: 'J', code: 'KeyJ', ctrlKey: true, altKey: true });

    expect(capsFor('Save')).toEqual(['Ctrl', 'Alt', 'J']);
    expect(within(rowFor('Save')).getByText(/stored as Mod\+Alt\+J/)).toBeTruthy();
  });

  it('reports a collision, naming the command it collides with', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Windows / Linux' }));

    // Take the shortcut Quick search already has.
    record('Save', { key: 'K', code: 'KeyK', ctrlKey: true });

    expect(within(rowFor('Save')).getByText('Already assigned to “Quick search”.')).toBeTruthy();
    expect(recorderFor('Save').getAttribute('aria-invalid')).toBe('true');
  });

  it('warns when the user records something the browser owns', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Windows / Linux' }));

    record('Save', { key: 'T', code: 'KeyT', ctrlKey: true });

    expect(within(rowFor('Save')).getByText(/browser keeps this shortcut/i)).toBeTruthy();
  });

  it('cancels on Escape without disturbing the stored value', () => {
    render(<App />);

    const control = recorderFor('Quick search');
    fireEvent.keyDown(control, { key: 'Enter' });
    expect(control.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(control, { key: 'Escape' });

    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(within(rowFor('Quick search')).getByText(/stored as Mod\+K/)).toBeTruthy();
  });

  it('clears a shortcut, and the cleared one stops colliding', () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Windows / Linux' }));

    fireEvent.click(screen.getByLabelText('Clear the shortcut for Quick search'));
    expect(capsFor('Quick search')).toEqual([]);
    expect(within(rowFor('Quick search')).getByText('Not set')).toBeTruthy();

    // Mod+K is free now, so taking it raises nothing.
    record('Save', { key: 'K', code: 'KeyK', ctrlKey: true });
    expect(within(bindings(view)).queryByText(/Already assigned to/)).toBeNull();
  });
});

describe('the shortcuts actually fire', () => {
  it('runs the matching command on a bare keypress, with nothing focused', () => {
    render(<App />);
    expect(overlay()).toBeNull();

    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });

    // Mod+K is Quick search, and Quick search opens the search overlay.
    expect(screen.getByRole('dialog', { name: 'Search documents' })).toBeTruthy();
  });

  it('toggles the sidebar on the shortcut assigned to it', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.app-sidebar')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'b', code: 'KeyB', ctrlKey: true });
    expect(container.querySelector('.app-sidebar')).toBeNull();

    fireEvent.keyDown(window, { key: 'b', code: 'KeyB', ctrlKey: true });
    expect(container.querySelector('.app-sidebar')).toBeTruthy();
  });

  it('fires the shortcut a user just recorded', () => {
    render(<App />);
    record('Save', { key: 'J', code: 'KeyJ', ctrlKey: true, altKey: true });

    // Saving is only observable against an unsaved document, so make one.
    fireEvent.change(screen.getByLabelText('Body of Welcome'), { target: { value: 'edited' } });
    expect(saveState()).toBe('Unsaved changes');

    fireEvent.keyDown(window, { key: 'j', code: 'KeyJ', ctrlKey: true, altKey: true });
    expect(saveState()).toBe('Saved');
  });

  it('does not fire while a recorder is listening — the keyboard is its', () => {
    const { container } = render(<App />);
    const sidebarBefore = container.querySelector('.app-sidebar');

    // Start recording on an unrelated row, then press the sidebar shortcut.
    fireEvent.keyDown(recorderFor('Save'), { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'b', code: 'KeyB', ctrlKey: true });

    expect(!!container.querySelector('.app-sidebar')).toBe(!!sidebarBefore);
  });

  it('ignores a chord nothing is bound to', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'q', code: 'KeyQ', ctrlKey: true, altKey: true });

    // Nothing the application can do has happened: no overlay, no new
    // document, and the editor is where it started.
    expect(overlay()).toBeNull();
    expect(docTitles()).toEqual(['Welcome']);
    expect(saveState()).toBe('Saved');
  });
});

describe('a settled recording always says so', () => {
  it('acknowledges a re-record of the value already held', () => {
    render(<App />);
    // The row already holds Mod+B; without a note this looks like a rejection.
    record('Toggle sidebar', { key: 'b', code: 'KeyB', ctrlKey: true });
    expect(within(rowFor('Toggle sidebar')).getByText(/unchanged/)).toBeTruthy();
  });

  it('acknowledges a new value, a clear, and a cancel', () => {
    render(<App />);

    record('Save', { key: 'J', code: 'KeyJ', ctrlKey: true, altKey: true });
    expect(within(rowFor('Save')).getByText(/saved/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Clear the shortcut for Quick search'));
    expect(within(rowFor('Quick search')).getByText(/cleared/)).toBeTruthy();

    const control = recorderFor('Add comment');
    fireEvent.keyDown(control, { key: 'Enter' });
    fireEvent.keyDown(control, { key: 'Escape' });
    expect(within(rowFor('Add comment')).getByText(/cancelled/)).toBeTruthy();
  });
});

describe('the demo stays headless', () => {
  it('uses only its own class names — the package contributes none', () => {
    const { container } = render(<App />);
    expect(container.querySelector('style')).toBeNull();

    const control = recorderFor('Quick search');
    expect(control.getAttribute('class')).toBe('recorder');
  });

  it('gives every recorder an accessible name and a live region', () => {
    render(<App />);
    const row = rowFor('Quick search');

    expect(recorderFor('Quick search').getAttribute('aria-keyshortcuts')).toBeTruthy();
    expect(row.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });
});

// Deliberately NOT jsdom: this file runs where a browser global would throw,
// which is the whole claim of `Requirement ServerRenderingSafe`.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ShortcutRecorder, useShortcutRecorder } from '../src/react/index.js';

function Field(props: { value?: string | null; defaultValue?: string | null }) {
  return (
    <ShortcutRecorder platform="macos" label="Search shortcut" {...props}>
      {({ state, getHandleProps, getStatusProps }) => (
        <>
          <div {...getHandleProps()}>
            {state.keycaps.map((cap, i) => (
              <kbd key={i}>{cap}</kbd>
            ))}
          </div>
          <span {...getStatusProps()}>{state.status}</span>
        </>
      )}
    </ShortcutRecorder>
  );
}

describe('Requirement ServerRenderingSafe', () => {
  it('runs in a context with no browser globals at all', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('imports the core and the React integration without them', async () => {
    await expect(import('../src/index.js')).resolves.toBeDefined();
    await expect(import('../src/react/index.js')).resolves.toBeDefined();
  });

  it('renders a recorder to markup on the server', () => {
    const html = renderToStaticMarkup(<Field defaultValue="Mod+Shift+P" />);

    expect(html).toContain('<kbd>Command</kbd>');
    expect(html).toContain('<kbd>Shift</kbd>');
    expect(html).toContain('<kbd>P</kbd>');
    expect(html).toContain('aria-keyshortcuts="Meta+Shift+P"');
    expect(html).toContain('aria-label="Search shortcut"');
    expect(html).toContain('role="status"');
  });

  it('renders a controlled recorder from the caller’s value', () => {
    expect(renderToStaticMarkup(<Field value="Mod+K" />)).toContain('<kbd>K</kbd>');
  });

  it('emits no style or class of its own', () => {
    const html = renderToStaticMarkup(<Field defaultValue="Mod+K" />);
    expect(html).not.toContain('class=');
    expect(html).not.toContain('style=');
  });

  it('falls back to the non-macOS platform when nothing can be detected', async () => {
    const { detectPlatform } = await import('../src/index.js');
    expect(detectPlatform()).toBe('other');
  });

  it('does not require a framework to use the core', async () => {
    const core = await import('../src/index.js');
    const shortcut = core.normalizeShortcut({
      chord: { key: 'P', control: false, alt: false, shift: true, meta: true },
      platform: 'macos',
    });
    expect(shortcut).toBe('Mod+Shift+P');
    expect(core.formatShortcut({ shortcut, platform: 'macos' }).text).toBe('Command + Shift + P');
  });
});

describe('the hook itself is importable on a server', () => {
  it('is a function, not something that needed a DOM to define', () => {
    expect(typeof useShortcutRecorder).toBe('function');
  });
});

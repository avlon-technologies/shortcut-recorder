import { describe, expect, it } from 'vitest';

import { ariaKeyShortcuts, formatShortcut, keycapLabels } from '../src/index.js';

describe('keycaps — Requirement PrettyKeycaps', () => {
  it('names the macOS caps the way the platform does', () => {
    expect(keycapLabels('Mod+Shift+P', 'macos')).toEqual(['Command', 'Shift', 'P']);
    expect(keycapLabels('Mod+Alt+K', 'macos')).toEqual(['Command', 'Option', 'K']);
    expect(keycapLabels('Ctrl+K', 'macos')).toEqual(['Control', 'K']);
  });

  it('names the same shortcut differently elsewhere', () => {
    expect(keycapLabels('Mod+Shift+P', 'other')).toEqual(['Ctrl', 'Shift', 'P']);
    expect(keycapLabels('Mod+Alt+K', 'other')).toEqual(['Ctrl', 'Alt', 'K']);
  });

  it('reads named keys as keycaps, not as event names', () => {
    expect(keycapLabels('Mod+ArrowUp', 'other')).toEqual(['Ctrl', 'Up']);
    expect(keycapLabels('Mod+PageDown', 'other')).toEqual(['Ctrl', 'Page Down']);
    expect(keycapLabels('Escape', 'macos')).toEqual(['Esc']);
    expect(keycapLabels('Enter', 'macos')).toEqual(['Return']);
    expect(keycapLabels('Enter', 'other')).toEqual(['Enter']);
  });

  it('joins the caps into the KeycapDisplay record the model declares', () => {
    expect(formatShortcut('Mod+Shift+P', 'macos')).toEqual({ text: 'Command + Shift + P' });
    expect(formatShortcut('Mod+Shift+P', 'other')).toEqual({ text: 'Ctrl + Shift + P' });
  });

  it('accepts any spelling of the shortcut', () => {
    expect(formatShortcut('mod+shift+p', 'macos').text).toBe('Command + Shift + P');
  });
});

describe('ariaKeyShortcuts — the accessible interaction contract', () => {
  it('resolves Mod to the physical modifier ARIA understands', () => {
    expect(ariaKeyShortcuts('Mod+Shift+P', 'macos')).toBe('Meta+Shift+P');
    expect(ariaKeyShortcuts('Mod+Shift+P', 'other')).toBe('Control+Shift+P');
  });

  it('never emits the portable token, which ARIA has no meaning for', () => {
    expect(ariaKeyShortcuts('Mod+K', 'other')).not.toContain('Mod');
  });
});

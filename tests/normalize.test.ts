import { describe, expect, it } from 'vitest';

import {
  ShortcutError,
  canonicalizeShortcut,
  normalizeShortcut,
  parseShortcut,
  shortcutsEqual,
} from '../src/index.js';
import type { RawChord } from '../src/index.js';

/** A chord with nothing held, so each test states only what it presses. */
function chord(overrides: Partial<RawChord> & { key: string }): RawChord {
  return { control: false, alt: false, shift: false, meta: false, ...overrides };
}

describe('normalizeShortcut — Requirement PortableModifier', () => {
  it('maps Command to Mod on macOS', () => {
    expect(normalizeShortcut({ chord: chord({ key: 'P', meta: true, shift: true }), platform: 'macos' })).toBe(
      'Mod+Shift+P',
    );
  });

  it('maps Control to Mod on other platforms', () => {
    expect(normalizeShortcut({ chord: chord({ key: 'P', control: true, shift: true }), platform: 'other' })).toBe(
      'Mod+Shift+P',
    );
  });

  it('gives the same portable value for each platform’s Mod key', () => {
    const mac = normalizeShortcut({ chord: chord({ key: 'k', meta: true }), platform: 'macos' });
    const other = normalizeShortcut({ chord: chord({ key: 'k', control: true }), platform: 'other' });
    expect(mac).toBe('Mod+K');
    expect(other).toBe(mac);
  });

  it('keeps the modifier Mod did not consume', () => {
    // On macOS, Mod is Command — so Control keeps its own token.
    expect(normalizeShortcut({ chord: chord({ key: 'K', meta: true, control: true }), platform: 'macos' })).toBe(
      'Mod+Ctrl+K',
    );
    // On other platforms, Mod is Control — so Meta keeps its own token.
    expect(normalizeShortcut({ chord: chord({ key: 'K', control: true, meta: true }), platform: 'other' })).toBe(
      'Mod+Meta+K',
    );
  });

  it('emits modifiers in a canonical order regardless of how they were pressed', () => {
    const all = chord({ key: 'a', meta: true, control: true, alt: true, shift: true });
    expect(normalizeShortcut({ chord: all, platform: 'macos' })).toBe('Mod+Ctrl+Alt+Shift+A');
  });

  it('folds key case, so p and P are one shortcut', () => {
    const lower = normalizeShortcut({ chord: chord({ key: 'p', control: true }), platform: 'other' });
    const upper = normalizeShortcut({ chord: chord({ key: 'P', control: true }), platform: 'other' });
    expect(lower).toBe(upper);
  });

  it('normalizes named and function keys', () => {
    expect(normalizeShortcut({ chord: chord({ key: ' ' }), platform: 'other' })).toBe('Space');
    expect(normalizeShortcut({ chord: chord({ key: 'ArrowUp', shift: true }), platform: 'other' })).toBe(
      'Shift+ArrowUp',
    );
    expect(normalizeShortcut({ chord: chord({ key: 'f5' }), platform: 'other' })).toBe('F5');
  });

  it('refuses a chord that is only a modifier', () => {
    expect(() => normalizeShortcut({ chord: chord({ key: 'Shift', shift: true }), platform: 'other' })).toThrow(
      ShortcutError,
    );
  });
});

describe('parseShortcut', () => {
  it('accepts the spellings people write by hand', () => {
    expect(parseShortcut('command+shift+p')).toEqual({ modifiers: ['Meta', 'Shift'], key: 'P' });
    expect(parseShortcut('CmdOrCtrl+Esc')).toEqual({ modifiers: ['Mod'], key: 'Escape' });
    expect(parseShortcut(' mod + k ')).toEqual({ modifiers: ['Mod'], key: 'K' });
  });

  it('rejects text with no key', () => {
    expect(() => parseShortcut('Mod+Shift')).toThrow(/only modifiers/);
  });

  it('rejects a key sequence, which is out of scope for this package', () => {
    expect(() => parseShortcut('G+G+H')).toThrow(/more than one key/);
  });

  it('rejects empty text', () => {
    expect(() => parseShortcut('')).toThrow(ShortcutError);
  });
});

describe('canonicalizeShortcut — Shortcut is identity-bearing', () => {
  it('folds spelling, order and case onto one identity', () => {
    expect(canonicalizeShortcut('shift+mod+p')).toBe('Mod+Shift+P');
    expect(canonicalizeShortcut('MOD+K')).toBe('Mod+K');
  });

  it('is idempotent', () => {
    const once = canonicalizeShortcut('shift+mod+p');
    expect(canonicalizeShortcut(once)).toBe(once);
  });

  it('decides equality', () => {
    expect(shortcutsEqual('mod+k', 'Mod+K')).toBe(true);
    expect(shortcutsEqual('Mod+K', 'Mod+Shift+K')).toBe(false);
  });
});

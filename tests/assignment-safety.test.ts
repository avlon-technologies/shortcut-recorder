import { describe, expect, it } from 'vitest';

import { assessShortcut, isReservedShortcut, reservedShortcuts } from '../src/index.js';
import type { ExistingBinding } from '../src/index.js';

const existing: ExistingBinding[] = [
  { id: 'search', shortcut: 'Mod+K' },
  { id: 'palette', shortcut: 'Mod+Shift+P' },
];

describe('assessShortcut — Requirement CollisionDetection', () => {
  it('identifies the binding a candidate collides with', () => {
    const assessment = assessShortcut({ shortcut: 'Mod+K', existing, platform: 'macos' });
    expect(assessment.conflict).toEqual({ bindingId: 'search', shortcut: 'Mod+K' });
  });

  it('reports no conflict for an unassigned candidate', () => {
    const assessment = assessShortcut({ shortcut: 'Mod+J', existing, platform: 'macos' });
    expect(assessment.conflict).toBeUndefined();
    expect(assessment.shortcut).toBe('Mod+J');
  });

  it('matches on shortcut identity, not on spelling', () => {
    const assessment = assessShortcut({ shortcut: 'shift+mod+p', existing, platform: 'macos' });
    expect(assessment.conflict?.bindingId).toBe('palette');
    expect(assessment.shortcut).toBe('Mod+Shift+P');
  });

  it('reports the first colliding binding when several share a shortcut', () => {
    const duplicated: ExistingBinding[] = [
      { id: 'first', shortcut: 'Mod+K' },
      { id: 'second', shortcut: 'Mod+K' },
    ];
    expect(assessShortcut({ shortcut: 'Mod+K', existing: duplicated, platform: 'other' }).conflict?.bindingId).toBe(
      'first',
    );
  });

  it('collides with nothing when there is nothing assigned', () => {
    expect(assessShortcut({ shortcut: 'Mod+K', existing: [], platform: 'other' }).conflict).toBeUndefined();
  });
});

describe('assessShortcut — Requirement ReservedShortcutWarning', () => {
  it('warns about a recognized browser-reserved shortcut', () => {
    expect(assessShortcut({ shortcut: 'Mod+T', existing, platform: 'other' }).reserved).toBe(true);
  });

  it('does not warn about an ordinary shortcut', () => {
    expect(assessShortcut({ shortcut: 'Mod+Shift+P', existing, platform: 'other' }).reserved).toBe(false);
  });

  it('reports a conflict and a reservation independently', () => {
    const both = assessShortcut({
      shortcut: 'Mod+T',
      existing: [{ id: 'new-thing', shortcut: 'Mod+T' }],
      platform: 'other',
    });
    expect(both.reserved).toBe(true);
    expect(both.conflict?.bindingId).toBe('new-thing');
  });
});

describe('isReservedShortcut', () => {
  it('recognizes what the platform reserves', () => {
    expect(isReservedShortcut('Mod+Q', 'macos')).toBe(true);
    expect(isReservedShortcut('Mod+Q', 'other')).toBe(false);
    expect(isReservedShortcut('Alt+F4', 'other')).toBe(true);
    expect(isReservedShortcut('Alt+F4', 'macos')).toBe(false);
  });

  it('recognizes what every browser reserves, on both platforms', () => {
    for (const platform of ['macos', 'other'] as const) {
      expect(isReservedShortcut('Mod+T', platform)).toBe(true);
      expect(isReservedShortcut('Mod+W', platform)).toBe(true);
      expect(isReservedShortcut('Mod+Shift+N', platform)).toBe(true);
    }
  });

  it('matches on identity, so spelling does not let a reserved shortcut through', () => {
    expect(isReservedShortcut('t+mod', 'other')).toBe(true);
    expect(isReservedShortcut('ctrl+t', 'other')).toBe(false); // Ctrl is not the portable Mod
  });

  it('lists a platform’s recognized set in canonical form', () => {
    const list = reservedShortcuts('macos');
    expect(list).toContain('Mod+T');
    expect(new Set(list).size).toBe(list.length);
  });
});

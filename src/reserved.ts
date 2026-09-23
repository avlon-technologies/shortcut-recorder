import { canonicalizeShortcut } from './normalize.js';
import type { Platform, Shortcut } from './types.js';

/**
 * Shortcuts a browser keeps for itself on every supported platform.
 *
 * `BusinessRule ReservedWarning` speaks of a *recognized* browser-reserved
 * shortcut without declaring which ones are recognized. This table is the
 * implementation's recognition set, not an architectural claim — see
 * `gaps/2026-09-23-reserved-shortcut-set.md`. It is deliberately conservative:
 * every entry is a shortcut mainstream browsers act on before the page sees it,
 * so a page cannot take it over with `preventDefault`.
 */
const RESERVED_EVERYWHERE = [
  'Mod+N', // new window
  'Mod+Shift+N', // new private/incognito window
  'Mod+T', // new tab
  'Mod+Shift+T', // reopen closed tab
  'Mod+W', // close tab
  'Mod+Shift+W', // close window
  'Mod+L', // focus the address bar
  'Mod+Tab', // switch tab (Windows/Linux) or application (macOS)
];

const RESERVED_BY_PLATFORM: Record<Platform, string[]> = {
  macos: [
    'Mod+Q', // quit the browser
    'Mod+M', // minimize the window
    'Mod+H', // hide the application
    'Mod+Alt+I', // developer tools
  ],
  other: [
    'Mod+Shift+Q', // quit the browser
    'Alt+F4', // close the window
    'Mod+Shift+Delete', // clear browsing data
    'F11', // full screen
    'F12', // developer tools
  ],
};

const RESERVED: Record<Platform, ReadonlySet<Shortcut>> = {
  macos: buildSet('macos'),
  other: buildSet('other'),
};

/**
 * Whether `shortcut` is one of the browser-reserved shortcuts this package
 * recognizes on `platform`.
 *
 * Recognition is one-directional evidence: `true` means the browser is known to
 * claim the shortcut, `false` means only that this table does not list it.
 */
export function isReservedShortcut(shortcut: Shortcut, platform: Platform): boolean {
  return RESERVED[platform].has(canonicalizeShortcut(shortcut));
}

/** The recognized reserved shortcuts for `platform`, in canonical form. */
export function reservedShortcuts(platform: Platform): Shortcut[] {
  return [...RESERVED[platform]];
}

function buildSet(platform: Platform): ReadonlySet<Shortcut> {
  return new Set(
    [...RESERVED_EVERYWHERE, ...RESERVED_BY_PLATFORM[platform]].map(canonicalizeShortcut),
  );
}

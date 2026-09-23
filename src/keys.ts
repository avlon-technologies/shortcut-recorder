import { ShortcutError } from './errors.js';

/**
 * Modifier tokens of the portable shortcut grammar, in canonical order.
 *
 * `Mod` is the model's portable modifier (`BusinessRule ModMapping`). The rest
 * name the physical modifiers that `RawChord` declares and that `Mod` did not
 * already consume on the given platform.
 */
export const MODIFIER_ORDER = ['Mod', 'Meta', 'Ctrl', 'Alt', 'Shift'] as const;

export type Modifier = (typeof MODIFIER_ORDER)[number];

const MODIFIER_INDEX = new Map<string, number>(
  MODIFIER_ORDER.map((m, i) => [m.toLowerCase(), i]),
);

/** Accepted spellings for each canonical modifier token. */
const MODIFIER_ALIASES = new Map<string, Modifier>([
  ['mod', 'Mod'],
  ['cmdorctrl', 'Mod'],
  ['commandorcontrol', 'Mod'],
  ['meta', 'Meta'],
  ['cmd', 'Meta'],
  ['command', 'Meta'],
  ['super', 'Meta'],
  ['win', 'Meta'],
  ['ctrl', 'Ctrl'],
  ['control', 'Ctrl'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['opt', 'Alt'],
  ['shift', 'Shift'],
]);

/** `KeyboardEvent.key` values that are modifiers, not committable keys. */
const MODIFIER_KEYS = new Set([
  'Control',
  'Alt',
  'AltGraph',
  'Shift',
  'Meta',
  'OS',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
  'FnLock',
  'Hyper',
  'Super',
  'Symbol',
  'SymbolLock',
  'Dead',
  'Unidentified',
]);

/**
 * Canonical spellings for non-printable keys, keyed by lowercase input.
 * `KeyboardEvent.key` already uses these spellings; the table exists so that
 * hand-written shortcut text (`"mod+arrowup"`, `"Mod+esc"`) canonicalizes to
 * the same identity.
 */
const NAMED_KEYS = [
  'Enter',
  'Tab',
  'Space',
  'Backspace',
  'Delete',
  'Insert',
  'Escape',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Clear',
  'Help',
  'ContextMenu',
  'PrintScreen',
  'Pause',
];

const NAMED_KEY_LOOKUP = new Map<string, string>(NAMED_KEYS.map((k) => [k.toLowerCase(), k]));

/** Short spellings people actually type, mapped onto the canonical name. */
const KEY_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['esc', 'Escape'],
  ['return', 'Enter'],
  ['del', 'Delete'],
  ['ins', 'Insert'],
  ['spacebar', 'Space'],
  [' ', 'Space'],
  ['up', 'ArrowUp'],
  ['down', 'ArrowDown'],
  ['left', 'ArrowLeft'],
  ['right', 'ArrowRight'],
  ['pgup', 'PageUp'],
  ['pgdn', 'PageDown'],
  ['pagedn', 'PageDown'],
];

for (const [alias, canonical] of KEY_ALIASES) NAMED_KEY_LOOKUP.set(alias, canonical);

/** True when `key` (a `KeyboardEvent.key` value) is a modifier rather than a key. */
export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

/** Resolve a modifier spelling to its canonical token, or `null` if it is not one. */
export function asModifier(token: string): Modifier | null {
  return MODIFIER_ALIASES.get(token.toLowerCase()) ?? null;
}

/** Sort modifier tokens into {@link MODIFIER_ORDER}. */
export function sortModifiers(modifiers: Iterable<Modifier>): Modifier[] {
  return [...new Set(modifiers)].sort(
    (a, b) => (MODIFIER_INDEX.get(a.toLowerCase()) ?? 0) - (MODIFIER_INDEX.get(b.toLowerCase()) ?? 0),
  );
}

/**
 * Canonicalize the non-modifier key of a chord.
 *
 * Single characters fold to upper case so that `p` and `P` are one identity —
 * case is carried by the `Shift` modifier, never by the key token. F-keys
 * normalize to `F1`…`F24`; named keys normalize to their `KeyboardEvent.key`
 * spelling.
 */
export function normalizeKeyToken(key: string): string {
  const raw = key === ' ' ? 'Space' : key.trim();
  if (raw === '') throw new ShortcutError('a shortcut needs a key, but none was given');
  if (isModifierKey(raw)) {
    throw new ShortcutError(`"${raw}" is a modifier, not a key a shortcut can be assigned to`);
  }

  const lower = raw.toLowerCase();
  const named = NAMED_KEY_LOOKUP.get(lower);
  if (named) return named;

  const fKey = /^f([1-9]|1\d|2[0-4])$/.exec(lower);
  if (fKey) return `F${fKey[1]}`;

  // Single printable character (letter, digit or punctuation): upper case folds
  // `p`/`P` together; punctuation is unaffected by the fold.
  if ([...raw].length === 1) return raw.toUpperCase();

  return raw;
}

/**
 * Derive a stable key token from a physical key code when one is available.
 *
 * A browser reports `KeyboardEvent.key` *after* applying the active modifiers
 * and layout: pressing Shift+2 on a US layout reports `"@"`, and Option+P on
 * macOS reports `"π"`. Neither is a stable identity for the key that was
 * pressed. `KeyboardEvent.code` names the physical key, so prefer it for the
 * cases where it is unambiguous and fall back to `key` everywhere else.
 */
export function keyTokenFromCode(code: string | undefined, key: string): string {
  if (code) {
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter?.[1]) return letter[1];

    const digit = /^Digit(\d)$/.exec(code);
    if (digit?.[1]) return digit[1];

    const numpad = /^Numpad(\d)$/.exec(code);
    if (numpad?.[1]) return numpad[1];

    if (code === 'Space') return 'Space';
  }
  return normalizeKeyToken(key);
}

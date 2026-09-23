import { ShortcutError } from './errors.js';
import { asModifier, normalizeKeyToken, sortModifiers, type Modifier } from './keys.js';
import type { NormalizeInput, Platform, RawChord, Shortcut } from './types.js';

/**
 * Implements `RecorderApi.NormalizeShortcut` — in `NormalizeInput`, out `Shortcut`.
 *
 * Applies `BusinessRule ModMapping`: "Mod resolves to Command on macOS and
 * Control on other supported platforms." Whichever physical modifier `Mod`
 * consumed on this platform is therefore never emitted a second time; the
 * remaining physical modifiers of the `RawChord` keep their own tokens so that
 * normalization loses nothing the chord declared.
 *
 * @throws {ShortcutError} when the chord carries no key, or only a modifier.
 */
export function normalizeShortcut(input: NormalizeInput): Shortcut {
  const { chord, platform } = input;
  return `${modifierPrefix(chordModifiers(chord, platform))}${normalizeKeyToken(chord.key)}`;
}

/** The canonical modifier tokens of `chord` on `platform`, in canonical order. */
function chordModifiers(chord: RawChord, platform: Platform): Modifier[] {
  const modifiers: Modifier[] = [];
  const modPressed = platform === 'macos' ? chord.meta : chord.control;

  if (modPressed) modifiers.push('Mod');
  // The modifier `Mod` did not consume keeps its own identity.
  if (platform === 'macos' ? chord.control : chord.meta) {
    modifiers.push(platform === 'macos' ? 'Ctrl' : 'Meta');
  }
  if (chord.alt) modifiers.push('Alt');
  if (chord.shift) modifiers.push('Shift');

  return sortModifiers(modifiers);
}

/** A parsed portable shortcut. */
export interface ParsedShortcut {
  modifiers: Modifier[];
  key: string;
}

/**
 * Parse portable shortcut text into its canonical parts.
 *
 * Accepts the spellings people write by hand — `"mod+k"`, `"Command+Shift+P"`,
 * `"CmdOrCtrl+Esc"` — and answers in canonical tokens, so that parsing is the
 * single place identity is decided.
 *
 * @throws {ShortcutError} when the text is empty, has no key, or has more than one key.
 */
export function parseShortcut(shortcut: Shortcut): ParsedShortcut {
  const tokens = String(shortcut)
    .split('+')
    .map((t) => t.trim())
    .filter((t) => t !== '');

  if (tokens.length === 0) throw new ShortcutError(`"${shortcut}" is not a shortcut`);

  const modifiers: Modifier[] = [];
  let key: string | null = null;

  for (const token of tokens) {
    const modifier = asModifier(token);
    if (modifier) {
      modifiers.push(modifier);
      continue;
    }
    if (key !== null) {
      throw new ShortcutError(
        `"${shortcut}" names more than one key ("${key}" and "${token}"); key sequences are out of scope`,
      );
    }
    key = normalizeKeyToken(token);
  }

  if (key === null) throw new ShortcutError(`"${shortcut}" is only modifiers, with no key`);

  return { modifiers: sortModifiers(modifiers), key };
}

/**
 * Fold shortcut text onto its canonical identity.
 *
 * `Shortcut` is declared `!identity`: two shortcuts are the same shortcut
 * exactly when their canonical text matches. Put both sides through this
 * function before comparing them.
 */
export function canonicalizeShortcut(shortcut: Shortcut): Shortcut {
  const { modifiers, key } = parseShortcut(shortcut);
  return `${modifierPrefix(modifiers)}${key}`;
}

/** True when both texts denote the same shortcut identity. */
export function shortcutsEqual(a: Shortcut, b: Shortcut): boolean {
  return canonicalizeShortcut(a) === canonicalizeShortcut(b);
}

function modifierPrefix(modifiers: readonly Modifier[]): string {
  return modifiers.length === 0 ? '' : `${modifiers.join('+')}+`;
}

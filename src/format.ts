import type { Modifier } from './keys.js';
import { parseShortcut } from './normalize.js';
import { detectPlatform } from './platform.js';
import type { FormatInput, KeycapDisplay, Platform, Shortcut } from './types.js';

/** Keycap label per modifier token, per platform. */
const MODIFIER_LABELS: Record<Platform, Record<Modifier, string>> = {
  macos: { Mod: 'Command', Meta: 'Command', Ctrl: 'Control', Alt: 'Option', Shift: 'Shift' },
  other: { Mod: 'Ctrl', Meta: 'Meta', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift' },
};

/** Keys whose `KeyboardEvent.key` spelling is not how a keycap reads. */
const KEY_LABELS = new Map<string, string>([
  ['ArrowUp', 'Up'],
  ['ArrowDown', 'Down'],
  ['ArrowLeft', 'Left'],
  ['ArrowRight', 'Right'],
  ['PageUp', 'Page Up'],
  ['PageDown', 'Page Down'],
  ['ContextMenu', 'Menu'],
  ['PrintScreen', 'Print Screen'],
]);

const KEY_LABELS_MACOS = new Map<string, string>([
  ['Escape', 'Esc'],
  ['Enter', 'Return'],
  ['Backspace', 'Delete'],
  ['Delete', 'Forward Delete'],
]);

const SEPARATOR = ' + ';

/** ARIA's modifier names, which are the physical ones — `Mod` has no meaning there. */
const ARIA_MODIFIERS: Record<Platform, Record<Modifier, string>> = {
  macos: { Mod: 'Meta', Meta: 'Meta', Ctrl: 'Control', Alt: 'Alt', Shift: 'Shift' },
  other: { Mod: 'Control', Meta: 'Meta', Ctrl: 'Control', Alt: 'Alt', Shift: 'Shift' },
};

/** The keycap label for a single modifier token on `platform`. */
export function modifierLabel(modifier: Modifier, platform: Platform): string {
  return MODIFIER_LABELS[platform][modifier];
}

/**
 * Render a shortcut in the `aria-keyshortcuts` grammar.
 *
 * ARIA names physical modifiers, so the portable `Mod` is resolved for the
 * platform first — the same mapping `BusinessRule ModMapping` declares. Part of
 * the accessible interaction contract required by `KeyboardAccessibility`.
 */
export function ariaKeyShortcuts(shortcut: Shortcut, platform: Platform = detectPlatform()): string {
  const { modifiers, key } = parseShortcut(shortcut);
  const names = ARIA_MODIFIERS[platform];
  return [...modifiers.map((m) => names[m]), key].join('+');
}

/**
 * The individual keycap labels of a shortcut, in canonical order.
 *
 * Satisfies `Requirement PrettyKeycaps` — "platform-appropriate keycap labels
 * such as Command, Shift, and P". One label per cap, so a UI can render each in
 * its own element; {@link formatShortcut} is the same information joined.
 *
 * `keycapLabels` is a presentation convenience, not a declared operation, so
 * it takes the platform as a second argument and defaults it to
 * {@link detectPlatform}. The declared operation is {@link formatShortcut},
 * which requires the platform because `FormatInput` declares it.
 */
export function keycapLabels(shortcut: Shortcut, platform: Platform = detectPlatform()): string[] {
  const { modifiers, key } = parseShortcut(shortcut);
  const labels = MODIFIER_LABELS[platform];
  return [...modifiers.map((m) => labels[m]), keyLabel(key, platform)];
}

/**
 * Implements `RecorderApi.FormatShortcut` — in `FormatInput`, out `KeycapDisplay`.
 *
 * The platform is required, not detected: `FormatInput` declares it, and a
 * caller that wants the ambient one passes `detectPlatform()` and can see that
 * it did.
 */
export function formatShortcut(input: FormatInput): KeycapDisplay {
  return { text: keycapLabels(input.shortcut, input.platform).join(SEPARATOR) };
}

function keyLabel(key: string, platform: Platform): string {
  if (platform === 'macos') {
    const mac = KEY_LABELS_MACOS.get(key);
    if (mac) return mac;
  }
  return KEY_LABELS.get(key) ?? key;
}

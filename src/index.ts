/**
 * `@avlon/shortcut-recorder` — the framework-agnostic core.
 *
 * Realizes `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.ShortcutEngine`.
 * Importing this module touches no browser global and pulls in no UI framework
 * (`FrameworkAgnosticCore`, `ServerRenderingSafe`, `HeadlessByDefault`).
 *
 * `RecorderApi` maps onto three functions:
 *
 * | operation | function |
 * |---|---|
 * | `NormalizeShortcut` | {@link normalizeShortcut} |
 * | `FormatShortcut` | {@link formatShortcut} |
 * | `AssessShortcut` | {@link assessShortcut} |
 *
 * {@link createShortcutRecorder} adds the recorder semantics the engine
 * provides to adapters around those operations.
 */

export type {
  Assessment,
  AssessmentInput,
  Conflict,
  ExistingBinding,
  KeycapDisplay,
  NormalizeInput,
  Platform,
  RawChord,
  Shortcut,
} from './types.js';

export { ShortcutError } from './errors.js';

// Normalization — Capability `Normalization`
export {
  canonicalizeShortcut,
  normalizeShortcut,
  parseShortcut,
  shortcutsEqual,
  type ParsedShortcut,
} from './normalize.js';

// Presentation — Capability `Presentation`
export { ariaKeyShortcuts, formatShortcut, keycapLabels, modifierLabel } from './format.js';

// Assignment safety — Capability `AssignmentSafety`
export { assessShortcut } from './assess.js';
export { isReservedShortcut, reservedShortcuts } from './reserved.js';

// Recording — Capability `Recording`
export {
  createShortcutRecorder,
  rawChordFromEvent,
  type KeyboardEventLike,
  type RecorderAttributes,
  type RecorderOptions,
  type RecorderSnapshot,
  type ShortcutRecorder,
  type StatusAttributes,
} from './recorder.js';

// Key vocabulary
export {
  MODIFIER_ORDER,
  asModifier,
  isModifierKey,
  keyTokenFromCode,
  normalizeKeyToken,
  sortModifiers,
  type Modifier,
} from './keys.js';

export { detectPlatform, hasDom } from './platform.js';

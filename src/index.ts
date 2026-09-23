/**
 * `@avlon/shortcut-recorder` — the framework-agnostic core.
 *
 * Realizes `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.ShortcutEngine`.
 * Importing this module touches no browser global and pulls in no UI framework
 * (`FrameworkAgnosticCore`, `ServerRenderingSafe`, `HeadlessByDefault`).
 *
 * `RecorderApi` maps onto these:
 *
 * | operation | function |
 * |---|---|
 * | `NormalizeShortcut` | {@link normalizeShortcut} |
 * | `FormatShortcut` | {@link formatShortcut} |
 * | `AssessShortcut` | {@link assessShortcut} |
 * | `StartRecording` | `recorder.start()` |
 * | `CancelRecording` | `recorder.cancel()` |
 * | `CommitChord` | `recorder.commitChord(input)` |
 *
 * The first three are pure functions over a chord or a shortcut and stand on
 * their own. The last three are the recording lifecycle, so they live on a
 * recorder instance from {@link createShortcutRecorder} — the state they move
 * between is the model's `RecordingState`.
 */

export type {
  Assessment,
  AssessmentInput,
  Conflict,
  ExistingBinding,
  FormatInput,
  KeycapDisplay,
  NormalizeInput,
  Platform,
  RawChord,
  RecordingState,
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

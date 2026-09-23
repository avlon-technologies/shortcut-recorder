/**
 * The semantic vocabulary of `::ShortcutRecorder.ShortcutConfiguration.Shortcuts`.
 *
 * Every type in this file is DECLARED by the semantic model
 * (`continuum/model/shortcut-recorder.adl`). Field names and shapes mirror the
 * model's TypeDefinitions; nothing here is invented.
 */

/** Model: `Platform v1` — enumeration `macos | other`. */
export type Platform = 'macos' | 'other';

/**
 * Model: `Shortcut v1` — `alias = text !identity`.
 *
 * The alias is identity-bearing: two shortcuts are the same shortcut exactly
 * when their canonical text is equal. Always produce values through
 * {@link normalizeShortcut} or {@link canonicalizeShortcut} so that identity
 * comparison is meaningful.
 */
export type Shortcut = string;

/** Model: `RawChord v1` — a captured key combination, before normalization. */
export interface RawChord {
  key: string;
  control: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** Model: `ExistingBinding v1` — a shortcut already assigned to something. */
export interface ExistingBinding {
  id: string;
  shortcut: Shortcut;
}

/** Model: `NormalizeInput v1` — input to `RecorderApi.NormalizeShortcut`. */
export interface NormalizeInput {
  chord: RawChord;
  platform: Platform;
}

/** Model: `AssessmentInput v1` — input to `RecorderApi.AssessShortcut`. */
export interface AssessmentInput {
  shortcut: Shortcut;
  existing: readonly ExistingBinding[];
  platform: Platform;
}

/** Model: `Conflict v1` — the binding a candidate collides with. */
export interface Conflict {
  bindingId: string;
  shortcut: Shortcut;
}

/** Model: `Assessment v1` — output of `RecorderApi.AssessShortcut`. */
export interface Assessment {
  shortcut: Shortcut;
  /** Model: `optional(Conflict)` — absent when the candidate is unassigned. */
  conflict?: Conflict;
  reserved: boolean;
}

/** Model: `KeycapDisplay v1` — output of `RecorderApi.FormatShortcut`. */
export interface KeycapDisplay {
  text: string;
}

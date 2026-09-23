import { assessShortcut } from './assess.js';
import { ariaKeyShortcuts, formatShortcut, keycapLabels, modifierLabel } from './format.js';
import { isModifierKey, keyTokenFromCode, sortModifiers, type Modifier } from './keys.js';
import { canonicalizeShortcut, normalizeShortcut } from './normalize.js';
import { detectPlatform } from './platform.js';
import type { Assessment, ExistingBinding, Platform, RawChord, Shortcut } from './types.js';

/**
 * The part of a `KeyboardEvent` the recorder reads.
 *
 * Structural, not nominal: a DOM `KeyboardEvent`, a React synthetic event and a
 * plain object all satisfy it. This is what keeps capture semantics independent
 * of any UI framework (`Requirement FrameworkAgnosticCore`).
 */
export interface KeyboardEventLike {
  readonly key: string;
  readonly code?: string | undefined;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly repeat?: boolean | undefined;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

/** How a recorder is configured. Every field is optional. */
export interface RecorderOptions {
  /**
   * The committed shortcut, owned by the caller. Supplying it — including as
   * `null` — makes the recorder **controlled**: it reports commits through
   * `onChange` and never changes the value itself
   * (`Requirement ControlledAndUncontrolled`).
   */
  value?: Shortcut | null | undefined;
  /** The initial committed shortcut when the recorder is uncontrolled. */
  defaultValue?: Shortcut | null | undefined;
  /** Shortcuts already assigned elsewhere, against which conflicts are reported. */
  existing?: readonly ExistingBinding[] | undefined;
  /** Defaults to {@link detectPlatform}. */
  platform?: Platform | undefined;
  /** Accessible name for the recording control. */
  label?: string | undefined;
  /**
   * Called when the committed shortcut settles — with the captured chord and
   * its assessment, or with `null, null` when the shortcut was cleared.
   */
  onChange?: ((shortcut: Shortcut | null, assessment: Assessment | null) => void) | undefined;
  /** Called when recording ends without committing. */
  onCancel?: (() => void) | undefined;
  /** Called whenever recording starts or stops. */
  onRecordingChange?: ((recording: boolean) => void) | undefined;
}

/** An immutable view of the recorder, safe to render from. */
export interface RecorderSnapshot {
  /** Whether the recorder is listening for a chord. */
  readonly recording: boolean;
  /** The committed shortcut, or `null` when nothing is assigned. */
  readonly value: Shortcut | null;
  /** The assessment of {@link RecorderSnapshot.value}, `null` when unassigned. */
  readonly assessment: Assessment | null;
  /** Modifiers held down right now while recording, in canonical order. */
  readonly pressed: readonly Modifier[];
  /** Keycap labels for the value, or for the live modifiers while recording. */
  readonly keycaps: readonly string[];
  /** {@link RecorderSnapshot.keycaps} joined for display. */
  readonly display: string;
  /** A sentence describing the current state, for an `aria-live` region. */
  readonly status: string;
  readonly platform: Platform;
}

/** Attributes for the element that records, under their DOM names. */
export interface RecorderAttributes {
  readonly role: 'button';
  readonly tabIndex: 0;
  readonly 'aria-pressed': boolean;
  readonly 'aria-label': string;
  readonly 'aria-invalid': boolean;
  readonly 'aria-keyshortcuts'?: string;
}

/** Attributes for the live region that announces recorder state. */
export interface StatusAttributes {
  readonly role: 'status';
  readonly 'aria-live': 'polite';
  readonly 'aria-atomic': true;
}

/**
 * The recorder: framework-independent capture semantics over a subscribable store.
 *
 * Every method is bound to its recorder, so they can be handed to a framework
 * individually (`onKeyDown={recorder.handleKeyDown}`) without losing `this`.
 */
export interface ShortcutRecorder {
  /** The current snapshot. Referentially stable until something changes. */
  getSnapshot(): RecorderSnapshot;
  /** Subscribe to changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Begin listening for a chord. */
  start(): void;
  /**
   * End recording without committing. Applies `BusinessRule EscapeCancels`:
   * the committed shortcut is left exactly as it was.
   */
  cancel(): void;
  /**
   * Clear the committed shortcut. Reported through `onChange` as `null, null`,
   * so a controlled caller learns about it the same way it learns about a
   * commit.
   */
  clear(): void;
  /**
   * Feed a keydown to the recorder. Returns whether the recorder consumed it;
   * when it did, `preventDefault` and `stopPropagation` have been called.
   */
  handleKeyDown(event: KeyboardEventLike): boolean;
  /** Feed a keyup, so the live modifier preview stays accurate. */
  handleKeyUp(event: KeyboardEventLike): void;
  /** Losing focus ends recording without committing. */
  handleBlur(): void;
  /** Apply new options — the controlled value, `existing`, `platform`, callbacks. */
  setOptions(options: RecorderOptions): void;
  /** Accessible attributes for the recording control. */
  getRecorderAttributes(): RecorderAttributes;
  /** Accessible attributes for the status live region. */
  getStatusAttributes(): StatusAttributes;
}

const STATUS_ATTRIBUTES: StatusAttributes = Object.freeze({
  role: 'status',
  'aria-live': 'polite',
  'aria-atomic': true,
} as const);

const DEFAULT_LABEL = 'Record keyboard shortcut';
const SEPARATOR = ' + ';

/** Build a `RawChord` from anything shaped like a keyboard event. */
export function rawChordFromEvent(event: KeyboardEventLike): RawChord {
  return {
    key: keyTokenFromCode(event.code, event.key),
    control: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

/**
 * Create a shortcut recorder.
 *
 * Realizes the recorder semantics of
 * `::ShortcutRecorder.ShortcutConfiguration.Shortcuts.ShortcutEngine` for
 * adapters: it owns no DOM, reads no global at import time, and renders nothing
 * (`HeadlessByDefault`, `ServerRenderingSafe`, `FrameworkAgnosticCore`). Wire it
 * to a framework by forwarding key events and rendering the snapshot.
 *
 * Keyboard contract (`Requirement KeyboardAccessibility`):
 *
 * | state | key | effect |
 * |---|---|---|
 * | idle | Enter or Space | start recording |
 * | recording | Escape | cancel; the committed value is unchanged |
 * | recording | a modifier | update the live preview |
 * | recording | bare Tab | ignored, so focus can leave |
 * | recording | any other key | commit that chord |
 *
 * A commit is reported whether or not the assessment found a conflict or a
 * reserved shortcut: the model has the engine *report* assignment problems
 * (`Capability AssignmentSafety`), and leaves to the caller what to do about
 * one.
 */
export function createShortcutRecorder(options: RecorderOptions = {}): ShortcutRecorder {
  let opts: RecorderOptions = { ...options };
  let controlled = options.value !== undefined;
  let platform: Platform = options.platform ?? detectPlatform();
  let existing: readonly ExistingBinding[] = options.existing ?? [];

  let recording = false;
  let pressed: readonly Modifier[] = [];
  let internalValue: Shortcut | null = normalizeOrNull(
    controlled ? (options.value ?? null) : (options.defaultValue ?? null),
  );

  let snapshot: RecorderSnapshot | null = null;
  const listeners = new Set<() => void>();

  const currentValue = (): Shortcut | null =>
    controlled ? normalizeOrNull(opts.value ?? null) : internalValue;

  const invalidate = (): void => {
    snapshot = null;
    for (const listener of [...listeners]) listener();
  };

  const getSnapshot = (): RecorderSnapshot => {
    snapshot ??= buildSnapshot({ recording, value: currentValue(), pressed, platform, existing });
    return snapshot;
  };

  const start = (): void => {
    if (recording) return;
    recording = true;
    pressed = [];
    invalidate();
    opts.onRecordingChange?.(true);
  };

  const cancel = (): void => {
    if (!recording) return;
    recording = false;
    pressed = [];
    invalidate();
    opts.onRecordingChange?.(false);
    opts.onCancel?.();
  };

  /** Settle on a value and report it, ending recording if it was in progress. */
  const settle = (shortcut: Shortcut | null): void => {
    const wasRecording = recording;
    if (!controlled) internalValue = shortcut;
    recording = false;
    pressed = [];
    invalidate();

    if (wasRecording) opts.onRecordingChange?.(false);
    opts.onChange?.(
      shortcut,
      shortcut === null ? null : assessShortcut({ shortcut, existing, platform }),
    );
  };

  const syncPressed = (event: KeyboardEventLike): void => {
    const next = sortModifiers(modifiersOf(event, platform));
    if (next.length === pressed.length && next.every((m, i) => m === pressed[i])) return;
    pressed = next;
    invalidate();
  };

  const handleKeyDown = (event: KeyboardEventLike): boolean => {
    if (!recording) {
      if (!isActivationKey(event)) return false;
      consume(event);
      start();
      return true;
    }

    // Auto-repeat while a key is held says nothing new about the chord.
    if (event.repeat === true) {
      consume(event);
      return true;
    }

    // Bare Tab is the user's way out of a recording control: never trap focus.
    if (event.key === 'Tab' && !hasModifier(event)) {
      cancel();
      return false;
    }

    if (event.key === 'Escape' && !hasModifier(event)) {
      consume(event);
      cancel();
      return true;
    }

    consume(event);

    if (isModifierKey(event.key)) {
      syncPressed(event);
      return true;
    }

    settle(normalizeShortcut({ chord: rawChordFromEvent(event), platform }));
    return true;
  };

  const getRecorderAttributes = (): RecorderAttributes => {
    const current = getSnapshot();
    const base = {
      role: 'button',
      tabIndex: 0,
      'aria-pressed': current.recording,
      'aria-label': opts.label ?? DEFAULT_LABEL,
      'aria-invalid': current.assessment?.conflict !== undefined,
    } as const;

    return current.value === null
      ? base
      : { ...base, 'aria-keyshortcuts': ariaKeyShortcuts(current.value, platform) };
  };

  return {
    getSnapshot,
    start,
    cancel,
    handleKeyDown,
    getRecorderAttributes,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear(): void {
      settle(null);
    },

    handleKeyUp(event: KeyboardEventLike): void {
      if (recording) syncPressed(event);
    },

    handleBlur(): void {
      cancel();
    },

    setOptions(next: RecorderOptions): void {
      const before = { controlled, platform, existing, value: currentValue() };

      opts = { ...next };
      controlled = next.value !== undefined;
      platform = next.platform ?? detectPlatform();
      existing = next.existing ?? [];

      // Callbacks and the label do not appear in the snapshot, and an adapter
      // may hand us a fresh options object on every render. Notify only when
      // something a subscriber can observe actually moved, so that calling this
      // on each render converges instead of looping.
      const changed =
        before.controlled !== controlled ||
        before.platform !== platform ||
        before.value !== currentValue() ||
        !sameBindings(before.existing, existing);

      if (changed) invalidate();
    },

    getStatusAttributes(): StatusAttributes {
      return STATUS_ATTRIBUTES;
    },
  };
}

function buildSnapshot(input: {
  recording: boolean;
  value: Shortcut | null;
  pressed: readonly Modifier[];
  platform: Platform;
  existing: readonly ExistingBinding[];
}): RecorderSnapshot {
  const { recording, value, pressed, platform, existing } = input;

  const assessment =
    value === null ? null : assessShortcut({ shortcut: value, existing, platform });

  const keycaps = recording
    ? pressed.map((modifier) => modifierLabel(modifier, platform))
    : value === null
      ? []
      : keycapLabels(value, platform);

  const display =
    recording || value === null ? keycaps.join(SEPARATOR) : formatShortcut(value, platform).text;

  return Object.freeze({
    recording,
    value,
    assessment,
    pressed: Object.freeze([...pressed]),
    keycaps: Object.freeze(keycaps),
    display,
    status: describe({ recording, display, assessment }),
    platform,
  });
}

function describe(input: {
  recording: boolean;
  display: string;
  assessment: Assessment | null;
}): string {
  if (input.recording) {
    const held = input.display === '' ? '' : ` Holding ${input.display}.`;
    return `Recording.${held} Press a shortcut, or Escape to cancel.`;
  }
  if (input.assessment === null) return 'No shortcut assigned.';

  const parts = [`Shortcut ${input.display}.`];
  if (input.assessment.conflict) {
    parts.push(`Already assigned to ${input.assessment.conflict.bindingId}.`);
  }
  if (input.assessment.reserved) parts.push('This shortcut is reserved by the browser.');
  return parts.join(' ');
}

/** The canonical modifiers an event is holding, per `BusinessRule ModMapping`. */
function modifiersOf(event: KeyboardEventLike, platform: Platform): Modifier[] {
  const modifiers: Modifier[] = [];
  if (platform === 'macos' ? event.metaKey : event.ctrlKey) modifiers.push('Mod');
  if (platform === 'macos' ? event.ctrlKey : event.metaKey) {
    modifiers.push(platform === 'macos' ? 'Ctrl' : 'Meta');
  }
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  return modifiers;
}

function hasModifier(event: KeyboardEventLike): boolean {
  return event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
}

function isActivationKey(event: KeyboardEventLike): boolean {
  const activates = event.key === 'Enter' || event.key === ' ' || event.key === 'Space';
  return activates && !hasModifier(event);
}

function consume(event: KeyboardEventLike): void {
  event.preventDefault?.();
  event.stopPropagation?.();
}

/** Bindings are equal when the same ids carry the same shortcuts, in order. */
function sameBindings(
  a: readonly ExistingBinding[],
  b: readonly ExistingBinding[],
): boolean {
  return (
    a.length === b.length &&
    a.every((binding, i) => binding.id === b[i]?.id && binding.shortcut === b[i]?.shortcut)
  );
}

function normalizeOrNull(value: Shortcut | null): Shortcut | null {
  return value === null || value === '' ? null : canonicalizeShortcut(value);
}

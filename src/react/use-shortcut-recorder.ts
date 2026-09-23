import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';

import {
  createShortcutRecorder,
  type RecorderAttributes,
  type RecorderOptions,
  type RecorderSnapshot,
  type ShortcutRecorder as ShortcutRecorderCore,
  type StatusAttributes,
} from '../recorder.js';

/** Props to spread onto the element that records. Behaviour only — never style. */
export type ShortcutRecorderHandleProps = RecorderAttributes & {
  onKeyDown(event: ReactKeyboardEvent): void;
  onKeyUp(event: ReactKeyboardEvent): void;
  onBlur(event: FocusEvent): void;
  onClick(): void;
};

/** Props to spread onto the element that announces recorder state. */
export type ShortcutRecorderStatusProps = StatusAttributes;

/** What {@link useShortcutRecorder} returns. */
export interface UseShortcutRecorder {
  /** The current state of the recorder. */
  readonly state: RecorderSnapshot;
  /** The underlying core recorder, for anything the prop bags do not cover. */
  readonly recorder: ShortcutRecorderCore;
  start(): void;
  cancel(): void;
  clear(): void;
  /** Behaviour props for the recording control. */
  getHandleProps(): ShortcutRecorderHandleProps;
  /** Attributes for the `aria-live` status region. */
  getStatusProps(): ShortcutRecorderStatusProps;
}

/**
 * `useLayoutEffect` where there is a DOM, `useEffect` where there is not.
 *
 * React warns that a layout effect does nothing during server rendering, and it
 * is right — but the warning would be the only browser-shaped thing about this
 * package on a server (`Requirement ServerRenderingSafe`), so choose the hook by
 * environment instead. Server renders never run effects at all; the store is
 * built from the first options, which is exactly what a server render needs.
 */
const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Subscribe a React component to a shortcut recorder.
 *
 * Controlled and uncontrolled both work, by the usual React rule
 * (`Requirement ControlledAndUncontrolled`): pass `value` and the caller owns
 * the committed shortcut — the hook reports commits through `onChange` and
 * never changes `value` itself; pass `defaultValue` (or nothing) and the
 * recorder keeps the shortcut internally.
 *
 * Safe to render on a server: the store is created without touching a browser
 * global, and `useSyncExternalStore` is given a server snapshot.
 */
export function useShortcutRecorder(options: RecorderOptions = {}): UseShortcutRecorder {
  // The store outlives renders; it is created once from the first options.
  const initial = useRef(options);
  const recorder = useMemo(() => createShortcutRecorder(initial.current), []);

  // Props are pushed into the store after every commit, before paint: never
  // during render, because the store notifies its subscribers and updating a
  // component mid-render is not allowed. `setOptions` notifies only when an
  // observable input actually moved, so re-rendering with fresh option objects
  // settles instead of looping.
  useIsomorphicLayoutEffect(() => {
    recorder.setOptions(options);
  });

  const state = useSyncExternalStore(
    recorder.subscribe,
    recorder.getSnapshot,
    recorder.getSnapshot,
  );

  const getHandleProps = useCallback(
    (): ShortcutRecorderHandleProps => ({
      ...recorder.getRecorderAttributes(),
      onKeyDown: (event: ReactKeyboardEvent) => {
        recorder.handleKeyDown(event);
      },
      onKeyUp: (event: ReactKeyboardEvent) => {
        recorder.handleKeyUp(event);
      },
      onBlur: () => {
        recorder.handleBlur();
      },
      onClick: recorder.start,
    }),
    [recorder, state],
  );

  const getStatusProps = useCallback(
    (): ShortcutRecorderStatusProps => recorder.getStatusAttributes(),
    [recorder],
  );

  return {
    state,
    recorder,
    start: recorder.start,
    cancel: recorder.cancel,
    clear: recorder.clear,
    getHandleProps,
    getStatusProps,
  };
}

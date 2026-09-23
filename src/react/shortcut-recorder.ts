import type { ReactNode } from 'react';

import type { RecorderOptions } from '../recorder.js';
import { useShortcutRecorder, type UseShortcutRecorder } from './use-shortcut-recorder.js';

/** Props of {@link ShortcutRecorder}: the recorder options, plus a render function. */
export interface ShortcutRecorderProps extends RecorderOptions {
  /** Receives the recorder and returns the markup. */
  children: (recorder: UseShortcutRecorder) => ReactNode;
}

/**
 * A render-prop wrapper around {@link useShortcutRecorder}, for callers who
 * would rather compose a component than call a hook.
 *
 * It renders exactly what `children` returns and nothing else — no wrapper
 * element, no class name, no style (`Requirement HeadlessByDefault`). The
 * markup, and every visual decision in it, belongs to the caller.
 */
export function ShortcutRecorder({ children, ...options }: ShortcutRecorderProps): ReactNode {
  return children(useShortcutRecorder(options));
}

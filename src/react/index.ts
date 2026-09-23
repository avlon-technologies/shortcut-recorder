/**
 * `@avlon/shortcut-recorder/react` — the thin React adapter.
 *
 * Thin is the whole point: every semantic decision lives in the core
 * (`Requirement FrameworkAgnosticCore`); this module only subscribes React to
 * the core's store and hands back prop bags. It ships no styles, no class names
 * and no DOM of its own (`Requirement HeadlessByDefault`), and it renders on a
 * server without touching a browser global (`Requirement ServerRenderingSafe`).
 */

export {
  useShortcutRecorder,
  type ShortcutRecorderHandleProps,
  type ShortcutRecorderStatusProps,
  type UseShortcutRecorder,
} from './use-shortcut-recorder.js';

export { ShortcutRecorder, type ShortcutRecorderProps } from './shortcut-recorder.js';

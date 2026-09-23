import type { Platform } from './types.js';

/**
 * Narrow structural views of the browser globals this module may read.
 * Declared locally so the package never depends on a DOM lib being present and
 * never references a global at module scope.
 */
interface NavigatorLike {
  readonly platform?: string;
  readonly userAgent?: string;
  readonly userAgentData?: { readonly platform?: string };
}

const MAC_PATTERN = /\b(mac|iphone|ipad|ipod)/i;

/**
 * Detect the ambient platform.
 *
 * Server-rendering safe (`IntegrationContract.ServerRenderingSafe`): reads
 * `navigator` only through a `typeof` guard, at call time, never at import
 * time. Where there is no navigator — Node, a worker, a server render — the
 * answer is `'other'`, which is also the model's non-macOS case.
 *
 * Detection is a convenience default only. Callers that know their platform
 * should pass it explicitly; the model's operations take `platform` as input.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const nav = navigator as NavigatorLike;
  const hint = nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent ?? '';
  return MAC_PATTERN.test(hint) ? 'macos' : 'other';
}

/** True when the package is running somewhere with a live DOM. */
export function hasDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

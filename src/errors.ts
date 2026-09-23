/** Thrown when input cannot be expressed as a `Shortcut`. */
export class ShortcutError extends Error {
  override readonly name = 'ShortcutError';

  constructor(message: string) {
    super(message);
  }
}

import { describe, expect, it, vi } from 'vitest';

import { createShortcutRecorder } from '../src/index.js';
import type { Assessment, KeyboardEventLike, Shortcut } from '../src/index.js';

/** A keyboard event with nothing held and both defaults spied on. */
function key(init: Partial<KeyboardEventLike> & { key: string }): KeyboardEventLike & {
  preventDefault: ReturnType<typeof vi.fn>;
} {
  return {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...init,
  } as KeyboardEventLike & { preventDefault: ReturnType<typeof vi.fn> };
}

const COMMAND_SHIFT_P = { key: 'P', code: 'KeyP', metaKey: true, shiftKey: true };

describe('the recorder does not need a DOM', () => {
  it('runs where there is no window or document', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(() => createShortcutRecorder()).not.toThrow();
  });
});

describe('recording — Requirement KeyboardAccessibility', () => {
  it('starts from the keyboard with Enter or Space', () => {
    for (const activator of ['Enter', ' ']) {
      const recorder = createShortcutRecorder({ platform: 'macos' });
      const event = key({ key: activator });
      expect(recorder.handleKeyDown(event)).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(recorder.getSnapshot().recording).toBe(true);
    }
  });

  it('ignores other keys while idle, so the page keeps working', () => {
    const recorder = createShortcutRecorder({ platform: 'macos' });
    const event = key({ key: 'a' });
    expect(recorder.handleKeyDown(event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(recorder.getSnapshot().recording).toBe(false);
  });

  it('exposes an accessible contract for the control', () => {
    const recorder = createShortcutRecorder({
      platform: 'macos',
      defaultValue: 'Mod+K',
      label: 'Search shortcut',
      existing: [{ id: 'search', shortcut: 'Mod+K' }],
    });

    expect(recorder.getRecorderAttributes()).toEqual({
      role: 'button',
      tabIndex: 0,
      'aria-pressed': false,
      'aria-label': 'Search shortcut',
      'aria-invalid': true, // it collides with `search`
      'aria-keyshortcuts': 'Meta+K',
    });

    recorder.start();
    expect(recorder.getRecorderAttributes()['aria-pressed']).toBe(true);
    expect(recorder.getStatusAttributes()).toEqual({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': true,
    });
  });

  it('omits aria-keyshortcuts when nothing is assigned', () => {
    const recorder = createShortcutRecorder({ platform: 'other' });
    expect(recorder.getRecorderAttributes()).not.toHaveProperty('aria-keyshortcuts');
  });

  it('lets bare Tab through so focus is never trapped', () => {
    const recorder = createShortcutRecorder({ platform: 'macos' });
    recorder.start();
    const event = key({ key: 'Tab' });
    expect(recorder.handleKeyDown(event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(recorder.getSnapshot().recording).toBe(false);
  });

  it('describes itself for a live region', () => {
    const recorder = createShortcutRecorder({
      platform: 'other',
      existing: [{ id: 'search', shortcut: 'Mod+K' }],
    });
    expect(recorder.getSnapshot().status).toBe('No shortcut assigned.');

    recorder.start();
    expect(recorder.getSnapshot().status).toMatch(/Escape to cancel/);

    recorder.handleKeyDown(key({ key: 'K', code: 'KeyK', ctrlKey: true }));
    expect(recorder.getSnapshot().status).toBe(
      'Shortcut Ctrl + K. Already assigned to search.',
    );
  });
});

describe('the declared lifecycle operations — RecorderApi', () => {
  it('StartRecording and CancelRecording answer with the RecordingState', () => {
    const recorder = createShortcutRecorder({ platform: 'macos', defaultValue: 'Mod+K' });

    expect(recorder.getSnapshot().recordingState).toBe('idle');
    expect(recorder.start()).toBe('recording');
    expect(recorder.getSnapshot().recordingState).toBe('recording');
    expect(recorder.cancel()).toBe('idle');
    expect(recorder.getSnapshot().recordingState).toBe('idle');
  });

  it('answers with the state the recorder is in, not the transition it made', () => {
    const recorder = createShortcutRecorder({ platform: 'macos' });
    expect(recorder.start()).toBe('recording');
    expect(recorder.start()).toBe('recording'); // already recording
    expect(recorder.cancel()).toBe('idle');
    expect(recorder.cancel()).toBe('idle'); // already idle
  });

  it('CommitChord normalizes, ends the capture, and returns the Assessment', () => {
    const recorder = createShortcutRecorder({
      platform: 'macos',
      existing: [{ id: 'search', shortcut: 'Mod+K' }],
    });

    recorder.start();
    const assessment = recorder.commitChord({
      chord: { key: 'k', control: false, alt: false, shift: false, meta: true },
      platform: 'macos',
    });

    expect(assessment).toEqual({
      shortcut: 'Mod+K',
      reserved: false,
      conflict: { bindingId: 'search', shortcut: 'Mod+K' },
    });
    expect(recorder.getSnapshot()).toMatchObject({ recordingState: 'idle', value: 'Mod+K' });
  });

  it('commits a chord that was never started, since the model does not forbid it', () => {
    const recorder = createShortcutRecorder({ platform: 'other' });
    const assessment = recorder.commitChord({
      chord: { key: 'j', control: true, alt: false, shift: false, meta: false },
      platform: 'other',
    });
    expect(assessment.shortcut).toBe('Mod+J');
  });

  it('keeps recordingState and the recording convenience in step', () => {
    const recorder = createShortcutRecorder({ platform: 'macos' });
    for (const _ of [0, 1]) {
      const idle = recorder.getSnapshot();
      expect(idle.recording).toBe(idle.recordingState === 'recording');
      recorder.start();
      const busy = recorder.getSnapshot();
      expect(busy.recording).toBe(busy.recordingState === 'recording');
      recorder.cancel();
    }
  });
});

describe('capture — Capability Recording', () => {
  it('commits the chord and reports its assessment', () => {
    const onChange = vi.fn<(s: Shortcut | null, a: Assessment | null) => void>();
    const recorder = createShortcutRecorder({
      platform: 'macos',
      existing: [{ id: 'search', shortcut: 'Mod+K' }],
      onChange,
    });

    recorder.start();
    recorder.handleKeyDown(key(COMMAND_SHIFT_P));

    expect(onChange).toHaveBeenCalledWith('Mod+Shift+P', {
      shortcut: 'Mod+Shift+P',
      reserved: false,
    });
    expect(recorder.getSnapshot()).toMatchObject({
      recording: false,
      value: 'Mod+Shift+P',
      display: 'Command + Shift + P',
    });
  });

  it('previews the modifiers being held, and commits nothing for them', () => {
    const onChange = vi.fn();
    const recorder = createShortcutRecorder({ platform: 'macos', onChange });
    recorder.start();

    recorder.handleKeyDown(key({ key: 'Meta', metaKey: true }));
    expect(recorder.getSnapshot().pressed).toEqual(['Mod']);
    expect(recorder.getSnapshot().display).toBe('Command');

    recorder.handleKeyDown(key({ key: 'Shift', metaKey: true, shiftKey: true }));
    expect(recorder.getSnapshot().display).toBe('Command + Shift');

    expect(onChange).not.toHaveBeenCalled();
    expect(recorder.getSnapshot().recording).toBe(true);
  });

  it('commits a conflicting shortcut and reports the conflict rather than refusing it', () => {
    const onChange = vi.fn();
    const recorder = createShortcutRecorder({
      platform: 'other',
      existing: [{ id: 'search', shortcut: 'Mod+K' }],
      onChange,
    });

    recorder.start();
    recorder.handleKeyDown(key({ key: 'K', code: 'KeyK', ctrlKey: true }));

    expect(recorder.getSnapshot().value).toBe('Mod+K');
    expect(onChange.mock.calls[0]?.[1]).toEqual({
      shortcut: 'Mod+K',
      reserved: false,
      conflict: { bindingId: 'search', shortcut: 'Mod+K' },
    });
  });

  it('reads the physical key, so a shifted layout still records the right one', () => {
    const recorder = createShortcutRecorder({ platform: 'other' });
    recorder.start();
    // Shift+2 on a US layout reports key "@" but code "Digit2".
    recorder.handleKeyDown(key({ key: '@', code: 'Digit2', ctrlKey: true, shiftKey: true }));
    expect(recorder.getSnapshot().value).toBe('Mod+Shift+2');
  });

  it('ignores auto-repeat while a key is held', () => {
    const onChange = vi.fn();
    const recorder = createShortcutRecorder({ platform: 'macos', onChange });
    recorder.start();
    recorder.handleKeyDown(key({ key: 'P', code: 'KeyP', metaKey: true, repeat: true }));
    expect(onChange).not.toHaveBeenCalled();
    expect(recorder.getSnapshot().recording).toBe(true);
  });
});

describe('cancellation — Requirement EscapeCancellation / BusinessRule EscapeCancels', () => {
  it('Escape cancels and leaves the committed shortcut exactly as it was', () => {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const recorder = createShortcutRecorder({
      platform: 'macos',
      defaultValue: 'Mod+K',
      onChange,
      onCancel,
    });

    recorder.start();
    recorder.handleKeyDown(key({ key: 'Meta', metaKey: true }));
    const cancelled = recorder.handleKeyDown(key({ key: 'Escape' }));

    expect(cancelled).toBe(true);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(recorder.getSnapshot()).toMatchObject({ recording: false, value: 'Mod+K' });
  });

  it('records Escape as a shortcut when it is pressed with a modifier', () => {
    const recorder = createShortcutRecorder({ platform: 'other', defaultValue: 'Mod+K' });
    recorder.start();
    recorder.handleKeyDown(key({ key: 'Escape', ctrlKey: true, shiftKey: true }));
    expect(recorder.getSnapshot().value).toBe('Mod+Shift+Escape');
  });

  it('cancels on blur, likewise without changing the committed shortcut', () => {
    const recorder = createShortcutRecorder({ platform: 'other', defaultValue: 'Mod+K' });
    recorder.start();
    recorder.handleBlur();
    expect(recorder.getSnapshot()).toMatchObject({ recording: false, value: 'Mod+K' });
  });

  it('cancelling when idle does nothing at all', () => {
    const onCancel = vi.fn();
    const recorder = createShortcutRecorder({ platform: 'other', onCancel });
    recorder.cancel();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('controlled and uncontrolled — Requirement ControlledAndUncontrolled', () => {
  it('an uncontrolled recorder keeps the shortcut itself', () => {
    const recorder = createShortcutRecorder({ platform: 'macos', defaultValue: 'Mod+K' });
    expect(recorder.getSnapshot().value).toBe('Mod+K');

    recorder.start();
    recorder.handleKeyDown(key(COMMAND_SHIFT_P));
    expect(recorder.getSnapshot().value).toBe('Mod+Shift+P');
  });

  it('a controlled recorder reports the commit and changes nothing itself', () => {
    const onChange = vi.fn();
    const recorder = createShortcutRecorder({ platform: 'macos', value: 'Mod+K', onChange });

    recorder.start();
    recorder.handleKeyDown(key(COMMAND_SHIFT_P));

    expect(onChange).toHaveBeenCalledWith('Mod+Shift+P', expect.anything());
    expect(recorder.getSnapshot().value).toBe('Mod+K'); // still the caller's value
  });

  it('a controlled recorder follows the caller’s value', () => {
    const recorder = createShortcutRecorder({ platform: 'macos', value: 'Mod+K' });
    recorder.setOptions({ platform: 'macos', value: 'Mod+Shift+P' });
    expect(recorder.getSnapshot().value).toBe('Mod+Shift+P');
  });

  it('a controlled null means "nothing assigned", not "uncontrolled"', () => {
    const onChange = vi.fn();
    const recorder = createShortcutRecorder({ platform: 'macos', value: null, onChange });
    recorder.start();
    recorder.handleKeyDown(key(COMMAND_SHIFT_P));
    expect(recorder.getSnapshot().value).toBeNull();
    expect(onChange).toHaveBeenCalled();
  });

  it('canonicalizes whatever spelling the caller supplies', () => {
    expect(createShortcutRecorder({ platform: 'macos', value: 'shift+mod+p' }).getSnapshot().value).toBe(
      'Mod+Shift+P',
    );
  });

  it('clears an uncontrolled shortcut', () => {
    const onChange = vi.fn();
    const recorder = createShortcutRecorder({ platform: 'macos', defaultValue: 'Mod+K', onChange });

    recorder.clear();

    expect(recorder.getSnapshot()).toMatchObject({ value: null, display: '', assessment: null });
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('reports a clear to a controlled caller, since it cannot act on it alone', () => {
    const onChange = vi.fn();
    const recorder = createShortcutRecorder({ platform: 'macos', value: 'Mod+K', onChange });

    recorder.clear();

    expect(onChange).toHaveBeenCalledWith(null, null);
    expect(recorder.getSnapshot().value).toBe('Mod+K'); // until the caller says otherwise
  });

  it('cancels an active recording when cleared', () => {
    const recorder = createShortcutRecorder({ platform: 'macos', defaultValue: 'Mod+K' });
    recorder.start();
    recorder.clear();
    expect(recorder.getSnapshot()).toMatchObject({ recording: false, value: null });
  });
});

describe('the store', () => {
  it('notifies subscribers and hands back a stable snapshot between changes', () => {
    const recorder = createShortcutRecorder({ platform: 'macos' });
    const listener = vi.fn();
    const unsubscribe = recorder.subscribe(listener);

    const before = recorder.getSnapshot();
    expect(recorder.getSnapshot()).toBe(before);

    recorder.start();
    expect(listener).toHaveBeenCalled();
    expect(recorder.getSnapshot()).not.toBe(before);

    unsubscribe();
    recorder.cancel();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when setOptions changes nothing observable', () => {
    const options = { platform: 'macos' as const, existing: [{ id: 'search', shortcut: 'Mod+K' }] };
    const recorder = createShortcutRecorder(options);
    const listener = vi.fn();
    recorder.subscribe(listener);

    const before = recorder.getSnapshot();
    // A fresh options object with equal contents — what a re-render looks like.
    recorder.setOptions({ ...options, existing: [{ id: 'search', shortcut: 'Mod+K' }] });

    expect(listener).not.toHaveBeenCalled();
    expect(recorder.getSnapshot()).toBe(before);
  });

  it('notifies when the assigned bindings really change', () => {
    const recorder = createShortcutRecorder({ platform: 'macos', defaultValue: 'Mod+K' });
    const listener = vi.fn();
    recorder.subscribe(listener);

    recorder.setOptions({
      platform: 'macos',
      defaultValue: 'Mod+K',
      existing: [{ id: 'search', shortcut: 'Mod+K' }],
    });

    expect(listener).toHaveBeenCalled();
    expect(recorder.getSnapshot().assessment?.conflict?.bindingId).toBe('search');
  });

  it('exposes methods that survive being detached from the recorder', () => {
    const recorder = createShortcutRecorder({ platform: 'macos' });
    const { start, handleKeyDown, getSnapshot } = recorder;

    start();
    handleKeyDown(key(COMMAND_SHIFT_P));
    expect(getSnapshot().value).toBe('Mod+Shift+P');
  });
});

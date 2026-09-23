// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExistingBinding, Platform, Shortcut } from '../src/index.js';
import { ShortcutRecorder, useShortcutRecorder } from '../src/react/index.js';
import type { ShortcutRecorderProps } from '../src/react/index.js';

afterEach(cleanup);

const COMMAND_SHIFT_P = { key: 'P', code: 'KeyP', metaKey: true, shiftKey: true };

/**
 * A caller's markup. Everything visual here belongs to the test, not to the
 * package — which is the point of a headless integration.
 */
function Field(props: Omit<ShortcutRecorderProps, 'children'>) {
  return (
    <ShortcutRecorder {...props}>
      {({ state, getHandleProps, getStatusProps }) => (
        <>
          <div data-testid="handle" {...getHandleProps()}>
            {state.keycaps.map((cap, i) => (
              <kbd key={i}>{cap}</kbd>
            ))}
          </div>
          <span data-testid="status" {...getStatusProps()}>
            {state.status}
          </span>
          <output data-testid="value">{state.value ?? ''}</output>
        </>
      )}
    </ShortcutRecorder>
  );
}

const handle = () => screen.getByTestId('handle');
const value = () => screen.getByTestId('value').textContent;
const caps = () => [...handle().querySelectorAll('kbd')].map((k) => k.textContent);

/** Start recording the way a keyboard user does. */
function startRecording() {
  handle().focus();
  fireEvent.keyDown(handle(), { key: 'Enter' });
}

describe('uncontrolled — Requirement ControlledAndUncontrolled', () => {
  it('manages the shortcut internally', () => {
    render(<Field platform="macos" defaultValue="Mod+K" />);
    expect(value()).toBe('Mod+K');
    expect(caps()).toEqual(['Command', 'K']);

    startRecording();
    expect(handle()).toHaveProperty('ariaPressed', 'true');

    fireEvent.keyDown(handle(), COMMAND_SHIFT_P);
    expect(value()).toBe('Mod+Shift+P');
    expect(caps()).toEqual(['Command', 'Shift', 'P']);
  });

  it('starts with nothing assigned when no default is given', () => {
    render(<Field platform="other" />);
    expect(value()).toBe('');
    expect(screen.getByTestId('status')).toHaveProperty('textContent', 'No shortcut assigned.');
  });

  it('shows the modifiers as they are held', () => {
    render(<Field platform="macos" />);
    startRecording();
    fireEvent.keyDown(handle(), { key: 'Meta', metaKey: true });
    expect(caps()).toEqual(['Command']);
    fireEvent.keyDown(handle(), { key: 'Shift', metaKey: true, shiftKey: true });
    expect(caps()).toEqual(['Command', 'Shift']);
  });
});

describe('controlled — Requirement ControlledAndUncontrolled', () => {
  it('never changes the caller’s value by itself', () => {
    const onChange = vi.fn();
    render(<Field platform="macos" value="Mod+K" onChange={onChange} />);

    startRecording();
    fireEvent.keyDown(handle(), COMMAND_SHIFT_P);

    expect(onChange).toHaveBeenCalledWith('Mod+Shift+P', expect.objectContaining({ reserved: false }));
    expect(value()).toBe('Mod+K');
  });

  it('follows the caller when the caller commits the change', () => {
    function Controlled() {
      const [shortcut, setShortcut] = useState<Shortcut | null>('Mod+K');
      return <Field platform="macos" value={shortcut} onChange={setShortcut} />;
    }

    render(<Controlled />);
    expect(value()).toBe('Mod+K');

    startRecording();
    fireEvent.keyDown(handle(), COMMAND_SHIFT_P);
    expect(value()).toBe('Mod+Shift+P');
    expect(caps()).toEqual(['Command', 'Shift', 'P']);
  });

  it('re-assesses when the assigned bindings change', () => {
    const existing: ExistingBinding[] = [{ id: 'search', shortcut: 'Mod+K' }];
    const { rerender } = render(<Field platform="macos" value="Mod+K" />);
    expect(handle()).toHaveProperty('ariaInvalid', 'false');

    rerender(<Field platform="macos" value="Mod+K" existing={existing} />);
    expect(handle()).toHaveProperty('ariaInvalid', 'true');
    expect(screen.getByTestId('status')).toHaveProperty(
      'textContent',
      'Shortcut Command + K. Already assigned to search.',
    );
  });

  it('re-renders when the platform changes', () => {
    const { rerender } = render(<Field platform={'macos' as Platform} value="Mod+K" />);
    expect(caps()).toEqual(['Command', 'K']);
    rerender(<Field platform={'other' as Platform} value="Mod+K" />);
    expect(caps()).toEqual(['Ctrl', 'K']);
  });

  it('settles without re-rendering forever when props are fresh objects each render', () => {
    let renders = 0;
    function Counting() {
      renders += 1;
      return <Field platform="macos" value="Mod+K" existing={[{ id: 'search', shortcut: 'Mod+J' }]} />;
    }
    render(<Counting />);
    expect(renders).toBeLessThan(5);
  });
});

describe('Requirement EscapeCancellation, through React', () => {
  it('cancels without disturbing the committed shortcut', () => {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(<Field platform="macos" defaultValue="Mod+K" onChange={onChange} onCancel={onCancel} />);

    startRecording();
    fireEvent.keyDown(handle(), { key: 'Meta', metaKey: true });
    fireEvent.keyDown(handle(), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(value()).toBe('Mod+K');
    expect(handle()).toHaveProperty('ariaPressed', 'false');
  });

  it('cancels when focus leaves', () => {
    render(<Field platform="macos" defaultValue="Mod+K" />);
    startRecording();
    fireEvent.blur(handle());
    expect(handle()).toHaveProperty('ariaPressed', 'false');
    expect(value()).toBe('Mod+K');
  });
});

describe('Requirement HeadlessByDefault', () => {
  it('contributes no styling of any kind', () => {
    render(<Field platform="macos" defaultValue="Mod+K" label="Search shortcut" />);

    for (const element of [handle(), screen.getByTestId('status')]) {
      expect(element.getAttribute('class')).toBeNull();
      expect(element.getAttribute('style')).toBeNull();
    }
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });

  it('gives the caller behaviour props only', () => {
    function Probe() {
      const { getHandleProps } = useShortcutRecorder({ platform: 'macos', defaultValue: 'Mod+K' });
      const props = getHandleProps();
      return <pre data-testid="props">{Object.keys(props).sort().join(',')}</pre>;
    }

    render(<Probe />);
    expect(screen.getByTestId('props').textContent).toBe(
      'aria-invalid,aria-keyshortcuts,aria-label,aria-pressed,onBlur,onClick,onKeyDown,onKeyUp,role,tabIndex',
    );
  });

  it('renders no wrapper element of its own', () => {
    const { container } = render(
      <ShortcutRecorder platform="macos">{() => <b data-testid="only">x</b>}</ShortcutRecorder>,
    );
    expect(container.innerHTML).toBe('<b data-testid="only">x</b>');
  });
});

describe('Requirement KeyboardAccessibility, through React', () => {
  it('is focusable, labelled, and announces its shortcut', () => {
    render(<Field platform="macos" defaultValue="Mod+K" label="Search shortcut" />);

    expect(handle()).toHaveProperty('tabIndex', 0);
    expect(handle().getAttribute('role')).toBe('button');
    expect(handle().getAttribute('aria-label')).toBe('Search shortcut');
    expect(handle().getAttribute('aria-keyshortcuts')).toBe('Meta+K');
    expect(screen.getByTestId('status').getAttribute('aria-live')).toBe('polite');
  });

  it('records with the keyboard alone, from focus to commit', () => {
    render(<Field platform="other" />);

    handle().focus();
    expect(document.activeElement).toBe(handle());

    fireEvent.keyDown(handle(), { key: ' ' });
    fireEvent.keyDown(handle(), { key: 'J', code: 'KeyJ', ctrlKey: true, altKey: true });

    expect(value()).toBe('Mod+Alt+J');
  });

  it('lets Tab move focus on, rather than swallowing it', () => {
    render(
      <>
        <Field platform="macos" />
        <button type="button">after</button>
      </>,
    );

    startRecording();
    const tabHandled = fireEvent.keyDown(handle(), { key: 'Tab' });
    expect(tabHandled).toBe(true); // not prevented by the recorder
    expect(handle()).toHaveProperty('ariaPressed', 'false');
  });
});

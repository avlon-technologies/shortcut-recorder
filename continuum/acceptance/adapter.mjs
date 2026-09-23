/**
 * Acceptance adapter — binds the package's step vocabulary to the real
 * implementation.
 *
 * It imports the BUILT package (`dist/`) through the same entry points a
 * consumer uses, so what these scenarios prove is what ships. Run it with
 * `npm run acceptance`, which builds first.
 *
 * This file runs in plain Node with no DOM, which is deliberate: the React
 * steps below therefore double as evidence for `ServerRenderingSafe`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DIST = join(ROOT, 'dist');

const core = await import(pathToFileURL(join(DIST, 'index.js')).href);
const reactAdapter = await import(pathToFileURL(join(DIST, 'react', 'index.js')).href);

/** Turn a scenario's chord arguments into something shaped like a keyboard event. */
function chordEvent(args) {
  const key = String(args.key);
  return {
    key,
    code: /^[A-Za-z]$/.test(key) ? `Key${key.toUpperCase()}` : undefined,
    ctrlKey: args.control === true,
    altKey: args.alt === true,
    shiftKey: args.shift === true,
    metaKey: args.meta === true,
  };
}

/** A bare keypress with no modifiers held. */
function plainKey(key) {
  return { key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
}

/**
 * Server-render a recorder and hand back both the markup and the hook's own
 * result, so a step can drive the React integration through the very prop bag
 * it gives callers.
 */
function renderRecorder(options) {
  let api = null;
  const markup = renderToStaticMarkup(
    createElement(reactAdapter.ShortcutRecorder, options, (recorder) => {
      api = recorder;
      return createElement(
        'div',
        recorder.getHandleProps(),
        ...recorder.state.keycaps.map((cap, i) => createElement('kbd', { key: i }, cap)),
      );
    }),
  );
  return { markup, api };
}

/** Every local module the core entry point reaches, transitively. */
function coreModuleGraph() {
  const files = readdirSync(DIST).filter((f) => f.endsWith('.js'));
  return files.map((file) => ({ file, source: readFileSync(join(DIST, file), 'utf8') }));
}

export function createAdapter() {
  return {
    steps: {
      // ---- core-shortcut-behavior -------------------------------------------------

      'recorder.has-existing-bindings': (ctx, args) => {
        ctx.state.existing = args.bindings;
        ctx.assert.ok(args.bindings.length > 0, 'the scenario supplies at least one binding');
        ctx.log(`existing: ${args.bindings.map((b) => `${b.id}=${b.shortcut}`).join(', ')}`);
      },

      'recorder.starts': (ctx) => {
        // Default to the non-macOS platform until the chord step names one.
        ctx.state.platform = ctx.state.platform ?? 'other';
        ctx.state.committed = [];
        ctx.state.recorder = core.createShortcutRecorder({
          platform: ctx.state.platform,
          existing: ctx.state.existing ?? [],
          onChange: (shortcut, assessment) => ctx.state.committed.push({ shortcut, assessment }),
        });

        // Recording must be reachable from the keyboard alone.
        const started = ctx.state.recorder.handleKeyDown(plainKey('Enter'));
        ctx.assert.equal(started, true, 'Enter starts recording');
        ctx.assert.equal(ctx.state.recorder.getSnapshot().recording, true);

        const attributes = ctx.state.recorder.getRecorderAttributes();
        ctx.assert.equal(attributes.role, 'button', 'the control has a role');
        ctx.assert.equal(attributes.tabIndex, 0, 'the control is focusable');
        ctx.assert.equal(attributes['aria-pressed'], true, 'recording is exposed to assistive tech');
      },

      'recorder.presses-chord': (ctx, args) => {
        // The chord names the platform it was pressed on; rebuild on it.
        ctx.state.platform = args.platform;
        ctx.state.recorder.setOptions({
          platform: args.platform,
          existing: ctx.state.existing ?? [],
          onChange: (shortcut, assessment) => ctx.state.committed.push({ shortcut, assessment }),
        });

        const handled = ctx.state.recorder.handleKeyDown(chordEvent(args));
        ctx.assert.equal(handled, true, 'the recorder consumed the chord');
        ctx.assert.equal(ctx.state.recorder.getSnapshot().recording, false, 'the chord ended recording');
      },

      'recorder.normalized-value-is': (ctx, args) => {
        const snapshot = ctx.state.recorder.getSnapshot();
        ctx.assert.equal(snapshot.value, args.shortcut, 'the portable value');
        ctx.assert.equal(ctx.state.committed.at(-1)?.shortcut, args.shortcut, 'the reported value');

        // Portability: the other platform's Mod key gives the same identity.
        const mirrored = core.normalizeShortcut({
          chord: { key: 'P', control: true, alt: false, shift: true, meta: false },
          platform: 'other',
        });
        ctx.assert.equal(mirrored, args.shortcut, 'Mod is Command on macOS and Control elsewhere');
      },

      'recorder.keycaps-are-readable': (ctx) => {
        const { value, platform } = ctx.state.recorder.getSnapshot();
        const labels = core.keycapLabels(value, platform);
        const display = core.formatShortcut(value, platform);

        ctx.assert.deepEqual(labels, ['Command', 'Shift', 'P'], 'one readable label per keycap');
        ctx.assert.equal(display.text, 'Command + Shift + P', 'KeycapDisplay.text');
        for (const label of labels) {
          ctx.assert.ok(/^[A-Za-z0-9][A-Za-z0-9 ]*$/.test(label), `"${label}" reads as a keycap`);
        }

        // The same shortcut reads differently where the keyboard differs.
        ctx.assert.deepEqual(core.keycapLabels(value, 'other'), ['Ctrl', 'Shift', 'P']);
        ctx.log(`macOS: ${display.text} / other: ${core.formatShortcut(value, 'other').text}`);
      },

      'recorder.conflict-is-reported': (ctx, args) => {
        const platform = ctx.state.platform;
        const existing = ctx.state.existing;

        const assessment = core.assessShortcut({ shortcut: args.candidate, existing, platform });
        ctx.assert.ok(assessment.conflict, `${args.candidate} is already assigned`);
        ctx.assert.equal(assessment.conflict.bindingId, args.bindingId, 'the conflicting binding');
        ctx.assert.equal(assessment.conflict.shortcut, args.candidate);

        // The shortcut actually recorded is free, and says so.
        const recorded = ctx.state.recorder.getSnapshot().assessment;
        ctx.assert.equal(recorded.conflict, undefined, 'the recorded shortcut collides with nothing');
      },

      'recorder.reserved-shortcut-warns': (ctx) => {
        const platform = ctx.state.platform;
        const [reserved] = core.reservedShortcuts(platform);

        const warned = core.assessShortcut({ shortcut: reserved, existing: [], platform });
        ctx.assert.equal(warned.reserved, true, `${reserved} is reserved by the browser`);

        const recorded = ctx.state.recorder.getSnapshot().assessment;
        ctx.assert.equal(recorded.reserved, false, 'an ordinary shortcut is not warned about');

        // A warning, not a refusal: the reserved shortcut still assesses cleanly.
        ctx.assert.equal(warned.shortcut, reserved);
        ctx.log(`reserved on ${platform}: ${core.reservedShortcuts(platform).join(', ')}`);
      },

      'recorder.escape-cancels': (ctx) => {
        const recorder = ctx.state.recorder;
        const committedBefore = recorder.getSnapshot().value;
        const commitCountBefore = ctx.state.committed.length;

        recorder.handleKeyDown(plainKey('Enter'));
        ctx.assert.equal(recorder.getSnapshot().recording, true, 'recording again');
        recorder.handleKeyDown({ ...plainKey('Meta'), metaKey: true });

        const handled = recorder.handleKeyDown(plainKey('Escape'));

        ctx.assert.equal(handled, true, 'Escape was consumed');
        ctx.assert.equal(recorder.getSnapshot().recording, false, 'recording stopped');
        ctx.assert.equal(recorder.getSnapshot().value, committedBefore, 'the committed value is untouched');
        ctx.assert.equal(ctx.state.committed.length, commitCountBefore, 'nothing was committed');
      },

      // ---- integration-contract ---------------------------------------------------

      'package.imports-core-without-ui-framework': (ctx) => {
        ctx.assert.equal(typeof core.createShortcutRecorder, 'function', 'the core loaded');
        ctx.assert.equal(typeof core.normalizeShortcut, 'function');
        ctx.assert.equal(typeof core.formatShortcut, 'function');
        ctx.assert.equal(typeof core.assessShortcut, 'function');

        // Nothing the core entry point reaches may import a UI framework.
        for (const { file, source } of coreModuleGraph()) {
          ctx.assert.ok(!/from ['"]react/.test(source), `${file} does not import react`);
        }

        // And the semantics work with no adapter in sight.
        ctx.assert.equal(
          core.normalizeShortcut({
            chord: { key: 'k', control: true, alt: false, shift: false, meta: false },
            platform: 'other',
          }),
          'Mod+K',
        );
        ctx.state.coreImported = true;
      },

      'package.imports-during-server-rendering': (ctx) => {
        ctx.assert.equal(typeof window, 'undefined', 'no window in this process');
        ctx.assert.equal(typeof document, 'undefined', 'no document in this process');

        ctx.state.render = renderRecorder({
          platform: 'macos',
          defaultValue: 'Mod+Shift+P',
          label: 'Search shortcut',
        });
        ctx.assert.ok(ctx.state.render.api, 'the integration rendered');
      },

      'package.server-import-is-safe': (ctx) => {
        ctx.assert.equal(ctx.state.coreImported, true, 'the core imported without a framework');
        ctx.assert.equal(typeof reactAdapter.useShortcutRecorder, 'function', 'the hook imported');
        ctx.assert.equal(typeof reactAdapter.ShortcutRecorder, 'function', 'the component imported');

        const { markup } = ctx.state.render;
        ctx.assert.match(markup, /<kbd>Command<\/kbd>/, 'it rendered real markup');
        ctx.assert.match(markup, /aria-keyshortcuts="Meta\+Shift\+P"/, 'with its accessible contract');
        ctx.assert.equal(core.hasDom(), false, 'the package knows there is no DOM and carries on');
        ctx.log(markup);
      },

      'react.supports-controlled-state': (ctx) => {
        const reported = [];
        const { markup, api } = renderRecorder({
          platform: 'macos',
          value: 'Mod+K',
          onChange: (shortcut, assessment) => reported.push({ shortcut, assessment }),
        });

        ctx.assert.match(markup, /<kbd>K<\/kbd>/, "it renders the caller's value");

        // Drive it through the prop bag the integration hands the caller.
        const props = api.getHandleProps();
        props.onKeyDown(plainKey('Enter'));
        props.onKeyDown(chordEvent({ key: 'P', meta: true, shift: true }));

        ctx.assert.equal(reported.length, 1, 'the commit was reported to the caller');
        ctx.assert.equal(reported[0].shortcut, 'Mod+Shift+P');
        ctx.assert.equal(
          api.recorder.getSnapshot().value,
          'Mod+K',
          'a controlled recorder never changes the value itself',
        );
      },

      'react.supports-uncontrolled-state': (ctx) => {
        const { markup, api } = renderRecorder({ platform: 'macos', defaultValue: 'Mod+K' });
        ctx.assert.match(markup, /<kbd>K<\/kbd>/, 'it renders its own initial value');

        const props = api.getHandleProps();
        props.onKeyDown(plainKey('Enter'));
        props.onKeyDown(chordEvent({ key: 'P', meta: true, shift: true }));

        ctx.assert.equal(
          api.recorder.getSnapshot().value,
          'Mod+Shift+P',
          'an uncontrolled recorder keeps the shortcut itself',
        );

        // Escape leaves that internally managed value alone, too.
        props.onKeyDown(plainKey('Enter'));
        props.onKeyDown(plainKey('Escape'));
        ctx.assert.equal(api.recorder.getSnapshot().value, 'Mod+Shift+P');
      },

      'react.is-headless-by-default': (ctx) => {
        const { markup, api } = renderRecorder({ platform: 'macos', defaultValue: 'Mod+K' });

        ctx.assert.ok(!markup.includes('class='), 'no class names');
        ctx.assert.ok(!markup.includes('style='), 'no inline styles');
        ctx.assert.ok(!markup.includes('<style'), 'no stylesheet');

        // The prop bag carries behaviour and accessibility, and nothing visual.
        const keys = Object.keys(api.getHandleProps()).sort();
        ctx.assert.deepEqual(keys, [
          'aria-invalid',
          'aria-keyshortcuts',
          'aria-label',
          'aria-pressed',
          'onBlur',
          'onClick',
          'onKeyDown',
          'onKeyUp',
          'role',
          'tabIndex',
        ]);

        // The component contributes no element of its own.
        const bare = renderToStaticMarkup(
          createElement(reactAdapter.ShortcutRecorder, { platform: 'macos' }, () =>
            createElement('b', null, 'only this'),
          ),
        );
        ctx.assert.equal(bare, '<b>only this</b>', 'it renders exactly what the caller returned');
      },
    },
  };
}

# Shortcut Recorder

Build a small, polished shortcut-recording library that lets applications capture user-defined keyboard shortcuts, normalize them into a portable representation, render readable keycaps, and detect assignment problems without forcing a visual style or UI framework onto the core.

A successful implementation has a framework-agnostic TypeScript core and a thin React adapter, works in controlled and uncontrolled usage, is safe to import during server rendering, supports keyboard-only interaction, cancels recording with Escape, maps `Mod` portably, and reports both assignment conflicts and recognized browser-reserved shortcuts.

Sequences such as `G G` and localization are outside this package's current semantic scope.

The Goal explains intent. The semantic ADL defines architectural meaning. If they conflict, the semantic model governs.

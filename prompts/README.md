# Prompt history

This directory preserves the user prompts that initiate meaningful bodies of
repository work (architecture, specification, implementation, review, planning).

Convention:

- One file per initiating prompt: `YYYY-MM-DD-NNN-short-slug.md`
- `YYYY-MM-DD` is the local date, `NNN` a zero-padded per-date sequence.
- The **Original Prompt** section is verbatim and is never rewritten; it is the
  historical artifact. Only secrets are redacted.
- `content_hash` in the front matter is the sha256 of the normalized (LF,
  trimmed, post-redaction) prompt text, used to avoid duplicate records.

Follow-up nudges, approvals and clarifications within an existing body of work
are not recorded here.

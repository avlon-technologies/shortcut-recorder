---
name: recover-architecture
description: Read a repository, a git ref, or a PR snapshot and generate a Continuum ADL model from the implementation - on either authored surface (.adl text or adl-json), compiled clean through the toolchain, with stable identity continuity across recoveries. Use when asked to model a repo in ADL, recover or extract the architecture from code, generate ADL for a codebase, or determine what architecture state a PR or branch produces.
---

# Recover an architecture (repository → compiled model)

**Load the `continuum` skill first** — knowledge routing, tool routing,
diagnostics and evidence discipline live there. **Authoring mechanics are
`author-architecture`** (inventory, minting, containment order, the
compile loop, delivery). This file adds what only a repository-reading
agent needs: snapshots, survey discipline, identity continuity across
recoveries, and where the output goes.

The deliverable is an **attested canonical model** of what the repository
establishes at **one commit** — never a file that parses, and never a
model of the code's structure.

## 1. Is there already a model?

`continuum_find` on the repository root — or, against a hosted MCP server
that does not serve it (`continuum` skill §0), a glob for
`continuum/model/*.adl-manifest.json`. If it finds one:

- **compile and read it first** (`understand-architecture`). It is the
  answer to most questions, and it is your identity baseline (§3).
- Recover again only when the user wants it refreshed against the code, or
  wants a PR's two sides. Say which you are doing.

If it finds nothing: the repository has no Continuum model. Offer to
recover one; do not answer architecture questions from code as if a model
existed.

## 2. Pin the snapshot

A model describes declared architecture at **one commit** — fix it before
reading anything.

- **Working tree** — use it in place; record `git rev-parse HEAD`, and note
  in the report if the tree is dirty.
- **A ref** — never disturb the user's checkout:
  `git -C <target> worktree add --detach <scratch>/snap <ref>`.
- **A PR** — materialize both sides:
  `git -C <target> fetch origin "pull/<N>/head:refs/remotes/pr/<N>"` (or
  `gh pr checkout` into a worktree); head = that ref, base =
  `git merge-base <default-branch> pr/<N>`. Each side gets its own detached
  worktree.

Remove any worktree you created (`git worktree remove`). Snapshot-mode
outputs never go inside a scratch worktree — write them under the real
checkout.

## 3. Survey: evidence → concept

Read `continuum://guides/repository-to-source` (the `.adl` surface) or
`continuum://guides/repository-to-model` (adl-json); their survey section
governs both. Then the non-negotiables:

- **Recover architecture, not source structure.** Not every class, file,
  module, DTO or helper is an architectural element. What the system *is*:
  its domains, capabilities, bounded contexts, services, messages,
  resources, workflows, APIs, actors, deployables.
- **Do not fabricate.** Where the repository establishes nothing, omit the
  element. Open questions go in the report, never into the model.
- **Never invent a causal claim.** A Service Reaction, a MessageChannel, a
  consumer, a publisher, an owner: authored only where the code establishes
  it. No Reaction is not a sink — it is an undeclared causal relation, and
  leaving it undeclared is the honest recovery.
- **Keep evidence and inference apart** as you go: record, per element,
  what in the repository established it. Put that record **inside the
  model**, not only in the report — REPOSITORY-TO-MODEL §3 carries the
  citation convention, and citations carried there travel with the
  compiled package instead of separating from it. A report is still where
  inference, confidence and open questions go.

Then produce the flat inventory (`author-architecture` §2) before writing.

## 4. Identity continuity — this skill's own discipline

Element ids are the architecture's stable identity; recovery must not churn
them, or every later comparison degrades into remove+add noise.

- **Find a baseline**: an existing model in the target repo (`continuum/` at
  its root) or one the user supplies. In PR mode, the base-side recovery is
  the head side's baseline.
- **Continuing elements keep their baseline ids** — same architectural
  entity ⇒ same id, even when renamed or moved. Judge continuity from
  repository evidence (same responsibility, endpoints, store), never from
  name equality.
- **New elements get fresh ids** — `continuum_mint_ids`, one batch. Never
  derive an id from a name; never reuse a removed one.
- **No baseline** ⇒ mint everything fresh.
- **A non-compiling baseline is still an id source.** Ids are authored
  members: harvest them even when the old model no longer compiles
  (`grep '"id"'`, or read the document directly). A rebuild that harvests
  ids reads as *the same architecture, migrated*; one that mints fresh ids
  claims the old system ceased to exist. Choose deliberately and say which.

| Repository evidence | Verdict |
|---|---|
| `OrderService` renamed `OrderManagementService`, same endpoints and store | same entity — **keep the id**; the rename is the change |
| a service moved from `Sales` to `Shared`, responsibilities unchanged | same entity — **keep the id**; the move is the change |
| one service split in two, each taking half the endpoints | one **keeps** the id (the one retaining the original's primary responsibility — say which and why); the other is **new** |
| two services merged into one | the survivor **keeps** one id; the other is **removed**, never silently absorbed |
| same name, entirely different responsibility (rewritten) | **not** the same entity: remove + add with a fresh id |
| a store replaced by a different technology, same architectural role | same entity — **keep the id**; technology is a binding concern, invisible here |

When the evidence genuinely does not settle it, prefer continuity and
record the doubt: a wrong continuity call is visible and correctable in the
next diff; a churned id silently destroys the history.

## 5. Author, validate, and where it goes

Author per `author-architecture` §5–§6. Manifest version token = **the
snapshot commit SHA**. In PR mode, author the head side by **editing a copy
of the base-side documents** — that is what keeps identity honest.

**Output location — `continuum/model/` at the target repo's root** (the
one layout: `continuum/` is the development package, `model/` its
semantic state — `docs/design/DESIGN-Development-Package-Layout.md`).
Create it if absent; use another directory only when the user names one.

```
continuum/
  model/
    <system>.adl-manifest.json
    <system>.adl                (or <system>.adl.json)
    <system>.adl.txt            (optional dense projection)
    changes/                    (architecture-change/1 artifacts)
```

Read architectural diagnostics as design review of the *recovery*:
`cross-context-resource-access` means the context carve is wrong;
`dead-event` / `phantom-event` mark a message whose other side the
repository did not establish — report them, never silence them by adding a
consumer the code does not have. `unproduced-read-model` (`adl/1.4`) marks
a view whose producer the repository did not establish: declare `projects`
on a Service only where its code visibly subscribes to **every** Event in
the view's `projectsFrom` set and maintains the view (the compiler refuses
a producer that consumes less, a second producer, and one in another
context); otherwise leave the view unproduced and say so — never add a
producer to clear the warning.

## 6. Deliver

- the model files, compiled clean, with the **attestation** and the
  **`changeState`** digest (the latter is what a ChangeSet's base pin
  names);
- **the closing checks a clean compile does not make** —
  REPOSITORY-TO-MODEL §5 owns them: valid and lawful are not the same
  as recovered, so report the **observable surface** and the evidence
  coverage rather than the element count;
- the survey notes: what the repository established, what you omitted and
  why, what you inferred and how confidently, and the open questions;
- **the CI gate** — offer it, install on the user's yes: copy
  `<continuum>/tooling/ci/continuum-architecture.yml` into the target
  repo's `.github/workflows/`, pinning `CONTINUUM_REF`. It compiles the
  model on every change and posts the verified architectural delta on pull
  requests. Without a gate, nothing compiles the model between the day it
  is authored and the day someone needs it — and a model that silently
  stopped compiling supports no answers at all
  (`tooling/ci/README.md` covers vendoring and self-hosted runners);
- **close the discovery loop** — add a short note to the target
  repository's `CLAUDE.md` so future sessions find the model instead of
  re-deriving the architecture from code:

  > The architecture model lives in `continuum/` (Continuum ADL). Read it
  > before answering architecture questions; validate and evolve it with
  > the Continuum toolchain (the `continuum` MCP server; the
  > `understand-architecture`, `change-architecture` and
  > `recover-architecture` skills). Regenerate rather than hand-drift: the
  > model is a claim about one commit.

## 7. PR mode: what the change actually is

Recover both sides, then hand off to **`change-architecture` §5**: the
verified `architecture-change/1` ChangeSet between the two states is the
PR's architectural delta, and identity continuity (§4) is what makes it a
rename rather than a remove+add.

## 8. Scope limits — state them, never paper over them

- **Single package** per repository. Multi-package models (imports, shared
  type packages) are lawful but out of this procedure's scope: say so and
  design the split with the user.
- **No bindings, no presentation.** Recovery produces the *semantic* model;
  technology realization and diagrams are separate artifacts. Do not
  smuggle technology into descriptions.
- **One commit.** The model says nothing about history or runtime, and it
  starts drifting the moment the code moves — which is what the CI gate
  exists to make visible.

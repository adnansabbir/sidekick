# Sidekick — Chrome Extension

## Working style — teaching mode (read this first)

The user is new to building Chrome extensions — everything they've built
before was AI-generated without them following along. For this project
they want to actually learn each part, so:

- Go slowly. Work in small steps — one new concept per step (e.g. "the
  manifest", "the service worker", "the side panel", "permissions", "the
  RPC call"), not a full scaffold dropped in one shot.
- Before writing code for a new concept, briefly explain in plain
  language what it is and why it's needed here, before or alongside
  writing it.
- Stop after each step and let the user review, run it, and ask
  questions before moving to the next one. Don't chain several new
  concepts together without a checkpoint.
- Favor a small, understandable diff over a complete-looking result —
  the goal right now is understanding, not speed.
- If the user pushes back, asks "why", or seems unsure, pause and
  explain rather than pushing forward with more code.
- This applies across POC 1 → POC 2 → POC 3 unless the user says
  otherwise.

## Documentation map

This file only covers repo orientation (layout, commands, tech stack).
Everything else lives in `docs/` — **read the relevant file before
starting related work:**

- `docs/PROJECT_PLAN.md` — architecture, command schema, privacy goals,
  and the POC 1 → POC 2 → POC 3 roadmap. Read this first, every session.
- `docs/CONVENTIONS.md` — code patterns as they get established. Read
  this before writing code.
- `docs/COMMIT_CONVENTIONS.md` — commit message format and workflow.
  Read this before running `git commit`.

If a decision made while coding isn't captured in the relevant doc yet,
add it once it's confirmed working — these docs exist so patterns aren't
relearned or reinvented each session.

## Repo layout

```
odoo-voice-assistant/
├── CLAUDE.md   ← this file (repo orientation only, see "Documentation map" above)
├── docs/        ← architecture, coding conventions, commit conventions
└── package.json ← Vite, @crxjs/vite-plugin, TypeScript, @types/chrome (devDependencies)
```

No `src/`, manifest, or build config exists yet — POC 1 scaffolding
hasn't started. See `docs/PROJECT_PLAN.md`'s "Status" section.

## Commands

No `npm` scripts are wired up yet (dependencies are installed but there's
no `vite.config.ts` / manifest / dev-build pipeline yet). This section
gets filled in once POC 1 scaffolding lands.

## Tech stack

- Chrome extension, Manifest V3
- TypeScript, Vite, `@crxjs/vite-plugin`
- UI: Chrome Side Panel
- Odoo JSON-RPC, session-cookie auth for POC 1 (see
  `docs/PROJECT_PLAN.md`'s "Privacy and cost goals")
- No backend, no database, no telemetry, no external infrastructure

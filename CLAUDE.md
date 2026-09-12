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
- This applies throughout the project unless the user says otherwise.

## Documentation map

This file only covers repo orientation (layout, commands, tech stack).
Everything else lives in `docs/` — **read the relevant file before
starting related work:**

- `docs/PROJECT_PLAN.md` — architecture, current state, known gaps, and
  the roadmap. Read this first, every session.
- `docs/CONVENTIONS.md` — code patterns as they get established. Read
  this before writing code.
- `docs/COMMIT_CONVENTIONS.md` — commit message format and workflow.
  Read this before running `git commit`.

If a decision made while coding isn't captured in the relevant doc yet,
add it once it's confirmed working — these docs exist so patterns aren't
relearned or reinvented each session.

## Repo layout

```
sidekick/
├── CLAUDE.md          ← this file (repo orientation only, see "Documentation map" above)
├── docs/               ← architecture, coding conventions, commit conventions
├── manifest.config.ts  ← Chrome extension manifest (TS, via @crxjs/vite-plugin's defineManifest)
├── vite.config.ts      ← build config (react + crx + Tailwind v4 plugins, `@` alias)
├── components.json     ← shadcn config: style, path aliases, assistant-ui registry
├── tsconfig.json       ← strict TypeScript config (`@/*` → `src/*`)
├── src/
│   ├── background.ts            ← service worker: opens a per-tab side panel on toolbar click
│   ├── sidepanel.html           ← panel entry point; mounts #root
│   ├── sidepanel.tsx            ← React root: theme detection + <ChatPage />
│   ├── sidepanel.css            ← Tailwind v4 + shadcn theme tokens (the only CSS file)
│   ├── pages/                   ← one file per top-level view (ChatPage: runtime + Thread)
│   ├── components/
│   │   ├── assistant-ui/elements/ ← chat UI vendored from the assistant-ui registry
│   │   ├── ui/                    ← shadcn primitives (button, dialog, tooltip, …)
│   │   └── Can.tsx                ← role/feature gate wrapper
│   ├── hooks/                   ← small shared React hooks
│   ├── i18n/                    ← en.json + the `strings` seam (no hardcoded UI copy)
│   ├── lib/                     ← roles.ts (role→feature map), utils.ts (`cn`)
│   └── icons/                   ← extension icons
└── package.json        ← Vite, @crxjs/vite-plugin, React, TypeScript, Tailwind, assistant-ui
```

Not present right now but coming back — see `docs/PROJECT_PLAN.md`'s
"Not yet ported to React": `src/commands/` (the trusted command
registry), the agent loop, the settings page, and `src/types/` (ambient
declarations for `LanguageModel` / `SpeechRecognition`).

## Commands

- `npm run dev` — Vite dev server with HMR; load the generated `dist/`
  folder as an unpacked extension via `chrome://extensions`
- `npm run build` — production build into `dist/`
- `npm run format` — Prettier

## Tech stack

- Chrome extension, Manifest V3, per-tab Chrome Side Panel UI
- TypeScript (strict), Vite, `@crxjs/vite-plugin`
- React 19 for the panel UI, with `@assistant-ui/react` providing the
  chat runtime (`useLocalRuntime` + a `ChatModelAdapter`) and the
  `Thread` component
- Tailwind v4 + shadcn (`radix-ui` primitives, `lucide-react` icons,
  `class-variance-authority`, `@fontsource-variable/geist`)
- Markdown rendering via `@assistant-ui/react-markdown` + `remark-gfm`
- Chrome's built-in on-device AI — Gemini Nano via the Prompt API
  (`LanguageModel`) — **not currently wired into the React UI**
- Speech-to-text via assistant-ui's `WebSpeechDictationAdapter`, which
  wraps the Web Speech API's `SpeechRecognition`
- `chrome.scripting` + `host_permissions: ["<all_urls>"]` for reading
  the active tab's content
- No backend, no database, no telemetry, no external AI API, no
  external infrastructure

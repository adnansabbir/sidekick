# Conventions

Patterns actually established while building this extension, kept up to
date as development continues — not aspirational rules written ahead of
the code.

## TypeScript

- Strict mode on (`strict: true` in `tsconfig.json`).
- When a browser API isn't in TypeScript's lib yet (e.g.
  `SpeechRecognition`, the Prompt API's `LanguageModel`), add a minimal
  ambient `.d.ts` file in `src/types/` declaring only the members
  actually used — not the whole spec. See
  `src/types/speech-recognition.d.ts` and `src/types/language-model.d.ts`
  for the pattern.
- `src/types/` is only for that — ambient, global declarations with no
  `import`/`export` of their own. A regular local interface (even an
  unexported one used by only one file) stays colocated with the code
  that uses it, not moved there. See `Command` in
  `src/commands/registry.ts` for an example of the latter.
- Once the page-analysis/action pipeline in `docs/PROJECT_PLAN.md` is
  built, its whitelisted function schema will be the one place strict
  typing matters most — everything downstream of a model-picked action
  should be compile-time checked against that schema, not `any`.

## Styling

- Tailwind v4 utility classes directly in markup — no hand-written CSS
  beyond `@import "tailwindcss";` in `src/sidepanel.css`.
- Prefer real Tailwind classes (including the default color palette)
  over arbitrary values. The one standing exception is the dark-mode
  background gradient, which has no equivalent standard utility.
- Icons are inline SVG (individual paths copied from Google's
  open-source Material Symbols), not an icon font or component library —
  keeps the bundle to only the handful of icons actually used.

## Gemini Nano (Prompt API)

- Always check `LanguageModel.availability()` before calling `.create()`
  — it can be `"unavailable"`, `"downloadable"`, `"downloading"`, or
  `"available"`.
- Set persistent behavior (e.g. "keep responses short") via
  `initialPrompts` with a `"system"` role at session creation, not by
  repeating instructions in every user-facing prompt.
- Nano's context window is small — don't dump large content (e.g. a full
  page DOM) into one prompt. Feed it in pieces across sequential prompts
  in the same session; the session's history carries prior turns forward
  automatically, including into a later summarization request.

## Tab access & permissions

- Prefer `"host_permissions"` over `"activeTab"` for reading tab
  content. `activeTab` only grants access on specific user-gesture
  triggers (action click, context menu, keyboard command, omnibox), and
  it's undocumented whether opening our side panel counts — in practice
  it didn't reliably work, throwing `"Cannot access contents of the
page"` from inside an already-open panel. `host_permissions` is
  persistent and gesture-independent, at the cost of a stronger install
  warning — an acceptable tradeoff for an assistant whose job is reading
  whatever site you're on.
- `chrome.scripting.executeScript` works on a tab regardless of whether
  it's currently focused. `chrome.tabs.captureVisibleTab()` does not —
  it only works on the tab that's actually visible right now.

## Commands

- Slash commands live in `src/commands/`: one file per command, each
  calling `registerCommand(name, description, handler)` at module load
  (a self-registering side effect), imported once from
  `src/commands/index.ts` so adding a command is "new file + one import
  line," nothing else changes.
- Command matching scans the whole message for a `/word` token that
  matches something registered — not just a prefix at the start of the
  string. A `/` that doesn't match anything (a URL, a path) is ignored,
  not flagged as an error, so normal chat text isn't disrupted by
  incidental slashes.

## Formatting

- Prettier, default config unless a project-specific override is needed
  (record it here if one is added).
- Override: `tabWidth: 4` (`.prettierrc`) — default 2-space indent felt
  too tight for this codebase.
- No ESLint — TypeScript 7 (this project's pinned version) makes
  `typescript-eslint` hard-crash on load; no supported workaround exists
  yet ([tracking issue](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
  Revisit once TS 7 support lands.

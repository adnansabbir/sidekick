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

- Commands live in `src/commands/`: one file per command, each calling
  `registerCommand(name, handler, commandAlias?)` at module load (a
  self-registering side effect), imported once from
  `src/commands/index.ts`.
- `commandAlias` is optional and is the only thing that exposes a command
  as `/alias` in chat and the suggestion dropdown — a command with no
  alias exists purely for the agent (Gemini) to invoke, never for a human
  to type.
- Each command's name, description, and params are defined once in
  `src/commands/toolManifest.json`, keyed by the exact same `name` string
  passed to `registerCommand`. This is the single source of truth for
  what gets shown to Gemini (via `formatAgentTools()`); `registerCommand`
  itself only owns execution (name → handler). `assertManifestConsistency()`
  (called once from `index.ts` after all commands register) logs a
  console error if the two ever drift apart — a soft safety net, not a
  build-breaking check, since the manifest is deliberately a plain JSON
  file for now so it can later be swapped for an auto-generated one
  without touching the registry or handlers.
- Shared tab access lives in `src/commands/tab.ts`: `getActiveTab()` and
  `execInActiveTab(func, args)` (a single `chrome.scripting.executeScript`
  wrapper every read command uses). `execInActiveTab` swallows a failed
  injection (`chrome://` pages, the Web Store, some PDFs) and returns
  `null` rather than throwing, since restricted pages are an expected
  case, not an exceptional one.
- Command matching for slash commands scans the whole message for a
  `/word` token that matches a registered alias — not just a prefix at
  the start of the string. A `/` that doesn't match anything (a URL, a
  path) is ignored, not flagged as an error, so normal chat text isn't
  disrupted by incidental slashes.

## Agent loop (Gemini invoking commands)

See `docs/PROJECT_PLAN.md`'s "What we've learned about the agent loop"
for the empirical reasoning behind these patterns — this section states
only the resulting rule.

- `src/sidepanel.ts`'s `runAgentLoop()` is the actual agent. Each message
  sends Gemini the live tool list (`formatAgentTools()`), a size hint for
  `command.read.body`'s `full` format (cached per tab via
  `peekBodySizes()`, only recomputed when the active tab's URL changes),
  the ambient `command.read.meta_data` result (always included, never
  gated behind an explicit request), and the guardrail text — constrained
  via `responseConstraint: AGENT_RESPONSE_SCHEMA` to `{type: "answer",
answer} | {type: "execute", commands: [{name, params}]}`.
- `commands` entries are `{name, params}` objects, not `[name, params]`
  tuples.
- Model output is untrusted: every `execute` entry is defensively
  reparsed in `runAgentLoop` (reject non-objects, a missing/non-string
  `name`, non-object `params`) rather than trusted to match the schema.
- `GUARDRAILS` is one shared constant used both in the persistent system
  prompt and re-appended to every round's prompt (together with a
  tab-changed note, when relevant) as a reminder.
- `formatAgentTools()` renders each param'd command with both its raw
  schema and a concrete `Example call` (derived from each param's
  `default`, or its first `options` key).
- Every `.prompt()` call has a 60s timeout via `AbortController`
  (`PROMPT_TIMEOUT_MS`). On timeout, the session is recreated from
  `conversationHistory` (a plain `{role, content}[]` array, tracked
  outside the session, uncapped) so the conversation's topic survives
  even though that one round's scaffolding is lost. `QuotaExceededError`
  is caught separately and does _not_ recreate the session.
- `isAgentBusy` blocks a second message from starting while one is still
  awaiting a response, and disables the send button for the duration
  (the same disabling pattern already used for mic-vs-send state) rather
  than accepting and silently discarding the input.

## Formatting

- Prettier, default config unless a project-specific override is needed
  (record it here if one is added).
- Override: `tabWidth: 4` (`.prettierrc`) — default 2-space indent felt
  too tight for this codebase.
- No ESLint — TypeScript 7 (this project's pinned version) makes
  `typescript-eslint` hard-crash on load; no supported workaround exists
  yet ([tracking issue](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
  Revisit once TS 7 support lands.

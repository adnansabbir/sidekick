# Project Plan

Architecture, current state, and roadmap for the Sidekick Chrome
extension. Read this before starting new build work in this repo.

## Concept

An AI sidekick for any website: chat about a page, summarize it, and
(eventually) take actions on it — powered entirely by Chrome's built-in
on-device AI (Gemini Nano), running locally in the browser. No backend,
no server-side storage, no telemetry, no external AI API.

## Core principle

Natural language is untrusted input. The model should never be given
free rein to manipulate a page directly — it should only ever pick from
a fixed, trusted set of action functions that our own code implements
and executes. This was enforced on the _read_ side on `main` (Gemini could
only request one of a small set of registered commands, never arbitrary
code or selectors). That code is not on the React branch yet — so the
principle currently holds by default (nothing reaches the page at all)
rather than by construction. Re-establishing it in the React
`ChatModelAdapter` is a prerequisite for page _actions_ (click, type),
not something to bolt on afterwards.

## Current architecture (branch: `sidekick-react`)

The side panel UI has been rewritten in React. The **shell is built and
running**; the assistant's actual intelligence — Nano, the command
registry, the agent loop — has **not been ported into it yet** (see "Not
yet ported to React"). `main` still holds the working vanilla-TS
implementation of all of it, and is the reference when porting.

- **Per-tab Chrome Side Panel.** Each tab gets its own independent panel
  instance — separate chat history, separate Nano session — not one
  panel shared across all tabs. The manifest's `side_panel.default_path`
  alone only gives a single shared panel, so it was removed; the panel is
  now registered lazily, per tab, when the toolbar icon is clicked
  (`src/background.ts` calls `chrome.sidePanel.setOptions({tabId})` then
  `.open({tabId})`). Neither call is awaited — `open()` requires the
  click's user gesture, and awaiting anything first loses it.
- **React app.** `src/sidepanel.html` mounts `#root`;
  `src/sidepanel.tsx` creates the root, applies the theme, and renders
  `ChatPage`. Vite's entry for the panel is declared in
  `vite.config.ts`, not in the manifest.
- **Chat UI via assistant-ui.** `ChatPage` creates a runtime with
  `useLocalRuntime` and renders assistant-ui's `Thread` — message list,
  composer, mic, attachments, branch navigation, markdown rendering and
  the scroll/stop/copy affordances all come from the vendored registry
  components in `src/components/assistant-ui/elements/`.
- **The chat model is still a placeholder.** `ChatPage`'s `echoAdapter`
  replies `"You said: …"`. This is the seam Gemini Nano plugs into.
- **Speech-to-text** via assistant-ui's `WebSpeechDictationAdapter`,
  wrapped as `GuardedDictationAdapter` and attached as a sibling adapter
  on the runtime, which enables the composer's built-in mic button. The
  mic needs a one-time permission grant from the options page (see
  "What we've learned about microphone access"). This replaced the hand-written
  `SpeechRecognition` code, and with it the two custom modes ("send as I
  speak" / "dictate only") and the keep-listening-through-silence
  behaviour — assistant-ui's default dictation behaviour is what we have
  now.
- **Markdown rendering** via `@assistant-ui/react-markdown` +
  `remark-gfm`, not `markdown-it` (still in `package.json`, now unused).
- **i18n seam.** Every user-facing string — including `aria-label`s and
  placeholders — lives in `src/i18n/en.json`, read through
  `strings` from `src/i18n/index.ts`. Only English exists; the seam is
  there so adding a locale touches one file.
- **Role/feature gating.** `src/lib/roles.ts` maps a role to a set of
  feature strings; `<Can feature="…">` renders children only if the
  current role has it. The role comes from `localStorage` and defaults
  to `anonymous`, so it fails closed. The composer's attachment button
  is gated behind `chat.attachment` (dev-only) using `preserveLayout`,
  which keeps an invisible placeholder so the send button doesn't shift.
  This is UI-level gating, not a security boundary.
- **Theme.** Dark mode is a `.dark` class on `<html>`, toggled in
  `sidepanel.tsx` from `prefers-color-scheme` with a live listener, and
  driven through shadcn theme tokens in `src/sidepanel.css`. Being
  class-driven rather than media-query-driven is what leaves room for a
  manual override later.

## Not yet ported to React

Deleted from `src/` in the rewrite, still present and working on `main`.
Nothing here was abandoned on purpose — it is the port backlog, roughly
in dependency order:

1. **Ambient types** (`src/types/language-model.d.ts`,
   `speech-recognition.d.ts`) — needed before any Nano code compiles.
2. **Gemini Nano session** — availability check, `initialPrompts` system
   prompt, `expectedOutputs`, the 60s `AbortController` timeout, and
   session recreation from `conversationHistory`.
3. **The command registry** (`src/commands/`: `registry.ts`, `tab.ts`,
   `toolManifest.json`, `read/meta.ts`, `read/body.ts`) — the trusted
   whitelist the "Core principle" depends on. The manifest's permissions
   are unchanged (`sidePanel`, `scripting`, `<all_urls>`), so nothing
   needs restoring there — `host_permissions` is what covers both tab
   metadata and content injection.
4. **The agent loop** — in React this belongs inside the
   `ChatModelAdapter`, which is the natural home for it: the adapter
   already owns "message in → response out", and the loop is just a
   multi-round version of that. assistant-ui also renders tool calls
   natively (`tool-group.aui.tsx`, `tool-fallback.aui.tsx`), so command
   execution can be shown in the thread instead of dumped as a JSON code
   block.
5. **Slash commands and the suggestion dropdown** — alias matching plus
   the `/`-triggered filterable list, which needs a custom composer
   rather than the stock one.
6. **The settings page** (`src/settings.ts`) — language selector and
   "Enable AI responses" toggle with draft Save/Cancel semantics. There
   is no settings UI at all right now, and no entry point to one.

## Known gaps

These were found against the vanilla implementation on `main`. They are
properties of Nano and of the design, not of the deleted code, so they
carry forward to the port — re-read them before rebuilding each piece.

- The language selector doesn't affect what language Nano _replies_
  in — only what language Chrome tries to transcribe speech as. Telling
  Nano (via the system prompt) to mirror the input language works, but
  that change was rolled back along with an unrelated text-to-speech
  experiment and hasn't been redone deliberately yet.
- Text-to-speech (reading Nano's replies aloud) was built as a quick
  disposable test via `speechSynthesis` and intentionally rolled back —
  it is not part of the app currently. Worth revisiting if wanted, along
  with the fact that voice availability is entirely OS-dependent and
  can't be fixed from code (verify with `speechSynthesis.getVoices()`).
- **`command.read.body`'s `full` format has no size cap or chunking.**
  Requesting `full` on an ordinary page (tens of thousands of chars of
  HTML) reliably triggers `QuotaExceededError` once that result is fed
  back into the next prompt. Deferred deliberately — the real fix is
  feeding oversized content in chunks across sequential prompts (Nano's
  session history already carries prior turns forward, so this is
  believed to work, just not built yet).
- **Hallucination on stale/unread content isn't fully solved.** Nano
  will confidently invent specific-sounding details about page content
  it never actually fetched, especially after several turns of
  successfully answering directly. A note is now added to the prompt
  when the active tab's URL changes since the last message (so stale
  body content from a previous page doesn't get blended in), but this
  addresses one specific trigger, not hallucination in general — treated
  as an accepted small-model limitation for now, not something to keep
  chasing with more prompt wording.
- **Speech-to-text is not on-device.** Chrome's `SpeechRecognition`
  streams audio to Google's servers, which is a real exception to the
  "no external API" principle above. True of the vanilla implementation
  too; recorded here rather than fixed.
- **Word/length instructions are honored loosely, not precisely.** Asked
  for "500-1000 words," Nano writes noticeably more than its short
  default but rarely anything close to the requested count. Not worth
  fixing further — the system prompt only asks it to honor length
  requests "fully," not hit an exact number.

## What we've learned about Gemini Nano

- It's reachable from a `chrome-extension://` origin, not just regular
  web pages — confirmed directly via `typeof LanguageModel` in the side
  panel's own DevTools console.
- `LanguageModel.availability()` reports `"unavailable"`,
  `"downloadable"`, `"downloading"`, or `"available"` — always check
  before calling `.create()`.
- Its context window is small compared to cloud models. Dumping an
  entire page's DOM into one prompt fails; feeding it section-by-section
  as separate prompts _within the same session_ works, because the
  session's conversation history carries every prior turn forward,
  including into a later "summarize everything" request.
- `initialPrompts` with a `"system"` role at session creation is the way
  to set persistent behavior (e.g. "keep responses short") without
  repeating instructions on every message.
- `LanguageModel.create()` needs `expectedOutputs: [{type: "text",
languages: [...]}]` or Chrome logs an "output language should be
  specified" warning. Only a handful of languages are actually supported
  for this (`de`, `en`, `es`, `fr`, `ja`) — a much smaller list than the
  speech-recognition language options in Settings, so the two are kept
  as separate, unrelated concerns rather than wired together.
- `session.prompt()` and `session.create()` both accept `{signal:
abortController.signal}` for real cancellation — confirmed against
  Chrome's own docs, not assumed. Used to add a client-side timeout (see
  "What we've learned about the agent loop").
- Structured output via `responseConstraint` (a JSON Schema passed as
  `.prompt()`'s second argument) reliably keeps Nano's _top-level_
  response shape in schema across many rounds of testing — but a loosely
  specified nested shape (e.g. `array of array` with no item typing) does
  not stop it from putting the wrong thing inside, so schema strictness
  still matters at every level, not just the outermost one.

## What we've learned about the agent loop

- **A small model needs an explicit default and a reason for the
  alternative, not just a neutral list of options.** `command.read.body`
  kept requesting the much larger `full` format even after a size hint
  was added, until the manifest's `format` param was reworded to say
  `text` is preferred by default and `full` is "much larger... only
  request this when you specifically need it."
- **Showing only a schema, not an example, gets the schema echoed back
  as if it were the value.** Nano returned `{"format": {"type": "string",
"options": {...}, ...}}` — the entire schema object — instead of
  `{"format": "text"}`, until `formatAgentTools()` started rendering a
  concrete `Example call` (derived from the manifest's own `default`)
  alongside the schema.
- **Object-shaped tool calls are more reliable than positional tuples.**
  `commands: [[name, params]]` repeatedly came back malformed (e.g. the
  name wrapped in `{"commandName": ...}` — a shape close to common
  function-calling conventions). Switching to `commands: [{name,
params}]`, with `name`/`params` as real schema properties, resolved it.
- **A prose "never mention X" instruction is a soft constraint, not a
  guarantee**, even repeated every round. Directly asking "what
  command?" got a command name back once despite explicit guardrail
  text. Accepted as a known limit of prompt-only enforcement — a
  deterministic output-side filter would be the stronger fix if this
  becomes a real problem, not attempted yet.
- **A session can get permanently stuck**, not just slow to answer.
  Reproduced case: a direct question requiring page content the model
  hadn't fetched yet took 2-3 minutes and then correctly failed with
  `QuotaExceededError: response exceeded output limits` — but sending a
  second message _while the first was still pending_ left the session
  answering nothing at all, permanently, until the whole panel was
  reloaded. Root cause believed to be overlapping `.prompt()` calls on
  one session, not a hang in a single call. Fixed with a 60s
  per-call timeout (`AbortController`) plus a busy-guard in
  `sendMessage()` that refuses a new message while one is in flight.
- **Recreating a session after a failure needs the conversation replayed
  in, not just the system prompt.** A bare recreated session forgets
  everything discussed even though old chat bubbles are still visible on
  screen, which reads as broken. `conversationHistory` (tracked outside
  the session, independent of the tool-list/guardrail scaffolding sent
  each round) is what gets replayed into a freshly created session.

## What we've learned about microphone access

- **Chrome cannot show a permission prompt inside a side panel.** The
  request is auto-dismissed — `getUserMedia` rejects with
  `NotAllowedError: Permission dismissed` and `permissions.query` stays
  at `"prompt"`, meaning the user was never actually asked. Confirmed
  against a normal tab on the same machine, which prompts fine.
- The fix is a separate extension page in a real tab
  (`src/permission.html`, registered as `options_ui` with
  **`open_in_tab: true`** — the default embeds it as a dialog inside
  `chrome://extensions`, which can't prompt either). The grant is stored
  per-origin, so the panel inherits it and the user does this once.
- **`audioCapture` in the manifest does not help the Web Speech API**,
  and neither does an offscreen document — offscreen documents are
  invisible, so they have the same missing-prompt-surface problem the
  side panel does. Both were tried and removed.
- **assistant-ui has no permission handling at all** — no `getUserMedia`
  or `permissions.query` anywhere in the package. It reports every
  dictation failure through `console.error` alone, so a missing grant
  looks like a mic button that does nothing.
- `capabilities.dictation` is derived purely from whether a dictation
  adapter was passed (`adapters?.dictation !== undefined`), never from
  browser support — so withholding the adapter is how a feature gets
  hidden.

## What we've learned about reading tabs

- The manifest needs explicit permissions before any tab data is
  visible: tab metadata (`url`, `title`, `favIconUrl`) requires the
  `"tabs"` permission or host permissions; reading page content needs
  `"scripting"` plus host access.
- **`activeTab` didn't work reliably with our side-panel architecture.**
  It grants host access only when the user "invokes the extension"
  (action click, context menu, keyboard command, or omnibox) — Chrome's
  own docs don't clarify whether opening a side panel counts, and in
  practice calling `chrome.scripting.executeScript` from inside an
  already-open panel threw `"Cannot access contents of the page"`. Fixed
  by switching to `"host_permissions": ["<all_urls>"]` (persistent
  access, not gesture-dependent) — the tradeoff is a stronger Chrome
  install warning, which is an acceptable cost for an assistant whose
  whole purpose is reading whatever site you're on.
- `chrome.tabs.captureVisibleTab()` (a screenshot, not just DOM text)
  only works on the tab that's currently visible/focused — it cannot
  capture a background tab, unlike `executeScript`, which works
  regardless of focus.
- `chrome://` pages, the Chrome Web Store, and other extensions' pages
  stay off-limits to script injection no matter what permissions are
  granted — `execInActiveTab` (`src/commands/tab.ts`) catches this and
  returns `null` instead of throwing, so opening the panel on a
  restricted page degrades gracefully (empty command results) rather
  than crashing the agent loop.
- Side panels have no built-in "which tab am I" API, so every read
  command resolves its target via "whichever tab is currently active in
  this window" (`getActiveTab()`), which usually but isn't strictly
  guaranteed to match the exact tab this panel instance was opened for.

## Planned: page actions

The _read_ half of the page-analysis/action pipeline is built and working
**on `main`** (see "Agent loop" above — `command.read.meta_data`,
`command.read.body`, the execute/answer loop, guardrails), and needs
porting to React first. Still to build — letting the assistant _act_ on
a page, not just read it:

- Add trusted action functions (e.g. `list_interactive_elements()`,
  `click_button()`, `type_in_input_box()`) as new registered commands,
  following the exact same pattern `command.read.*` already established
  (manifest entry + registration + defensive param parsing).
- Nano picks from that whitelist only — it never generates or executes
  arbitrary code or selectors. Trusted extension code is the only thing
  that touches the page, mirroring the "Core principle" above.
- For multi-step tasks (e.g. "search for X on this site"), test whether
  Nano can plan the whole step sequence upfront versus needing to be
  re-consulted after each individual action — the existing multi-round
  loop already supports this shape, it just hasn't been tested with
  actions yet, only reads.
- For element targeting, favor giving Nano a numbered list of
  interactive elements (role/label) over asking it to invent CSS
  selectors — a small on-device model is far more reliable picking from
  a list than generating a selector blind. Real accessibility semantics
  (ARIA roles/labels) on the target site should make this more reliable
  too — worth testing.
- Chunking oversized `command.read.body` content (see "Known gaps") is
  worth building before or alongside actions, since actions will likely
  need to reason about page content too.

## Planned: multi-provider models

Gemini Nano stays the default — always available, no configuration, no
network request. Everything else is user-configured and strictly
opt-in, added from the settings page (see below).

- **Group providers by wire protocol, not by brand.** Most of what a
  user would want to add — ChatGPT, a locally-run Codex exposed on
  localhost, Ollama, and Gemini's own cloud API — all speak (or can
  speak) the same OpenAI-shaped `/v1/chat/completions`-style request.
  Confirmed directly: Gemini's cloud API has an OpenAI-compatible
  endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/`
  (SSE streaming, swap in a Gemini key + model name, otherwise identical
  to the OpenAI shape). So one generic "OpenAI-compatible HTTP" adapter,
  configured per-provider with `{baseUrl, apiKey?, modelName}`, covers
  all of those — a local Codex is just this adapter pointed at
  `http://localhost:PORT` with no key. Claude's wire format genuinely
  differs (system prompt as a separate field, different streaming
  envelope) and needs its own adapter. That makes three adapters total
  today (on-device, OpenAI-compatible HTTP, Anthropic HTTP), not one
  per named provider.
- **`ChatModelAdapter.run()` becomes a dispatcher**, not the model
  logic itself: look up the currently selected provider+model, delegate
  to the matching adapter above. Cross-provider behavior (the "you are
  Sidekick" system prompt, guardrails, future tool-calling) lives in the
  dispatcher so it isn't duplicated or allowed to drift per provider.
- **Sequencing: build the pattern with one real provider before
  generalizing.** First slice — the model picker starts with just Nano
  plus a second, non-model "Add more" row (rendered alongside the
  `models.map(...)` list, not as a fake `ModelOption`) that opens
  settings. Pasting a Gemini API key there adds Gemini as a second real,
  selectable option. This is deliberately the OpenAI-compatible adapter
  being built for real, not a throwaway special case — ChatGPT/Ollama/
  custom endpoints reuse it once a settings UI exists for them too.
  Still undecided, to be settled once a second and third provider
  actually exist: how a provider's model list is populated (hardcoded
  per known provider, auto-fetched via the provider's own "list models"
  endpoint, or manually typed), and whether v1 exposes exactly one
  Gemini model or several.
- **Model selection may end up as up to three selectors**, not
  necessarily one dropdown: Model/Provider, an optional Variant (for a
  provider with multiple models), and an optional Effort level (low/
  medium/high — already a first-class concept in the vendored
  `model-selector.tsx`'s `ModelOption.efforts`, not something to build
  from scratch). Left open on purpose until real multi-model providers
  exist to design against.
- **Settings page scope grows accordingly.** The already-planned
  settings page (see "Not yet ported to React" above) absorbs
  `src/permission.html`'s mic-grant flow rather than staying a second
  separate extension page, plus a new "AI providers" section: add/edit/
  remove named provider configs, each with a transport kind (on-device /
  OpenAI-compatible / Anthropic / custom) that determines which fields
  show (API key vs. base URL). Provider configs (including API keys)
  belong in `chrome.storage.local`, not `localStorage` — this is real
  user-entered configuration, not a debug toggle. Worth being explicit
  that no client-side extension storage is meaningfully "secure" against
  someone with devtools access to their own browser, regardless of which
  storage API is used.
- **This does not reintroduce a backend.** Cloud providers are opt-in
  and use the user's own credentials — the browser talks directly to
  the provider; nothing routes through infrastructure Sidekick runs.
  "No backend" stays true even once cloud providers are supported (see
  "Privacy and cost goals" below, updated to reflect this).
- **Speech-to-text privacy is a separate, related axis**, not coupled to
  which chat model is selected. Already tracked in "Known gaps":
  `SpeechRecognition` currently streams audio to Google regardless of
  the chat model in use. A future local-vs-cloud STT toggle on the
  settings page is planned but not scoped in detail yet.

## Privacy and cost goals

No backend, no server-side storage, no telemetry, no user accounts, no
analytics, no recurring infrastructure cost. On-device (Gemini Nano) and
local-network (e.g. Ollama) processing are the default and require no
configuration; connecting to a cloud provider (ChatGPT, Claude, Gemini's
cloud API, or a custom endpoint) is strictly opt-in, configured by the
user with their own credentials from the settings page. Even then,
Sidekick never operates as a backend or proxy — the browser talks
directly to whichever provider the user configured. Everything runs in
the browser using Chrome's built-in on-device AI and Web Speech APIs.

## Status

**On `main`:** chat + speech-to-text + Gemini Nano, per-tab, plus the
full read-side agent loop — Gemini requests `command.read.meta_data` or
`command.read.body` on its own, gets real page data back, and answers
without leaking any internal mechanism. Hardened against several real
failure modes found through live testing (malformed tool calls, stuck
sessions, stale cross-tab content, restricted-page crashes).

**On `sidekick-react` (current branch):** the React + assistant-ui shell
is built and running — themed chat UI, working mic, i18n seam, role
gating — but it answers with a placeholder echo adapter. Everything in
"Not yet ported to React" is the work between here and parity with
`main`; page _actions_ (click, type) come after that, on top of the
restored command registry.

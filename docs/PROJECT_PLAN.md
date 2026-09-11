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
and executes. This is now enforced on the _read_ side (see "Agent loop"
below — Gemini can only request one of a small set of registered
commands, never arbitrary code or selectors); it still needs to be
extended once page _actions_ (click, type) are built.

## Current architecture (built and working)

- **Per-tab Chrome Side Panel.** Each tab gets its own independent panel
  instance — separate chat history, separate Nano session — not one
  panel shared across all tabs. The manifest's `side_panel.default_path`
  alone only gives a single shared panel; per-tab isolation requires the
  background service worker to call `chrome.sidePanel.setOptions()` for
  every tab (see `src/background.ts`).
- **Chat UI.** Message list, mic button (with a mode-picker popup), text
  input, send button, and a header with a reset-conversation control and
  a Settings entry (kebab menu).
- **Gemini Nano** (the Prompt API's `LanguageModel`) powers responses,
  with a session-level system prompt asking for concise-by-default
  answers.
- **Speech-to-text** via the Web Speech API's `SpeechRecognition`, with
  two modes: "Send as I speak" (auto-sends each finalized phrase) and
  "Dictate only" (accumulates into the input box, sent manually).
  Listening is designed to persist across Chrome's own silence-timeouts
  and only stop on an explicit click.
- **Markdown rendering** of Nano's replies via `markdown-it` (raw HTML
  disabled), since Nano naturally outputs Markdown formatting.
- **Settings page** with a language selector and an "Enable AI
  responses" toggle, both persisted to `localStorage` with explicit
  Save/Cancel (draft) semantics. The language selector currently only
  controls the speech-recognition language — see "Known gaps." When AI
  is toggled off, messages still show in the chat but are never sent to
  Nano.
- **Slash commands.** Any message (typed or spoken) is scanned for a
  `/word` token that matches a registered command's alias anywhere in
  the text — not just at the start, and unmatched slashes (URLs, paths)
  are ignored rather than flagged as errors. A matching command runs
  instead of going to Nano, and its result now shows in the chat (as a
  JSON code block) instead of only being logged. Typing `/` shows a
  filterable suggestion dropdown navigable with ↑/↓, Enter/Tab to select,
  Escape to close.
- **Agent loop.** This is the real page-analysis pipeline the "Core
  principle" above refers to. Every AI message goes through
  `runAgentLoop()` (`src/sidepanel.ts`): Gemini gets the live tool list,
  the current tab's metadata (always included, no request needed), and a
  size hint for the page body — constrained via `responseConstraint` to
  either answer the user directly or request one or more registered
  commands by name. Requested commands run through the same trusted
  registry slash commands use; results feed back into the next round
  (capped at `MAX_AGENT_ROUNDS`). Two commands exist today:
  `command.read.meta_data` (title/URL/description, always ambient) and
  `command.read.body` (visible text or full HTML, model's choice). See
  `docs/CONVENTIONS.md`'s "Agent loop" section for the implementation
  details and the empirical reasons behind them (object-shaped commands
  over tuples, example calls alongside the schema, per-round guardrail
  repetition, the 60s timeout + session-recreation-from-history pattern).

## Known gaps

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
(see "Agent loop" above — `command.read.meta_data`, `command.read.body`,
the execute/answer loop, guardrails). Still to build — letting the
assistant _act_ on a page, not just read it:

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

## Privacy and cost goals

No backend, no server-side storage, no telemetry, no user accounts, no
analytics, no external AI API requirement (no OpenAI/Claude dependency),
no recurring infrastructure cost. Everything runs in the browser using
Chrome's built-in on-device AI and Web Speech APIs.

## Status

Chat + speech-to-text + Gemini Nano is built and working, per-tab. The
full read-side agent loop is built and working: Gemini can request
`command.read.meta_data` or `command.read.body` (text or full HTML) on
its own, gets real page data back, and answers without leaking any
internal mechanism — hardened against several real failure modes found
through live testing (malformed tool calls, stuck sessions, stale
cross-tab content, restricted-page crashes). Building page _actions_
(click, type) on top of the same pattern is next.

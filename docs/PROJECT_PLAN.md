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
and executes. This will apply once the page-analysis/action pipeline
below is built; it isn't enforced by anything yet since that pipeline
doesn't exist.

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
  `/word` token that matches a registered command name anywhere in the
  text — not just at the start, and unmatched slashes (URLs, paths) are
  ignored rather than flagged as errors. A matching command runs instead
  of going to Nano. Typing `/` shows a filterable suggestion dropdown
  navigable with ↑/↓, Enter/Tab to select, Escape to close. Commands
  live in `src/commands/` — one file per command, self-registering via
  import in `src/commands/index.ts`. First command: `/read`, which logs
  the current tab's title, URL, and meta description to the console.

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
  granted.
- First real test: the `/read` command uses
  `chrome.tabs.query({active: true, currentWindow: true})` +
  `chrome.scripting.executeScript` to pull `document.title`,
  `location.href`, and the meta description — confirmed working end to
  end. Caveat: side panels have no built-in "which tab am I" API, so
  `/read` resolves its target via "whichever tab is currently active in
  this window," which usually but isn't strictly guaranteed to match the
  exact tab this panel instance was opened for.

## Planned: page-analysis / action pipeline

The command-dispatch mechanism now exists (`src/commands/`) and permissions
are sorted out; `/read` is the first proof it works end to end. Still to
build — letting the assistant read and act on the page more generally,
not just have a freeform chat:

- Collect lightweight page context (URL + metadata) and send it to Nano
  along with the user's prompt and a fixed list of available trusted
  functions (e.g. `copy_dom()`, `list_interactive_elements()`,
  `click_button()`, `type_in_input_box()`).
- Nano picks from that whitelist only — it never generates or executes
  arbitrary code or selectors. Trusted extension code is the only thing
  that touches the page, mirroring the "Core principle" above.
- For multi-step tasks (e.g. "search for X on this site"), test whether
  Nano can plan the whole step sequence upfront versus needing to be
  re-consulted after each individual action.
- For element targeting, favor giving Nano a numbered list of
  interactive elements (role/label) over asking it to invent CSS
  selectors — a small on-device model is far more reliable picking from
  a list than generating a selector blind. Real accessibility semantics
  (ARIA roles/labels) on the target site should make this more reliable
  too — worth testing.
- Test Nano's actual limits (context length, function-picking accuracy,
  multi-step planning) with small, deliberate experiments before
  building the full pipeline around assumptions.

## Privacy and cost goals

No backend, no server-side storage, no telemetry, no user accounts, no
analytics, no external AI API requirement (no OpenAI/Claude dependency),
no recurring infrastructure cost. Everything runs in the browser using
Chrome's built-in on-device AI and Web Speech APIs.

## Status

Chat + speech-to-text + Gemini Nano is built and working, per-tab. The
slash-command dispatcher exists with one working command (`/read`) that
proves tab access is correctly configured. Building out more commands
toward the full page-analysis/action pipeline is next.

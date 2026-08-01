# Project Plan

Architecture, scope, and POC roadmap for the Sidekick Chrome extension.
Read this before starting new build work in this repo.

## Concept

A Chrome extension that lets a user control Odoo using natural-language
voice commands, while keeping everything on the user's machine and
communicating directly with the user's Odoo instance through RPC.

No backend, no server-side storage, no telemetry, no dependency on any
infrastructure beyond the user's own Odoo instance.

## Core principle

Natural language is untrusted input.

```
Natural language
      ↓
strict command schema
      ↓
validated deterministic code
      ↓
Odoo RPC
```

The AI/parser never generates arbitrary Odoo RPC calls. It only ever
produces one of a fixed, whitelisted set of structured commands. Trusted
JavaScript (the executor) is the only code allowed to translate a command
into an actual RPC call. This gives the flexibility of a voice assistant
without giving any model unrestricted control over the Odoo RPC API.

## Core flow (end state)

```
Voice command
    ↓
On-device speech-to-text
    ↓
Natural-language intent parsing
    ↓
Structured internal command
    ↓
Trusted command executor
    ↓
Odoo RPC
    ↓
Optional browser navigation / refresh
```

Example — "Create an invoice for XYZ with 2 apples and 3 bananas" becomes:

```json
{
    "action": "create_invoice",
    "customer": "XYZ",
    "lines": [
        { "product": "Apple", "quantity": 2 },
        { "product": "Banana", "quantity": 3 }
    ]
}
```

### Whitelisted commands

`create_invoice`, `add_product`, `remove_product`, `change_quantity`,
`set_discount`, `post_invoice`, `find_customer`, `open_customer`,
`open_invoice`, `open_menu`.

Trusted executor code maps these to Odoo RPC operations such as
`res.partner.search_read`, `product.product.search_read`,
`account.move.create`, `account.move.line.create`, `account.move.write`,
`account.move.action_post`.

### Conversation context

The extension keeps lightweight local state so follow-up commands work
naturally, e.g.:

```
"Create an invoice for XYZ"
"Add 5 bananas"
"Make that 10"
"Give them 10% discount"
"Post it"
```

State tracked: current record, current model, last invoice line, last
referenced product, last customer. None of this leaves the browser.

### UI behavior

Chrome Side Panel (not a temporary popup) — persists across page
navigation, which the design depends on. The extension operates Odoo in
the background via RPC while also driving browser navigation, but the two
are kept as separate concerns:

```
Command
   ↓
Odoo executor
   ↓
ActionResult
   ↓
Browser controller
```

`ActionResult` shape:

```json
{ "model": "account.move", "resId": 1234, "navigate": true }
```

or:

```json
{ "model": "account.move", "resId": 1234, "refresh": true }
```

`navigate: true` sends the active tab to the record; `refresh: true`
reloads the current page in place (e.g. after adding a line to an invoice
already open).

## Privacy and cost goals

```
User's Chrome
├── Extension
├── microphone
├── on-device speech recognition
├── local intent parsing / browser AI
├── local state
└── HTTPS → user's Odoo instance
```

No project backend, no project database, no user accounts, no analytics,
no telemetry, no stored business data, no OpenAI/Claude API requirement,
no recurring infrastructure cost. Speech recognition and intent parsing
are both intended to run locally using browser/on-device capabilities.
RPC auth uses the user's existing Odoo session or an Odoo API key — see
`docs/CONVENTIONS.md` for the auth approach chosen for POC 1.

## POC roadmap

Layers are built and proven independently — do not skip ahead or build
multiple POCs in one go unless explicitly asked.

### POC 1 — Manual JSON command → Odoo RPC (current)

No speech, no AI. Prove the extension can:

- [ ] connect to an Odoo instance
- [ ] search a customer
- [ ] search a product
- [ ] create a draft invoice
- [ ] add invoice lines
- [ ] open the created invoice in the active Chrome tab

### POC 2 — Typed natural language → intent parser → same executor

Typed text goes through an intent parser that produces the same
structured command schema as POC 1, run through the same executor
unchanged.

### POC 3 — Voice → speech-to-text → same parser → same executor

Swaps typed text for on-device speech-to-text feeding the same parser
from POC 2.

### Beyond invoices

Once POC 3 is proven, expand the command set to: sales quotations,
purchase orders, customers, products, CRM, projects/tasks, timesheets,
expenses, search/reporting, navigation.

## Status

Frameworks installed (Vite, @crxjs/vite-plugin, TypeScript, @types/chrome
as dev dependencies). No source files, manifest, or build config exist
yet — POC 1 scaffolding has not started.

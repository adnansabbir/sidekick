# Conventions

Patterns actually established while building this extension, kept up to
date as development continues. This file starts empty on purpose — filled
in with real decisions as POC 1 takes shape, not aspirational rules
written ahead of the code.

## TypeScript

- Strict mode on (`strict: true` in `tsconfig.json`).
- The command schema (whitelisted actions, `ActionResult`) is the one
  place strict typing matters most — see `docs/PROJECT_PLAN.md`'s "Core
  principle". Everything downstream of a parsed command should be
  compile-time checked against that schema, not `any`.

## Formatting

- Prettier, default config unless a project-specific override is needed
  (record it here if one is added).
- Override: `tabWidth: 4` (`.prettierrc`) — default 2-space indent felt
  too tight for this codebase.
- No ESLint — TypeScript 7 (this project's pinned version) makes
  `typescript-eslint` hard-crash on load; no supported workaround exists
  yet ([tracking issue](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
  Revisit once TS 7 support lands.

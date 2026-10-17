# Offshelf Engineering Rules

## Product boundary
- Local-only. No accounts, backend, sync, analytics or telemetry.
- No permanent host permissions; image hosts are requested per use (optional_host_permissions).
- Offshelf does not bypass paywalls or recover private, deleted or unloaded posts.

## Architecture
- IndexedDB (`offshelf-library`, v1) is the source of truth. Schema changes need a version bump and a migration.
- Every document entering storage passes `validateDocument` / `validateSnapshot`.
- Browser APIs stay in `src/background`, `src/capture` and `src/storage`; UI talks to the worker through `offshelf:*` messages.
- Do not keep required state in service-worker globals; jobs live in the `jobs` store and are recovered by alarm.
- Imports are relative (WXT's built-in `@` alias points at the project root, not `src`).
- UI is React + shadcn in `src/surfaces`, primitives in `src/ui`, pure logic in `src/features`; components read data only through `useLibrary`/storage functions; colors only via tokens in `src/styles/tokens.css`.

## Compatibility
- Do not rename the DB, stores, message types, storage keys or backup format (`offshelf-backup` v1).

## Style
- Blank line between declarations and logical blocks; `pnpm lint` enforces it, `pnpm lint:fix` applies it.

## Gate
- `pnpm check` (typecheck, lint, build, test) must pass. Run `pnpm test:e2e` for anything that touches pages, capture or the worker.

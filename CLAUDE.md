# Claude guide — bible-friend (monorepo)

- `apps/mobile` is an Expo SDK 57 app; read `apps/mobile/AGENTS.md` before touching Expo APIs.
- `packages/core` is shared by the app and Supabase Edge Functions. After editing it, run `pnpm sync:core`
  (CI fails on a stale copy). Imports inside core use explicit `.ts` extensions (Deno compatibility).
- Database changes go in a new file under `supabase/migrations/`; every new table needs RLS policies and
  explicit grants, and a pgTAP test in `supabase/tests/database/`. Then run `pnpm db:types`.
- Child data rules: never add a column that stores a child's real name, contact, or location; AI calls go
  only through Edge Functions after `requireConsent` + `requireChild` + `consumeQuota` + `screenChildInput`.
- Before calling work done: `pnpm check`, and with the local stack running `pnpm db:test` and `pnpm smoke`.

# Merchant Empires V1 — 2–4 human players

Verified 2026-10-18.

- Host can start with 2–4 members; one member is rejected, maximum remains four unique companies.
- Start records joining-order company IDs in the action and snapshot. Only these companies are initialized.
- Setup finishes after one settlement per participating company. Turns and sealed tenders follow frozen seats.
- Disconnect preserves membership and state. Late joins remain rejected.
- Existing production, construction, factories, contracts and profit victory rules are unchanged.
- No AI, database migration or schema change.

Validation:
- npm run typecheck: PASS.
- npm test: 151 passed, 4 database tests skipped without TEST_DATABASE_URL.
- npm run test:neon: 155 passed, 12 files, no skips.
- Real Socket.IO games for 2/3/4 players: setup, four rounds, market updates only at round end, tender bid/skip completion, disconnect/reconnect and late-join rejection.
- PostgreSQL process restart for 2/3/4 players: exact HTTP/snapshot restoration, all clients reconnect, original tokens remain valid, idempotent retry and next turn work.
- Existing PostgreSQL rooms remain unchanged in restart tests.
- npm run build and npm run server:build: PASS.
- git diff --check: PASS.

Vitest discovery is restricted to source and server tests, excluding stale copies under .render-verification.
Initial restricted runs could not connect to localhost; reruns with network access passed.
No deployment performed.

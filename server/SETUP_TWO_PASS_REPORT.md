# Two-pass initial settlements — 2026-10-18

## Behavior

Every participating company places two free level-1 settlements before main round 1.
Seats retain joining order; placement follows seats once and then repeats that same order (not reverse/snake).
Only the current setup actor can place. Completion requires EACH participant to own two setup settlements, not just a global building count.
All existing valid vertices can be used unless already occupied. Adjacent settlements owned by the same or different companies are allowed.
The per-company total limit is four, including free homes. Paid homes retain the current economyConfig cost (40 gold + metal 1, wood 2, wheat 1).
Upgrade chain remains settlement 1 -> 2 -> factory 1 -> 2 -> 3.

Constants are shared: SETUP_SETTLEMENTS_PER_PLAYER=2; MAX_SETTLEMENTS_PER_PLAYER=4; economyConfig.MAX_SETTLEMENTS aliases the latter.

## Backend and snapshots

No schema or snapshot field change is necessary. The backend already dispatches placement through the shared rules under a room transaction/row lock and publishes committed snapshots through Socket.IO.
Validation checks phase, current seat, two-free limit, vertex existence/occupancy and total ownership cap.
Concurrent placement requests cannot double-reserve an occupied vertex; stale state versions and idempotency handling remain in effect.
The next setup actor is the next joining-order seat still below its free-placement quota.

Existing playing/finished games are not reopened and do not receive automatically inserted buildings.
Existing mid-setup snapshots keep buildings and current turn, and continue toward two per participant.
No room is bulk migrated or deleted. Existing integration-test cleanup touches only newly created test fixtures.
Production, dice, market, tenders, contract accounting and manufacturing rules are untouched.

## UI

The setup card names the current actor, shows that actor's free count /2 and lists every participant's count /2, highlighting who is placing.
Guidance states two joining-order passes and permits adjacency.
The paid construction button is disabled during setup with a clear free-placement explanation; paid costs/inventory tables are not presented as setup requirements.
Construction recipes and all cap messages now say four total settlements.
Frontend/backend shared rules version: human-2-4-setup-v4.

## Files

Runtime:
- src/rules/types.ts
- src/rules/economyConfig.ts
- src/rules/settlementRules.ts
- src/rules/gameState.ts
- src/rules/constructionRules.ts
- src/rules/lobbyRules.ts
- src/engine/gameEngine.ts (legacy placement/cap helpers kept consistent)
- src/App.tsx
- src/components/ConstructionUI.tsx
- src/i18n/vi.ts

Tests:
- src/rules/setupRules.test.ts (new)
- src/rules/boardRules.test.ts
- src/rules/economyRules.test.ts
- src/rules/constructionProgression.test.ts
- src/engine/gameEngine.test.ts
- server/tests/api.test.ts
- server/tests/realtime.test.ts
- server/tests/postgres.test.ts
- server/tests/neonRestart.test.ts

Docs: GAME_RULES.md and server/SETUP_TWO_PASS_REPORT.md.

## Verification coverage

- 2/3/4 participants, non-sequential company IDs, correct repeated joining order, free level-1 placements and unchanged economic balances.
- Duplicate vertices, adjacent/interleaved companies, wrong actor, only two free placements, no dice before setup completes.
- Exactly two paid additions after the free homes; fifth total home rejected without cost/state mutation.
- Socket.IO observers receive each placement; reconnect after the first pass restores actor/counts.
- Real backend process restart between first and second setup passes for 2/3/4 players restores exact state and PostgreSQL snapshot, reconnects all clients, then completes setup.
- Existing gameplay/restart, two-stage tenders, accounting and sequential construction regression suites retained.
- API race test accepts one concurrent placement, rejects stale duplicate, rejects occupied vertex, and accepts its adjacent vertex.

## Redeploy

Deploy the same final commit on Render and Vercel; no migration/reset is needed.
Render build: npm ci --include=dev && npm run db:generate && npm run server:build
Render start: npm run server:start
Health must report rulesVersion human-2-4-setup-v4.
Vercel build: npm run build; output: dist; keep VITE_API_URL pointed at Render.
Reload/reconnect all clients to receive the new setup UI.
No deployment was initiated.

## Final results

- npm run typecheck: PASS.
- npm test: 234 passed, 9 database-only cases skipped without TEST_DATABASE_URL.
- Full npm run test:neon: 242 passed; one old PostgreSQL retry fixture still used pre-change version 5 after setup instead of 9.
- After correcting that fixture (including CAS/rerun/opponent-view versions), npm run test:neon -- server/tests/postgres.test.ts: all 3 PostgreSQL cases passed.
- All 243 distinct cases have therefore passed: 234 unit/API/Socket.IO + 3 PostgreSQL + 6 real process-restart cases. No remaining test failure.
- npm run build: PASS (including final player-name/count UI).
- npm run server:build: PASS.
- git diff --check: PASS.
- Mid-setup restart, exact snapshot recovery, all-client reconnection and completion are verified for 2, 3 and 4 participants.
- Existing rows remain unchanged in integrity checks. No migration or deployment performed.

# Multiplayer lobby regression audit — 2026-10-18

## Findings
At baseline 29c0e76, Lobby.tsx already allowed two members. Disabled checks were connection, busy, member count below two, invalid target and the old target cap. The store separately checked host/count; enqueue silently rejected busy/offline requests. No production start/setup/turn/tender logic still required exactly four players.
The actual command is game:start over Socket.IO, or POST /api/rooms/:code/start, rather than START_GAME. Both route to RoomService.execute; it checks host, waiting status and 2–4 members.
The backend already broadcasts joins through service.changed -> realtime.schedule -> room:update. Joins do not increment gameplay version; the frontend must accept equal-version lobby updates.

## Changes
- src/rules/lobbyRules.ts: one start eligibility function with specific Vietnamese reasons; shared rules version.
- src/components/Lobby.tsx: use that function for button disabled state and an accessible status explanation.
- src/store/gameStore.ts: same eligibility check before sending; store received backend rules version; explain rejected starts.
- src/network/protocol.ts: optional rulesVersion metadata for compatibility detection.
- server/src/service.ts: include shared rules version in authenticated WebSocket snapshots.
- server/src/app.ts: expose rulesVersion in /api/health.
- server/src/validation.ts and src/rules/gameState.ts: positive safe-integer target consistently; remove unrelated one-million lobby target cap.
- src/store/gameStore.test.ts: 1/2/3/4 start matrix, equal-version second join, host/target/network/busy/version blockers.
- src/rules/lobbyRules.test.ts: invalid numeric target regressions.
- server/tests/api.test.ts: 1/2/3/4 backend start matrix, non-host and invalid target rejection.

No AI, database schema or economic rules changed. Existing 2/3/4 setup, turns, market, tender, production, factory, delivery and victory tests retained.

## Browser verification
Available automation exposed one in-app browser only, so this used two fresh tabs with independent sessionStorage identities, not two separate browser engines/profiles.
Local Vite + real backend + PostgreSQL:
1. Regression Host creates GPU724W3 as Iron Works; target 1000; one member disables start with explicit reason.
2. Regression Guest joins as Ocean Empire. Host receives 2/4 and an enabled start button without reload.
3. Host starts; both enter the same setup with target 1000.
4. Each places one settlement. Host rolls/ends, Guest rolls/ends, round 2 returns to Host.
Screenshots (ignored local artifacts): server/multiplayer-lobby-ready.png and server/multiplayer-round-two.png.

Local frontend/backend share human-2-4-v1. No production URL or hosting dashboard was supplied, so deployed commit parity was not independently verified. An old/missing backend rules version now gives an actionable mismatch explanation instead of unexplained disabled state.

## Redeploy (owner action only)
Use the exact pushed commit on both platforms. Do not redeploy an older Vercel deployment expecting it to pick up new main code.
1. Render: Manual Deploy -> Deploy a specific commit; select this commit. Repository root "."; build "npm ci --include=dev && npm run db:generate && npm run server:build"; start "npm run server:start". Keep existing DATABASE_URL, HOST=0.0.0.0, FRONTEND_ORIGIN and one instance. No migration required.
2. Check Render /api/health returns status ok and rulesVersion human-2-4-v1.
3. Vercel: create a deployment from the same main commit, or redeploy the deployment already associated with that exact commit. Build "npm run build", output dist; VITE_API_URL must be the Render HTTPS origin.
4. Hard-refresh both clients, reconnect (or create a fresh room), then repeat the two-player check. Old clients need reload to receive the new version check.
References: https://render.com/docs/deploys and https://vercel.com/docs/deployments

No deployment was triggered by the agent.

## Final validation
- npm run typecheck: PASS.
- npm test: 174 passed, 4 DB tests skipped without TEST_DATABASE_URL.
- npm run test:neon: 178/178 passed, 13 files, no skips, including PostgreSQL and real process restarts for 2/3/4 players.
- npm run build: PASS.
- npm run server:build: PASS.
- git diff --check: PASS.
- The first DB run overlapped manual browser joins and correctly detected a changed pre-existing room. Rerunning with browser gameplay idle passed the unchanged-room assertion.

# Construction progression V2 — 2026-10-18

## Delivered behavior

Sequential path: settlement 1 -> settlement 2 -> factory 1 -> factory 2 -> factory 3.
Settlement level 3 is removed from active types, rules, costs and UI. Factories require a same-owner level-2 settlement. Each company remains limited to three settlements and each settlement to one factory. No level may be skipped.

Existing retained costs are unchanged:
- New settlement: 40 gold, metal 1, wood 2, wheat 1.
- Settlement 2: 50 gold, metal/wood/wheat/cotton 1 each.
- Factory 1: 70 gold, metal 2, wood 1, cotton 1.
- Factory 2: 110 gold, metal 1, wood 2, wheat 2, cotton 1.
- Factory 3: 180 gold, metal 2, wood 1, wheat 1, cotton 2.

A factory remains a separate record; its settlement stays at level 2. Raw production is 1/2 units by settlement level, and remains 2 after building/upgrading a factory. Factory capacity remains 1/2/3 batches, including unchanged used-capacity accounting. Construction still records gold plus consumed inventory basis as CAPEX; no direct profit, revenue or cost deduction. Manufacturing recipes, operating fees, market and contract rules are unchanged.

## UI

Owned map structures expose exactly one next construction action. Clicking it opens a cost/current-inventory table and explicit confirmation. Missing funds/materials, wrong turn, roll requirement, connection/pending request and auction blockers are explained. Maximum factory level shows a terminal status. Opponent structures have no upgrade action.

HTML popovers render through a body portal, outside SVG/map/sidebar clipping; fixed coordinates are clamped to viewport, size changes are observed and oversized content scrolls. Map camera moves dismiss the anchored popover. SVG structures are clickable and keyboard-accessible.

Industry construction controls are exactly two buttons: Build settlement and Construction recipes. Placement highlights valid vertices and requires confirmation after selecting a paid site. Free setup remains free and immediate. The five-recipe dialog includes costs and current holdings. Manufacturing controls remain available for a selected owned factory. Removed old sidebar upgrade buttons, duplicate build button and the left Owned structures list. Market and Tender tabs are preserved.

## Persistence and compatibility

No Prisma/schema migration is needed: buildings and factories are stored separately inside existing GameSnapshot JSONB.
No game room or action history was deleted.
Legacy snapshots are normalized for reads: settlement 3 becomes 2; an existing factory on settlement 1 retains the factory and receives a level-2 base. Economics and factory levels/used capacity remain unchanged. The original construction arrays are archived in legacyConstruction when normalization is needed, then saved atomically on the next accepted action. Reads alone never rewrite snapshots; invalid requests roll back. Archived construction data is omitted from public projections.

Read-only PostgreSQL audit at verification time: 28 snapshots, 0 with settlement level 3, 0 with factories on level-1 bases. Compatibility is additionally verified using an isolated synthetic legacy snapshot.

Shared frontend/backend rules version: human-2-4-buildings-v2, exposed by /api/health and authenticated WebSocket snapshots.

## Changed files

UI:
- src/App.tsx
- src/components/Board.tsx
- src/components/ConstructionUI.tsx (new)
- src/components/construction.css (new)
- src/components/EconomyPanel.tsx
- src/components/PlayerDossier.tsx

Rules/types/compatibility:
- src/types.ts
- src/config/economy.ts
- src/engine/economyEngine.ts
- src/rules/economyConfig.ts
- src/rules/constructionRules.ts
- src/rules/settlementRules.ts
- src/rules/factoryRules.ts
- src/rules/constructionProgression.ts (new)
- src/rules/constructionCompatibility.ts (new)
- src/rules/gameState.ts
- src/rules/types.ts
- src/rules/lobbyRules.ts
- src/network/protocol.ts

Backend:
- server/src/service.ts
- server/src/projection.ts

Tests:
- src/rules/constructionProgression.test.ts (new)
- src/rules/economyRules.test.ts
- src/rules/factoryRules.test.ts
- src/rules/diceProduction.test.ts
- src/rules/manufacturingRules.test.ts
- src/engine/gameEngine.test.ts
- server/tests/realtime.test.ts
- server/tests/postgres.test.ts

Docs: GAME_RULES.md and this report.

## Validation

- npm run typecheck: PASS.
- npm run test:neon: 189/189 tests, 14 files, no skips.
- npm run build: PASS.
- npm run server:build: PASS.
- Tests cover each stage, costs/accounting, insufficient gold and each resource, wrong turn, no roll, auction/finished phases, ownership, duplicate factory, skipped stages, terminal levels, settlement cap, raw production, capacity, rollback, WebSocket observers, PostgreSQL reload/legacy snapshot preservation and real backend restarts.
- Browser QA: two independent in-app tab sessions in room 7XCKXDD7. Verified missing-gold disabled confirmation, all four upgrades with confirmation, terminal factory 3, opponent read-only popup, a paid new settlement and five-recipe dialog. Only this explicitly guarded QA fixture was funded for UI testing.
- Local ignored screenshots: server/multiplayer-construction-confirm.png, server/multiplayer-construction-max.png, server/multiplayer-construction-recipes.png.

## Redeploy — owner action only

Deploy the final pushed commit on BOTH platforms.
1. Render: Manual Deploy -> Deploy a specific commit. Repository root "."; build "npm ci --include=dev && npm run db:generate && npm run server:build"; start "npm run server:start". Keep DATABASE_URL, HOST=0.0.0.0, FRONTEND_ORIGIN and one instance. Do not run a schema migration/reset for this update.
2. Check /api/health returns status ok and rulesVersion human-2-4-buildings-v2.
3. Vercel: create deployment from the same commit on main (or redeploy its matching deployment). Build "npm run build"; output dist. VITE_API_URL must point to the correct Render HTTPS backend.
4. Hard-refresh all clients and reconnect. Verify the new construction path in a fresh room. Existing rooms are retained; legacy normalization occurs on read and is persisted on their next accepted action.

References: https://render.com/docs/deploys and https://vercel.com/docs/deployments
No deployment was initiated.

# Five-stage resource extraction fix

## Corrected rule

Settlement level 1/2 produces 1/2 resources per adjacent activated tile. Factory level 1/2/3 produces 3/4/5 instead of the settlement yield at the same vertex. Each activated adjacent tile contributes separately, for every owner. A total of 7 produces no tile resources. An upgrade changes extraction only on subsequent rolls.

`productionRules.ts` is invoked by the existing server dice action. It reads the current buildings and owned factories, counts each vertex/adjacent hex once, and applies inventory quantity changes to all players. Natural extraction retains zero COGS: gold, cumulative profit, revenue, inventory cost totals and factory manufacturing capacity are untouched by the roll. The frontend roll path continues to transmit commands and display server snapshots, with no optimistic production.

The existing compatibility `distribute` helper uses the same yield function and handles 7; it is not the multiplayer authoritative path. Building popovers now show current and next extraction yields; the construction recipe panel shows all five stages. Existing construction costs and manufacturing capacity configuration remain unchanged.

## Validation

- `npm run typecheck`: PASS (frontend and backend).
- `npm test`: **256 passed / 9 skipped**, 19 files passed / 2 skipped. The skipped tests require PostgreSQL; no Neon access occurred.
- `npm run build`: PASS.
- `npm run server:build`: PASS.
- Added unit regressions: five stages, factory replacement without double counting, multiple matching adjacent tiles/resources, multiple owners, nonmatching tiles, total 7, duplicate roll rejection, sequential upgrades, costs and unchanged manufacturing capacity/accounting.
- Added Socket.IO tests for 2/3/4-player rooms: server dice awards all owners, clients receive identical inventories, reconnect preserves exact state without another award, factory upgrade takes effect on the next roll.
- Added frontend regression: local roll input does not award resources; incoming server snapshot controls inventory.
- Updated the old regression asserting factories kept settlement-level extraction.
- No schema migration, stored snapshot rewrite, Neon data changes or manual deployment.

## Changed files

- `src/rules/productionRules.ts`, `buildingProduction.test.ts`.
- `src/rules/constructionProgression.ts`, `constructionProgression.test.ts`.
- `src/components/ConstructionUI.tsx`.
- `src/engine/gameEngine.ts`.
- `src/rules/lobbyRules.ts` (shared version `human-2-4-production-v6`).
- `src/store/gameStore.test.ts`.
- `server/tests/realtime.test.ts`.
- `GAME_RULES.md`.
- This report.

When deploying later, frontend and backend should use the same new rules version. Existing stored games retain their inventories and apply the new yield from their next roll; no database reset or migration is required.

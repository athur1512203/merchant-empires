# Ironhaven irregular map update

## Behavior

- New games use 61 cells by default. `generateBoard(seed, count)` accepts integer counts 60–80; there is no new lobby size selector.
- Axial region growth starts with connected land, admits frontier cells with at least two existing neighbors, weights compact growth with seeded directional variation, then validates connectivity, uniqueness, no enclosed holes, minimum two neighbors and physical bounding-box aspect ratio ≤1.65. Invalid shapes are retried with a bounded limit; there is no fixed-layout fallback.
- Resources remain balanced to within one tile, while greedy neighborhood penalties disperse repeated resources, numbers and adjacent 6/8 tokens. The original relative number-token frequencies are scaled to the chosen map size. No resource number is 7.
- Server chooses a dedicated public map seed independently of the private economic seed. It creates the map once at match start, then broadcasts/stores cells and integer topology. Clients render that snapshot instead of recreating match geometry. Old snapshots without mapSeed retain their saved cells and vertices.
- Existing settlement setup, caps, economy, auction, production and dice rules remain unchanged. Existing artwork is reused. Number tokens move to cell centers, with a minimum display scale to avoid overlap with settlements and improve readability.
- Board viewport gains horizontal room; ResizeObserver fits the actual map bounds on load, new map and viewport resize. Manual zoom/pan remain; reset returns to the fitted view. State updates with unchanged geometry preserve the camera.

## Verification

- 1,000 seeds (0–999), varying sizes across all 60–80 values: cell count, coordinate uniqueness, independent connectivity traversal, valid dice tokens, unique vertex IDs, shared-corner pixel consistency, no holes, compactness, no one-neighbor tips, and fitted camera bounds verified.
- More than 990 unique silhouettes required by regression test; same seed/count reproduces the same complete board.
- Separate 1,000-seed neighborhood scan: maximum same-resource neighbor-pair fraction 10.11%; same-number fraction 4.22%; neighboring 6/8 fraction 7.15%. These are dispersion goals, not new production or dice rules.
- Socket.IO tests with 2/3/4 players compare full public board snapshots and mapSeed across clients and reconnect during setup. Existing free placement and turn tests retained.
- JSON snapshot round-trip into a fresh repository/service verifies restoration of both new 61-cell and legacy 37-cell boards. These tests use in-memory fixtures, not Neon.
- Browser screenshots at 1280×720: seeds 42, 137, 2026, all 61 cells. Actual server-selected seeds and snapshots rendered with existing assets; QA backend uses memory only and auto-completes setup. All 61 tile elements verified in each tab. Zoom, pan, reset, selection and reload preserving seed 42 checked.
- `npm run typecheck`, `npm run build`, `npm run server:build`: PASS.
- `npm test`: 238 passed, 9 skipped (PostgreSQL/Neon tests intentionally not connected).
- No schema migration, no Neon access or data changes, no deploy.

## Review screenshots

Screenshots are saved locally under `.render-verification/`:

- `ironhaven-seed-42.png`
- `ironhaven-seed-137.png`
- `ironhaven-seed-2026.png`

## Changed files

- `GAME_RULES.md`
- `src/rules/boardRules.ts`, `boardRules.test.ts`, `mapGeneration.test.ts`, `gameState.ts`, `types.ts`, `lobbyRules.ts`
- `src/engine/boardCamera.ts`, `hexGrid.ts`, `gameEngine.test.ts`
- `src/components/Board.tsx`, `src/gameAssets.css`, `src/store/gameStore.ts`
- `server/src/service.ts`, `server/tests/realtime.test.ts`, `server/tests/mapRestore.test.ts`
- This report.

When deploying later, update frontend and backend together: the multiplayer rules version is `human-2-4-map-v5`. No database reset or migration is needed. Existing rooms keep their saved maps.

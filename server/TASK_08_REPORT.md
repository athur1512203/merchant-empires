# Task 08 — Two-stage sealed tenders

Verified: 2026-10-18. Production source of truth: src/rules via RoomService.execute.
Reviewed GAME_RULES, auction/contract/delivery rules, raw NPC trade, manufacturing and inventory basis, Player/GameState, authoritative service/validation/projection, Prisma JSONB snapshots, Socket.IO subscriptions/controller ownership and current UI before editing.

## Rules delivered

- New lots through completed round 30 select only metal, wood, wheat and cotton.
- From round 31, the pool contains all four raw templates plus all six unchanged finished-goods templates. Uniform selection from eligible templates; no new group weighting.
- Existing 3-completed-round cadence is unchanged. Therefore the first possible finished-goods lot is at the END OF ROUND 33.
- One lot/session, lowest valid sealed bid wins, earliest accepted equal bid wins, participating seats only (2/3/4), delivery over the same next three rounds, partial delivery, completion-only payment and 20% failure penalty are retained.
- Backend creates lots from its completed-round state. Strict action validation rejects client-supplied contracts/product/reference overrides.
- Open and awarded legacy lots keep their original item/terms, including finished-goods lots created before round 31.

Raw trial values live in economyConfig, under the existing BALANCE_PROVISIONAL flag:

| Item | Quantity | Reference gold |
| --- | ---: | ---: |
| Metal | 5 | 75 |
| Wood | 6 | 84 |
| Wheat | 8 | 104 |
| Cotton | 6 | 84 |

## Accounting correction

The previous partial-delivery implementation removed inventory basis at every shipment but recognized only the final shipment's COGS. Added optional GameContract.deliveredCost to accumulate every shipment's removed weighted-average basis.

- Partial shipment removes only the requested quantity/basis; no cash, revenue or profit is recognized.
- Completion recognizes all deferred basis once and credits the winning bid once. Existing cumulative profit/victory logic is reused.
- Failure retains the current non-return policy: deferred delivered basis becomes an expense once, plus the 20% penalty. Only the penalty removes cash or adds outstandingPenalty. Collecting that debt later does not expense it again.
- Self-mined raw stock has zero basis. NPC purchases add paid acquisition basis. Sales/manufacturing/construction continue using their existing average-basis rules. No changes to those engines.
- Tests conserve basis across NPC purchase + sale + manufacturing + partial raw delivery, repeated rounding, finished-goods partial shipments and penalty-debt collection.

## Snapshot/Neon compatibility

No Prisma schema change or migration. Existing product field now accepts Commodity (four raw + six finished), preserving serialized field names. Type label is derived from the item, so old snapshots do not need a discriminator.

deliveredCost is optional; absent fields safely default to zero for FUTURE shipments. No speculative historical basis reconstruction or past balance rewrite. A legacy partial shipment's basis discarded by old code cannot reliably be inferred from a single snapshot. Read-only audit at verification time found ZERO active partial legacy contracts missing the field.

No existing lots/contracts are regenerated, retyped, repriced or bulk migrated. Read-only APIs do not persist new fields. Existing room/snapshot versions and timestamps are checked unchanged across restart tests. Existing integration cleanup is limited to test-created fixtures; no pre-existing room is deleted.

No changes to new construction rules, map, dice, manufacturing recipes, prices, factory capacity or AI.

## UI

Tender tab labels each open/active contract NGUYÊN LIỆU or THÀNH PHẨM, uses commodity names, shows quantities/reference value/deadline/delivery progress and announces the round-31 unlock. No extra tabs. Opponent prices remain filtered in every authoritative response and WebSocket update.

Manual in-app browser QA, isolated room 4QRQHL32:
- Round 30 raw lot: metal 5, reference 75, deadline end round 33.
- Round 33 finished lot: machinery 2, reference 90, deadline end round 36.
- Existing raw contract remains displayed with progress 2/5 alongside the finished lot.
Only this guarded, explicitly named UI fixture was staged for screenshots. No production deployment was used.
Ignored proof images: server/multiplayer-task08-raw.png, server/multiplayer-task08-finished.png.

## Changed files

- src/rules/economyConfig.ts — raw templates, eligible pool, stage helpers, Commodity contract type, optional shipment basis.
- src/rules/contractConfig.ts — compatibility exports for new config/helpers.
- src/rules/deliveryRules.ts — raw/finished inventory debit and complete partial-delivery accounting.
- src/rules/lobbyRules.ts — shared version human-2-4-auctions-v3.
- src/components/EconomyPanel.tsx — tender type/stage/details/progress UI.
- src/rules/contractRules.test.ts — adapt early-round fixtures to raw inventory.
- src/rules/twoStageContracts.test.ts — generation, accounting, failure, legacy and participant regressions.
- server/tests/api.test.ts — reject client contract tampering.
- server/tests/postgres.test.ts — durable partial basis, completion and unchanged legacy reads.
- server/tests/neonRestart.test.ts — process restart mid-sealed-tender for 2/3/4 players, exact lot/private bids/snapshot recovery, idempotent retry, tie settlement and synchronized results.
- GAME_RULES.md — Task08 staged tender and accounting rules.
- server/TASK_08_REPORT.md — this report.

## Redeploy — user action only

Use the final pushed commit on BOTH services.
1. Render: Manual Deploy -> Deploy a specific commit. Root ".". Build: npm ci --include=dev && npm run db:generate && npm run server:build. Start: npm run server:start. Keep current DATABASE_URL, FRONTEND_ORIGIN, HOST=0.0.0.0 and one backend instance. No schema migration/reset.
2. Verify /api/health -> status ok and rulesVersion human-2-4-auctions-v3.
3. Vercel: create a deployment from that same main commit, or redeploy its corresponding deployment. Build npm run build, output dist. VITE_API_URL must point to the correct Render HTTPS origin.
4. Hard-refresh all clients and reconnect. Existing open/active contracts remain valid. Verify a fresh round-3 raw auction; unit/integration boundary tests cover 30/31/33.
References: https://render.com/docs/deploys and https://vercel.com/docs/deployments

The agent did not deploy Vercel or Render.

## Final validation

- npm run typecheck: PASS.
- npm run test:neon: 230/230 passed, 15 files, no skips; includes nine PostgreSQL/process-restart cases.
- Final npm test after adding two rounding/debt regression cases: 223 passed, 9 database-only cases skipped without TEST_DATABASE_URL. Those nine passed in the full Neon run above; both additional cases passed in the final standard run.
- npm run build: PASS.
- npm run server:build: PASS.
- git diff --check: PASS.
- Tests verify early-round pools at 3/6/9/12/15/18/21/24/27/30; both pools at 33/36/60/99; no auctions at 31/32; raw delivery completeness/shortage/partial flow; COGS, revenue, profit and victory; failure/penalty; sealed prices, tie order and 2–4 seats.
- Real process restarts occur after a first sealed bid for 2 players at round 3, 3 players at round 30 and 4 players at round 33. Snapshots/private views and idempotency survive; remaining participants finish the tender and every socket receives the same winner/contract.

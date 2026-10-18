# Settlement and factory artwork integration

## Changed files for this task

- `public/assets/game/buildings/settlement_level_1.png`
- `public/assets/game/buildings/settlement_level_2.png`
- `public/assets/game/buildings/factory_level_1.png`
- `public/assets/game/buildings/factory_level_2.png`
- `public/assets/game/buildings/factory_level_3.png`
- `src/config/gameAssets.ts`: typed building artwork mapping and original alpha-content bounds.
- `src/components/BuildingIcon.tsx`: one image for the current settlement/factory stage, bottom-center anchor, company badge, focus/selection border and hit target.
- `src/components/Board.tsx`: render images at existing vertex coordinates; empty placement targets render above building artwork; retain existing click/keyboard upgrade flow; render readable dice labels above artwork.
- `src/engine/buildingLabels.ts`: presentation-only dice-label offsets within hex boundaries to reduce overlap with building images.
- `src/engine/buildingLabels.test.ts`: unobstructed labels, collision avoidance and containment at multiple zoom levels.
- `src/gameAssets.css`: non-animated company badge and keyboard focus styling.
- This report.

Earlier uncommitted irregular-map changes remain in the workspace. This task does not change construction rules, topology, market, auction, production, persistence or multiplayer logic.

## Asset handling

All five original 256×256 transparent PNGs were copied byte-for-byte from `asset/hous/`; no files were deleted or moved. No raster recoloring, generation or resampling was needed. Nested SVG viewports exclude transparent source padding and preserve aspect ratio. Each visible image is 28px high at fitted default zoom, with its bottom midpoint exactly at the existing vertex coordinate. At detailed zoom the image remains 28px; zooming farther out scales it down. Only a small badge is colored by company. A factory image replaces the settlement image visually while the underlying settlement data remains unchanged.

Dice labels receive small presentation offsets only when needed, constrained inside their original hex. Labels render after buildings with pointer events disabled, so crowded artwork cannot hide a number or intercept input. Empty vertex targets render after occupied vertices, preserving selection near a building. Existing construction popovers remain portals outside the SVG and show the same next upgrade action and confirmation costs.

## Verification results

- `npm run typecheck`: PASS, frontend and backend.
- `npm test`: PASS, **241 passed / 9 skipped**, 17 test files passed / 2 skipped. PostgreSQL/Neon integration tests were intentionally not connected. The existing 1,000-seed map and Socket.IO suites also pass.
- `npm run build`: PASS.
- `npm run server:build`: PASS.
- All five public and dist images match the original source bytes; all five Vite asset URLs return HTTP 200, `image/png`, and the original bytes.
- Browser check on an in-memory fixture: all five stage images render, four company badge colors appear, image hit rectangles confirm a 28px artwork height plus padding, vertex translation remains the anchor.
- Clicking an owned level-1 settlement shows exactly one next action, then the existing cost/confirmation table. After confirmation, the image changes from settlement_level_1 to settlement_level_2 at the unchanged anchor `(-45.89934640057525, -26.5)`.
- A free nearby vertex remains selectable in settlement placement mode and opens the existing “Vị trí khu định cư mới” popover.
- Default-zoom and detailed-map screenshots saved locally: `.render-verification/building-icons-map.png`, `.render-verification/building-icons-detail.png`; confirmation flow screenshot: `.render-verification/building-upgrade-confirm.png`.
- No Neon access, database changes or deployment performed. No commit/push was requested for this task.

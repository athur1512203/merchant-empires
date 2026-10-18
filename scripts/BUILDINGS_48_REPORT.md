# Uniform 48px building artwork

## Implementation

- Replaced the 20 company-prefixed PNGs in `public/assets/game/buildings/` with the latest files from `asset/hous/`. Copies are byte-identical; originals were not edited, moved or deleted.
- Removed legacy per-stage sizes and the 2x multiplier. `BUILDING_ICON_SIZE=48` is the sole frame size for every company and stage.
- Inspected alpha content for all 20 PNGs. At alpha >8 the visible subject occupies x=41…214, y=66…219 in every source. Viewport bounds include 1px padding: x=40, y=65, width=176, height=156. This normalizes actual source content, rather than relying only on CSS or full PNG dimensions.
- All images use the existing proportional SVG contain behavior and bottom-center anchoring. The frame is exactly 48×48 screen pixels at default zoom; the nonsquare subject retains its proportions inside that frame. Subject footprints are equivalent across all stages and companies.
- The existing vertex coordinates, upgrade actions, company ownership, company colors, number-label foreground layer, free-vertex hit targets and zoom/pan remain unchanged. No extraction, manufacturing capacity, pricing, auction, networking or persistence rules changed.

## Validation

- `npm test`: **256 passed / 9 skipped**, 19 test files passed / 2 skipped. PostgreSQL/Neon tests were not connected.
- Focused asset regression after strengthening alpha-bound checks: **4 passed**, covering all 20 files.
- `npm run typecheck`: PASS, frontend/backend.
- `npm run build`: PASS.
- `npm run server:build`: PASS.
- Original/public/dist bytes match for all 20 PNGs. All 20 Vite image URLs respond HTTP 200, `image/png`, and original bytes.
- Browser gallery renders the production BuildingIcon component for all 20 combinations: all measured 48×48 screen pixels. Four colors and all five stages visually verified. Measurement data saved locally.
- Actual map at fitted default zoom: all eight representative buildings measure exactly 48×48, including four companies and all five stages.
- Zoom in/out controls, pan and reset checked. Upgrading an owned settlement changes its PNG to level 2, remains 48×48 and retains vertex `(-45.89934640057525, -26.5)` and company color.
- Selecting a nearby free vertex still opens its normal construction popover. Number labels remain above building artwork.
- QA uses only an in-memory backend. No Neon access, schema changes, force push or manual deployment.

## Local screenshots

- `.render-verification/buildings-48-map.png`: default map, four companies and five stages.
- `.render-verification/buildings-48-zoom.png`: detailed zoom.
- `.render-verification/buildings-48-gallery.png`: all 20 icons rendered with 48px guides.
- `.render-verification/buildings-48-measurements.json`: 20 browser frame measurements.

## Changed files

- 20 company-prefixed PNGs in `public/assets/game/buildings/`.
- `src/config/gameAssets.ts`.
- `src/config/buildingAssetBounds.json`.
- `src/config/buildingAssets.test.ts`.
- This report.

Existing local source-folder changes are excluded from this commit.

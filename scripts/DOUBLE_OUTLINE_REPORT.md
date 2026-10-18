# Double-outline building artwork integration

## Selected assets

Used all 20 individual PNGs from `asset/hous/256px/`, rather than the old unoutlined set, the ZIP or a full sprite sheet. The supplied README identifies this as the double-outline collection. Each image was visually inspected in a contact sheet: blue-black outer edge, cream-gold inner edge, transparency, four company colors and all five stages. The 256px originals preserve edge quality on high-DPI displays.

Copied PNGs byte-for-byte to the existing company-prefixed paths in `public/assets/game/buildings/`. Originals were not modified, moved or deleted. No recoloring, hue-rotate, generated image, CSS border substitute or raster stretching was used.

The existing company/stage URL mapping remains correct: Iron Works/red, Timber Guild/green, Golden Trade/yellow, Ocean Empire/blue. Updated per-image alpha-content bounds with 1px padding, including the supplied double outline. The renderer continues to proportionally contain each cutout in the common 48×48 frame and center its actual content at the existing vertex. No vertex, renderer coordinate system, zoom/pan or construction action changed.

## Checks

- `npm run typecheck`: PASS (frontend/backend).
- `npm test`: **260 passed / 9 skipped**, 20 files passed / 2 skipped. The skipped tests require PostgreSQL; no Neon connection was made.
- `npm run build`: PASS.
- `npm run server:build`: PASS.
- All 20 PNGs decode and retain transparency. Source/public/dist/HTTP bytes match for every file. All 20 Vite asset URLs return HTTP 200, `image/png`.
- Updated the asset regression to validate each actual PNG's alpha bounds instead of the previous set's fixed dimensions. Existing renderer tests verify the visible content center for all 20 combinations.
- Browser gallery uses the actual BuildingIcon component over Metal, Wood, Wheat and Cotton tile backgrounds. All 20 frames measure 48×48px and have local SVG x/y = -24/-24. Company colors, levels and visible double edges checked at real 48px size.
- Actual map screenshot includes four companies, all five stages, interior and boundary vertices. All eight representative building frames are 48×48 and centered. Dice labels remain above artwork.
- Zoom in, wheel zoom out, pan and camera reset checked. Upgrading the owned settlement changes its company PNG to level 2 at the same vertex `(-45.89934640057525, -26.5)`, still 48×48 with local offsets -24/-24.
- Nearby free vertex remains selectable and opens the unchanged construction popover.
- QA backend uses only in-memory fixtures. No game rule, extraction, construction recipe, manufacturing capacity, auction, economy, multiplayer, database or schema changes. No manual deployment or force push.

## Local screenshots

- `.render-verification/buildings-double-outline-map.png`
- `.render-verification/buildings-double-outline-zoom.png`
- `.render-verification/buildings-double-outline-gallery.png`
- `.render-verification/double-outline-contact.png`

## Changed files (23)

- 20 PNGs in `public/assets/game/buildings/`: each company prefix (`iron_works`, `timber_guild`, `golden_trade`, `ocean_empire`) × each stage (`settlement_level_1`, `settlement_level_2`, `factory_level_1`, `factory_level_2`, `factory_level_3`).
- `src/config/buildingAssetBounds.json`.
- `src/config/buildingAssets.test.ts`.
- This report.

Existing local changes in the source asset folder are excluded from this commit.

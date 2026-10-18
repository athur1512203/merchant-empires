# Company building artwork and 2x render size

## Scope and asset handling

20 new original 256×256 transparent PNGs were copied byte-for-byte from `asset/hous/` into `public/assets/game/buildings/`: five stages for each of `iron_works`, `timber_guild`, `golden_trade`, `ocean_empire`. Source PNGs and 64px variants were not edited, moved or deleted. Pre-existing source-folder deletions/untracked files are excluded from this commit. Existing generic public PNGs remain available for compatibility.

Company IDs map in the existing game order: 0 Iron Works/red, 1 Timber Guild/green, 2 Golden Trade/yellow, 3 Ocean Empire/blue. A factory selects its level-specific company image while retaining the settlement data. No image tint/filter is applied.

## Measured dimensions and anchoring

Browser measurements at fitted default zoom, before and after the change:

| Stage | Previous frame px | New frame px |
| --- | --- | --- |
| Settlement 1 | 26.6257668712 × 28 | 53.2515337423 × 56 |
| Settlement 2 | 28.1666666667 × 28 | 56.3333333333 × 56 |
| Factory 1 | 21.1891891892 × 28 | 42.3783783784 × 56 |
| Factory 2 | 24.6702702703 × 28 | 49.3405405405 × 56 |
| Factory 3 | 25.2756756757 × 28 | 50.5513513514 × 56 |

Both frame dimensions are exactly doubled. New artwork is proportionally contained inside its stage frame, aligned bottom-center; different source artwork proportions can leave internal space. SVG viewports focus on the opaque subject with 2px padding, ignoring stray near-transparent edge pixels; the PNG bytes and alpha remain unchanged. Coordinates remain the existing board vertices. Default/detailed zoom behavior is retained: frame dimensions stay fixed while zooming in and shrink when zooming out below the fitted view.

At doubled size, nearby buildings can overlap visually. Existing number labels remain within their cells, seek a lower-overlap position and paint above artwork. Added transparent 7px anchor targets keep every occupied vertex directly clickable despite overlapping images; existing free-vertex targets and keyboard buttons are retained. No economic, construction, map generation, auction, multiplayer, snapshot or database rules changed.

## Validation

- `npm run typecheck`: PASS.
- `npm test`: **245 passed / 9 skipped**, 18 test files passed / 2 skipped. PostgreSQL tests were not connected; no Neon access occurred.
- Final focused run after viewport bounds refinement: **7 passed** (all 20 asset mappings/dimensions/transparency and label containment).
- `npm run build`: PASS (final production build).
- `npm run server:build`: PASS.
- All 20 source/public/dist PNGs match byte-for-byte; 20 Vite URLs return HTTP 200, `image/png`, with original bytes.
- Browser measured eight representative building frames before/after: width and height ratios exactly 2.000; all anchor coordinates unchanged.
- Existing owned settlement upgrade UI shows one next action, then the cost confirmation. Upgrade changes `iron_works_settlement_level_1.png` to `iron_works_settlement_level_2.png` at the same vertex `(-45.89934640057525, -26.5)`.
- A nearby free vertex remains clickable in placement mode and opens the existing construction popover.
- Four company colors, all five stages, fitted/detailed zoom, pan and camera reset checked on a memory-only QA backend.
- No manual deployment, force push, or Neon data changes.

Local evidence in `.render-verification/`: `building-colors-default.png`, `building-colors-zoom.png`, `building-colors-source-contact.png`, `building-colors-before.json`, `building-colors-after.json`.

## Changed files

- 20 company-prefixed PNGs in `public/assets/game/buildings/`.
- `src/components/Board.tsx`, `src/components/BuildingIcon.tsx`.
- `src/config/gameAssets.ts`, `src/config/buildingAssetBounds.json`, `src/config/buildingAssets.test.ts`.
- `src/engine/buildingLabels.ts`, `src/engine/buildingLabels.test.ts`.
- This report.

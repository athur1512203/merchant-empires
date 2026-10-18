# Building image center at hex vertices

## Change

- Preserved all 20 PNGs, their normalized alpha-content viewports and 48×48 default-zoom frames.
- Changed the local SVG viewport from `x=-24, y=-48` to `x=-24, y=-24`, using `xMidYMid meet`. Its parent still translates to the original algorithm-generated vertex; no vertex coordinates or corrective world offsets changed.
- Centered the hit rectangle and selection outline on the same origin. Moved the company badge into the lower-right corner of the frame; colors and stage mapping are unchanged.
- Updated the presentation-only number-label collision rectangle to match centered artwork. Number labels retain their foreground layer and the existing vertex/anchor click priorities remain unchanged.

## Validation

- `npm run typecheck`: PASS (frontend/backend).
- `npm test`: **260 passed / 9 skipped**, 20 test files passed / 2 skipped. PostgreSQL/Neon tests were not connected.
- `npm run build`: PASS.
- `npm run server:build`: PASS.
- New renderer regression covers all 20 company/stage combinations. It renders the real component, decodes the actual PNG alpha-content bounds and projects the subject center through the SVG contain viewport. Every subject center is `(0,0)`, rather than merely centering the original PNG canvas.
- Browser fixture uses only memory and includes six interior vertices and two boundary vertices. Default-frame measurements: all eight are 48×48; maximum center/vertex screen discrepancy is **0.0000152588 px** (floating-point screen bounds). Every vertex translation matches the before snapshot.
- Zoom in, wheel zoom out, pan and camera reset checked. All hit rectangles remain symmetric around their vertex at different zoom levels.
- Clicking the owned level-1 settlement opens its existing upgrade action. After confirmation the level-2 company PNG remains centered at vertex `(-45.89934640057525, -26.5)` with local SVG offsets `(-24,-24)`.
- A nearby factory remains separately selectable, and a free neighboring vertex opens its existing construction popover.
- No asset, construction-rule, production, auction, multiplayer, map-topology or database changes. No Neon access, force push or manual deployment.

## Local evidence

- `.render-verification/buildings-center-before.png`
- `.render-verification/buildings-center-after.png`
- `.render-verification/buildings-center-zoom.png`
- `.render-verification/buildings-center-measurements.json`

## Changed files

- `src/components/BuildingIcon.tsx`
- `src/components/BuildingIcon.test.ts`
- `src/engine/buildingLabels.ts`
- `src/engine/buildingLabels.test.ts`
- This report.

Existing source-asset working-tree changes are excluded from this commit.

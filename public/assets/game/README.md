# Merchant Empires game artwork

14 optimized WebP derivatives of the supplied `asset/assets/*.png` files:

- Tiles: metal, wood, wheat, cotton.
- Resource icons: metal, wood, wheat, cotton.
- Goods icons: machinery, rail, furniture, flour, fabric, clothing.

Regenerate with `npm run assets:prepare` when the original local source directory is available. The source directory is not required for `npm ci` or production builds; the generated files are committed. The pipeline never modifies originals. `manifest.json` records their SHA-256 hashes, original/output dimensions and byte counts.

Tiles retain their original artwork and are clipped by the map's SVG hexagons. Icons retain their original dark backgrounds. Background removal was attempted with the built-in imagegen tool on machinery, using this prompt:

> Use case: background-extraction. Edit target: supplied machinery icon for Merchant Empires. Remove only the nearly black rectangular background and border, output genuine transparency. Preserve the exact industrial machine/gear subject, original colors, shape, perspective, painted Industrial Revolution style and all metal and dark details. No redesign, no added objects, no text. Keep complete object uncropped.

The result retained a dark background and changed the source detail, so it was rejected. All ten original icons were retained to preserve fidelity. No generated replacement artwork is shipped. A future transparent source export can replace these derivatives without altering gameplay.

WebP quality 88, no upscaling, proportional fit: tiles up to 360px, icons up to 192px. Total image payload: **2,042,990 → 345,964 bytes (83.1% smaller)**.

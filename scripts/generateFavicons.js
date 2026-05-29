/**
 * Trim the transparent padding around `public/images/Brand_Ruvia.png` and
 * regenerate favicon assets so the logo fills the tab icon instead of
 * appearing tiny inside a big empty square.
 *
 * Outputs (Next.js App Router auto-discovers all of these):
 *   app/icon.png         — primary favicon (512×512, fills frame)
 *   app/apple-icon.png   — iOS home-screen icon (180×180)
 *
 * Usage:
 *   node scripts/generateFavicons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'public', 'images', 'Brand_Ruvia.png');
const OUT_ICON = path.resolve(__dirname, '..', 'app', 'icon.png');
const OUT_APPLE = path.resolve(__dirname, '..', 'app', 'apple-icon.png');

const main = async () => {
  if (!fs.existsSync(SRC)) {
    console.error('Source not found:', SRC);
    process.exit(1);
  }

  // 1. Trim transparent edges so the logo fills the frame.
  // 2. Place onto a square canvas so final icon is square (browsers crop
  //    rectangular favicons unpredictably).
  // 3. Add a small inner margin (~6%) so the logo doesn't kiss the edge.
  const trimmed = await sharp(SRC).trim({ threshold: 1 }).toBuffer();
  const trimMeta = await sharp(trimmed).metadata();
  const longest = Math.max(trimMeta.width, trimMeta.height);
  const margin = Math.round(longest * 0.06);
  const canvas = longest + margin * 2;

  const square = await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, gravity: 'center' }])
    .png()
    .toBuffer();

  await sharp(square)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUT_ICON);
  console.log('Wrote', OUT_ICON);

  await sharp(square)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUT_APPLE);
  console.log('Wrote', OUT_APPLE);

  console.log('Done. Hard-refresh browser tabs to see the new favicon.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Dry-run helper for seedRuviaProducts.js. Prints the parsed image groupings
 * without touching MongoDB or Cloudinary.
 */
const path = require('path');
const fs = require('fs');

const IMAGES_DIR = path.resolve(__dirname, 'Products images');

const parseImageFilename = (filename) => {
  const base = filename.replace(/\.(png|jpe?g|webp)$/i, '');
  const m = base.match(/^Product\s*(\d+)(?:\s*img\s*(\d+))?\s*$/i);
  if (!m) return null;
  return { product: Number(m[1]), image: m[2] ? Number(m[2]) : 1 };
};

const files = fs.readdirSync(IMAGES_DIR);
const grouped = new Map();
const skipped = [];
for (const f of files) {
  if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
  const p = parseImageFilename(f);
  if (!p) {
    skipped.push(f);
    continue;
  }
  const arr = grouped.get(p.product) || [];
  arr.push({ filename: f, order: p.image });
  grouped.set(p.product, arr);
}

for (const [k, list] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
  list.sort((a, b) => a.order - b.order);
  console.log(`Product ${k}: ${list.length} image(s)`);
  for (const item of list) {
    console.log(`  ${item.order}. ${item.filename}`);
  }
}

if (skipped.length) {
  console.log('');
  console.log('Unrecognized files (will be skipped):');
  for (const s of skipped) console.log('  ' + s);
}

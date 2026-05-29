/**
 * Upload `public/vedioes/Ruvia.mp4` to Cloudinary so the storefront hero
 * section can stream it from a CDN instead of bundling 24 MB into the Vercel
 * deploy. Idempotent: uses a fixed `public_id` so re-runs overwrite the same
 * asset rather than creating duplicates.
 *
 * Usage:
 *   cd backend
 *   node scripts/uploadHeroVideo.js
 *
 * Required env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * CLOUDINARY_API_SECRET (already configured in backend/.env).
 *
 * Output: prints the secure CDN URL on success — paste that into
 * `app/page.js` hero `<source src="…">`.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const cloudinary = require('../config/cloudinary');

const VIDEO_PATH = path.resolve(__dirname, '..', '..', 'public', 'vedioes', 'Ruvia.mp4');
const FOLDER = 'ruvia_site';
const PUBLIC_ID = 'hero_video';

const main = async () => {
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`Video not found at: ${VIDEO_PATH}`);
    process.exit(1);
  }

  const sizeMB = (fs.statSync(VIDEO_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(`Uploading ${VIDEO_PATH} (${sizeMB} MB) to Cloudinary…`);

  // upload_large chunks the file at 6 MB by default — handles 24 MB cleanly
  // and gives us resumable behaviour if the connection blips.
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      VIDEO_PATH,
      {
        resource_type: 'video',
        folder: FOLDER,
        public_id: PUBLIC_ID,
        overwrite: true,
        invalidate: true, // bust any prior CDN cache
        chunk_size: 6 * 1024 * 1024,
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );
  });

  console.log('\nUpload complete.');
  console.log('  public_id   :', result.public_id);
  console.log('  format      :', result.format);
  console.log('  duration    :', result.duration, 's');
  console.log('  bytes       :', result.bytes);
  console.log('  secure_url  :', result.secure_url);
  console.log('\nPaste this into app/page.js hero <source src=…>:');
  console.log(`  ${result.secure_url}`);
};

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});

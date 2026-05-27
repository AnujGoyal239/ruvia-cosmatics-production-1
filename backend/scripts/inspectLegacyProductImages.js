/**
 * Read-only inspection helper for the Cloudinary migration.
 *
 * Lists how many Product documents still have legacy /images/* paths,
 * shows a sample, and reports which corresponding files exist on disk.
 * Does not modify anything in MongoDB or upload to Cloudinary.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Product = require('../models/productModel');

const run = async () => {
  await connectDB();

  const total = await Product.countDocuments({});
  const legacyCount = await Product.countDocuments({
    image: { $regex: '^/images/', $options: 'i' },
  });
  const cloudinaryCount = await Product.countDocuments({
    image: { $regex: '^https?://', $options: 'i' },
  });

  console.log(`Total products: ${total}`);
  console.log(`Legacy /images/* products: ${legacyCount}`);
  console.log(`Cloudinary/https products: ${cloudinaryCount}`);
  console.log('');

  if (legacyCount === 0) {
    console.log('Nothing to migrate. All product images are already remote.');
    process.exit(0);
  }

  const candidates = await Product.find({
    image: { $regex: '^/images/', $options: 'i' },
  })
    .select('id name image')
    .lean();

  const frontendPublic = path.resolve(__dirname, '..', '..', 'Frontend', 'public');

  let onDisk = 0;
  let missingOnDisk = 0;

  console.log('Candidates:');
  for (const p of candidates) {
    const rel = String(p.image || '').replace(/^\/+/, '');
    const abs = path.join(frontendPublic, rel);
    const exists = fs.existsSync(abs);
    if (exists) onDisk += 1;
    else missingOnDisk += 1;
    console.log(
      `  ${exists ? 'OK ' : '!! '} ${p.id || '(no id)'} - ${p.image} - ${exists ? 'on disk' : 'NOT FOUND'}`
    );
  }

  console.log('');
  console.log(`Will upload: ${onDisk}`);
  console.log(`Will skip (file missing): ${missingOnDisk}`);

  process.exit(0);
};

run().catch((err) => {
  console.error('Inspection failed:', err.message);
  process.exit(1);
});

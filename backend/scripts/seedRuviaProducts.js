/**
 * Seed the Ruvia product catalog into MongoDB and upload its photography to
 * Cloudinary in one pass.
 *
 * What this script does:
 *   1. Connects to MONGO_URI.
 *   2. Walks `backend/scripts/Products images/` and groups files by product
 *      number using a tolerant filename parser (handles "Product 1 img 1",
 *      "Product 1img 4", "Product 7 img 2", "Product7 img 1", and
 *      single-image variants like "Product 5"). The numeric image index
 *      determines display order, so img 1 becomes the primary cover.
 *   3. Uploads each image to Cloudinary under folder `ruvia_products/<slug>`
 *      with a stable `public_id` (e.g. `rice-potato-luminance-soap-1`) so
 *      re-runs replace the same asset rather than duplicating it.
 *   4. Wipes the existing `products` collection and inserts the 13 records
 *      with full descriptions, key benefits, categories, and pricing.
 *
 * Idempotent: re-running drops + re-inserts products and overwrites the
 * Cloudinary assets at the same `public_id`. Existing customer orders are
 * untouched (they keep their point-in-time `image` snapshot).
 *
 * Usage:
 *   cd backend
 *   node scripts/seedRuviaProducts.js
 *
 * Required env: MONGO_URI, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * CLOUDINARY_API_SECRET.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Product = require('../models/productModel');
const cloudinary = require('../config/cloudinary');

// ---------------------------------------------------------------------------
// 1) Product catalog — copy of the data the client provided. Order in this
//    array becomes display order on the storefront.
// ---------------------------------------------------------------------------

const products = [
  {
    productNumber: 1,
    id: 'rice-potato-luminance-soap',
    name: 'Ruvia Cosmetic Rice & Potato Luminance Bath Soap Bar',
    tag: 'Koji Rice + Potato Extract + Vitamin E, 100g',
    price: 199,
    category: 'Soap Bars',
    concern: 'Brightening',
    description:
      'Ruvia Cosmetic Rice & Potato Luminance Bath is a handcrafted bathing bar that brings together the traditional power of purifying Koji Rice and soothing Potato Extract for deeply renewed, vibrant skin. Enriched with a nourishing blend of Goat Milk Base, Vitamin E, Jojoba Oil, and Essential Oil, this 100g soap bar gently cleanses impurities and excess oil while leaving your skin feeling irresistibly soft and smooth. Regular use helps brighten and even out skin tone, reduce tan and dullness, and promote a naturally healthy glow suitable for daily care.',
    ingredients: ['Koji Rice', 'Potato Extract', 'Vitamin E', 'Goat Milk Base', 'Jojoba Oil', 'Essential Oils'],
    usage:
      'Wet your skin, apply the bar and gently massage. Leave for 20–30 seconds, then rinse thoroughly. For best results, use twice daily. Made in India. For external use only — avoid contact with eyes and discontinue use if irritation occurs.',
    benefits: [
      'Brightens and evens skin tone',
      'Reduces tan and dullness',
      'Cleanses impurities and excess oil',
      'Leaves skin soft and smooth',
      'Suitable for daily care',
    ],
  },
  {
    productNumber: 2,
    id: 'glass-skin-body-bath',
    name: 'Ruvia Cosmetics All in One Glass Skin Body Bath',
    tag: 'Rice Powder + Vitamin C + Vitamin E, Deep Exfoliation, 250g',
    price: 399,
    category: 'Body Care',
    concern: 'Exfoliation',
    description:
      'Ruvia Cosmetics All in One Glass Skin Body Bath is a powerful, nature-inspired skincare blend formulated with Rice Powder, Vitamin C, and Vitamin E to reveal visibly smoother, softer, and more radiant skin. This pure powder-based body bath gently exfoliates dead skin cells, removes tan, and deeply cleanses pores, giving your skin an instant glow with every use. Free from parabens, cruelty-free, and suitable for all skin types — a refreshing, spa-like bathing experience at home. Net Weight: 250g.',
    ingredients: ['Rice Powder', 'Vitamin C', 'Vitamin E'],
    usage:
      'Apply on damp skin, massage gently, focus on rough areas, then rinse thoroughly. Use twice weekly for best results.',
    benefits: [
      'Reveals smoother, softer skin',
      'Removes tan and dead skin cells',
      'Deeply cleanses pores',
      'Instant glow with every use',
      'Paraben-free and cruelty-free',
    ],
  },
  {
    productNumber: 3,
    id: 'organic-neem-leaf-powder',
    name: 'Ruvia Cosmetic Organic Neem Leaf Powder',
    tag: 'For Skin, Hair and Face Packs, 200g — Detox, Purify, Glow',
    price: 199,
    category: 'Powders',
    concern: 'Acne & Detox',
    description:
      'Ruvia Cosmetic Organic Neem Leaf Powder is a powerful herbal beauty essential crafted from 100% pure and natural neem leaves. Known for its deep purifying properties, this versatile powder helps reduce acne and pimples, control excess oil, and detoxify the skin for a naturally healthy glow. It also supports scalp and hair health, making it an ideal ingredient for face packs, hair masks, and DIY skincare remedies. Completely free from chemicals, parabens, sulphates, preservatives, and cruelty-free.',
    ingredients: ['100% Pure Neem Leaf Powder'],
    usage:
      'Mix with water or rose water to form a smooth paste. Apply evenly on skin or scalp, leave for 10–15 minutes, then rinse off.',
    benefits: [
      'Reduces acne and pimples',
      'Controls excess oil',
      'Detoxifies the skin',
      'Supports scalp and hair health',
      'Suitable for all skin types',
    ],
  },
  {
    productNumber: 4,
    id: 'organic-rose-petal-powder',
    name: 'Ruvia Cosmetics Organic Rose Petal Powder',
    tag: 'For Glowing Skin — Natural Face Pack Powder',
    price: 249,
    category: 'Powders',
    concern: 'Brightening',
    description:
      'Experience the natural goodness of roses with Ruvia Cosmetics Organic Rose Petal Powder. Made from carefully selected rose petals, this premium skincare powder helps cleanse, tone, and refresh the skin naturally. Its gentle formula supports radiant, glowing, and healthy-looking skin while providing a soothing floral experience. Perfect for DIY face packs, ubtan, and skincare routines.',
    ingredients: ['Organic Rose Petal Powder'],
    usage:
      'Mix with rose water, milk, curd, or aloe vera gel to make a smooth paste. Apply evenly, leave for 10–15 minutes, then rinse off. Use 2–3 times a week.',
    benefits: [
      'Naturally brightens and refreshes skin',
      'Improves skin glow and softness',
      'Cleanses excess oil and impurities',
      'Perfect for DIY face masks and ubtan',
      'Gentle and suitable for all skin types',
    ],
  },
  {
    productNumber: 5,
    id: 'omega-glow-cleanser',
    name: 'Ruvia Cosmetic Omega Glow Cleanser',
    tag: 'Herbal Face Cleanser with Coffee Robusta + Lemon + Sunflower + Flaxseed',
    price: 349,
    category: 'Cleansers',
    concern: 'Acne & Glow',
    description:
      'A gentle yet effective herbal face cleanser enriched with Coffee Robusta Seed Extract, Lemon Extract, Sunflower Seed Extract, and Flaxseed Powder to deeply cleanse, exfoliate, and nourish the skin. Designed to help reduce acne, blackheads, and excess oil while giving your skin a healthy natural glow.',
    ingredients: [
      'Coffee Robusta Seed Extract',
      'Lemon Extract',
      'Sunflower Seed Extract',
      'Flaxseed Powder',
    ],
    usage:
      'Apply on damp skin, massage gently in circular motions, then rinse with water. Use morning and night for daily skincare.',
    benefits: [
      'Deeply cleanses impurities and excess oil',
      'Helps control acne and blackheads',
      'Gently exfoliates dead skin',
      'Hydrates and nourishes the skin',
      'Gives a fresh radiant glow',
    ],
  },
  {
    productNumber: 6,
    id: 'organic-papaya-powder',
    name: 'Ruvia Cosmetic Organic Papaya Powder',
    tag: '100% Natural — Brighten, Cleanse, Rejuvenate',
    price: 299,
    category: 'Powders',
    concern: 'Brightening',
    description:
      'A 100% natural and chemical-free papaya powder made from premium organic green papaya, specially formulated to brighten, cleanse, and rejuvenate the skin naturally. Rich in vitamins, antioxidants, and natural exfoliating properties, this powder helps remove tan, dead skin cells, and impurities while promoting an even skin tone and healthy glow.',
    ingredients: ['Organic Green Papaya Powder'],
    usage:
      'Mix with rose water, milk, curd, or aloe vera gel to create a smooth paste. Apply evenly on face or body, leave for 10–15 minutes, then rinse off. Use 2–3 times a week.',
    benefits: [
      'Brightens and refreshes dull skin',
      'Gently exfoliates dead skin cells',
      'Helps reduce tan and pigmentation',
      'Promotes healthy glowing skin',
      'Rich in vitamins and antioxidants',
      '100% pure, natural and chemical-free',
    ],
  },
  {
    productNumber: 7,
    id: 'mogra-grapes-soap',
    name: 'Ruvia Cosmetics Mogra Grapes Soap',
    tag: 'Handmade Perfume Soap',
    price: 189,
    category: 'Soap Bars',
    concern: 'Hydration',
    description:
      'Indulge your skin in the soothing essence of mogra and the nourishing touch of grape extracts. Ruvia Cosmetics Mogra Grapes Soap gently cleanses, hydrates, and refreshes your skin while leaving behind a soft floral fragrance. Handcrafted for a luxurious bathing experience.',
    ingredients: ['Mogra Fragrance', 'Grape Extract'],
    usage: 'Lather on wet skin, massage gently, rinse thoroughly. Use daily.',
    benefits: [
      'Soft mogra floral fragrance',
      'Enriched with grape extract',
      'Gentle and nourishing',
      'Suitable for all skin types',
    ],
  },
  {
    productNumber: 8,
    id: 'mint-aqua-grapes-soap',
    name: 'Ruvia Cosmetics Mint N Aqua Grapes Soap',
    tag: 'Handmade Perfume Soap',
    price: 189,
    category: 'Soap Bars',
    concern: 'Refreshing',
    description:
      'Refresh your senses with the cooling blend of mint, aqua freshness, and nourishing grape extracts. Ruvia Cosmetics Mint N Aqua Grapes Soap deeply cleanses the skin while providing a fresh, hydrated, and revitalized feel after every wash.',
    ingredients: ['Mint Extract', 'Aqua Notes', 'Grape Extract'],
    usage: 'Lather on wet skin, massage gently, rinse thoroughly. Use daily.',
    benefits: [
      'Cool mint and aqua fragrance',
      'Enriched with grape extract',
      'Deep cleansing formula',
      'Refreshing and hydrating',
      'Suitable for all skin types',
    ],
  },
  {
    productNumber: 9,
    id: 'palash-flower-grapes-soap',
    name: 'Ruvia Cosmetics Palash Flower Grapes Soap',
    tag: 'Handmade Perfume Soap',
    price: 189,
    category: 'Soap Bars',
    concern: 'Hydration',
    description:
      'Experience the beauty of nature with the delicate touch of Palash flower and the goodness of grape extracts. Ruvia Cosmetics Palash Flower Grapes Soap gently cleanses and nourishes your skin while leaving a soft floral aroma that feels refreshing and luxurious.',
    ingredients: ['Palash Flower Extract', 'Grape Extract'],
    usage: 'Lather on wet skin, massage gently, rinse thoroughly. Use daily.',
    benefits: [
      'Natural Palash flower fragrance',
      'Enriched with grape extract',
      'Soft and nourishing care',
      'Refreshes and hydrates skin',
      'Suitable for all skin types',
    ],
  },
  {
    productNumber: 10,
    id: 'lemon-grapes-soap',
    name: 'Ruvia Cosmetics Lemon Grapes Soap',
    tag: 'Handmade Perfume Soap',
    price: 189,
    category: 'Soap Bars',
    concern: 'Refreshing',
    description:
      'Brighten your skincare routine with the refreshing blend of lemon and nourishing grape extracts. Ruvia Cosmetics Lemon Grapes Soap deeply cleanses the skin, helping remove excess oil and impurities while leaving your skin feeling fresh, soft, and energized.',
    ingredients: ['Lemon Extract', 'Grape Extract'],
    usage: 'Lather on wet skin, massage gently, rinse thoroughly. Use daily.',
    benefits: [
      'Refreshing lemon fragrance',
      'Enriched with grape extract',
      'Deep cleansing and refreshing',
      'Hydrating and skin softening',
      'Suitable for all skin types',
    ],
  },
  {
    productNumber: 11,
    id: 'beetroot-grapes-soap',
    name: 'Ruvia Cosmetics Beetroot Grapes Soap',
    tag: 'Handmade Perfume Soap',
    price: 189,
    category: 'Soap Bars',
    concern: 'Glow',
    description:
      'Pamper your skin with the natural richness of beetroot and grape extracts. Ruvia Cosmetics Beetroot Grapes Soap gently cleanses while helping your skin feel soft, refreshed, and naturally radiant. Infused with a soothing fruity aroma.',
    ingredients: ['Beetroot Extract', 'Grape Extract'],
    usage: 'Lather on wet skin, massage gently, rinse thoroughly. Use daily.',
    benefits: [
      'Enriched with beetroot and grape extracts',
      'Nourishing and hydrating formula',
      'Helps maintain soft and glowing skin',
      'Refreshing fruity fragrance',
      'Suitable for all skin types',
    ],
  },
  {
    productNumber: 12,
    id: 'rose-petal-grapes-soap',
    name: 'Ruvia Cosmetics Rose Petal Grapes Soap',
    tag: 'Handmade Perfume Soap',
    price: 189,
    category: 'Soap Bars',
    concern: 'Hydration',
    description:
      'Indulge in the luxurious blend of delicate rose petals and nourishing grape extracts with Ruvia Cosmetics Rose Petal Grapes Soap. Gently cleanses and hydrates the skin while leaving behind a soft floral fragrance that feels fresh and elegant.',
    ingredients: ['Rose Petals', 'Grape Extract'],
    usage: 'Lather on wet skin, massage gently, rinse thoroughly. Use daily.',
    benefits: [
      'Soft rose floral fragrance',
      'Enriched with rose petals and grape extracts',
      'Nourishing and hydrating formula',
      'Helps maintain smooth and glowing skin',
      'Suitable for all skin types',
    ],
  },
  {
    productNumber: 13,
    id: 'glycerine-grapes-soap',
    name: 'Glycerine & Grapes Extract Soap',
    tag: 'Daily Cleansing Bar',
    price: 189,
    category: 'Soap Bars',
    concern: 'Hydration',
    description:
      'Enriched with the goodness of glycerine and grape extracts, this soap gently cleanses your skin while helping maintain natural moisture. Grapes are known for their antioxidant properties that help refresh and brighten the skin, leaving it feeling soft, smooth, and nourished after every wash.',
    ingredients: ['Glycerine', 'Grape Extract'],
    usage: 'Lather on wet skin, massage gently, rinse thoroughly. Use daily.',
    benefits: [
      'Deeply moisturizes skin',
      'Maintains soft and smooth texture',
      'Rich in antioxidant grape extracts',
      'Gentle daily cleansing',
      'Refreshing fruity fragrance',
    ],
  },
];

const DEFAULT_STOCK = 100;
const CLOUDINARY_FOLDER = 'ruvia_products';
const IMAGES_DIR = path.resolve(__dirname, 'Products images');

// ---------------------------------------------------------------------------
// 2) Filename parser — tolerant of inconsistent spacing.
// ---------------------------------------------------------------------------

/**
 * Parse a filename like "Product 1 img 1.png", "Product 1img 4.png",
 * "Product7 img 2.png", or "Product 5.png" into { product, image }.
 * Single-image variants (no `img <n>`) are treated as image index 1.
 */
const parseImageFilename = (filename) => {
  const base = filename.replace(/\.(png|jpe?g|webp)$/i, '');
  const m = base.match(/^Product\s*(\d+)(?:\s*img\s*(\d+))?\s*$/i);
  if (!m) return null;
  return {
    product: Number(m[1]),
    image: m[2] ? Number(m[2]) : 1,
  };
};

/**
 * Walk the images folder and return a Map keyed by productNumber, where each
 * entry is the list of absolute file paths sorted by their image index.
 */
const collectImagesByProduct = () => {
  if (!fs.existsSync(IMAGES_DIR)) {
    throw new Error(`Images directory not found at ${IMAGES_DIR}`);
  }
  const files = fs.readdirSync(IMAGES_DIR);
  const grouped = new Map();
  const skipped = [];

  for (const filename of files) {
    if (!/\.(png|jpe?g|webp)$/i.test(filename)) continue;
    const parsed = parseImageFilename(filename);
    if (!parsed) {
      skipped.push(filename);
      continue;
    }
    const arr = grouped.get(parsed.product) || [];
    arr.push({ path: path.join(IMAGES_DIR, filename), order: parsed.image, filename });
    grouped.set(parsed.product, arr);
  }

  // Sort each product's images by their numeric index so img 1 ends up first.
  for (const [k, list] of grouped.entries()) {
    list.sort((a, b) => a.order - b.order);
    grouped.set(k, list);
  }

  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} unrecognized files:`, skipped);
  }

  return grouped;
};

// ---------------------------------------------------------------------------
// 3) Cloudinary uploader — stable public_ids so re-runs replace assets.
// ---------------------------------------------------------------------------

const isCloudinaryConfigured = () =>
  !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

const uploadProductImages = async (productSlug, files) => {
  if (files.length === 0) return [];
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const publicId = `${productSlug}-${i + 1}`; // e.g. rice-potato-luminance-soap-1

    // Cloudinary's regular `upload` endpoint caps source files at 10 MB on
    // free plans. `upload_large` handles chunked uploads for anything above
    // that. Pick based on file size to avoid spurious 400s.
    const stat = fs.statSync(file.path);
    const useChunked = stat.size > 9 * 1024 * 1024;
    const opts = {
      folder: CLOUDINARY_FOLDER,
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
      // Cap delivery size: 2000px on the longest side keeps product photos
      // crisp without bloating the asset. `quality: auto` and
      // `fetch_format: auto` let Cloudinary serve WebP/AVIF when the client
      // supports it.
      transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
      quality: 'auto',
      fetch_format: 'auto',
    };

    const result = useChunked
      ? await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_large(
            file.path,
            { ...opts, chunk_size: 6 * 1024 * 1024 },
            (err, res) => (err ? reject(err) : resolve(res))
          );
        })
      : await cloudinary.uploader.upload(file.path, opts);

    urls.push(result.secure_url);
    console.log(`  uploaded ${file.filename}${useChunked ? ' (chunked)' : ''} -> ${result.secure_url}`);
  }
  return urls;
};

// ---------------------------------------------------------------------------
// 4) Main entrypoint.
// ---------------------------------------------------------------------------

const run = async () => {
  if (!isCloudinaryConfigured()) {
    console.error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.'
    );
    process.exit(1);
  }

  await connectDB();

  console.log('Scanning images folder…');
  const imagesByProduct = collectImagesByProduct();
  console.log(`Found image groups for products: [${[...imagesByProduct.keys()].sort((a, b) => a - b).join(', ')}]`);

  // Hard-fail if any product has no images. Better to abort than seed a doc
  // that violates the schema's required `image` field.
  for (const p of products) {
    const list = imagesByProduct.get(p.productNumber);
    if (!list || list.length === 0) {
      console.error(`No images found for product #${p.productNumber} (${p.name}). Aborting.`);
      process.exit(1);
    }
  }

  console.log('Wiping existing products collection…');
  await Product.deleteMany({});

  console.log('Uploading images and inserting product documents…');
  const created = [];
  for (const p of products) {
    console.log(`Product ${p.productNumber}: ${p.name}`);
    const files = imagesByProduct.get(p.productNumber);
    const urls = await uploadProductImages(p.id, files);

    const doc = await Product.create({
      id: p.id,
      name: p.name,
      tag: p.tag,
      price: p.price,
      originalPrice: p.price,
      category: p.category,
      concern: p.concern,
      description: p.description,
      ingredients: p.ingredients || [],
      usage: p.usage,
      benefits: p.benefits || [],
      image: urls[0],
      images: urls,
      countInStock: DEFAULT_STOCK,
    });
    created.push(doc);
  }

  console.log('');
  console.log(`Done. Inserted ${created.length} products.`);
  for (const doc of created) {
    console.log(`  ${doc.id}  • ${doc.images.length} images  • ₹${doc.price}`);
  }
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

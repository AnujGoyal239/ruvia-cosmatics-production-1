/**
 * Hard-reset the products collection.
 *
 * Drops the entire `products` collection (data + indexes) so the next run of
 * seedRuviaProducts.js starts from a guaranteed empty state. Mongoose
 * recreates the indexes on the next model save.
 *
 * Usage:
 *   cd backend
 *   node scripts/wipeProducts.js
 */

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    const conn = mongoose.connection;
    console.log(`Connected: db=${conn.name} host=${conn.host}`);

    const collections = await conn.db.listCollections({ name: 'products' }).toArray();
    if (collections.length === 0) {
      console.log('Collection "products" does not exist. Nothing to drop.');
    } else {
      const before = await conn.db.collection('products').countDocuments();
      console.log(`Dropping "products" (${before} documents)…`);
      await conn.db.collection('products').drop();
      console.log('Dropped.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Wipe failed:', err.message || err);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* ignore */
    }
  }
})();

/**
 * Quick connectivity check for MongoDB Atlas + Cloudinary before running the
 * full seed. Fails fast with a clear message so we don't waste a partial run.
 */
const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');

(async () => {
  try {
    console.log('Mongo: connecting…');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log(`Mongo: connected to ${mongoose.connection.host} db=${mongoose.connection.name}`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Mongo connection failed:', err.message);
    process.exit(1);
  }

  try {
    console.log('Cloudinary: pinging…');
    const res = await cloudinary.api.ping();
    console.log('Cloudinary: ok', res);
  } catch (err) {
    console.error('Cloudinary ping failed:', err.message || err);
    process.exit(1);
  }

  console.log('All connections healthy.');
  process.exit(0);
})();

/**
 * Smoke-test that the admin password actually verifies via the model's
 * `matchPassword` helper. Useful right after running createAdmin.js to be
 * sure the bcrypt hash was written correctly and the policy regex didn't
 * silently mangle anything.
 */
const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const User = require('../models/userModel');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!email || !password) {
      console.error('ADMIN_EMAIL / ADMIN_PASSWORD missing');
      process.exit(1);
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`No user with email ${email}`);
      process.exit(1);
    }

    const ok = await user.matchPassword(password);
    console.log(`Login check for ${email}: ${ok ? 'PASS' : 'FAIL'}`);
    console.log(`Role: ${user.role}`);
    console.log(`Email verified: ${user.emailVerified}`);
    console.log(`Blocked: ${user.isBlocked}`);
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.error('verify failed:', e.message || e);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();

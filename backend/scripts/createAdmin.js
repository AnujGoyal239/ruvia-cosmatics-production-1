/**
 * Create (or refresh) the bootstrap admin user.
 *
 * Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. The User model's
 * pre-save hook hashes the password with bcrypt, so we never store cleartext.
 *
 * Behavior:
 *   - If no admin with the given email exists, creates one.
 *   - If an admin already exists with the given email and `--force` is
 *     passed, resets that account's password and ensures `role: 'admin'`.
 *   - Otherwise leaves the existing record alone (idempotent default).
 *
 * Password policy mirrors the one enforced on the public registration
 * endpoint: ≥ 12 chars, must include lowercase, uppercase, digit, and one
 * of @$!%*?& special characters.
 *
 * Usage:
 *   node scripts/createAdmin.js
 *   node scripts/createAdmin.js --force   # reset password / promote to admin
 */

const mongoose = require('mongoose');
const User = require('../models/userModel');
require('dotenv').config();

const PASSWORD_POLICY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
const MIN_PASSWORD_LENGTH = 12;
const FORCE = process.argv.includes('--force');

const validateInputs = () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email) {
    throw new Error('ADMIN_EMAIL is not set in .env');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`ADMIN_EMAIL "${email}" is not a valid email`);
  }
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not set in .env');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  if (!PASSWORD_POLICY_RE.test(password)) {
    throw new Error(
      'ADMIN_PASSWORD must contain at least one lowercase letter, uppercase letter, digit, and special character (@$!%*?&)'
    );
  }
  return { email, password };
};

const run = async () => {
  let conn;
  try {
    const { email, password } = validateInputs();

    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set in .env');
    }
    conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const existing = await User.findOne({ email });

    if (existing && !FORCE) {
      console.log(`Admin "${email}" already exists. Re-run with --force to reset password.`);
      process.exit(0);
    }

    if (existing && FORCE) {
      // Update in place so the bcrypt pre-save hook re-hashes the new password.
      existing.password = password;
      existing.role = 'admin';
      existing.isBlocked = false;
      // Bump lastLogout so any old JWTs issued before this reset are invalid.
      existing.lastLogout = new Date();
      await existing.save();
      console.log(`Admin "${email}" password reset and promoted.`);
    } else {
      await User.create({
        name: 'Admin',
        email,
        password,
        role: 'admin',
        emailVerified: true,
      });
      console.log(`Admin "${email}" created.`);
    }

    console.log('');
    console.log('Login at: <FRONTEND_URL>/admin/login');
    console.log(`Email:    ${email}`);
    console.log('Password: <hidden — read from ADMIN_PASSWORD env>');
    console.log('');
    console.log('Rotate ADMIN_PASSWORD in your .env / hosting platform after first login.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (conn) {
      try {
        await mongoose.disconnect();
      } catch (_) {
        /* ignore */
      }
    }
  }
};

run();

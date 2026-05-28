/**
 * One-shot secret generator. Prints to stdout:
 *   - ENCRYPTION_KEY  (32 random bytes hex = 64 chars)
 *   - ADMIN_PASSWORD  (16 random alphanumerics + Aa1!  to satisfy the
 *                     password complexity policy enforced by the User model
 *                     pre-save hook: lowercase, uppercase, digit, special).
 *
 * Used once by the deployment runbook. Safe to run multiple times — every
 * invocation produces fresh values; nothing is persisted by this script.
 */
const crypto = require('crypto');

const enc = crypto.randomBytes(32).toString('hex');
const base = crypto.randomBytes(15).toString('base64').replace(/[+/=]/g, '');
const adminPass = base + 'Aa1!';

console.log('ENCRYPTION_KEY=' + enc);
console.log('ADMIN_PASSWORD=' + adminPass);

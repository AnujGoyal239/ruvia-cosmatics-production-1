#!/usr/bin/env node
/**
 * Audit: find any remaining state-changing fetch() calls in the frontend
 * tree that are NOT wrapped in withCsrf() or going through apiClient.
 *
 * The codemod (addCsrfToFetches.js) rewrites the common
 * `fetch(apiUrl(...), { ... })` pattern. Anything still flagged here is
 * either:
 *   (a) using a non-literal options variable (codemod skipped it on purpose), or
 *   (b) hitting a non-apiUrl URL, or
 *   (c) already going through `apiClient` / `api.post/put/delete` (safe — apiClient
 *       wraps with withCsrf internally).
 *
 * This is read-only. No files are modified.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN = ['app', 'components', 'context', 'utils'];

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
};

const files = [];
for (const d of SCAN) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full, files);
}

const hits = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split(/\r?\n/);
  lines.forEach((l, i) => {
    const isMutating = /method\s*:\s*['"](POST|PUT|DELETE|PATCH)/i.test(l);
    if (!isMutating) return;
    // Inspect a small window around the mutation method line to decide
    // whether the call is already protected.
    const region = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
    const safe =
      /\bcsrfFetch\s*\(/.test(region) ||
      /\bwithCsrf\s*\(/.test(region) ||
      /apiClient\.|\bapi\.(post|put|delete|patch|postFormData)\b/i.test(region);
    if (!safe) {
      hits.push({ f: path.relative(ROOT, f), line: i + 1, text: l.trim().slice(0, 140) });
    }
  });
}

if (hits.length === 0) {
  console.log('All mutating fetch calls are CSRF-protected.');
  process.exit(0);
}

console.log(`${hits.length} unprotected mutation(s) remain:`);
for (const h of hits) console.log(`  ${h.f}:${h.line}  ${h.text}`);
process.exit(1);

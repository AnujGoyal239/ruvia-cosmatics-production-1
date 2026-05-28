#!/usr/bin/env node
/**
 * Minimal codemod that replaces `fetch(apiUrl(...)` -> `csrfFetch(apiUrl(...)`
 * in every JS/TS source file under app/ components/ context/ utils/, and
 * adds the import for `csrfFetch` if needed.
 *
 * The previous, more ambitious codemod tried to wrap option objects in
 * `withCsrf(...)` and miscounted closing parens for nested template
 * literals. This one only changes the function name — paren count
 * unchanged, no risk of syntax damage.
 *
 * Idempotent: regex skips occurrences already using `csrfFetch`. Safe to
 * re-run.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN = ['app', 'components', 'context', 'utils'];
const FILE_RE = /\.(js|jsx|ts|tsx)$/;

const relativeImportPath = (filePath) => {
  const fromDir = path.dirname(filePath);
  const target = path.join(ROOT, 'lib', 'csrf');
  let rel = path.relative(fromDir, target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
};

const ensureImport = (source, importPath) => {
  if (/from\s+['"][^'"]*\/csrf['"]/.test(source)) return source;
  const importLine = `import { csrfFetch } from "${importPath}";\n`;
  const importBlock = source.match(/^(?:import[^;\n]+;\s*\n)+/m);
  if (importBlock) {
    return source.replace(importBlock[0], importBlock[0] + importLine);
  }
  if (/^\s*['"]use client['"];?\s*\n/.test(source)) {
    return source.replace(/^(\s*['"]use client['"];?\s*\n)/, `$1\n${importLine}`);
  }
  return importLine + source;
};

const transformFile = (filePath) => {
  const original = fs.readFileSync(filePath, 'utf8');
  // Replace standalone `fetch(apiUrl(` only — never `csrfFetch(...` already,
  // never `noFetch(`, etc. Word boundary on the left and `apiUrl(` on the
  // right keeps the match tight.
  const next = original.replace(/(^|[^a-zA-Z_$.])fetch\(\s*apiUrl\(/g, (m, lead) => {
    return `${lead}csrfFetch(apiUrl(`;
  });
  if (next === original) return false;
  const final = ensureImport(next, relativeImportPath(filePath));
  fs.writeFileSync(filePath, final);
  return true;
};

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (FILE_RE.test(e.name)) out.push(p);
  }
  return out;
};

const main = () => {
  const files = [];
  for (const d of SCAN) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) walk(full, files);
  }
  let touched = 0;
  for (const f of files) {
    if (transformFile(f)) {
      touched += 1;
      console.log('rewrote', path.relative(ROOT, f));
    }
  }
  console.log(`Done. ${touched} files updated.`);
};

main();

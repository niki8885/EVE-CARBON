#!/usr/bin/env node
// Lightweight syntax check: runs `node --check` on every project .js file.
// Catches parse/syntax errors without needing a full ESLint setup. Used by CI
// (npm run lint / npm test) and runnable locally.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'release', 'data', '.git', '.vs', '.idea', 'tmp_electron_extracted']);

function collect(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collect(path.join(dir, entry.name), acc);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

const files = collect(ROOT, []);
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    process.stderr.write(`✖ ${path.relative(ROOT, file)}\n`);
    process.stderr.write((e.stderr ? e.stderr.toString() : String(e)) + '\n');
  }
}

if (failed) {
  console.error(`\nLint failed: ${failed} file(s) with syntax errors (of ${files.length} checked).`);
  process.exit(1);
}
console.log(`Lint OK: ${files.length} JS files passed syntax check.`);

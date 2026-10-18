'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'SOURCE-PROVENANCE.json'), 'utf8'));
for (const row of provenance.originalSourceFiles.filter(row => row.path.startsWith('tests/fixtures/'))) {
  const data = fs.readFileSync(path.join(root, row.path));
  const actual = crypto.createHash('sha256').update(data).digest('hex');
  assert.equal(actual, row.stagedSha256, 'Historical fixture mismatch: ' + row.path);
}
const tests = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs')).sort();
assert.equal(tests.length, 15, 'Expected all 15 standalone code tests');
let passed = 0;
for (const name of tests) {
  const result = spawnSync(process.execPath, [path.join(root, 'tests', name)], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(result.error.message + '\n');
  if (result.status === 0 && !result.error) {
    passed++;
    console.log('PASS ' + name);
  } else {
    console.error('FAIL ' + name);
  }
}
console.log(`Standalone scripts: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exitCode = 1;

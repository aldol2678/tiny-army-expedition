import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root = path.resolve(process.argv[2] || path.resolve(import.meta.dirname, '..'));
const manifest = JSON.parse(fs.readFileSync(path.join(root,'SOURCE-MANIFEST.json'),'utf8'));
assert.equal(manifest.releaseEligible,false);
let scripts=0;
for (const item of manifest.files) {
  assert(!item.path.split('/').some(p=>/^(?:assets|legacy|test(?:s|-)?|evidence(?:-|$)|provenance|fixtures|seeds|validation-inputs)/.test(p)),item.path);
  const file = path.resolve(root,item.path);
  assert(file.startsWith(root+path.sep), 'Manifest path escaped source directory');
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.length,item.size,item.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.path);
  if (file.endsWith('.js')) {
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${item.path}: ${result.stderr}`); scripts++;
  }
}
for (const item of JSON.parse(fs.readFileSync(path.join(root,'boot-manifest.json'),'utf8')).scripts) {
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,item.file))).digest('hex'),item.sha256,item.file);
}
console.log(JSON.stringify({sourceHashes:manifest.files.length,syntaxChecks:scripts,assetParityClaimed:false,releaseEligible:false}));

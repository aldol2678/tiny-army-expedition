// Synthetic tiny assets only. No project media or user data is loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=body=>{const r=spawnSync('python3',['-B','-c',`import importlib.util,tempfile,json,hashlib\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location('assembly','assemble.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)\nwith tempfile.TemporaryDirectory() as d:\n root=Path(d);(root/'assets-local').mkdir()\n ${body.replaceAll('\n','\n ')}`],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);};
test('exact synthetic asset digest is required, not only filename or byte length',()=>run(`b=b'abc';(root/'assets-local'/'input.txt').write_bytes(b)
(root/'assets-required.json').write_text(json.dumps({'files':[{'path':'input.txt','bytes':3,'sha256':hashlib.sha256(b).hexdigest()}]}))
assert a.check_inputs(root)==[]
(root/'assets-local'/'input.txt').write_bytes(b'xyz')
assert a.check_inputs(root)[0]['reason']=='hash mismatch'`));
test('synthetic traversal and escaped symlink input are rejected',()=>run(`outside=root/'outside.txt';outside.write_text('abc')
(root/'assets-local'/'link.txt').symlink_to(outside)
for name in ['../outside.txt',str(outside),'link.txt']:
 (root/'assets-required.json').write_text(json.dumps({'files':[{'path':name,'bytes':3,'sha256':hashlib.sha256(b'abc').hexdigest()}]}))
 assert a.check_inputs(root)[0]['reason']=='unsafe path'`));
test('local assembly refuses missing input and preserves existing output',()=>run(`(root/'assets-required.json').write_text(json.dumps({'files':[{'path':'none','bytes':3,'sha256':hashlib.sha256(b'abc').hexdigest()}]}))
try:a.build(root);raise AssertionError('missing input accepted')
except ValueError:pass
assert not (root/'dist').exists()
(root/'assets-required.json').write_text(json.dumps({'files':[]}));(root/'dist').mkdir();(root/'dist'/'keep').write_text('retained')
try:a.build(root);raise AssertionError('existing output accepted')
except ValueError:pass
assert (root/'dist'/'keep').read_text()=='retained'`));

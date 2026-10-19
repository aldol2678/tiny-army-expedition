#!/usr/bin/env python3
"""Local-only assembly. Required rights-cleared assets are never fetched."""
from pathlib import Path
import hashlib,json,shutil,sys,tempfile
ROOT=Path(__file__).resolve().parent

def check_inputs(root=ROOT):
 manifest=json.loads((root/'assets-required.json').read_text())
 source=(root/'assets-local').resolve();problems=[]
 for item in manifest['files']:
  rel=Path(item['path']);p=source/rel
  if rel.is_absolute() or '..' in rel.parts or not p.resolve().is_relative_to(source):
   problems.append({'path':item['path'],'reason':'unsafe path'});continue
  if not p.is_file():problems.append({'path':item['path'],'reason':'missing'});continue
  b=p.read_bytes()
  if len(b)!=item['bytes'] or hashlib.sha256(b).hexdigest()!=item['sha256']:problems.append({'path':item['path'],'reason':'hash mismatch'})
 return problems

def build(root=ROOT):
 problems=check_inputs(root)
 if problems:raise ValueError('Required separately supplied inputs are missing or mismatched: '+str(len(problems)))
 dest=root/'dist'
 if dest.exists():raise ValueError('dist already exists; move it aside explicitly before building')
 # All writes remain local. No network, deployment or asset substitution.
 staging=Path(tempfile.mkdtemp(prefix='build-local-',dir=root))
 for name in ['core','adapter','loading','model','ui','audio']:
  shutil.copytree(root/name,staging/name,ignore=shutil.ignore_patterns('*.test.js','*.test.cjs','test.cjs','test.js','test','fixtures','__pycache__'))
 for name in ['index.html','profile-loader.js','boot-manifest.json']:shutil.copyfile(root/name,staging/name)
 for item in json.loads((root/'assets-required.json').read_text())['files']:
  p=staging/item['path'];p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/'assets-local'/item['path'],p)
 staging.rename(dest);return dest

if __name__=='__main__':
 if len(sys.argv)>2 or len(sys.argv)==2 and sys.argv[1]!='--check':raise SystemExit('Usage: python3 assemble.py [--check]')
 errors=check_inputs()
 if errors:
  print(json.dumps({'ready':False,'missingOrMismatched':len(errors),'examples':errors[:5]},indent=2));raise SystemExit(2)
 if '--check' in sys.argv:print(json.dumps({'ready':True,'assetFiles':len(json.loads((ROOT/'assets-required.json').read_text())['files'])}));raise SystemExit(0)
 print(build())

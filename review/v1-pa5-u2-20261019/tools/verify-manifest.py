#!/usr/bin/env python3
"""Read-only integrity check for the public source payload."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
m=json.loads((root/'PUBLIC-MANIFEST.json').read_text())
for row in m['files']:
 p=root/row['path']
 assert not Path(row['path']).is_absolute() and '..' not in Path(row['path']).parts
 assert p.is_file() and p.resolve().is_relative_to(root)
 b=p.read_bytes()
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
print(json.dumps({'verifiedFiles':len(m['files']),'releaseEligible':False}))

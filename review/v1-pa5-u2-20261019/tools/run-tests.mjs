import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const directories=['core/progression','core/encounters','core/relic-services','core/spear-skills','core/events','core/ultimate-actions','core/family-weight','core/training-access','test'];
const files=directories.flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(f=>/\.test\.(js|cjs)$/.test(f)||f==='test.js'||f==='test.cjs').sort().map(f=>dir+'/'+f));
const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{cwd:root,stdio:'inherit',env:{...process.env,NPM_CONFIG_UPDATE_NOTIFIER:'false'}});
process.exitCode=result.status??1;

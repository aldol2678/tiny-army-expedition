// TEST_ONLY child-process crash fixture. Files are temporary, no user save access.
import fs from 'node:fs';import {trialSetup} from './trial-fixture.js';import {canonical} from '../runtime/hash.js';import {captureGame} from '../spear-skills/browser.js';
const [mode,file]=process.argv.slice(2),store={load(){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;},commit(parent,next){if(canonical(this.load())!==canonical(parent))throw Error('Exact parent conflict');fs.writeFileSync(file,canonical(next));}};
const f=trialSetup({kind:'ember_tactician',store,afterEffect:mode==='crash'?(_,i)=>{if(i===1)process.exit(73);}:null});
while(f.game.tickCount<471&&f.game.phase==='battle')f.step();
if(mode==='crash')throw Error('Crash hook not reached');f.ult.exportCheckpoint();console.log(canonical({game:captureGame(f.game),ultimate:f.ult.snapshot(),spear:f.spear.snapshot(),classes:f.classes.snapshot()}));

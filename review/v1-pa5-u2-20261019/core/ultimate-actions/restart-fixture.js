// TEST_ONLY persistence fixture, no power-loss durability guarantee.
import fs from 'node:fs';import {canonical} from '../runtime/hash.js';
import {captureGame} from '../spear-skills/browser.js';
import {setup,neutralProgram} from './fixture-helper.js';
const [mode,path,scenario='empty-child']=process.argv.slice(2),prior=scenario==='prior-spear',end=prior?188:8,program=neutralProgram.map(x=>({...x,atTick:prior?180:0}));
const store={load(){return fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):null;},commit(parent,next){if(canonical(this.load())!==canonical(parent))throw Error('Exact-parent conflict');fs.writeFileSync(path+'.next',JSON.stringify(next));fs.renameSync(path+'.next',path);}};
const f=setup({kind:prior?'vanguard':'watcher',program,store,afterEffect:mode==='crash'?(_,i)=>{if(i===0)process.exit(73);}:null});
f.step(end-f.game.tickCount);process.stdout.write(JSON.stringify({game:captureGame(f.game),ultimate:f.ult.snapshot(),spear:f.spear.snapshot(),classes:f.classes.snapshot()}));

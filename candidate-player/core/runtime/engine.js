import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {ENGINE_HASHES} from './identity.js';
import {initializeEngine} from './portable-engine.js';
const context=vm.createContext({console});
for(const [name,hash] of Object.entries(ENGINE_HASHES)){const source=fs.readFileSync(new URL(`./vendor/${name}`,import.meta.url),'utf8');if(createHash('sha256').update(source).digest('hex')!==hash)throw new Error(`Pinned engine hash mismatch: ${name}`);vm.runInContext(source,context,{filename:name});}
const rci1Source=fs.readFileSync(new URL('../rci1/game-engine.js',import.meta.url),'utf8');
const rci1Identity=JSON.parse(fs.readFileSync(new URL('../rci1/engine-identity.json',import.meta.url),'utf8'));
if(createHash('sha256').update(rci1Source).digest('hex')!==rci1Identity.scriptSHA256)throw Error('RCI1 engine hash mismatch');
vm.runInContext(rci1Source,context,{filename:'rci1-game-engine.js'});
export const C=context.TinyArmyV09Content;
export const engine=context.TinyArmy;
initializeEngine({content:C,engine,engines:{rci1:context.TinyArmyRCI1},withContent(content,fn){const old=context.TinyArmyV09Content;context.TinyArmyV09Content=content;try{return fn();}finally{context.TinyArmyV09Content=old;}}});
export * from './portable-engine.js';

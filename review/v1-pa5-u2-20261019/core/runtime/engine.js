import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {ENGINE_HASHES} from './identity.js';
import {initializeEngine} from './portable-engine.js';
const context=vm.createContext({console});
for(const [name,hash] of Object.entries(ENGINE_HASHES)){const source=fs.readFileSync(new URL(`./vendor/${name}`,import.meta.url),'utf8');if(createHash('sha256').update(source).digest('hex')!==hash)throw new Error(`Pinned engine hash mismatch: ${name}`);vm.runInContext(source,context,{filename:name});}
export const C=context.TinyArmyV09Content;
export const engine=context.TinyArmy;
initializeEngine({content:C,engine,withContent(content,fn){const old=context.TinyArmyV09Content;context.TinyArmyV09Content=content;try{return fn();}finally{context.TinyArmyV09Content=old;}}});
export * from './portable-engine.js';

// Node bootstrap. Browser consumers may inject the same pinned validator API into bridge.js.
import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';import {createProfileBridge} from './bridge.js';
export const SOURCE_HASHES=Object.freeze({
 'content.js':'696b7e8186583719230b51cfe4a90b80b51e31cf578668beb0927f7b5fe783e1',
 'v09-content.js':'3583bed4cef48cedc68287ea5e7a230501b51a6670cc09dc0102434f9f95dabe',
 'campaign-legacy.js':'053653571485f7fe8a4b2809dfa938ba41d58cd40c14a146e57dfa6a509bc057',
 'campaign-map.js':'3b8c9e49709a40d1db9b303f275ed8b3491a4959f26462be04ade80e63aa1bd5',
 'campaign.js':'1691f97a8ca82db4bc0e87aeac9523efdb93016acb781e6e1e7db13fee5161ef',
 'game-engine.js':'6e6913f166527fc031fc270320cadcf5fcbb8e914883903ef360215a1b872f20'
});
export function createPinnedContext(){const context=vm.createContext({console});for(const [name,hash] of Object.entries(SOURCE_HASHES)){const bytes=fs.readFileSync(new URL(`./vendor/${name}`,import.meta.url));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error(`Pinned legacy dependency changed: ${name}`);vm.runInContext(bytes.toString(),context,{filename:name});}return context;}
const context=createPinnedContext();export const bridge=createProfileBridge({legacyApi:context.TinyArmyCampaign,content:context.TinyArmyV09Content,sourceHashes:SOURCE_HASHES});export * from './bridge.js';

import {sha256} from '../core/runtime/hash.js';
let initialization;
export function ensureWorkerEngine(){return initialization??=initialize();}
async function initialize(){
 if(typeof process!=='undefined'&&process.versions?.node){
  await import('../core/runtime/engine.js');await import('../core/profile-integration/initialize-node.js');
  const [{installCandidateRules},spear]=await Promise.all([import('../core/runtime/integrated-rules.js'),import('../core/spear-skills/browser.js')]);installCandidateRules(spear);return;
 }
 if(typeof WorkerGlobalScope==='undefined'||!(globalThis instanceof WorkerGlobalScope))throw Error('SG2 engine preparation requires a dedicated worker');
 // Classic sources are closed IIFEs. Execute verified bytes in this worker only.
 // No window, document, storage, or source from a save is accepted.
 const load=async(url,expected)=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Pinned worker source missing');const text=await r.text();if(sha256(text)!==expected)throw Error('Pinned worker source differs');const blob=URL.createObjectURL(new Blob([text],{type:'text/javascript'}));try{await import(blob);}finally{URL.revokeObjectURL(blob);}};
 const profile=await import('../core/profile-integration/browser.js');
 for(const [file,hash] of Object.entries(profile.SOURCE_HASHES))await load(new URL('../core/profile-bridge/vendor/'+file,import.meta.url),hash);
 profile.initializeLegacyProfileCompatibility({legacyApi:globalThis.TinyArmyCampaign,content:globalThis.TinyArmyV09Content,verifiedSourceHashes:profile.SOURCE_HASHES});
 const {ENGINE_HASHES}=await import('../core/runtime/identity.js');
 for(const [file,hash] of Object.entries(ENGINE_HASHES))await load(new URL('../core/runtime/vendor/'+file,import.meta.url),hash);
 await load(new URL('../core/rci1/game-engine.js',import.meta.url),'8a9d3844d049dec73aebd4124c46a48c0f2a385a6fcc6694b5dc951f028ee523');
 const api=await import('../core/runtime/browser-api.js');api.initializeBrowserEngine();
}

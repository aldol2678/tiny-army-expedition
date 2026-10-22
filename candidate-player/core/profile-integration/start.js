// Browser-safe opt-in support. Ordinary C3 headers and starting state are unchanged.
import {canonical,clone,digest,invariant,exactKeys} from '../runtime/hash.js';
export const PROFILE_INTEGRATION_VERSION='legacy-entitlement-private-integrated-trial-2';
export const PROFILE_RUN_SCHEMA='v10-profile-bound-private-integrated-trial-run-save-2';
export const PROFILE_RUNTIME_VERSION='profile-bound-private-integrated-trial-runtime-2';
import {isNativeOrigin,validateNativeOrigin,nativeSnapshot} from './native.js';
let support=null;
export function validateProfileOrigin(origin){return isNativeOrigin(origin)?validateNativeOrigin(origin):legacyProfileSupport().bridge.validateConverted(origin);}
export function installLegacyProfileSupport({bridge,content}){
 invariant(bridge&&typeof bridge.validateConverted==='function'&&typeof bridge.snapshotEntitlements==='function'&&Array.isArray(content?.UNLOCKS),'Pinned legacy profile support required');
 if(support)invariant(canonical(content.UNLOCKS)===canonical(support.content.UNLOCKS),'Cannot replace pinned legacy catalog');
 support={bridge,content};return PROFILE_INTEGRATION_VERSION;
}
export function legacyProfileSupport(){invariant(support,'Legacy profile validation capability is not installed; preserve the file without starting a run');return support;}
export function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
export function makeProfileStart(conversion,{runId,campaignRulesVersion,tactic,purchases=[],earnedVanguard=false,earnedLevel=1}){
 const {bridge,content}=legacyProfileSupport();
 if(isNativeOrigin(conversion))return freeze({version:PROFILE_INTEGRATION_VERSION,conversion:clone(conversion),purchases:clone(purchases),...(earnedVanguard?{earnedVanguard:true}:{}),...(earnedLevel>1?{earnedLevel}:{}),entitlementSnapshot:nativeSnapshot(conversion,purchases,content.UNLOCKS,{runId,campaignRulesVersion,tactic,earnedVanguard,earnedLevel})});
 bridge.validateConverted(conversion);
 return freeze({version:PROFILE_INTEGRATION_VERSION,conversion:clone(conversion),entitlementSnapshot:bridge.snapshotEntitlements(conversion,{runId,campaignRulesVersion,tactic})});
}
export function profileStartState(start,runId,campaignRulesVersion){
 exactKeys(start,['version','conversion','entitlementSnapshot',...(isNativeOrigin(start.conversion)?['purchases',...(Object.hasOwn(start,'earnedVanguard')?['earnedVanguard']:[]),...(Object.hasOwn(start,'earnedLevel')?['earnedLevel']:[])]:[])]);invariant(start.version===PROFILE_INTEGRATION_VERSION,'Unsupported profile start version');
 const {bridge,content}=legacyProfileSupport();if(isNativeOrigin(start.conversion)){invariant(!Object.hasOwn(start,'earnedVanguard')||start.earnedVanguard===true,'Invalid earned tactic flag');invariant(!Object.hasOwn(start,'earnedLevel')||Number.isInteger(start.earnedLevel)&&start.earnedLevel>=2&&start.earnedLevel<=4,'Invalid earned level flag');invariant(canonical(start.entitlementSnapshot)===canonical(nativeSnapshot(start.conversion,start.purchases,content.UNLOCKS,{runId,campaignRulesVersion,tactic:start.entitlementSnapshot.tactic,earnedVanguard:start.earnedVanguard===true,earnedLevel:start.earnedLevel??1})),'Native entitlement snapshot differs');}else{bridge.validateConverted(start.conversion);bridge.validateEntitlementSnapshot(start.entitlementSnapshot,start.conversion);}
 const e=start.entitlementSnapshot;invariant(e.runId===runId&&e.campaignRulesVersion===campaignRulesVersion,'Entitlement run/rules mismatch');
 invariant(['balanced','vanguard','arcane_guard','swift_expedition'].includes(e.tactic),'Unsupported owned tactic; no silent fallback');
 const types=e.tactic==='arcane_guard'?['spear','mage','support']:e.tactic==='swift_expedition'?['spear','archer','mage']:['spear','archer','support'];
 return {roster:types.map((type,i)=>({id:i+1,type,slot:i===0?(e.tactic==='vanguard'?1:0):i===1?8:9,training:0,trainingTrack:null,condition:100})),skills:e.tactic==='vanguard'?['guard','focus']:['heal','guard'],unlocks:clone(e.unlocks),entitlements:clone(e.unlocks),tactic:e.tactic,entitlementSnapshotDigest:digest(e)};
}
export function catalogPreview(conversion){const {bridge,content}=legacyProfileSupport();bridge.validateConverted(conversion);const p=conversion.profile,groups={relic:'relics',branch:'branches',training:'training',tactic:'tactics'};return freeze(clone(content.UNLOCKS).map(x=>({...clone(x),owned:p.unlocks[groups[x.type]].includes(x.id),balance:p.tokens,affordable:p.tokens>=x.cost,purchasable:false,reason:'READ_ONLY_LEGACY_PRICE_PRESERVATION_NO_PURCHASE_API'})));}

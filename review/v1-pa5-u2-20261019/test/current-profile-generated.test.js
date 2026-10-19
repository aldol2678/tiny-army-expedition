// Public replacement smoke: no serialized fixture input, disk save, or user data.
// Every legacy field comes from a brand-new original engine instance, retired
// before combat, in an isolated in-memory store. No entitlement is granted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPinnedContext} from '../core/profile-bridge/index.js';
import * as P from '../core/profile-integration/index.js';
import {canonical,digest} from '../core/runtime/hash.js';
function fresh(){
 const context=createPinnedContext(),entries=new Map();
 const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
 const old=new context.TinyArmyCampaign.Campaign({storage,seed:3,autoLoad:false});
 assert.equal(old.profile.tokens,0);assert.equal(old.retire(),true);assert.equal(old.profile.tokens,0);
 const preview=P.previewLegacyImport(old.exportSave(),{profileId:'public-generated-zero',transactionId:'fresh-import'});
 return P.acceptLegacyPreview(preview,{confirmedPreviewDigest:preview.previewDigest});
}
const start={type:'startRun',seed:3,runId:'public-generated-run',tactic:'balanced'};
const action={type:'runAction',action:{type:'setCommands',skills:['guard','heal']}};
test('fresh zero-entitlement profile preserves current/strict one-action bytes without any imported fixture',()=>{
 const initial=fresh();assert.equal(initial.preservedProfile.tokens,0);
 let strict=P.transitionProfile(initial,start,'start'),current=P.transitionProfileCurrent(initial,start,'start');
 strict=P.transitionProfile(strict,action,'commands');current=P.transitionProfileCurrent(current,action,'commands');
 assert.equal(canonical(current),canonical(strict));assert.equal(current.preservedProfile.tokens,0);
 assert.equal(P.exportProfileEnvelopeCurrent(current),P.exportProfileEnvelope(strict));
});
test('generated current envelope remains lower trust and never seeds the strict replay cache',()=>{
 const current=P.transitionProfileCurrent(P.transitionProfileCurrent(fresh(),start,'start'),action,'commands');
 current.activeRun.state.gold=7;current.activeRun.transactions.at(-1).stateDigest=digest(current.activeRun.state);
 const state={...current};delete state.transactions;current.transactions.at(-1).stateDigest=digest(state);
 P.clearProfileValidationCache();assert.equal(P.validateProfileEnvelopeCurrent(current),true);
 const raw=P.exportProfileEnvelopeCurrent(current);assert.throws(()=>P.importProfileEnvelope(raw),/replay/);
});
test('generated profile operation retains exact parent and reconciles a persisted lost acknowledgement once',()=>{
 const initial=P.transitionProfileCurrent(fresh(),start,'start'),parent=P.exportProfileEnvelopeCurrent(initial);
 const operation=P.createProfileOperationCurrent(parent,action,'once');let raw=parent,writes=0;
 const store={load:()=>raw,commit(expected,next){assert.equal(raw,expected);P.validateProfileCommitCurrent(expected,next);raw=next;writes++;throw Error('synthetic lost acknowledgement');}};
 const committed=P.commitProfileOperationCurrent(operation,store);assert.equal(committed.raw,raw);assert.equal(writes,1);
 P.commitProfileOperationCurrent(operation,store);assert.equal(writes,1);
 const foreign={load:()=>parent+' ',commit(){throw Error('must not overwrite changed parent');}};
 assert.throws(()=>P.commitProfileOperationCurrent(operation,foreign),/base changed/);
});

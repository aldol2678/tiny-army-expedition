// Prototype local-current persistence. Original stores remain full-history strict.
import {canonical,invariant} from '../runtime/hash.js';
import {acceptLegacyPreview,exportProfileEnvelopeCurrent,importProfileEnvelopeCurrent,importProfileEnvelopeCurrentAsync,transitionProfileCurrent} from './portable.js';

export function validateProfileCommitCurrent(previousRaw,nextRaw){
 const prior=previousRaw===null?null:importProfileEnvelopeCurrent(previousRaw),next=importProfileEnvelopeCurrent(nextRaw);
 invariant(next.revision===(prior?prior.revision+1:0),'Profile store requires exact next revision');
 if(prior){
  invariant(canonical(next.origin)===canonical(prior.origin)&&next.profileId===prior.profileId&&canonical(next.transactions.slice(0,-1))===canonical(prior.transactions),'Profile store lineage conflict');
  const t=next.transactions.at(-1),expected=transitionProfileCurrent(prior,t.action,t.id,prior.revision);
  invariant(canonical(next)===canonical(expected),'Profile successor differs from its one new action');
 }
 return next;
}
function persistCurrent(store,oldRaw,newRaw){
 validateProfileCommitCurrent(oldRaw,newRaw);
 try{store.commit(oldRaw,newRaw);invariant(store.load()===newRaw,'Profile write readback mismatch');}
 catch(error){let observed;try{observed=store.load();}catch{throw error;}if(observed!==newRaw)throw error;importProfileEnvelopeCurrent(observed);}
}
export class CurrentProfileSession{
 #raw;
 constructor(envelope,store,raw){this.envelope=envelope;this.store=store;this.#raw=raw??exportProfileEnvelopeCurrent(envelope);}
 get raw(){return this.#raw;}
 static create(preview,confirmation,store){
  const e=acceptLegacyPreview(preview,confirmation),raw=exportProfileEnvelopeCurrent(e),old=store.load();
  if(old!==null){const saved=importProfileEnvelopeCurrent(old);invariant(canonical(saved.origin)===canonical(e.origin),'Existing profile requires an explicit replacement workflow; merge/overwrite is not enabled');return new CurrentProfileSession(saved,store,old);}
  persistCurrent(store,null,raw);return new CurrentProfileSession(e,store,raw);
 }
 static load(store){const raw=store.load();invariant(raw!==null,'No stored profile');return new CurrentProfileSession(importProfileEnvelopeCurrent(raw),store,raw);}
 static async loadAsync(store,options={}){
  const raw=store.load();invariant(raw!==null,'No stored profile');invariant(!Object.hasOwn(options,'expectedRaw')||raw===options.expectedRaw,'Profile store changed before loading');
  const envelope=await importProfileEnvelopeCurrentAsync(raw,options);
  if(options.signal?.aborted)throw Object.assign(new Error('Profile load cancelled'),{name:'AbortError'});
  invariant(store.load()===raw,'Profile store changed during loading');return new CurrentProfileSession(envelope,store,raw);
 }
 transition(action,id,expectedRevision){
  const next=transitionProfileCurrent(this.envelope,action,id,expectedRevision);if(next.revision===this.envelope.revision)return this.envelope;
  const raw=exportProfileEnvelopeCurrent(next);persistCurrent(this.store,this.#raw,raw);this.envelope=next;this.#raw=raw;return next;
 }
}

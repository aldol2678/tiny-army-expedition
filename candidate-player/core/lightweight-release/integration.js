// Separate 29-item campaign: real reward/shop/forge, no starter grants or profile settlement.
import {installRC2Contracts,RC2_VERSION} from '../rci2/contracts.js';
import {RCI2_INTEGRATION_VERSION} from '../rci2/identity.js';
import {createLightweightProjection,LR29_CAPABILITY} from './projection.js';
import {LR29_PROFILE,LR29_VERSION,LR29_ENGINE_KEY,LR29_ENGINE_HASHES} from './identity.js';
import {registerCombatProfile,engineContent} from '../runtime/portable-engine.js';
import {registerCampaignRules,campaignRules} from '../runtime/core.js';
import {DEFAULT_CANDIDATE,REWARD_RNG_NAMESPACE} from '../runtime/identity.js';
import {digest,invariant} from '../runtime/hash.js';
import {createRelicServices} from './services.js';
import {createEventServices} from '../events/index.js';
import {progressionCandidates,applyProgression,targetKeyEligibility,awakeningTrainingCandidates,applyAwakeningTraining} from '../progression/index.js';
export function installLightweightRelease({capability}={}){
 invariant(capability===LR29_CAPABILITY,'Explicit private LR29 opt-in required');
 const original=campaignRules(DEFAULT_CANDIDATE),C=engineContent(),projection=createLightweightProjection(C,{capability});
 const R=createRelicServices(C,{digest,projection,enableTrainingAccess:true,enableNewRelics:true,enablePreparedEvents:true,enableResearch:true,progressionCandidates,applyProgressionCandidate:(state,candidate)=>applyProgression(state,candidate,`growth:${candidate.candidateId}`),targetKeyEligibility,awakeningTrainingCandidates,applyAwakeningTrainingCandidate:(state,candidate,node,providerCapability)=>applyAwakeningTraining(state,candidate,`awakening-training:${candidate.candidateId}`,{node,providerCapability})});
 const content={...original.content,...R,projectDef:projection.projectDefense},events=createEventServices({services:R,content,digest});
 const id=LR29_PROFILE,version=original.version+'|'+RC2_VERSION+'|'+RCI2_INTEGRATION_VERSION+'|'+LR29_VERSION;
  registerCombatProfile(id,{version,engineKey:LR29_ENGINE_KEY,engineHashes:LR29_ENGINE_HASHES,contentFor:()=>content,afterStart(game,config){
   const owners=installRC2Contracts(game,{content,roster:config.roster,runId:config.battleId,research:config.research,encounter:config.encounter,full:true,beforeGate({game,rb5}){const finish=game.finish;game.finish=function(...args){const ok=finish.apply(this,args);if(ok&&this.phase!=='battle')rb5.endBattle();return ok;};}});
   const commands={snapshot:()=>({version:'rci1-command-owner-1',state:owners.rb2.snapshot()})};
   const authority={afterTerminal(){owners.status.afterTick?.();owners.ultimate.afterTick();owners.spear.afterTick();owners.cls.afterTick();owners.rb5.endBattle();},snapshot:()=>({version:LR29_VERSION,ownerIds:game._v10CheckpointParticipants.map(p=>p.id),final:owners.rb6.snapshot(),firstHp:owners.fh1.snapshot(),paid:owners.paid.snapshot(),companion:owners.rb5.snapshot(),healing:owners.hb1.snapshot(),restore:owners.gate.status()})};
   return [commands,owners.status,owners.ultimate,owners.spear,owners.cls,authority];
  }});
  registerCampaignRules(id,{...original,version,content,events,requiresAsyncSettlement:true,engineHashes:LR29_ENGINE_HASHES,services:{...R,makeReward:(state,node)=>R.makeReward({...state,profileId:REWARD_RNG_NAMESPACE},node)},validateState(state){original.validateState(state);R.checkState(state);}});
 return {profile:LR29_PROFILE,content,services:R};
}

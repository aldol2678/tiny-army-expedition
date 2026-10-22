import {assert} from '../rc2-fast/relic-services/registry.js';
import {createCommandResearchAdapter} from '../rc2-fast/contracts-rc2/./command-combat.js';
import {createFinalDamageAuthority} from '../rc2-fast/contracts-rc2/./final-authority.js';
import {RB6_CAPABILITY} from '../rc2-fast/relic-batch-6/index.js';
import {installFirstHpHitAdapter} from '../rc2-fast/contracts-rc2/./first-hp-adapter.js';
import {FH1_CAPABILITY} from '../rc2-fast/first-hp-hit/projection.js';
import {installProtectionPipeline} from '../rc2-fast/final-damage-rb6/protection.js';
import {installCD1Adapter} from '../rc2-fast/contracts-rc2/./paid-companion.js';
import {CD1_CAPABILITY} from '../rc2-fast/relic-chain-cd1/index.js';
import {installHealBarrierAuthority} from '../rc2-fast/contracts-rc2/./heal-barrier-authority.js';
import {HB1_CAPABILITY} from '../rc2-fast/heal-barrier-hb1/index.js';
import {installBatchAdapter,RB1_CAPABILITY} from '../rc2-fast/heal-barrier-hb1/rb1-adapter.js';
import {installRB2Adapter} from '../rc2-fast/contracts-rc2/./command-effects.js';
import {RB2_CAPABILITY} from '../rc2-fast/relic-batch-2/index.js';
import {installRB3Adapter,RB3_CAPABILITY} from '../rc2-fast/relic-batch-3/index.js';
import {createSpearCombatAdapter} from '../rc2-fast/spear-skills-rb6/browser.js';
import {createClassCombatAdapter} from '../rc2-fast/contracts-rc2/./class-combat.js';
import {createUltimateTrialAdapter} from '../rc2-fast/contracts-rc2/./ultimate-adapter.js';
import {installActionArbiter} from '../rc2-fast/ultimate-actions/adapter.js';
import {installRestoreGate} from '../rc2-fast/contracts-rc2/./restore-gate.js';
import {RC2_CAPABILITY} from '../rc2-fast/contracts-rc2/./projection.js';
import {createEncounterAdapter} from '../rc2-fast/encounters/index.js';
export {createRC2Projection,RC2_CAPABILITY,RC2_VERSION} from '../rc2-fast/contracts-rc2/./projection.js';
export function installRC2Contracts(game,{content,roster=game.startingRoster,runId='rc2-synthetic-run',research,statusAdapter=null,encounter=game.encounter,classes=false,full=false,store,afterCommand=null,afterHit=null,afterFirstHp=null,afterHealBarrier=null,afterEvent=null,afterEffect=null,ultimateAfterEffect=null,beforeGate=null}={}){
 assert(content?.rc2Capability===RC2_CAPABILITY&&game.phase==='battle'&&game.tickCount===0,'Fresh explicit RC2 projected battle required');
 assert(!game._rc2Contracts&&!game._rb6FinalDamage&&!game._rb5Companion&&!game._hb1Healing&&!game._v10ClassCombat,'RC2 owns one installation');
 createCommandResearchAdapter(game,{content,research});
 const rb6=createFinalDamageAuthority(game,{content,roster,capability:RB6_CAPABILITY,afterReceipt:afterHit});
 const fh1=installFirstHpHitAdapter(game,{content,runId,capability:FH1_CAPABILITY,afterReceipt:afterFirstHp});
 installProtectionPipeline(game,content);
 statusAdapter??=createEncounterAdapter(game,encounter);
 const rb5=installCD1Adapter(game,{content,roster,capability:CD1_CAPABILITY,afterEvent,afterEffect}),paid=rb5.paid;
 const hb1=installHealBarrierAuthority(game,{content,capability:HB1_CAPABILITY,afterReceipt:afterHealBarrier});
 const rb1=installBatchAdapter(game,{content,capability:RB1_CAPABILITY});
 const rb2=installRB2Adapter(game,{content,capability:RB2_CAPABILITY,afterReceipt:afterCommand}),rb3=installRB3Adapter(game,{content,capability:RB3_CAPABILITY});
 rb6.bindOwners();beforeGate?.({game,rb5});const gate=installRestoreGate(game);
 let spear,cls,ultimate,arbiter;
 if(classes||full){arbiter=installActionArbiter(game);spear=createSpearCombatAdapter(game,{content,roster,actionArbiter:arbiter,ultimateMode:'independent-foundation',companion:rb5});cls=createClassCombatAdapter(game,{content,roster,statusAdapter,actionArbiter:arbiter,ultimateMode:'independent-foundation',paidLifecycle:paid});}
 if(full)ultimate=createUltimateTrialAdapter(game,{roster,statusAdapter,actionArbiter:arbiter,store,paidLifecycle:paid,afterEffect:ultimateAfterEffect});
 gate.seal();
 // Fail closed on dirty or reentrant restore even for direct engine entry points.
 for(const name of ['tick','attack','hit','supportHeal','heal','grantBarrier','castSkill','castUnitSkill','castBarrier']){const original=game[name];if(typeof original==='function')game[name]=function(...args){return gate.withOwner(()=>original.apply(this,args));};}
 const wrap=owner=>{if(!owner)return owner;const descriptors=Object.getOwnPropertyDescriptors(owner);for(const name of ['beforeTick','afterTick'])if(typeof owner[name]==='function')descriptors[name]={value:(...a)=>gate.withOwner(()=>owner[name](...a)),enumerable:true};if(owner.exportCheckpoint)descriptors.exportCheckpoint={value:()=>{gate.assertExternal();return owner.exportCheckpoint();},enumerable:true};return Object.freeze(Object.defineProperties({},descriptors));};
 // Public RC2 handles cannot perform a partial participant import. The original
 // underscore-prefixed engine owner APIs remain trusted implementation details.
 const publicOwner=owner=>{if(!owner)return owner;const descriptors=Object.getOwnPropertyDescriptors(owner);for(const name of ['restore','restoreSnapshot','importCheckpoint','exportCheckpoint'])if(typeof owner[name]==='function')descriptors[name]={value:()=>{throw Error('Use the RC2 aggregate or full composite checkpoint');},enumerable:true};for(const name of ['perform','observeMana','endBattle','nextChargeRoot','chargeCommitted','chargeResolved'])if(typeof owner[name]==='function')descriptors[name]={value:(...a)=>gate.withOwner(()=>owner[name](...a)),enumerable:true};if(owner===rb5)descriptors.paid={value:publicOwner(paid),enumerable:true};return Object.freeze(Object.defineProperties({},descriptors));};
 return {rb6:publicOwner(rb6),fh1:publicOwner(fh1),rb5:publicOwner(rb5),paid:publicOwner(paid),hb1:publicOwner(hb1),rb1:publicOwner(rb1),rb2:publicOwner(rb2),rb3:publicOwner(rb3),gate,status:statusAdapter,spear:wrap(spear),cls:publicOwner(wrap(cls)),ultimate:wrap(ultimate),arbiter};
}

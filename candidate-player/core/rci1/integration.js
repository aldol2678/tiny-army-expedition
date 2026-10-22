import {installRC2Contracts} from './contracts-fast.js';
import {createLongBattleAdapter} from '../long-battle/adapter.js';
import {longBattlePolicyFor} from '../long-battle/trial-config.js';
import {createRC2Projection,RC2_CAPABILITY,RC2_VERSION} from '../rc2/contracts-rc2/index.js';
import {RCI1_PROFILE,RCI1_LONG_PROFILE,RCI1_PRESSURE_PROFILE,RCI1_ENGINE_HASHES,RCI1_ENGINE_KEY} from './identity.js';
import {registerCombatProfile,combatProfile,engineContent} from '../runtime/portable-engine.js';
import {registerCampaignRules,campaignRules} from '../runtime/core.js';
import {DEFAULT_CANDIDATE} from '../runtime/identity.js';
import {LONG_BATTLE_POLICY,LONG_BATTLE_PRESSURE_POLICY} from '../long-battle/trial-config.js';
export {RCI1_PROFILE,RCI1_LONG_PROFILE,RCI1_PRESSURE_PROFILE};
export function installRCI1Profiles(){
 const original=campaignRules(DEFAULT_CANDIDATE),projection=createRC2Projection(engineContent(),{capability:RC2_CAPABILITY});
 const content={...original.content,...projection,projectDef:projection.projectDefense};
 const version=original.version+'|'+RC2_VERSION+'|rci1-actual-ui-runtime-1';
 const profile={version,engineKey:RCI1_ENGINE_KEY,engineHashes:RCI1_ENGINE_HASHES,contentFor:()=>content,afterStart(game,config){
  let longBattle=null;
  const owners=installRC2Contracts(game,{content,roster:config.roster,runId:config.battleId,research:config.research,encounter:config.encounter,full:true,beforeGate({game,rb5}){const policy=longBattlePolicyFor(config);if(policy)longBattle=createLongBattleAdapter(game,policy);const finish=game.finish;game.finish=function(...a){const ok=finish.apply(this,a);if(ok&&this.phase!=='battle')rb5.endBattle();return ok;};}});
  const commands={snapshot:()=>({version:'rci1-command-owner-1',state:owners.rb2.snapshot()})};
  const authority={afterTerminal(){owners.status.afterTick?.();owners.ultimate.afterTick();owners.spear.afterTick();owners.cls.afterTick();owners.rb5.endBattle();longBattle?.afterTick();},snapshot:()=>({version:RC2_VERSION,ownerIds:game._v10CheckpointParticipants.map(p=>p.id),final:owners.rb6.snapshot(),firstHp:owners.fh1.snapshot(),paid:owners.paid.snapshot(),companion:owners.rb5.snapshot(),healing:owners.hb1.snapshot(),restore:owners.gate.status()})};
  return [commands,owners.status,owners.ultimate,owners.spear,owners.cls,authority,...(longBattle?[longBattle]:[])];
 }};
 registerCombatProfile(RCI1_PROFILE,profile);
 // Keep the campaign service/reward owner and its 26-entry registry unchanged.
 registerCampaignRules(RCI1_PROFILE,{...original,version,content,engineHashes:RCI1_ENGINE_HASHES});
 for(const [id,policy]of [[RCI1_LONG_PROFILE,LONG_BATTLE_POLICY],[RCI1_PRESSURE_PROFILE,LONG_BATTLE_PRESSURE_POLICY]]){
  registerCombatProfile(id,{...profile,version:version+'|'+policy.policyVersion});
  registerCampaignRules(id,{...campaignRules(RCI1_PROFILE),version:version+'|'+policy.policyVersion,longBattlePolicy:policy});
 }
 return {version,content};
}

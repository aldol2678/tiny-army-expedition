import {INTEREST_RULES} from './interest-config.js';
import {ULTIMATE_ACTION_VERSION,installActionArbiter} from '../ultimate-actions/adapter.js';
import {createUltimateTrialAdapter,ULTIMATE_TRIAL_ADAPTER_VERSION} from '../ultimate-actions/trial-adapter.js';
import {ULTIMATE_TRIAL_VERSION,ULTIMATE_TRIAL_CONFIG} from '../ultimate-actions/trial-config.js';
import {ULTIMATE_EFFECTS_VERSION} from '../ultimate-actions/effects.js';
import {RESOURCE_BUDGET_VERSION} from '../ultimate-actions/resource-budget.js';
import {createEventServices,EVENT_VERSION,EVENT_TRIAL_VALUES} from '../events/index.js';
import {DEFAULT_CANDIDATE,RUNTIME_VERSION,REWARD_RNG_NAMESPACE} from './identity.js';
import {digest} from './hash.js';
import {registerCombatProfile,engineContent,TERMINAL_RESULT_VERSION} from './portable-engine.js';
import {registerCampaignRules} from './core.js';
import {createEncounter,createEncounterAdapter,ENCOUNTER_PROFILE,ENCOUNTER_VERSION} from '../encounters/index.js';
import {createCommandResearchAdapter,COMMAND_COMBAT_VERSION} from '../relic-services/command-combat.js';
import {createRelicServices,VERSION as RELIC_VERSION,TRAINING_ACCESS_VERSION} from '../relic-services/index.js';
import {PROGRESSION_VERSION,CLASS_COMBAT_VERSION,progressionCandidates,applyProgression,awakeningCandidates,applyAwakening,awakeningReadiness,awakeningTrainingCandidates,applyAwakeningTraining,validateProgressionState,targetKeyEligibility,createClassCombatAdapter} from '../progression/index.js';
// Concrete spear functions are injected once from the canonical generated browser
// module by both Node and browser entrypoints. Missing host fails closed.
export function installCandidateRules({createSpearCombatAdapter,installProtectionPipeline,SPEAR_COMBAT_VERSION}){
 if(typeof createSpearCombatAdapter!=='function'||typeof installProtectionPipeline!=='function'||!SPEAR_COMBAT_VERSION)throw Error('Transactional spear integration is required');
 const C=engineContent(),R=createRelicServices(C,{digest,enableTrainingAccess:true,enableNewRelics:true,enablePreparedEvents:true,enableResearch:true,progressionCandidates,applyProgressionCandidate:(state,candidate)=>applyProgression(state,candidate,`growth:${candidate.candidateId}`),targetKeyEligibility,awakeningTrainingCandidates,applyAwakeningTrainingCandidate:(state,candidate,node,providerCapability)=>applyAwakeningTraining(state,candidate,`awakening-training:${candidate.candidateId}`,{node,providerCapability})});
 const content={...C,...R,projectDef:R.projectDefense},E=createEventServices({services:R,content,digest});
 const version=[RUNTIME_VERSION,ENCOUNTER_PROFILE,ENCOUNTER_VERSION,RELIC_VERSION,PROGRESSION_VERSION,CLASS_COMBAT_VERSION,SPEAR_COMBAT_VERSION,COMMAND_COMBAT_VERSION,TERMINAL_RESULT_VERSION,TRAINING_ACCESS_VERSION,INTEREST_RULES.version,EVENT_VERSION,EVENT_TRIAL_VALUES.version,ULTIMATE_ACTION_VERSION,ULTIMATE_TRIAL_ADAPTER_VERSION,ULTIMATE_TRIAL_VERSION,ULTIMATE_EFFECTS_VERSION,RESOURCE_BUDGET_VERSION].join('|');
 registerCombatProfile(DEFAULT_CANDIDATE,{version,contentFor:()=>content,afterStart(game,config){const commands=createCommandResearchAdapter(game,{content,research:config.research});installProtectionPipeline(game,content);const actionArbiter=installActionArbiter(game),status=createEncounterAdapter(game,config.encounter),spear=createSpearCombatAdapter(game,{content,roster:config.roster,battleId:config.battleId,statusAdapter:status,actionArbiter,ultimateMode:'independent-foundation'}),classes=createClassCombatAdapter(game,{roster:config.roster,statusAdapter:status,actionArbiter,ultimateMode:'independent-foundation'}),ultimate=createUltimateTrialAdapter(game,{roster:config.roster,actionArbiter,statusAdapter:status,config:ULTIMATE_TRIAL_CONFIG});return [commands,status,ultimate,spear,classes];}});
 registerCampaignRules(DEFAULT_CANDIDATE,{version,events:E,services:{...R,makeReward:(state,node)=>R.makeReward({...state,profileId:REWARD_RNG_NAMESPACE},node)},content,encounter:createEncounter,applyAwakening,awakeningCandidates,awakeningReadiness,validateState(s){validateProgressionState(s);R.validateResearch(s);},targetCandidates(){return [];}});
 return {version,content,services:R,events:E};
}

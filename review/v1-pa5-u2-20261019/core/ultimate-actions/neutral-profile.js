// TEST_ONLY profile registration. Never installed by campaign/browser entrypoints.
import {registerCombatProfile,engineContent} from '../runtime/portable-engine.js';
import {createSpearCombatAdapter,installProtectionPipeline} from '../spear-skills/browser.js';
import {createClassCombatAdapter} from '../progression/combat.js';
import {createCommandResearchAdapter} from '../relic-services/command-combat.js';
import {createEncounterAdapter} from '../encounters/index.js';
import {installActionArbiter,createUltimateFoundationAdapter,ULTIMATE_ACTION_VERSION} from './adapter.js';
export const NEUTRAL_PROFILE='TEST_ONLY_INDEPENDENT_ULTIMATE_FOUNDATION';
export function installNeutralFixtureProfile(content=engineContent()){
 registerCombatProfile(NEUTRAL_PROFILE,{version:ULTIMATE_ACTION_VERSION+'|TEST_ONLY',contentFor:()=>content,afterStart(game,config){if(config.fixturePolicy?.classification!=='TEST_ONLY_NEUTRAL')throw Error('Explicit neutral fixture policy required');const command=createCommandResearchAdapter(game,{content,research:config.research||{owned:[],equipped:{},purchases:[]}});installProtectionPipeline(game,content);const arbiter=installActionArbiter(game),status=createEncounterAdapter(game,config.encounter),spear=createSpearCombatAdapter(game,{content,roster:config.roster,actionArbiter:arbiter,ultimateMode:'independent-foundation'}),classes=createClassCombatAdapter(game,{roster:config.roster,statusAdapter:status,actionArbiter:arbiter,ultimateMode:'independent-foundation'}),ultimate=createUltimateFoundationAdapter(game,{roster:config.roster,actionArbiter:arbiter,fixturePolicy:config.fixturePolicy});return [command,status,ultimate,spear,classes];}});
}

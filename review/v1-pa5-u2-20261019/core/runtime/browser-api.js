export {interestAmount,INTEREST_DESCRIPTION} from './interest.js';
import {initializeEngine} from './portable-engine.js';
import {installCandidateRules} from './integrated-rules.js';
import * as spear from '../spear-skills/browser.js';
export function initializeBrowserEngine({content=globalThis.TinyArmyV09Content,engine=globalThis.TinyArmy}={}){initializeEngine({content,engine,withContent(C,fn){const old=globalThis.TinyArmyV09Content;globalThis.TinyArmyV09Content=C;try{return fn();}finally{globalThis.TinyArmyV09Content=old;}}});return installCandidateRules(spear);}
export * from './core.js';
export * from './views.js';
export {createCampaignBattleController as createBattleController} from './core.js';

// Optional legacy validator must be loaded in an isolated realm; no live storage is accessed.
export {installLegacyProfileSupport,PROFILE_RUN_SCHEMA,PROFILE_RUNTIME_VERSION} from '../profile-integration/start.js';

export {createCampaignBattleControllerCurrent as createBattleControllerCurrent} from './core.js';

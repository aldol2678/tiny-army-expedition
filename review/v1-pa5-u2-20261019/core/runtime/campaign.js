import '../profile-integration/initialize-node.js';
import './engine.js';
import * as spear from '../spear-skills/browser.js';
import {installCandidateRules} from './integrated-rules.js';
export const integrated=installCandidateRules(spear);
export * from './core.js';
export * from './views.js';
export {simulateBattle,clearCombatCache} from './portable-engine.js';

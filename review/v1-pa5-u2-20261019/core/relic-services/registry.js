import {INTEREST_RULES} from '../runtime/interest-config.js';
// Reconstruction from retained implementation contracts and recovered plans.
// Not byte-identical recovery of the lost R5 module.
export const VERSION = 'v10-relic-services-family-weight-trial-1';
// New isolated RNG namespace; pool gate adds one draw per random relic slot.
export const RNG_NAMESPACE = 'v10-relic-family-weight-20261019-1';
export const LEGACY_RELIC_IDS = Object.freeze(['banner','seal','spear_tip','medic','whistle','drum','keen_eye','arcane_lens','vanguard_plate','vanguard_banner','mid_resonance','heavy_blade','overcharge_core','triage_codex','echo_crystal','emergency_case','quick_hourglass']);
export const clone = value => JSON.parse(JSON.stringify(value));
export const assert = (value, message) => { if (!value) throw Error(message); };
export function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
export function canonical(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']'; return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}'; }
const definition = (id,name,rarity,family,field,operation,values,scope,key=false) => ({id,name,rarity,intrinsicRarity:rarity,family,definitionVersion:VERSION,baseUnlocked:true,perItemCap:1,maxEvolution:3,evolution:[1,2,3],iconId:null,assetStatus:'SEPARATE_ASSET_MAPPING_REQUIRED',key,effects:[{affectedField:field,operation,values,scope}]});
export const NEW_RELICS = deepFreeze({
 savings_charm:{id:'savings_charm',name:'저축의 부적',rarity:INTEREST_RULES.rarity,intrinsicRarity:INTEREST_RULES.rarity,trialShopPrice:INTEREST_RULES.shopPrice,iconId:null,assetStatus:'NO_NEW_ART_TEXT_FALLBACK',family:'economy',definitionVersion:VERSION,baseUnlocked:true,perItemCap:1,maxEvolution:1,evolution:[1],key:false,effects:[],classification:'economy'},
 iron_oath:definition('iron_oath','맹세의 철심','rare','spear','maxHp','percent_gain',[.06,.08,.10],'spear',true),
 eagle_signet:definition('eagle_signet','매의 인장','rare','archer','basicDamageBonus','percent_gain',[.04,.06,.08],'archer',true),
 arcane_seed:definition('arcane_seed','비전의 씨앗','rare','mage','manaRegenBonus','percent_gain',[.06,.09,.12],'mage',true),
 covenant_lamp:definition('covenant_lamp','서약의 등불','rare','support','abilityPower','percent_gain',[.06,.08,.10],'support',true),
 wall_pin:definition('wall_pin','연결 핀','uncommon','army','defense','flat_gain',[2,3,4],'adjacent_ally'),
 long_sight:definition('long_sight','먼길 조준경','common','archer','range','flat_gain',[10,15,20],'rear_archer'),
 open_flank:definition('open_flank','빈 측면 표장','uncommon','army','attackPower','percent_gain',[.06,.08,.10],'sparse_front'),
 coalition_standard:definition('coalition_standard','연합 군기','rare','army','maxHp','percent_gain',[.04,.06,.08],'four_families'),
});
export const NEW_RELIC_IDS=Object.freeze(Object.keys(NEW_RELICS));
export const KEY_RELIC_IDS=Object.freeze(NEW_RELIC_IDS.filter(id=>NEW_RELICS[id].key));
export const RELIC_REGISTRY=Object.freeze([...LEGACY_RELIC_IDS,...NEW_RELIC_IDS]);
export const MILESTONES=deepFreeze([{chapter:1,row:6,rewardRole:'relic-only'},{chapter:3,row:1,rewardRole:'relic-only'},{chapter:4,row:6,rewardRole:'relic-only'}]);
export const PRICES=Object.freeze({recruit:20,train:30,common:10,uncommon:15,rare:20,epic:30,legendary:40});
export const FORGE_PRICES=Object.freeze({1:20,2:30});
export const LIMITS=Object.freeze({maxHp:.50,attackPower:.50,abilityPower:.50,relicDefense:40,defense:.50,guardianDefense:20,basicDamageBonus:.35,supportHealBonus:.35,shieldBonus:.35,mageSkillDamageBonus:.35,damageReduction:.55,attackSpeedBonus:.50,movementSpeedBonus:.25,manaRegenBonus:.50,unitSkillCdr:.15,commanderSkillCdr:.20,critChance:.50,critDamage:2.5,echoRefund:.50,relicRange:30});

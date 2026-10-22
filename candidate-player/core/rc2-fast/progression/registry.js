// Reconstructed from approved local plans and retained implementation contracts.
export const PROGRESSION_VERSION='v11-ultimate-identity-foundation-1';
export const ULTIMATE_IDENTITY_VERSION='ultimate-identity-foundation-1';
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export const FAMILIES=freeze({spear:{id:'spear',name:'창병',firstClassIds:['guardian','charger'],keyId:'iron_oath',ultimateSkillId:'ult_spear'},archer:{id:'archer',name:'궁수',firstClassIds:['sniper','volley'],keyId:'eagle_signet',ultimateSkillId:'ult_archer'},mage:{id:'mage',name:'마법사',firstClassIds:['pyromancer','frostmage'],keyId:'arcane_seed',ultimateSkillId:'ult_mage'},support:{id:'support',name:'지원병',firstClassIds:['medic','warder'],keyId:'covenant_lamp',ultimateSkillId:'ult_support'}});
const rows=[
 ['guardian','방벽병','spear','bastion','성채수호병','guardian_link','bastion_guard','sentinel','반격호위병','counter_thrust'],
 ['charger','돌격병','spear','vanguard','돌파선봉병','charge','charge_cover','pursuer','추격창기병','escape_lock'],
 ['sniper','저격수','archer','marksman','정밀사수','precision_shot','fixed_aim','watcher','감시사수','watch_shot'],
 ['volley','연사수','archer','skirmisher','기동연사수','volley_salvo','retreat_step','suppressor','제압궁수','suppress_lane'],
 ['pyromancer','폭염술사','mage','ember_tactician','화염전술사','flame_burst','ember_field','heat_warden','열막술사','heat_veil'],
 ['frostmage','서리술사','mage','frost_weaver','한파조율사','frost_bolt','frost_boundary','frost_binder','한기봉인사','frost_seal'],
 ['medic','군의관','support','surgeon','야전의무장','normal_heal','field_surgery','cleanser','정화의무관','cleanse'],
 ['warder','수호사','support','barrier_keeper','결계수호사','normal_heal','ward_shield','ward_keeper','금제수호사','ward_barrier']
];
export const FIRST_CLASSES=freeze(Object.fromEntries(rows.map(r=>[r[0],{id:r[0],name:r[1],family:r[2],assetType:r[0],secondClassIds:[r[3],r[7]],unlockId:['frostmage','warder'].includes(r[0])?r[0]:null}])));
// A key is an inventory prerequisite, never a skill. Variant identity is the
// explicit second-class ID; no branch effects or numeric tuning are implied.
function secondClass(row,id,name,secondSkillId){
 const family=FAMILIES[row[2]];
 return {id,name,firstClassId:row[0],family:family.id,assetType:row[0],skillIds:[row[5],secondSkillId],keyId:family.keyId,ultimateSkillId:family.ultimateSkillId,ultimateVariantId:id,ultimateId:family.ultimateSkillId};
}
// Compatibility alias ultimateId means only ultimateSkillId in this version.
export const SECOND_CLASSES=freeze(Object.fromEntries(rows.flatMap(r=>[[r[3],secondClass(r,r[3],r[4],r[6])],[r[7],secondClass(r,r[7],r[8],r[9])]])));
export const KEY_RELICS=freeze({iron_oath:{id:'iron_oath',name:'맹세의 철심',family:'spear',rarity:'rare',field:'maxHp',values:[.06,.08,.10]},eagle_signet:{id:'eagle_signet',name:'매의 인장',family:'archer',rarity:'rare',field:'basicDamageBonus',values:[.04,.06,.08]},arcane_seed:{id:'arcane_seed',name:'비전의 씨앗',family:'mage',rarity:'rare',field:'manaRegen',values:[.06,.09,.12]},covenant_lamp:{id:'covenant_lamp',name:'서약의 등불',family:'support',rarity:'rare',field:'abilityPower',values:[.06,.08,.10]}});
const labels={guardian_link:'방벽 연결',bastion_guard:'방벽 전개',counter_thrust:'반격 견제',charge:'돌격',charge_cover:'돌파 후 엄호',escape_lock:'퇴로 봉쇄',precision_shot:'강화탄',fixed_aim:'고정 조준',watch_shot:'경계 사격',volley_salvo:'일제 사격',retreat_step:'후퇴 기동',suppress_lane:'견제 사선',flame_burst:'폭염탄',ember_field:'잔불 지대',heat_veil:'열기 장막',frost_bolt:'서리 화살',frost_boundary:'냉기 경계',frost_seal:'한기 봉인',normal_heal:'정상 진료',field_surgery:'집중 수술',cleanse:'저주 정화',ward_shield:'교대 방벽',ward_barrier:'금제 방벽'};
// Identity-only registry. Casting/effects require a separately approved capability.
export const ULTIMATE_SKILLS=freeze(Object.fromEntries(Object.values(FAMILIES).map(f=>[f.ultimateSkillId,{id:f.ultimateSkillId,name:`${f.name} 궁극기`,family:f.id,identityOnly:true,automatic:false,commanderSlot:false}])));
export const SKILLS=freeze({...Object.fromEntries(Object.entries(labels).map(([id,name])=>[id,{id,name,automatic:true,commanderSlot:false}])),...ULTIMATE_SKILLS});
export const CAPS=freeze({hpBonus:.5,attackPowerBonus:.5,abilityPowerBonus:.5,defense:.5,relicDefense:40,guardianDefense:20,basicDamageBonus:.35,supportHealBonus:.35,shieldBonus:.35,mageSkillDamageBonus:.35,damageReduction:.55,attackSpeed:.5,movementSpeedBonus:.25,manaRegenBonus:.5,unitSkillCdr:.15,commanderSkillCdr:.2,critChance:.5,critDamage:2.5,echoRefund:.5});
export const CLASS_REGISTRY=freeze({families:FAMILIES,first:FIRST_CLASSES,second:SECOND_CLASSES,skills:SKILLS,keys:KEY_RELICS,ultimates:ULTIMATE_SKILLS});
export function familyOf(value){const id=typeof value==='object'?value?.type:value;return FAMILIES[id]?.id??FIRST_CLASSES[id]?.family??SECOND_CLASSES[id]?.family??null;}
export function classStage(u){return u?.secondClassId?(u.classStage===3?3:2):FIRST_CLASSES[u?.type]?1:0;}
export function clampBonus(key,value){if(!(key in CAPS)||!Number.isFinite(value)||value<0)throw new RangeError('Invalid cap/value');return Math.min(CAPS[key],value);}
export function combatDescriptor(u){
 const c=SECOND_CLASSES[u?.secondClassId],stage=classStage(u);
 if(c&&(c.firstClassId!==u.type||u.training!==2))throw Error('Incomplete or cross-parent second class');
 const ultimateSkillId=stage===3?c.ultimateSkillId:null,ultimateVariantId=stage===3?c.ultimateVariantId:null;
 return {unitId:u?.id,type:u?.type,assetType:u?.type,family:familyOf(u),classStage:stage,secondClassId:c?.id??null,keyId:c?.keyId??FAMILIES[familyOf(u)]?.keyId??null,basicSkillIds:c?[...c.skillIds]:[],skillIds:c?[...c.skillIds,...(stage===3?[ultimateSkillId]:[])]:[],ultimateSkillId,ultimateVariantId,ultimateId:ultimateSkillId,training:u?.training??0,trainingTrack:u?.trainingTrack??null};
}

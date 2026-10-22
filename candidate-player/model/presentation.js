import {INTEREST_RULES} from '../core/runtime/interest-config.js';
export const names={spear:'창병',archer:'궁수',support:'지원병',guardian:'방벽병',charger:'돌격병',sniper:'저격수',volley:'연사수',mage:'마법사',pyromancer:'폭염술사',frostmage:'서리술사',medic:'군의관',warder:'수호사'};
export const kinds={normal:'전투',elite:'정예',boss:'보스',rest:'휴식',shop:'상점',target_shop:'목표 상점',forge:'대장간',event:'사건',lab:'연구소',training:'훈련소'};
export const fields={speed:'이동 속도',maxHp:'최대 체력',attackPower:'공격력',basicDamage:'기본 피해',abilityPower:'주문력',defense:'방어력',heal:'치유',attackInterval:'공격 주기',attackRange:'사거리',manaRegen:'마나 회복',damageReduction:'피해 감소',critChance:'치명 확률',critDamage:'치명 배율'};
export const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number=x=>Number.isFinite(Number(x))?String(Math.round(Number(x)*100)/100):'—';
export const deployed=u=>Number.isInteger(u.slot)&&u.slot>=0;
export const cap=xp=>xp>=13?9:xp>=9?8:xp>=4?7:6;
export const level=xp=>[0,4,9,13,23,39].filter(x=>xp>=x).length;
export function status(s){return {level:level(s.xp),cap:cap(s.xp),deployed:s.roster.filter(deployed).length,average:Math.round(s.roster.reduce((n,u)=>n+u.condition,0)/s.roster.length),minimum:Math.min(...s.roster.map(u=>u.condition))};}
export function moveFormation(s,unitId,slot){const unit=s.roster.find(u=>u.id===unitId);if(!unit)throw Error('병사를 찾을 수 없어요.');const other=slot===null?null:s.roster.find(u=>u.slot===slot&&u.id!==unitId);return s.roster.map(u=>({unitId:u.id,slot:u.id===unitId?slot:other?.id===u.id?unit.slot:u.slot}));}
export function choiceName(c){if(c.kind==='buy')c={...c,kind:c.purchaseKind};return c.name||`${names[c.type]||''} ${c.kind==='train'?`훈련 ${c.training}`:c.kind==='evolve'?(c.secondClassName||c.secondClassId||'전직'):c.kind==='rest'?'전원 휴식':c.kind==='leave'?'떠나기':c.kind==='pass'?'건너뛰기':c.kind}`.trim();}
// Display-only formatting: never serialize preview records or round gameplay data.
const previewFields={...fields,'max-heal-on-selected-target':'대상 최대 회복','incoming-damage-factor':'받는 피해 비율','focused-basic-damage-bonus':'표적 기본 피해 증가','rally-haste':'창 계열 가속',cooldown:'재사용',duration:'지속',power:'효과',healInterval:'치유 주기',healInitialDelay:'첫 치유 대기',guardianDefense:'방벽 방어 증가',range:'사거리',healRange:'치유 사거리',firstAttackMultiplier:'첫 공격 배율',primaryMultiplier:'주 기술 배율',secondaryMultiplier:'보조 기술 배율',maxTargets:'대상 수',emergencyMultiplier:'응급 치유 배율',maxMana:'최대 마나',startingMana:'시작 마나','skill.damage':'주 기술 피해','skill.secondaryDamage':'보조 기술 피해','skill.manaCost':'기술 마나 비용','skill.cooldown':'기술 재사용','skill.defenseAfter':'기술 사용 후 방어','skill.slowDuration':'둔화 지속','shield.amount':'보호막 양','shield.cooldown':'보호막 재사용','shield.initialDelay':'첫 보호막 대기','shield.duration':'보호막 지속',whistleHaste:'평타 가속',whistleDuration:'가속 시간',echoRefund:'사용 마나 환급률',emergencyHeal:'응급 치유',attackFrequencyCostFactor:'공격 빈도',supportPeriodCostFactor:'치유·보호막 주기·첫 대기',commanderDurationCostFactor:'지휘 지속시간',basicDamageBonus:'기본 피해 증가',supportHealBonus:'치유량 증가',manaRegenBonus:'마나 회복 증가',attackSpeedBonus:'공격 가속',movementSpeedBonus:'이동 가속',shieldBonus:'보호막 증가',mageSkillDamageBonus:'마법 기술 피해 증가',unitSkillCdr:'고유 기술 재사용 감소',commanderSkillCdr:'지휘 재사용 감소'};
const previewCommands={heal:'응급 회복',guard:'수호 진형',focus:'집중 사격',rally:'사기 고양'};
const previewPercent=new Set(['incoming-damage-factor','focused-basic-damage-bonus','rally-haste','power','critChance','damageReduction','whistleHaste','echoRefund','basicDamageBonus','supportHealBonus','manaRegenBonus','attackSpeedBonus','movementSpeedBonus','shieldBonus','mageSkillDamageBonus','unitSkillCdr','commanderSkillCdr']);
const previewUnknown='효과 정보 확인 필요';
const previewKnown=(map,key)=>typeof key==='string'&&Object.hasOwn(map,key)?map[key]:null;
function previewLabel(field){const m=/^command\.([^.]+)\.(cooldown|duration)$/.exec(field||'');return m&&previewKnown(previewCommands,m[1])?previewKnown(previewCommands,m[1])+' '+(m[2]==='cooldown'?'재사용':'지속'):previewKnown(previewFields,field);}
function previewValue(field,value){if(!Number.isFinite(value))return '—';if(previewPercent.has(field))return number(value*100)+'%';if(/Multiplier$|^critDamage$/.test(field))return '×'+number(value);if(/cooldown|duration|interval|delay/i.test(field))return number(value)+'초';return number(value);}
const previewUnit=x=>Number.isSafeInteger(x?.unitId)?'#'+x.unitId+' ':'';
function previewChange(x){const label=previewLabel(x?.field);if(!label)return previewUnknown;const loss=x.benefit===false?'대가 · ':'';const delta=previewPercent.has(x.field)&&Number.isFinite(x.before)&&Number.isFinite(x.after)?' ('+(x.after>=x.before?'+':'−')+number(Math.abs(x.after-x.before)*100)+'%p)':'';return loss+previewUnit(x)+label+' '+previewValue(x.field,x.before)+' → '+previewValue(x.field,x.after)+delta;}
const previewConditions={first_ally_knockout_with_survivor:'첫 아군 전투불능 후 생존 기본 공격자가 있을 때 · 전투당 1회',third_successful_paid_spell:'실제로 마나를 쓴 기술 3회마다 · 사용 마나 기준 환급 · 최대 마나까지만 · 재사용 초기화 없음',critical_successful_normal_heal:'체력 20% 이하 생존 아군에게 일반 치유 성공 시 · 잃은 체력까지만 · 전투당 1회'};
const previewReasons={'Already owned; duplicate acquisition does not stack':'이미 보유 중이며 중복 효과는 없습니다.','Relic is not owned':'보유한 유물만 강화할 수 있습니다.','Relic is not unlocked':'아직 해금하지 않은 유물입니다.','Relic capability is not implemented':'아직 구현되지 않은 유물입니다.','Evolution III is maximum':'이미 최대 3단계입니다.','Required commander skill is not equipped':'필요한 지휘 기술을 편성하지 않았습니다.','No timed commander skill equipped':'지속형 지휘 기술을 편성하지 않았습니다.','No effective improvement after conditions and caps':'현재 편성·상한에서는 추가 효과가 없습니다.','Trigger cannot occur with current deployed roster':'현재 출전 편성에서는 발동 조건을 충족하지 못합니다.','No remaining battle or awakening use':'남은 전투·각성 기회가 없습니다.','Economy relic cannot be forged':'이 경제 유물은 강화할 수 없습니다.','No owned army for future battles':'앞으로 전투할 보유 병사가 없습니다.'};
export function previewLines(p){
 if(!p)return [];
 if(p.classification==='economy')return [p.description,'제시 당시 '+number(p.economy?.principal)+'G 기준 승리 이자 '+number(p.economy?.projectedVictoryInterest)+'G · 구매/재추첨 후에는 잔액에 따라 감소'].filter(x=>typeof x==='string');
 const list=key=>Array.isArray(p[key])?p[key]:[],lines=list('changes').map(previewChange);
 for(const x of list('costs')){if(typeof x==='string'){lines.push(x);continue;}const label=previewLabel(x?.field);if(!label||!Number.isFinite(x?.factor)){lines.push(previewUnknown);continue;}const change=(x.factor-1)*100;lines.push('대가 · '+previewUnit(x)+label+' ×'+number(x.factor)+(change?' ('+number(Math.abs(change))+'% '+(change<0?'감소':'증가')+')':'')+(x.remainsOnForge?' · 강화 후에도 유지':''));}
 for(const x of list('conditions'))lines.push(typeof x==='string'?x:previewKnown(previewConditions,x?.id)||'발동 조건 정보 확인 필요');
 for(const x of list('caps')){if(typeof x==='string'){lines.push(x);continue;}const label=previewLabel(x?.field),prefix='상한 적용 · '+previewUnit(x);let shown=false;
  if(label&&x.capped>1e-9&&Number.isFinite(p.limits?.[x.field])){lines.push(prefix+label+' 합산 증가 +'+number(p.limits[x.field]*100)+'%');shown=true;}
  if(x?.field==='defense'&&x.relicFlatCapped>1e-9&&Number.isFinite(p.limits?.relicDefense)){lines.push(prefix+'유물 방어 증가 +'+number(p.limits.relicDefense));shown=true;}
  if(!shown)lines.push('상한 정보 확인 필요');
 }
 for(const x of list('losses'))lines.push(typeof x==='string'?x:previewChange(x));
 if(p.reason)lines.push(previewKnown(previewReasons,p.reason)||'현재 선택 조건을 확인해 주세요.');
 if(p.futureInstruction)lines.push(p.futureInstruction==='Deploy the matching reserve and independently satisfy the complete second-class/two-skill and matching-key prerequisites between battles'?'같은 계열 예비대를 출전시키고, 전투 사이에 개인 각성 준비·고유 기술 2개·같은 계열 열쇠 조건을 별도로 충족해야 합니다.':'향후 적용 조건을 확인해 주세요.');
 return [...new Set(lines)];
}

export function graphLayout(graph){const nodes=Object.values(graph.nodes),rows=[...new Set(nodes.map(n=>n.row))].sort((a,b)=>a-b);return {height:rows.length*72+4,nodes:nodes.map(n=>{const row=nodes.filter(x=>x.row===n.row).sort((a,b)=>a.lane-b.lane);return {...n,x:row.length<=3?(row.indexOf(n)+1)*300/(row.length+1):38+row.indexOf(n)*224/(row.length-1),y:rows.indexOf(n.row)*72+34};})};}
export const rarityName=id=>({common:'일반',uncommon:'고급',rare:'희귀',epic:'영웅',legendary:'전설'}[id]||id||'');
Object.assign(fields,{basicDamageBonus:'기본 피해',supportHealBonus:'치유량',whistleHaste:'개전 가속',whistleDuration:'가속 시간',rallyDurationBonus:'사기 고양 지속',critDamageBonus:'치명 배율',attackFrequencyCostFactor:'공격 빈도',supportPeriodCostFactor:'치유 주기',echoRefund:'마나 환급',emergencyHeal:'응급 치유',commanderSkillCdr:'지휘 재사용 감소',commanderDurationCostFactor:'지휘 지속시간',manaRegenBonus:'마나 회복',range:'사거리'});
export function effectLines(definition,evolution=1){
 // Owned-card copy for the three approved description defects only. These are
 // presentation rules, not effect, rarity, acquisition or evolution overrides.
 if(definition?.id===INTEREST_RULES.relicId)return [
  `전투 시작 시 보유 ${INTEREST_RULES.principalStep}G당 승리 이자 +${INTEREST_RULES.goldPerStep}G · 최대 ${INTEREST_RULES.cap}G`,
  '시작 전 소유 시 승리 1회 지급 · 패배·도주·방문 0G',
  '이번 전투 수입·보상 취득 소급 없음 · 중복·강화 불가 · 전투 능력치 증가 없음'
 ];
 if((definition?.formationQAFixture===true||definition?.formationReleaseCandidate===true)&&['diagonal_banner','isolated_crown','quiet_column'].includes(definition.id)){
  const value=number(definition.values?.[evolution-1]*100),notes={
   diagonal_banner:[`시작 대각선 아군이 있는 병사 공격력 +${value}%`,'공격력 합산 +50% 상한 · 시작 배치 고정'],
   isolated_crown:[`시작 직교 아군이 없는 병사 공격력·주문력 +${value}%`,'대가 · 방어력 −5 고정, 최저 0 · 양수 상한 적용 뒤 차감','공격력·주문력 합산 각각 +50% 상한 · 시작 배치 고정'],
   quiet_column:[`시작 같은 열 정확히 2명일 때 해당 병사 이동 +${value}%p`,'이동 증가 W 합산 +25% 상한 · 시작 배치 고정']
  };return [...notes[definition.id],definition.formationQAFixture===true?'QA 시작 지급 전용 · 자연 획득·강화·정식 해금 없음':'29종 비공개 후보 · 조건 충족 시 보상·상점 획득 · 최대 3단계 강화'];
 }
 const effectValue=field=>{const e=definition?.effects?.find(e=>e.affectedField===field);return e?.values?.[evolution-1]??e?.value;};
 if(definition?.id==='whistle')return [
  `첫 아군 전투불능 후 생존 아군 평타 가속 +${number(effectValue('whistleHaste')*100)}% · ${number(effectValue('whistleDuration'))}초`,
  '군단 전투당 1회'
 ];
 if(definition?.id==='open_flank')return [`시작 전열 1~2명일 때 · 해당 전열 공격력 +${number(effectValue('attackPower')*100)}%`];
 const scopes={ally:'전원',army:'전원',spear:'창 계열',archer:'궁 계열',mage:'마법 계열',support:'지원 계열',adjacent_ally:'인접 아군',rear_archer:'후열 궁 계열',sparse_front:'빈 칸이 있는 전열',four_families:'4계열 편성',command:'지휘',front:'전열',mid_ap:'중열 능력 병종',weapon:'무기 병종',timed_command:'시간형 지휘'};return [...(definition?.key===true&&definition.intrinsicRarity==='legendary'?['전설 · 궁극 각성 열쇠']:[]),...(definition?.effects||[]).map(e=>{const v=e.values?.[evolution-1]??e.value;let value=e.operation==='multiply_cost'?`×${number(v)}`:e.operation==='percent_gain'?`+${number(v*100)}%`:e.affectedField==='critChance'?`+${number(v*100)}%p`:`+${number(v)}`;if(['whistleDuration','rallyDurationBonus'].includes(e.affectedField))value+='초';return `${e.operation==='multiply_cost'?'대가 · ':''}${scopes[e.scope]||e.scope||''} ${fields[e.affectedField]||e.affectedField} ${value}`.trim();})];}
export function decisionLines(c){return [c.conditionDelta!=null?`전원 컨디션 ${c.conditionDelta>=0?'+':''}${c.conditionDelta} (0~100)`:'',c.goldGrant?`금화 +${c.goldGrant}G`:'',c.prepared?'다음 전투 준비 효과':'',c.informationOnly?'정보 확인만 · 지급 없음':'',c.trainingTrack?`훈련 ${c.training} · ${c.trainingTrack==='specialty'?'특기':'운용'}`:''].filter(Boolean);}

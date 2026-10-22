import {names,number} from './presentation.js';
import {serviceEffectLines} from './service-presentation.js';

const finite=Number.isFinite;
const signed=value=>`${value>0?'+':''}${number(value)}`;
const label=value=>typeof value==='string'&&value?value:'확인 필요';
const own=(map,id)=>Object.hasOwn(map,id)?map[id]:null;

function grantLine(grant,{relicName,unitName}){
 if(!grant)return '';
 if(grant.kind==='relic')return `유물 · ${label(relicName(grant.relic?.id)||grant.relic?.id)}${finite(grant.relic?.evolution)?` · 강화 ${number(grant.relic.evolution)}`:''}`;
 if(grant.kind==='recruit')return [
  `${label(unitName(grant))}${finite(grant.count)?` ${number(grant.count)}명`:''}`,
  grant.slot===null?'예비대':'',finite(grant.training)?`훈련 ${number(grant.training)}`:'',
  finite(grant.condition)?`컨디션 ${number(grant.condition)}`:''
 ].filter(Boolean).join(' · ');
 return `보상 종류 확인 필요 · ${label(grant.kind)}`;
}

// Format saved decisions only. No eligibility, settlement or effect arithmetic.
export function eventChoiceLines(choice,{relicName=id=>id,unitName=unit=>own(names,unit.type)||unit.type}={}){
 if(!choice)return [];
 const p=choice.preview||{},combat=choice.combat,lines=[],context={relicName,unitName};
 const money=[finite(choice.goldCost)?`선택 비용 ${number(choice.goldCost)}G`:'',finite(choice.goldGranted)?`즉시 금화 +${number(choice.goldGranted)}G`:''].filter(Boolean);
 if(money.length)lines.push(money.join(' · '));
 if(finite(choice.goldBefore)&&finite(choice.goldAfter)&&choice.goldBefore!==choice.goldAfter)lines.push(`보유 금화 ${number(choice.goldBefore)}G → ${number(choice.goldAfter)}G`);
 if(choice.affordable===false)lines.push(`금화 부족${finite(choice.goldBefore)?` · 보유 ${number(choice.goldBefore)}G`:''}`);
 if(Array.isArray(choice.actualConditionChanges)){
  lines.push(finite(choice.totalActualConditionDelta)?`전원 컨디션 변화 합계 ${signed(choice.totalActualConditionDelta)}`:'전원 컨디션 변화 합계 확인 필요');
  for(const change of choice.actualConditionChanges)lines.push(`#${change.unitId} ${change.reserve?'예비대 · ':''}컨디션 ${number(change.before)} → ${number(change.after)}`);
 }
 if(combat){
  lines.push(`${own({normal:'일반',elite:'정예',boss:'보스'},combat.encounterKind)||`종류 확인 필요 (${label(combat.encounterKind)})`} 전투`);
  const gains=[finite(combat.gold)?`금화 +${number(combat.gold)}G`:'',finite(combat.xp)?`XP +${number(combat.xp)}`:''].filter(Boolean);
  if(gains.length)lines.push(`승리 시 ${gains.join(' · ')}`);
  if(finite(combat.fatigue))lines.push(`승리 시 출전 기본 피로 ${number(combat.fatigue)}`);
  if(combat.rewardMode==='event-special-replacement'){
   lines.push('특별 보상 · 일반 전투 보상 대체');
   const grant=grantLine(combat.specialGrant,context);if(grant)lines.push(`승리 후 선택 · ${grant}`);
  }else if(combat.rewardMode!=='ordinary')lines.push(`보상 방식 확인 필요 · ${label(combat.rewardMode)}`);
  const budgets=[finite(combat.eventRewardSelectionBudget)?`특별 보상 ${number(combat.eventRewardSelectionBudget)}회`:'',finite(combat.ordinaryRewardSelectionBudget)?`일반 전투 보상 ${number(combat.ordinaryRewardSelectionBudget)}회`:''].filter(Boolean);
  if(budgets.length)lines.push(`승리 후 선택 · ${budgets.join(' · ')}`);
  if(combat.advancesMilestone===false)lines.push('사건 전투 · 보스 진행 기록에 포함되지 않음');
  const excluded=[combat.grantsGuaranteedKey===false?'열쇠 확정 지급 없음':'',combat.grantsAwakeningPreparation===false?'각성 준비 지급 없음':''].filter(Boolean);
  if(excluded.length)lines.push(excluded.join(' · '));
 }else{
  const grant=grantLine(choice.grant,context);if(grant)lines.push(`선택 보상 · ${grant}`);
 }
 if(p.entryGrantsNothing===true)lines.push('서비스 목록 확인 · 진입 보상 없음 · 구매 비용 별도');
 if(choice.prepared===true){
  const effect=[finite(p.durationSeconds)?`첫 ${number(p.durationSeconds)}초`:'',finite(p.damageBonus)?`기본 피해 +${number(p.damageBonus*100)}%`:''].filter(Boolean).join(' ');
  lines.push(`${p.scope==='next-actual-battle-only'?'다음 전투 준비':'준비 효과'}${effect?` · ${effect}`:''}${p.consumedOnBattleFinish===true?' · 전투 종료 시 소모':''}`);
  if(p.preparedBefore===true&&p.stackable===false)lines.push('이미 준비됨 · 중첩 없음');
 }
 if(choice.escape===true){
  const excluded=[p.knockout===false?'도주로 쓰러짐 없음':'',p.reserveVictoryRecovery===0?'예비대 회복 없음':'',p.battleRewards===0?'전투 보상 없음':''].filter(Boolean);
  if(excluded.length)lines.push(excluded.join(' · '));
 }
 if(choice.grant?.kind==='recruit'||combat?.specialGrant?.kind==='recruit')lines.push('이번 원정에만 합류 · 영구 해금 없음');
 lines.push(...serviceEffectLines({preview:p.kind==='relic'?p.preview:p}));
 return [...new Set(lines.length?lines:['선택 정보 확인 필요'])];
}

export function awakeningStatusLines(unitReadiness,{keyName=id=>id}={}){
 if(!unitReadiness)return ['각성 상태 확인 필요'];
 const r=unitReadiness,codes=Array.isArray(r.remainingReasonCodes)?r.remainingReasonCodes:[];
 if(r.alreadyAwakened===true||codes.includes('already-awakened'))return ['각성 완료'];
 const key=r.keyId?label(keyName(r.keyId)||r.keyId):'종류 확인 필요',lines=[];
 if(r.eligible===true)lines.push('각성 가능');else if(r.eligible===false)lines.push('각성 대기');
 if(r.preparationComplete===true)lines.push('개별 각성 훈련 완료');
 if(r.keyOwned===true)lines.push(`열쇠 보유 · ${key}`);
 const reasons={
  'second-class-incomplete':'상위 병종 전직 필요','basic-skills-incomplete':'고유 기술 2개 필요',
  'preparation-required':'개별 각성 훈련 필요','matching-key-required':`계열 열쇠 필요 · ${key}`,
  'unsupported-second-class':'현재 지원하지 않는 상위 병종','phase-not-allowed':'현재 단계에서는 각성 불가',
  'checkpoint-locked':'전투·진행 상태 잠금','campaign-complete':'원정 종료 · 각성 불가'
 };
 for(const code of codes)lines.push(own(reasons,code)||`조건 확인 필요 · ${label(code)}`);
 if(r.phaseAllowed===false)lines.push(reasons['phase-not-allowed']);
 if(r.checkpointLocked===true)lines.push(reasons['checkpoint-locked']);
 return [...new Set(lines.length?lines:['각성 상태 확인 필요'])];
}

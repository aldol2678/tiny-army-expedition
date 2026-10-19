import {fields,number} from './presentation.js';
export const commandNames={heal:'응급 회복',guard:'수호 진형',focus:'집중 사격',rally:'사기 고양'};
const fieldNames={...fields,healInterval:'치유 주기',healInitialDelay:'첫 치유 대기','skill.damage':'주 기술 피해','skill.secondaryDamage':'보조 기술 피해','shield.amount':'보호막 양','shield.cooldown':'보호막 재사용','shield.initialDelay':'첫 보호막 대기',healRange:'치유 사거리',firstAttackMultiplier:'첫 공격 배율',primaryMultiplier:'주 기술 배율',secondaryMultiplier:'보조 기술 배율',maxTargets:'대상 수',emergencyMultiplier:'응급 치유 배율',maxMana:'최대 마나',startingMana:'시작 마나','skill.manaCost':'기술 마나 비용','skill.cooldown':'기술 재사용','skill.defenseAfter':'기술 사용 후 방어','skill.slowDuration':'둔화 지속','shield.duration':'보호막 지속',attackSpeedBonus:'공격 가속',movementSpeedBonus:'이동 가속',shieldBonus:'보호막',mageSkillDamageBonus:'마법 기술 피해',unitSkillCdr:'고유 기술 재사용 감소',commanderSkillCdr:'지휘 재사용 감소',relicDefense:'유물 방어 증가',guardianDefense:'방벽 방어 증가',relicRange:'유물 사거리 증가','max-heal-on-selected-target':'대상 최대 회복','incoming-damage-factor':'받는 피해 비율','focused-basic-damage-bonus':'표적 기본 피해 증가','rally-haste':'창 계열 가속',cooldown:'재사용',duration:'지속',power:'효과'};
const percentFields=new Set(['basicDamageBonus','attackSpeedBonus','supportHealBonus','shieldBonus','mageSkillDamageBonus','movementSpeedBonus','manaRegenBonus','unitSkillCdr','commanderSkillCdr','critChance','echoRefund','damageReduction','incoming-damage-factor','focused-basic-damage-bonus','rally-haste','power']);
export function fieldLabel(field){const m=/^command\.([^.]+)\.(.+)$/.exec(field);return m?`${commandNames[m[1]]||m[1]} ${fieldNames[m[2]]||m[2]}`:fieldNames[field]||field;}
export function limitValue(field,value){return ['relicDefense','guardianDefense','relicRange'].includes(field)?number(value):field==='critDamage'?'×'+number(value):number(value*100)+'%';}
export function statValue(field,value){return percentFields.has(field)?number(value*100)+'%':/Multiplier$|^critDamage$/.test(field)?'×'+number(value):/cooldown|duration|interval|delay/i.test(field)?number(value)+'초':number(value);}
const reasons={
 'No legal useful fixed grant is available; no replacement or reroll':'지급 가능한 고정 보상이 없습니다. 다른 보상으로 바뀌지 않습니다.',
 'Fixed event relic is owned, locked, unsupported, or currently ineffective':'이 유물은 이미 보유했거나 현재 획득 조건을 충족하지 않습니다.',
 'Owned roster cap20 reached or captive unsupported':'병사 보유 한도20명에 도달했거나 지원하지 않는 병사입니다.',
 'Relic capability is not implemented':'아직 구현되지 않은 유물입니다.',
 'Already owned; duplicate acquisition does not stack':'이미 보유 중이며 중복 효과는 없습니다.',
 'Relic is not owned':'보유한 유물만 강화할 수 있습니다.',
 'Relic is not unlocked':'아직 해금하지 않은 유물입니다.',
 'Required commander skill is not equipped':'필요한 지휘 기술을 편성하지 않았습니다.',
 'No timed commander skill equipped':'지속형 지휘 기술을 편성하지 않았습니다.',
 'Research is available in chapters 2 and 4 only':'연구는 2장과 4장에서 가능합니다.',
 'Evolution III is maximum':'이미 최대 3단계입니다.',
 'No effective improvement after conditions and caps':'현재 편성·상한에서는 추가 효과가 없습니다.',
 'Trigger cannot occur with current deployed roster':'현재 출전 편성에서는 발동 조건을 충족하지 못합니다.',
 'No effective training improvement':'현재 상한에서는 훈련 효과가 없습니다.',
 'Variant already researched':'이미 연구한 전략입니다.',
 'Two research purchases per expedition is the maximum':'이번 원정의 연구 2회를 모두 사용했습니다.',
 'This chapter research opportunity is already used':'이번 장의 연구 기회를 사용했습니다.',
 'Matching command is not equipped':'해당 지휘 기술을 먼저 편성해야 합니다.',
 'No deployed spear-family ally with haste headroom':'가속 효과를 받을 출전 창 계열 병사가 없습니다.',
 'No effective command improvement after current caps':'현재 상한에서는 추가 지휘 효과가 없습니다.',
 'No deployed unit can use this command':'효과를 받을 출전 병사가 없습니다.',
 'Campaign has ended':'원정이 종료되었습니다.',
 'No condition recovery available when everyone is at 100':'전원 컨디션이 이미 100입니다.',
 'E02 currency grant is disabled in the earned-combat-income candidate':'이 사건의 재화 지급은 현재 검증판에서 제공하지 않습니다.',
 'No remaining battle or awakening use':'남은 전투·각성 기회가 없습니다.',
 'Chosen target owned, unsupported or ineligible; no substitute target':'지정 목표가 이미 보유·미지원·조건 미충족 상태입니다. 대체 목표는 없습니다.',
 'No eligible target or non-ultimate core relic':'조건에 맞는 목표 또는 일반 핵심 유물이 없습니다.'
};
export const reasonText=text=>reasons[text]||(/^No eligible (.+) shop relic$/.test(text||'')?'현재 조건에 맞는 상점 유물이 없습니다.':text||'');
export function serviceTargets(choices){
 const targets=new Map();
 for(const c of choices){if(c.kind==='leave'||c.targetId===undefined||c.targetId===null)continue;const id=String(c.targetId);if(!targets.has(id))targets.set(id,{id,name:c.targetName||id,choices:[]});targets.get(id).choices.push(c);}
 return [...targets.values()];
}
export function selectedServiceChoices(choices,target){
 return choices.filter(c=>c.kind!=='leave'&&(target===undefined||target!==null&&String(c.targetId)===String(target)));
}
export function targetInformationLines(c,{state={},relicName=id=>id,unitName=u=>u.type}={}){
 if(!c.informationOnly)return [];
 if(c.familyWeights)return ['정보 확인 · 0G · 지급 없음','전직 계열 보유수: 예비대 포함, 기본 병사 제외',`시험값/미확정 · 유물칸 열쇠 진입 ${c.probabilityTrial.keyPoolChance*100}% · 계열 가중치 ${Object.entries(c.familyWeights).map(([k,v])=>k+':'+v).join(' / ')}`,'열쇠 후보가 없으면 일반 유물 풀로 복귀 · 확정 지급 아님'];
 const target=c.target,selected=state.targetRelicId,lines=['정보 확인 · 0G · 유물·골드·XP 지급 없음'];
 lines.push(selected?`지정 목표 · ${relicName(selected)}`:'목표 미지정 · 현재 조건으로 후보 확인');
 if(target?.kind==='relic'){
  const id=target.relic.id,p=target.preview||{};
  if(!selected||selected!==id)lines.push(`확인 후보 · ${target.name||relicName(id)}`);
  lines.push(`보유 상태 · ${(state.relics||[]).some(r=>r.id===id)?'이미 보유':'미보유'}`);
  const units=(p.qualificationUnits||[]).map(id=>{const u=(state.roster||[]).find(u=>u.id===id);return u?`${unitName(u)} #${id}`:`#${id}`;});
  if(p.qualification){
   lines.push(`열쇠 수집 조건에 맞는 병사 · ${units.join(' · ')||'확인됨'}`);
   lines.push('각성은 별도: 개인 각성 준비 + 같은 계열 열쇠 + 고유 기술 2개');
  }else lines.push('일반 핵심 유물 후보 · 각성 열쇠 아님');
  if(p.futureUtility)lines.push('현재 출전 효과 없음 · 예비대의 향후 자격용 후보');
  else if(p.currentUtility)lines.push('현재 편성에서 효과 조건 충족 · 이 사건에서는 획득하지 않음');
 }else{
  if(selected)lines.push(`보유 상태 · ${(state.relics||[]).some(r=>r.id===selected)?'이미 보유':'미보유'}`);
  lines.push(`확인 불가 · ${reasonText(target?.reason||'목표 정보가 없습니다.')}`);
 }
 return lines;
}
export function serviceEffectLines(c,context){
 const p=c.preview||{},lines=[];if(p.classification==='economy')lines.push(p.description,`현재 ${p.economy.principal}G 기준 승리 이자 ${p.economy.projectedVictoryInterest}G · 구매 비용 차감 후 재계산`);
 if(p.fromTraining!==undefined)lines.push(`훈련 ${p.fromTraining} → ${p.toTraining}`);
 if(p.fromEvolution!==undefined&&p.toEvolution!==undefined)lines.push(`강화 ${p.fromEvolution} → ${p.toEvolution}`);
 for(const x of p.changes||[])lines.push(`${x.unitId!=null?'#'+x.unitId+' ':''}${fieldLabel(x.field)} ${statValue(x.field,x.before)} → ${statValue(x.field,x.after)}`);
 if(c.kind==='research'&&p.before&&p.after){
  lines.push(`재사용 ${number(p.before.cooldown)}초 → ${number(p.after.cooldown)}초`);
  if(p.before.duration||p.after.duration)lines.push(`지속 ${number(p.before.duration)}초 → ${number(p.after.duration)}초`);
  lines.push(...(p.losses||[]).filter(x=>typeof x==='string'));
  const caps=p.after.caps||{};
  const notes={heal:'가장 체력이 낮은 생존 아군 1명만 회복 · 잃은 체력까지만 · 부활 없음',guard:`최종 피해 감소 상한 ${number(caps.damageReduction*100)}%`,focus:`표적 1명에게 사거리 내 기본 공격만 적용 · 합산 증가 상한 ${number(caps.basicDamageBonus*100)}%`,rally:`생존 창 계열만 적용 · 합산 가속 상한 ${number(caps.attackSpeed*100)}%`};
  if(notes[c.skillId])lines.push(notes[c.skillId]);
  lines.push('구매 즉시 편성 · 이번 원정에만 적용');
 }
 for(const x of p.costs||[])if(typeof x==='string')lines.push(x);else if(x.factor!=null)lines.push(`대가 · ${x.unitId!=null?'#'+x.unitId+' ':''}${fieldLabel(x.field)} ×${number(x.factor)}${x.remainsOnForge?' 유지':''}`);
 for(const x of p.caps||[])lines.push(`상한 적용 · ${x.unitId!=null?'#'+x.unitId+' ':''}${fieldLabel(x.field)}${p.limits?.[x.field]!=null?' '+limitValue(x.field,p.limits[x.field]):''}`);
 for(const x of p.conditions||[])lines.push(({first_ally_knockout_with_survivor:'첫 아군 쓰러짐 후 생존 기본 공격자가 있을 때 · 전투당 1회',third_successful_paid_spell:'실제로 마나를 쓴 기술 3회마다 · 최대 마나까지만 · 재사용 초기화 없음',critical_successful_normal_heal:'체력 20% 이하 생존 아군에게 일반 치유 성공 시 · 잃은 체력까지만 · 전투당 1회'})[x.id]||x.description||x.id);
 for(const x of c.actualConditionChanges||[])lines.push(`#${x.unitId} 컨디션 ${number(x.before)} → ${number(x.after)}`);
 if(c.informationOnly)lines.push(...targetInformationLines(c,context));
 if(c.prepared)lines.push('다음 전투 첫 10초 기본 피해 +10% · 해당 전투 종료 시 소모');
 return [...new Set(lines)];
}

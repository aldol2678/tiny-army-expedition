// Read-only aggregation. The host injects the existing statistics reader and
// canonical family resolver; no gameplay, storage, RNG or command capability.
const FAMILIES=Object.freeze([['spear','창병'],['archer','궁수'],['mage','마법사'],['support','지원병']]);
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const total=(rows,key)=>rows.every(r=>r[key]!==null)?number(rows.reduce((n,r)=>n+r[key],0)):null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const displayNumber=v=>number(v)===null?'—':v.toLocaleString('ko-KR',{maximumFractionDigits:1});
export function createBattleSummaryReader({readStatistics,familyOf}={}){
 if(typeof readStatistics!=='function'||typeof familyOf!=='function')throw Error('Existing statistics and family readers are required');
 return function read({snapshot=null,result=null}={}){
  const terminal=result||(snapshot?.phase!=='battle'?snapshot?.lastResult:null),source=terminal||snapshot;
  if(!source)return freeze({available:false,reason:'NO_BATTLE',rows:[],families:[]});
  const view=readStatistics({snapshot,result}),actors=terminal?source.contributions:source.units;
  if(!Array.isArray(actors)||!Array.isArray(view.rows)||actors.length!==view.rows.length)throw Error('Statistics actor rows differ');
  const byId=new Map();for(const actor of actors){if(!Number.isSafeInteger(actor.id)||actor.id<1||byId.has(actor.id))throw Error('Invalid or duplicate statistics actor');byId.set(actor.id,actor);}
  const ids=new Set(),elapsed=number(view.elapsed),rows=view.rows.map(row=>{
   if(!byId.has(row.id)||ids.has(row.id))throw Error('Unknown or duplicate statistics row');ids.add(row.id);
   const actor=byId.get(row.id);if(actor.type!==row.type)throw Error('Statistics actor identity differs');
   const family=familyOf(row.type),hp=number(actor.hp),maxHp=number(actor.maxHp),validHealth=hp!==null&&maxHp!==null&&maxHp>0&&hp<=maxHp;
   return {id:row.id,type:row.type,slot:row.slot??null,family:FAMILIES.some(([id])=>id===family)?family:null,health:validHealth?(hp>0?'alive':'knocked-out'):'unknown',hp:validHealth?hp:null,maxHp:validHealth?maxHp:null,damage:number(row.damage),dps:number(row.dps),healing:number(row.healing),shieldAbsorbed:number(row.shieldAbsorbed)};
  });
  const aggregate=(members,id,label)=>{const healthKnown=members.every(r=>r.health!=='unknown'),damage=total(members,'damage'),hp=total(members,'hp'),maxHp=total(members,'maxHp');return {id,label,participants:members.length,alive:healthKnown?members.filter(r=>r.health==='alive').length:null,knockedOut:healthKnown?members.filter(r=>r.health==='knocked-out').length:null,unknownHealth:members.filter(r=>r.health==='unknown').length,hp,maxHp,hpRatio:hp!==null&&maxHp!==null&&maxHp>0?hp/maxHp:null,damage,dps:damage===null||elapsed===null?null:elapsed>0?damage/elapsed:0,healing:total(members,'healing'),shieldAbsorbed:total(members,'shieldAbsorbed'),unitIds:members.map(r=>r.id)};};
  return freeze({available:true,source:terminal?'terminal':'live',battleId:view.battleId??null,elapsedSeconds:elapsed,rows,families:FAMILIES.map(([id,label])=>aggregate(rows.filter(r=>r.family===id),id,label)),unclassified:aggregate(rows.filter(r=>r.family===null),'unclassified','미분류'),soldierTotals:aggregate(rows,'soldiers','병사 합계'),allHealingRecorded:number(source.healingDone),commanderHealingRecorded:terminal?number(source.skillHealing):null,notes:{headcount:'생존 / 이 전투 출전 인원',healing:'계열 합계는 병사에게 기록된 실제 치유만 포함합니다. 지휘·유물 등 병사 외 치유를 임의 배분하지 않습니다.',shield:'시전자의 보호막이 실제 소모하여 흡수한 피해입니다. 부여량·방어력·상태이상 예방·HP를 구한 양과 다릅니다.',dps:'기록된 피해 ÷ 동일한 게임 내 전투 경과 시간. 시각 연출 시간은 포함하지 않습니다.'}});
 };
}
export function familySituationMarkup(view){
 if(!view?.available)return '';
 return `<section class="battle-family-situation" aria-label="계열별 전황"><p class="battle-summary-caption">생존 / 출전 인원</p><ul>${view.families.map(f=>`<li data-family="${f.id}"><strong>${esc(f.label)}</strong><span>${f.alive===null?'—':f.alive} / ${f.participants}명</span><span>HP ${f.hpRatio===null?'—':Math.round(f.hpRatio*100)+'%'}</span></li>`).join('')}</ul>${view.unclassified.participants?`<p>미분류 ${view.unclassified.participants}명 · 아래 병사 기록에 포함</p>`:''}</section>`;
}
export function resultSummaryMarkup(view,{nameFor=row=>`${row.type} #${row.id}`}={}){
 if(!view?.available)return '<p>아직 전투 기록이 없습니다.</p>';
 const metrics=row=>`<dl>${[['damage','피해'],['dps','DPS'],['healing','실제 치유'],['shieldAbsorbed','보호막 흡수']].map(([key,label])=>`<div><dt>${label}</dt><dd>${displayNumber(row[key])}</dd></div>`).join('')}</dl>`;
 return `${familySituationMarkup(view)}<section class="battle-result-summary"><h3>계열별 병사 기록 합계</h3><p>게임 내 ${displayNumber(view.elapsedSeconds)}초 · 생존 / 출전 인원</p><ul class="battle-family-results">${view.families.map(f=>`<li><strong>${esc(f.label)} · ${f.alive===null?'—':f.alive}/${f.participants}명</strong>${metrics(f)}</li>`).join('')}</ul><h3>병사별 기록</h3><ol class="battle-unit-results">${view.rows.map(r=>`<li data-unit-id="${r.id}"><strong>${esc(nameFor(r))}${r.health==='knocked-out'?' · 전투불능':r.health==='unknown'?' · 상태 확인 불가':''}</strong>${metrics(r)}</li>`).join('')}</ol><p>${esc(view.notes.healing)}</p><p>${esc(view.notes.shield)}</p><p>${esc(view.notes.dps)}</p></section>`;
}

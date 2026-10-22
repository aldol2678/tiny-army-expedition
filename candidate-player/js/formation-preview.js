(function(global){'use strict';
// Read-only formation projection adapter. No imports from campaign, storage, RNG or battle engine.
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const token=run=>JSON.stringify(run); // conservative: any run change invalidates approval
const near=(a,b)=>Math.abs(a-b)<1e-9;
const scalarFields=['maxHp','attackPower','abilityPower','defense','baseDefense','basicDamage','attackInterval','attackRange','speed','heal','healInterval','healRange','healInitialDelay','guardianDefense','manaRegen','maxMana','startingMana','critChance','critDamage','preparedDamageMultiplier','preparedDuration'];
function metrics(p){
 const out={};for(const k of scalarFields)if(Number.isFinite(p[k]))out[k]=p[k];
 for(const a of p.abilities||[])for(const k of ['amount','primaryAmount','secondaryAmount','firstAttackAmount','interval','range','targets','duration','manaCost','slow','slowDuration','bossSlow','initialDelay','every','defenseAfter','defenseDuration','emergencyThreshold','emergencyMultiplier'])if(Number.isFinite(a[k]))out[`ability.${a.id}.${k}`]=a[k];
 return out;
}
function reasons(a,b){
 const tags=[];const keyed=p=>new Map(p.ledger.map(e=>[e.sourceId+':'+e.effectId,e]));const old=keyed(a),next=keyed(b);
 for(const key of new Set([...old.keys(),...next.keys()])){const x=old.get(key),y=next.get(key);if(JSON.stringify(x)!==JSON.stringify(y))tags.push({kind:(y||x).category,sourceId:(y||x).sourceId,field:(y||x).affectedField,before:x?.applied?x.value:0,after:y?.applied?y.value:0});}
 if(JSON.stringify(a.guardianLink)!==JSON.stringify(b.guardianLink))tags.push({kind:'guardian_link',before:a.guardianLink,after:b.guardianLink});
 for(const [side,p] of [['before',a],['after',b]]){
  for(const c of p.cappedModifiers)tags.push({kind:'cap',side,field:c.field,overflow:c.capped,relicFlatOverflow:c.relicFlatCapped});
  if(p.type==='guardian'&&p.abilityPower*p.skill.coefficient>=20)tags.push({kind:'guardian_cap',side,field:'guardianDefense',cap:20});
 }
 return tags;
}
function preview(C,run,unitId,toSlot){
 const invalid=reason=>freeze({valid:false,reason});
 if(C.COMBAT_VERSION!=='v09-combat-1'||run?.combatRulesVersion!==C.COMBAT_VERSION)return invalid('unsupported_rules');
 if(!['map','prepare'].includes(run.phase))return invalid('locked_phase');
 if(!(toSlot===null||Number.isInteger(toSlot)&&toSlot>=0&&toSlot<12))return invalid('invalid_slot');
 const before=clone(run.roster),ids=new Set(),slots=new Set();
 for(const u of before){if(ids.has(u.id)||!(u.slot===null||C.isDeployed(u))||u.slot!==null&&slots.has(u.slot))return invalid('invalid_roster');ids.add(u.id);if(u.slot!==null)slots.add(u.slot);}
 const unit=before.find(u=>u.id===unitId);if(!unit)return invalid('missing_unit');
 const other=toSlot===null?null:before.find(u=>u.id!==unitId&&u.slot===toSlot);
 if(unit.slot===null&&toSlot!==null&&!other&&before.filter(C.isDeployed).length>=C.deploymentCap(run.xp))return invalid('deployment_full');
 const after=clone(before),moving=after.find(u=>u.id===unitId),occupied=other&&after.find(u=>u.id===other.id);
 if(occupied)occupied.slot=moving.slot;moving.slot=toSlot;
 const options=roster=>({roster,relics:run.relics,skills:run.skills,prepared:run.prepared});
 try{
 const units=before.map((u,i)=>{
  const a=C.projectUnit(u,options(before)),b=C.projectUnit(after[i],options(after)),ma=metrics(a),mb=metrics(b),changes=[];
  for(const key of new Set([...Object.keys(ma),...Object.keys(mb)]))if(Number.isFinite(ma[key])&&Number.isFinite(mb[key])&&!near(ma[key],mb[key]))changes.push({field:key,before:ma[key],after:mb[key],delta:mb[key]-ma[key]});
  const tags=reasons(a,b),placementChanged=u.slot!==after[i].slot;
  return{id:u.id,type:u.type,slotBefore:u.slot,slotAfter:after[i].slot,deployedBefore:C.isDeployed(u),deployedAfter:C.isDeployed(after[i]),before:a,after:b,changes,tags,placementChanged,affected:placementChanged||changes.length>0||JSON.stringify(a.guardianLink)!==JSON.stringify(b.guardianLink)};
 });
 return freeze({valid:true,contextToken:token(run),unitId,toSlot,kind:unit.slot===toSlot?'noop':other?'swap':toSlot===null?'reserve':unit.slot===null?'deploy':'move',rosterAfter:after,units,affectedUnits:units.filter(u=>u.affected),hasStatChanges:units.some(u=>u.changes.length),synergyBefore:C.synergyPreview(before),synergyAfter:C.synergyPreview(after),deploymentCap:C.deploymentCap(run.xp)});
 }catch(error){return invalid('projection_error: '+error.message);}
}
function isCurrent(run,p){return p?.valid===true&&p.contextToken===token(run);}

// Known imported saves retain placement, but never borrow v09 stat formulas.
function review(C,run,unitId,toSlot){
 if(!['v05-combat-1','v08-combat-1'].includes(run?.combatRulesVersion))return preview(C,run,unitId,toSlot);
 const invalid=reason=>freeze({valid:false,reason});
 if(!['v05-fixed-1','v08-seeded-1','v082-events-1'].includes(run.mapVersion))return invalid('unsupported_rules');
 if(!['map','prepare'].includes(run.phase))return invalid('locked_phase');
 if(!Number.isInteger(toSlot)||toSlot<0||toSlot>=12)return invalid('invalid_slot');
 const before=clone(run.roster),ids=new Set(),slots=new Set();
 for(const u of before){if(ids.has(u.id)||!Number.isInteger(u.slot)||u.slot<0||u.slot>=12||slots.has(u.slot))return invalid('invalid_roster');ids.add(u.id);slots.add(u.slot)}
 const unit=before.find(u=>u.id===unitId);if(!unit)return invalid('missing_unit');
 const other=before.find(u=>u.id!==unitId&&u.slot===toSlot),after=clone(before);
 if(other)after.find(u=>u.id===other.id).slot=unit.slot;after.find(u=>u.id===unitId).slot=toSlot;
 return freeze({valid:true,locationOnly:true,contextToken:token(run),unitId,toSlot,kind:unit.slot===toSlot?'noop':other?'swap':'move',rosterAfter:after,units:before.filter(u=>u.id===unitId||u.id===other?.id).map(u=>({...u,slotBefore:u.slot,slotAfter:after.find(v=>v.id===u.id).slot}))});
}
// Session-only, single-level undo. Store placements, never a campaign snapshot.
function history({content,run,commit,restore,label}){
 const fingerprint=()=>{const value=token(run());let a=2166136261,b=5381;for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b,33)^value.charCodeAt(i)}return `${value.length}:${a>>>0}:${b>>>0}`};
 let entry=null,busy=false;
 const current=()=>entry&&['map','prepare'].includes(run().phase)&&entry.afterToken===fingerprint();
 function invalidate(){entry=null}
 function move(id,slot){
  if(busy)return {status:'ignored'};
  const p=review(content(),run(),id,slot);
  if(!p.valid)return {status:'invalid',preview:p};
  if(p.kind==='noop')return {status:'noop'};
  const slots=run().roster.map(u=>({id:u.id,slot:u.slot}));
  busy=true;let ok=false;try{ok=commit(id,slot)!==false}catch(_){}finally{busy=false}
  if(!ok){invalidate();return {status:'failed'}};
  entry={slots,afterToken:fingerprint(),unitId:id,summary:summary(p,{content:content(),label})};return {status:'committed',id,slot,preview:p};
 }
 function undo(){
  if(busy)return {status:'ignored'};
  if(!current()){invalidate();return {status:'stale'}};
  const saved=entry;busy=true;let ok=false;try{ok=restore(saved.slots)!==false}catch(_){}finally{busy=false}
  if(!ok){invalidate();return {status:'failed'}};
  invalidate();return {status:'undone',id:saved.unitId};
 }
 return Object.freeze({move,undo,invalidate,get entry(){if(!current())invalidate();return entry}});
}
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?(Math.round(n*100)/100).toLocaleString('ko-KR',{maximumFractionDigits:2}):'미지원';
const names={maxHp:'최대 HP',attackPower:'ATK',abilityPower:'AP',defense:'DEF',basicDamage:'평타 기본량',attackInterval:'평타 간격',attackRange:'평타 사거리',speed:'이동 속도',heal:'정상 치유 기본량',healInterval:'치유 간격',healRange:'치유 사거리',healInitialDelay:'첫 치유 대기 (초)',guardianDefense:'방벽 연결 DEF',manaRegen:'마나 회복',maxMana:'최대 마나',startingMana:'시작 마나',critChance:'치명 확률 (비율)',critDamage:'치명 배율 (배)',preparedDamageMultiplier:'준비 피해 배율',preparedDuration:'준비 지속'};
const location=slot=>slot===null?'예비':`${['전열','중열','후열'][Math.floor(slot/4)]} ${slot%4+1}번`;
function summary(r,{content:C,label=u=>C.TYPES[u.type]?.name||u.type}={}){
 if(!r?.valid)return '배치를 바꿀 수 없어요. 정원과 현재 상태를 확인해 주세요.';
 if(r.kind==='noop')return '현재 자리';
 const mover=r.units.find(u=>u.id===r.unitId),prefix=`${label(mover)} · ${location(mover.slotBefore)} → ${location(mover.slotAfter)}`;
 if(r.locationOnly)return `${prefix} · 구버전 저장: 위치만 변경`;
 const primary=['maxHp','attackPower','abilityPower','defense'];
 const changed=r.affectedUnits.flatMap(u=>[...u.changes.filter(c=>primary.includes(c.field)),...u.changes.filter(c=>names[c.field]&&!primary.includes(c.field))].map(c=>`${label(u)} ${names[c.field]} ${fmt(c.before)} → ${fmt(c.after)}`));
 const links=r.affectedUnits.filter(u=>JSON.stringify(u.before.guardianLink)!==JSON.stringify(u.after.guardianLink));
 return `${prefix} · ${changed.length?changed.slice(0,2).join(' · ')+(changed.length>2?` 외 ${changed.length-2}개 변화`:''):r.hasStatChanges?`전투 능력치 ${r.affectedUnits.filter(u=>u.changes.length).length}명 변경`:links.length?`방벽 연결 ${links.length}명 변경`:'능력치 변화 없음'}`;
}
// Detail artwork is a separately shipped asset; stat artwork belongs to the existing game registry.
const extraMetricKeys=Object.freeze({healInitialDelay:'cooldown',guardianDefense:'defense',preparedDamageMultiplier:'prepared',preparedDuration:'cooldown'});
function metricKey(field){return global.TinyArmyStrategyView?.ROWS?.[field]?.icon||extraMetricKeys[field]||({maxHp:'hp',attackPower:'attackPower',abilityPower:'abilityPower',defense:'defense',basicDamage:'attack',attackInterval:'attackInterval',attackRange:'attackRange',speed:'attackSpeed',heal:'heal',healInterval:'cooldown',healRange:'attackRange',manaRegen:'mana',maxMana:'mana',startingMana:'mana',critChance:'critChance',critDamage:'critMultiplier'})[field]}
function uiIcon(kind){
 if(kind==='info')return '<img class="formation-ui-icon" data-formation-icon="info" src="./assets/formation/detail-info.svg" width="20" height="20" alt="" aria-hidden="true" draggable="false">';
 const key=metricKey(kind),art=key&&global.TinyArmyCardArt?.metric(key,{size:20});
 return art?`<span class="formation-ui-icon" data-formation-icon="${html(kind)}" data-metric-key="${html(key)}" aria-hidden="true">${art}</span>`:`<span class="formation-metric-fallback" aria-hidden="true">${html(names[kind]||kind)}</span>`;
}
const compactLocation=slot=>location(slot).replace('번','');
const deltaText=n=>`${n>0?'+':'−'}${fmt(Math.abs(n))}`;
// Reusable read-only presentation model: never combine another soldier's numbers.
function compactResult(r,{content:C,label=u=>C.TYPES[u.type]?.name||u.type}={}){
 if(!r?.valid)return null;
 const mover=r.units.find(u=>u.id===r.unitId),primary=['maxHp','attackPower','abilityPower','defense'];
 const changes=(mover.changes||[]).filter(c=>names[c.field]);
 changes.sort((a,b)=>(primary.includes(a.field)?primary.indexOf(a.field):4)-(primary.includes(b.field)?primary.indexOf(b.field):4));
 const others=(r.affectedUnits||r.units.filter(u=>u.slotBefore!==u.slotAfter)).filter(u=>u.id!==r.unitId);
 return {name:label(mover),location:`${compactLocation(mover.slotBefore)} → ${compactLocation(mover.slotAfter)}`,changes,others,locationOnly:!!r.locationOnly};
}
function resultMarkup(r,options){
 const model=compactResult(r,options);if(!model)return '';
 const {label=u=>options.content.TYPES[u.type]?.name||u.type}=options;
 const shown=model.changes.slice(0,4),extra=model.changes.length-shown.length;
 const chips=shown.map(c=>`<span class="formation-delta" data-stat="${c.field}" data-delta="${c.delta}" aria-label="${html(names[c.field])} ${html(deltaText(c.delta))}" title="${html(names[c.field])}: ${fmt(c.before)} → ${fmt(c.after)}">${uiIcon(c.field)}${!['maxHp','attackPower','abilityPower','defense'].includes(c.field)?`<span>${html(names[c.field])}</span>`:''}<b>${deltaText(c.delta)}</b></span>`).join('');
 const detailUnits=r.affectedUnits||r.units;
 const details=detailUnits.map(u=>`<li><strong>${html(label(u))}</strong> · ${html(location(u.slotBefore))} → ${html(location(u.slotAfter))}${(u.changes||[]).map(c=>`<span>${html(names[c.field]||c.field)} ${fmt(c.before)} → ${fmt(c.after)} (${deltaText(c.delta)})</span>`).join('')}${u.before&&JSON.stringify(u.before.guardianLink)!==JSON.stringify(u.after.guardianLink)?'<span>방벽 연결 변경</span>':''}</li>`).join('');
 return `<div class="formation-result-copy"><div class="formation-result-compact" role="group" aria-label="${html(model.name)} 이동 결과"><strong class="formation-result-location">${html(model.location)}</strong>${chips}${extra?`<span class="formation-result-note">외 ${extra}개</span>`:''}${!model.changes.length?`<span class="formation-result-note">${model.locationOnly?'구버전 저장: 위치만 변경':'능력치 변화 없음'}</span>`:''}</div><details class="formation-result-details"><summary>${uiIcon('info')}<span>${model.others.length?`다른 병사 ${model.others.length}명 영향 · `:''}변화 상세</span></summary><ul>${details}</ul></details></div>`;
}
function markup(p,options){return p?`<strong>놓으면 ${p.preview.kind==='swap'?'교환':'이동'}</strong><span>${html(summary(p.preview,options))}</span>`:''}
// Adjacent to the board, informational only. Never appended below the long roster.
function mount({root,content,label}){
 const panel=root.ownerDocument.createElement('section');panel.className='formation-preview-panel';panel.hidden=true;panel.setAttribute('aria-label','이동 예상 변화');
 const grid=root.querySelector('.formation-grid');if(grid)grid.parentNode.insertBefore(panel,grid.nextSibling);
 function draw(p){panel.hidden=!p;panel.innerHTML=markup(p,{content:content(),label});for(const cell of root.querySelectorAll('[data-action="slot"]')){cell.classList.remove('formation-preview-origin','formation-preview-destination');if(p?.preview.valid){if(Number(cell.dataset.unitId)===p.id)cell.classList.add('formation-preview-origin');if(p.slot!==null&&Number(cell.dataset.slot)===p.slot)cell.classList.add('formation-preview-destination')}}}
 return {draw,destroy(){draw(null);panel.remove()}};
}
const api=Object.freeze({preview,review,isCurrent,metrics,history,summary,metricKey,uiIcon,compactResult,resultMarkup,markup,mount});global.TinyArmyFormationPreview=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

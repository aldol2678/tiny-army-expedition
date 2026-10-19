// Observational UI only. Never add these projections to a command, receipt or save.
import {esc,names} from './presentation.js';
export const STATISTICS_REFRESH_MS=750;
const measured=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const sum=(rows,key)=>rows.every(r=>r[key]!==null)?rows.reduce((n,r)=>n+r[key],0):null;
export const statisticsNumber=x=>measured(x)===null?'—':x.toLocaleString('ko-KR',{maximumFractionDigits:1});
export function battleStatistics({snapshot=null,result=null}={}){
 // Terminal contributions precede the engine's post-victory revival. Do not read
 // live HP to decide whether a soldier was knocked out in the finished battle.
 const terminal=result||(snapshot?.phase!=='battle'?snapshot?.lastResult:null),source=terminal||snapshot;
 if(!source)return {battleId:null,elapsed:0,rows:[],damage:0,healing:0,shieldAbsorbed:0};
 const ticks=measured(terminal?source.ticks:source.tickCount),elapsed=ticks===null?measured(source.time):ticks/60;
 const rows=(terminal?source.contributions:source.units||[]).map(u=>{const s=terminal?u:u.stats||{},damage=measured(s.damage);return {id:u.id,type:u.type,slot:u.slot,knockedOut:u.hp===0,damage,dps:damage===null||elapsed===null?null:elapsed>0?damage/elapsed:0,healing:measured(s.healing),shieldAbsorbed:measured(s.barrierAbsorbed),shieldGranted:measured(s.barrierGranted)};});
 return {battleId:source.battleId,elapsed,rows,damage:sum(rows,'damage'),healing:sum(rows,'healing'),shieldAbsorbed:sum(rows,'shieldAbsorbed')};
}
const metrics=result=>result?[['damage','피해'],['dps','DPS'],['healing','실제 치유'],['shieldAbsorbed','보호막 흡수']]:[['damage','피해'],['dps','DPS']];
export function statisticsRowsMarkup(view,{result=false,nameFor=u=>names[u.type]||u.type}={}){
 return view.rows.map(u=>`<li class="battle-stat-row" data-stat-id="${esc(u.id)}"><div class="battle-stat-name"><strong>${esc(nameFor(u))} #${esc(u.id)}</strong><span data-stat-ko>${u.knockedOut?'전투불능':''}</span></div><dl class="battle-stat-values">${metrics(result).map(([key,label])=>`<div><dt>${label}</dt><dd data-stat-value="${key}">${statisticsNumber(u[key])}</dd></div>`).join('')}</dl></li>`).join('');
}
export function liveStatisticsMarkup(){return `<div class="battle-statistics"><button type="button" id="battle-stats-toggle" data-action="toggle-battle-stats" aria-expanded="false" aria-controls="battle-stats-panel">전투 통계</button><section id="battle-stats-panel" class="panel battle-stats-panel" aria-labelledby="battle-stats-title" hidden><div class="bar"><h2 id="battle-stats-title">전투 통계</h2><button type="button" data-action="close-battle-stats">닫기</button></div><p class="muted">게임 내 <span id="battle-stats-time">0</span>초 · 피해 ÷ 경과 시간 = DPS</p><ol id="battle-stats-rows" class="battle-stat-list" aria-live="off"></ol><p class="muted battle-stats-note">과잉 피해 제외 · 전투불능 병사 기록 유지 · 약 0.75초마다 갱신</p></section></div>`;}
export function resultStatisticsMarkup(result,{nameFor,open=true}={}){
 if(!result?.contributions)return '';const v=battleStatistics({result});
 return `<details class="panel battle-result-statistics" ${open?'open':''}><summary>직전 전투 기여 · ${result.win?'승리':'패배'} · ${statisticsNumber(v.elapsed)}초</summary><ol class="battle-stat-list">${statisticsRowsMarkup(v,{result:true,nameFor})}</ol><p class="muted battle-stats-note">피해는 실제 HP 감소, 치유는 실제 HP 회복입니다. 보호막은 부여량이 아니라 시전자의 막이 실제 흡수한 피해입니다. 방어력·피해 감소·상태이상 방지는 포함하지 않으며, HP를 구한 양과는 다릅니다.</p></details>`;
}
// Keyed, in-place number updates avoid replacing focus/scroll targets every frame.
export function createLiveStatisticsUpdater({document,now=()=>performance.now(),nameFor}={}){
 let current=null,signature='',lastUpdate=-Infinity;
 return function update(snapshot,{force=false}={}){
  const panel=document.getElementById('battle-stats-panel'),list=document.getElementById('battle-stats-rows');
  if(!panel||panel.hidden||!list||!snapshot)return false;
  const at=now(),fresh=list!==current;if(!force&&!fresh&&at-lastUpdate<STATISTICS_REFRESH_MS)return false;
  const view=battleStatistics({snapshot}),key=JSON.stringify([view.battleId,view.rows.map(u=>[u.id,u.type])]);
  if(fresh||signature!==key){list.innerHTML=statisticsRowsMarkup(view,{nameFor});current=list;signature=key;}
  for(const row of view.rows){const node=list.querySelector(`[data-stat-id="${row.id}"]`);if(!node)continue;for(const [field]of metrics(false)){const value=node.querySelector(`[data-stat-value="${field}"]`),text=statisticsNumber(row[field]);if(value&&value.textContent!==text)value.textContent=text;}const ko=node.querySelector('[data-stat-ko]'),text=row.knockedOut?'전투불능':'';if(ko&&ko.textContent!==text)ko.textContent=text;}
  const time=document.getElementById('battle-stats-time'),text=statisticsNumber(view.elapsed);if(time&&time.textContent!==text)time.textContent=text;lastUpdate=at;return true;
 };
}

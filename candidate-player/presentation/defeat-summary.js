import {classifyDefeat} from './terminal-vignette.js';
// Read projection of acknowledged terminal bytes; no settlement or navigation.
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min?n:null;
export function readDefeatSummary(ack){
 const s=ack?.state,b=s?.battles?.at(-1),r=b?.receipt;
 if(!['defeat','complete'].includes(s?.phase)||r?.source!=='REAL_PINNED_V09_ENGINE'||r.result?.win!==false)return null;
 const loss=classifyDefeat(r.result),wins=s.battles.filter(x=>x?.receipt?.result?.win===true).length;
 // Current productionCurrency:0/tokensDelta:0 placeholders are NOT payouts.
 // No numeric amount is shown without an approved authoritative payout schema.
 const status=s.settlement?.permanentSettlementStatus;
 const settlement=status===undefined||status==='PENDING_FIVE_CHAPTER_ECONOMY_SPEC'?
  {status:'unimplemented',tokens:null,label:'증표 정산 정보 없음 · 아직 구현되지 않았습니다.'}:
  {status:'unavailable',tokens:null,label:'증표 정산 정보를 확인할 수 없습니다.'};
 return freeze({available:true,key:{runId:ack.runId,revision:ack.revision,battleId:r.result.battleId,resultDigest:r.resultDigest},...loss,currentChapter:integer(s.chapter,1),battleChapter:integer(b.chapter,1),attemptedBattles:s.battles.length,wonBattles:integer(s.battleCount)===wins?wins:null,settlementRecorded:s.phase==='complete'&&s.settlement?.outcome==='defeat',settlement,notes:{counts:'도전 전투 수와 승리 수는 서로 다른 기록입니다.',health:'생존·전투불능 인원은 전투 종료 영수증 기준입니다. 현재 화면의 HP로 승패를 판단하지 않습니다.',navigation:'기록 저장·보관·새 원정은 기존 명령으로만 진행합니다.'}});
}
export function defeatHeaderMarkup(view){
 if(!view?.available||view.outcome!=='defeat')return '';
 const show=n=>n===null?'확인 불가':esc(n);
 return `<section class="battle-defeat-summary" data-outcome="defeat" aria-label="확정 패배 기록"><h2>${esc(view.title)}</h2><p>${esc(view.description)}</p><dl><div><dt>현재 장</dt><dd>${show(view.currentChapter)}</dd></div><div><dt>도전 전투</dt><dd>${show(view.attemptedBattles)}회</dd></div><div><dt>승리</dt><dd>${show(view.wonBattles)}회</dd></div><div><dt>종료 시 생존 / 출전</dt><dd>${show(view.survivors)} / ${show(view.participants)}명</dd></div></dl><p class="battle-settlement-note">${esc(view.settlement.label)}</p><p>${esc(view.notes.health)}</p></section>`;
}

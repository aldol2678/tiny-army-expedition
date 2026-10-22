// Presentation-clock-only terminal vignette. No engine/command/storage APIs.
export const TERMINAL_VIGNETTE_MAX_MS=550;
const text=v=>typeof v==='string'&&v.length>0&&v.length<=240;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const key=(runId,battleId)=>JSON.stringify([runId,battleId]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function context(ack){
 if(!ack)return null;const s=ack.state;
 if(!text(ack.runId)||!Number.isSafeInteger(ack.revision)||ack.revision<0||!s||!Array.isArray(s.battles)||s.battles.length>6000)throw Error('Acknowledged run context required');
 return {runId:ack.runId,revision:ack.revision,phase:s.phase,count:s.battles.length,pendingBattleId:s.pendingBattle?.battleId??null,last:s.battles.at(-1)??null};
}
function stamp(c){return c?{runId:c.runId,revision:c.revision,phase:c.phase,count:c.count,pendingBattleId:c.pendingBattleId,lastId:c.last?.receipt?.result?.battleId??null,lastDigest:c.last?.receipt?.resultDigest??null}:null;}
function same(a,b){return a?.runId===b?.runId&&a?.revision===b?.revision&&a?.phase===b?.phase&&a?.count===b?.count&&a?.pendingBattleId===b?.pendingBattleId&&a?.lastId===b?.lastId&&a?.lastDigest===b?.lastDigest;}
function createOutcomeGate({durationMs=TERMINAL_VIGNETTE_MAX_MS}={},includeDefeat=false){
 if(!Number.isFinite(durationMs)||durationMs<0||durationMs>TERMINAL_VIGNETTE_MAX_MS)throw Error('Invalid presentation-only duration');
 let prior=null,active=null,disposed=false,sequence=0,lastState=freeze({phase:'idle',blocksInput:false}),saturated=false;const consumed=new Set();
 const mark=(runId,battleId)=>{if(!text(battleId))return;if(consumed.size>=10000){saturated=true;return;}consumed.add(key(runId,battleId));};
 const close=reason=>{if(active){lastState=freeze({...active.public,phase:'complete',blocksInput:false,progress:1,reason});active=null;}return lastState;};
 function prime(ack){if(disposed)return lastState;const c=context(ack);close('owner-reset');prior=stamp(c);if(c)for(const battle of ack.state.battles)mark(c.runId,battle?.receipt?.result?.battleId);return lastState;}
 function observeAck(ack,{liveReceipt=null,pending=false,failed=false,enabled=true,reducedMotion=false,now=0}={}){
  if(disposed)return null;if(!Number.isFinite(now)||now<0)throw Error('Finite presentation clock required');const c=context(ack),next=stamp(c);
  if(pending||failed){if(prior?.phase==='battle')mark(prior.runId,prior.pendingBattleId);if(c?.phase==='battle')mark(c.runId,c.pendingBattleId);close('unconfirmed-or-failed');return null;}
  if(!c||!prior||c.runId!==prior.runId||c.revision<prior.revision){prime(ack);return null;}
  if(same(next,prior))return null;
  const old=prior;prior=next;close('owner-changed');
  if(c.revision!==old.revision+1||old.phase!=='battle'||c.phase==='battle'||c.count!==old.count+1){for(const battle of ack.state.battles)mark(c.runId,battle?.receipt?.result?.battleId);return null;}
  const b=c.last,r=b?.receipt,result=r?.result,id=result?.battleId,seen=consumed.has(key(c.runId,id));mark(c.runId,id);
  if(seen||saturated||!enabled||reducedMotion||durationMs===0)return null;
  if(r?.source!=='REAL_PINNED_V09_ENGINE'||typeof result?.win!=='boolean'||!text(id)||id!==old.pendingBattleId||id!==b.config?.battleId||!hash(r.resultDigest)||!hash(r.inputDigest))return null;
  // A newly loaded/imported historical receipt is not a new live completion.
  if(liveReceipt?.source!==r.source||liveReceipt.resultDigest!==r.resultDigest||liveReceipt.inputDigest!==r.inputDigest||liveReceipt.result?.battleId!==id||liveReceipt.result?.win!==result.win||liveReceipt.result?.ticks!==result.ticks)return null;
  if(result.win===false){
   if(!includeDefeat||c.phase!=='defeat'||liveReceipt.result.reason!==result.reason||liveReceipt.result.survivors!==result.survivors||liveReceipt.result.unitCount!==result.unitCount||terminalHealthKey(liveReceipt.result)!==terminalHealthKey(result))return null;
   const loss=classifyDefeat(result),ticket=freeze({sequence:++sequence,key:{runId:c.runId,revision:c.revision,battleId:id,resultDigest:r.resultDigest},phase:'presenting',blocksInput:true,progress:0,durationMs,outcome:'defeat',reason:loss.reason,title:loss.title,name:'',caption:loss.description,presentationClockOnly:true});
   active={public:ticket,start:now,elapsed:0};lastState=ticket;return ticket;
  }
  if(b?.kind!=='boss'||!Array.isArray(result.enemySummary)||!result.enemySummary.some(e=>e.type==='boss'&&e.count>0)||!result.enemySummary.every(e=>e.survivors===0&&e.remainingHp===0))return null;
  const eventBoss=b.origin?.type==='event'&&b.milestoneOrigin==='event',chapterBoss=b.origin?.type==='route'&&b.milestoneOrigin==='chapter-boss';if(!eventBoss&&!chapterBoss)return null;
  const name=b.config.encounter?.bossName||b.config.encounter?.name;
  const ticket=freeze({sequence:++sequence,key:{runId:c.runId,revision:c.revision,battleId:id,resultDigest:r.resultDigest},phase:'presenting',blocksInput:true,progress:0,durationMs,bossKind:eventBoss?'event':'chapter',title:'보스 격파',name:text(name)?name:'보스',caption:eventBoss?'이벤트 전투 승리':'보스 전투 승리',presentationClockOnly:true});
  active={public:ticket,start:now,elapsed:0};lastState=ticket;return ticket;
 }
 function advance(now,{owner,enabled=true,reducedMotion=false}={}){
  if(!active)return lastState;if(!Number.isFinite(now)||now<0)throw Error('Finite presentation clock required');
  const k=active.public.key;if(owner&&(owner.runId!==k.runId||owner.revision!==k.revision||owner.battleId!==k.battleId||(owner.resultDigest!==undefined&&owner.resultDigest!==k.resultDigest)))return close('owner-changed');
  if(!enabled||reducedMotion)return close(reducedMotion?'reduced-motion':'option-off');
  active.elapsed=Math.max(active.elapsed,Math.max(0,now-active.start));if(active.elapsed>=durationMs)return close('elapsed');
  lastState=freeze({...active.public,progress:active.elapsed/durationMs});return lastState;
 }
 return Object.freeze({prime,observeAck,advance,skip:()=>close('skipped'),fail:()=>close('render-failed'),state:()=>lastState,dispose(){close('disposed');disposed=true;prior=null;consumed.clear();return lastState;}});
}
export function bossVignetteMarkup(state,{bossPortraitUrl=''}={}){
 if(state?.phase!=='presenting')return '';
 const asset=/^\.\/assets\/enemies\/boss\.[a-f0-9]{16}\.webp$/.test(bossPortraitUrl)?`<img src="${bossPortraitUrl}" alt="" class="battle-terminal-boss">`:'';
 return `<section class="battle-terminal-vignette" role="status" aria-live="polite" aria-label="확정 보스 전투 승리"><div class="battle-terminal-panel">${asset}<strong>${esc(state.title)}</strong><span>${esc(state.name)}</span><small>${esc(state.caption)} · 결과 확정</small><button type="button" data-action="terminal-skip">연출 건너뛰기</button></div></section>`;
}

// R1 stays boss-victory-only. R2 opts into a single shared victory/loss owner gate.
export function createTerminalVignette(options={}){return createOutcomeGate(options,false);}
export function createBattleOutcomeVignette(options={}){return createOutcomeGate(options,true);}
const validHP=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
function terminalHealthKey(result){return JSON.stringify((result.contributions||[]).map(u=>[u.id,u.hp,u.maxHp]));}
export function classifyDefeat(result){
 if(result?.win!==false)return null;
 const rows=result.contributions,ids=new Set();let known=Array.isArray(rows)&&Number.isSafeInteger(result.unitCount)&&result.unitCount>0&&rows.length===result.unitCount&&Number.isSafeInteger(result.survivors)&&result.survivors>=0&&result.survivors<=result.unitCount;
 if(known)for(const u of rows){if(!Number.isSafeInteger(u?.id)||u.id<1||ids.has(u.id)||!validHP(u.hp)||!validHP(u.maxHp)||u.maxHp<=0||u.hp>u.maxHp){known=false;break;}ids.add(u.id);}
 if(known&&rows.filter(u=>u.hp>0).length!==result.survivors)known=false;
 const reason=result.reason==='withdrawal'?'withdrawal':result.reason==='timeout'?'timeout':result.reason===''&&known&&result.survivors===0?'annihilation':'other';
 return freeze({outcome:'defeat',reason,title:reason==='withdrawal'?'자발적 철수':reason==='annihilation'?'군단 전멸':reason==='timeout'?'시간 초과':'패배',description:reason==='withdrawal'?'철수를 선택해 원정이 종료되었습니다. 시간 초과나 전멸이 아닙니다.':reason==='annihilation'?'전투 종료 기록에서 출전 병사 전원이 전투불능입니다.':reason==='timeout'?'제한 시간 안에 전투를 돌파하지 못했습니다.':'전투 패배가 확정되었습니다.',terminalHealthKnown:known,survivors:known?result.survivors:null,participants:known?result.unitCount:null,knockedOut:known?rows.filter(u=>u.hp===0).length:null});
}
export function terminalVignetteMarkup(state,options={}){
 if(state?.phase!=='presenting')return '';
 if(state.outcome!=='defeat')return bossVignetteMarkup(state,options);
 return `<section class="battle-terminal-vignette battle-terminal-vignette--defeat" role="status" aria-live="polite" aria-label="확정 전투 패배"><div class="battle-terminal-panel"><strong>${esc(state.title)}</strong><small>${esc(state.caption)}</small><span>패배 확정 · 전투 기록 보존</span><button type="button" data-action="terminal-skip">연출 건너뛰기</button></div></section>`;
}

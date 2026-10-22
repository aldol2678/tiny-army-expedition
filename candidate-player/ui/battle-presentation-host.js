import {createBattleOutcomeVignette,terminalVignetteMarkup} from '../presentation/terminal-vignette.js';
// Observational host only: no model, engine, command, RNG or storage capability.
export function createBattlePresentationHost({document,window,root,bossPortraitUrl=''}){
 const gate=createBattleOutcomeVignette();let disposed=false,enabled=true,overlay=null,focusBefore=null,mountedKey=null;
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const owner=ack=>{const r=ack?.state.battles.at(-1)?.receipt;return {runId:ack?.runId,revision:ack?.revision,battleId:r?.result.battleId,resultDigest:r?.resultDigest};};
 function remove(){const old=overlay,focus=focusBefore;overlay=null;focusBefore=null;mountedKey=null;old?.remove();if(!disposed&&focus?.isConnected&&typeof focus.focus==='function')focus.focus();}
 function sync(){const state=gate.state();if(disposed||!state.blocksInput){remove();return;}if(mountedKey===state.key)return;remove();if(disposed)return;focusBefore=document.activeElement;const element=document.createElement('div');element.className='official-terminal-host';element.innerHTML=terminalVignetteMarkup(state,{bossPortraitUrl});overlay=element;mountedKey=state.key;root.appendChild(element);element.querySelector('[data-action="terminal-skip"]')?.focus();}
 function safely(work){if(disposed)return null;try{const result=work();sync();return result;}catch{gate.fail();remove();return null;}}
 return Object.freeze({
  prime:ack=>safely(()=>gate.prime(ack)),
  beforeTick:ack=>safely(()=>gate.observeAck(ack)),
  afterTick:(ack,{liveReceipt=null,pending=false,failed=false,now=0}={})=>safely(()=>gate.observeAck(ack,{liveReceipt,pending,failed,now,enabled,reducedMotion:reduced()})),
  advance:(now,ack)=>safely(()=>gate.advance(now,{owner:owner(ack),enabled:enabled&&!document.hidden,reducedMotion:reduced()})),
  skip:()=>safely(()=>gate.skip()),fail:()=>safely(()=>gate.fail()),
  setEnabled(value){enabled=value===true;if(!enabled)safely(()=>gate.skip());return enabled;},
  enabled:()=>enabled,blocksInput:()=>!disposed&&gate.state().blocksInput,state:()=>gate.state(),
  dispose(){if(disposed)return;disposed=true;gate.dispose();remove();}
 });
}

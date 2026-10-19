import {invariant} from './data.js';
import {previewFormationMove} from './slots.js';
import {updateOfficialHeader} from './official-components.js';
import {createOfficialComponents} from './official-extracted-components.js';
import {createOfficialCanvasRenderer} from './official-canvas-renderer.js';
import {createOfficialModal} from './official-modal.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Explicit opt-in mount on the official shell. No bootstrap, save key, scheduler,
// profile conversion, terminal settlement or network side effect is installed.
export function mountOfficialRenderBridge({document,host,boundary,readPresentation,types,onPauseChange=()=>{}}) {
 invariant(boundary?.state&&boundary?.dispatch&&typeof readPresentation==='function','Boundary and core reader required');
 const screen=document.getElementById('screen'),canvas=document.getElementById('arena');invariant(screen&&canvas,'Original shell required');
 let selectedUnitId=null,paused=false,controller=null,controllerOwner=null,lastFrame=null,destroyed=false,formationActive=false,formationInput=null;
 const renderer=createOfficialCanvasRenderer({canvas,host,types});
 const modal=createOfficialModal({document,cancelInput:()=>formationInput?.cancel(),getOwner:()=>boundary.owner(),isBattle:()=>boundary.state().run.state.phase==='battle',getPaused:()=>paused,setPaused(value){paused=!!value;if(!destroyed)onPauseChange(isPaused());}});
 function isPaused(){return paused||modal.isOpen()||!boundary.canAdvance();}
 function present(){if(selectedUnitId!==null&&!boundary.state().run.state.roster.some(u=>u.id===selectedUnitId))selectedUnitId=null;return readPresentation(boundary.state().run,{selectedUnitId,locked:!boundary.canAdvance()});}
 function components(){return createOfficialComponents(present().detail,{host,battleFrame:lastFrame});}
 function reflectBoundary(){if(destroyed)return;const state=boundary.state(),warning=document.getElementById('saveWarning');screen.setAttribute('aria-busy',String(state.busy||!!state.pending));if(warning){warning.hidden=!(state.pending||state.conflict||state.error);warning.textContent=state.conflict?'저장 충돌 · 원본 보관 후 다시 열기':state.pending?'저장 확인 대기 · 다음 행동 잠금':state.error?'행동을 확인하지 못했어요':'';}onPauseChange(isPaused());}
 function bindFormation(){formationInput?.destroy();formationInput=null;if(!host.TinyArmyFormationInput)return;const owner=boundary.owner();formationInput=host.TinyArmyFormationInput.attach(screen,{canInteract:()=>!modal.isOpen()&&present().detail.editable&&same(owner,boundary.owner()),onMove:(id,slot)=>move(id,slot,owner)});}
 function renderFormation(){invariant(!destroyed,'Bridge destroyed');formationActive=true;const p=present();formationInput?.destroy();formationInput=null;screen.innerHTML=createOfficialComponents(p.detail,{host,battleFrame:lastFrame}).workspace();updateOfficialHeader(document,p.view);reflectBoundary();modal.refresh();bindFormation();return p.view;}
 function refresh(){if(destroyed)return false;reflectBoundary();const owner=boundary.owner();if(controllerOwner&&!same(controllerOwner,owner)){controller=null;controllerOwner=null;lastFrame=null;renderer.reset();}if(formationActive)renderFormation();else modal.refresh();}
 function openDetail(id){invariant(!destroyed,'Bridge destroyed');const c=components();modal.open({view:'unit-detail',title:c.name(id),content:()=>components().detail(id)});}
 async function move(unitId,toSlot,owner){if(destroyed||!present().detail.editable||!same(owner,boundary.owner()))return false;const state=boundary.state();if(state.run.state.roster.find(u=>u.id===unitId)?.slot===toSlot){selectedUnitId=null;renderFormation();return true;}try{const intent=previewFormationMove(state.run.state.roster,unitId,toSlot,present().view.formation.deploymentCap);const pending=boundary.dispatch(intent,owner);renderFormation();const accepted=await pending;if(accepted)selectedUnitId=null;refresh();return accepted;}catch{return false;}}
 async function action(event){if(host.TinyArmyFormationInput?.consumeClick(event))return;const button=event.target.closest?.('[data-action]');if(!button||(!screen.contains(button)&&!document.getElementById('modal').contains(button)))return;
  const kind=button.dataset.action;if(!['unit-detail','slot','reserve-select','reserve-move'].includes(kind))return;event.preventDefault();
  if(kind==='unit-detail'){openDetail(Number(button.dataset.id));return;}
  if(button.disabled||button.getAttribute('aria-disabled')==='true'||!present().detail.editable)return;
  if(kind==='reserve-select'){selectedUnitId=Number(button.dataset.id);renderFormation();return;}
  const state=boundary.state(),toSlot=kind==='reserve-move'?null:Number(button.dataset.slot),occupant=state.run.state.roster.find(u=>u.slot===toSlot);
  if(kind==='slot'&&selectedUnitId===null){if(occupant){selectedUnitId=occupant.id;renderFormation();}return;}
  if(selectedUnitId===null)return;
  await move(selectedUnitId,toSlot,boundary.owner());
 }
 document.addEventListener('click',action);
 return Object.freeze({renderFormation,refresh,openDetail,closeModal:()=>modal.close(),modalState:()=>modal.state(),isPaused,
  attachController(next){invariant(!destroyed,'Bridge destroyed');const state=boundary.state();invariant(state.canAdvance&&state.run.state.phase==='battle'&&state.run.state.pendingBattle,'Acknowledged battle checkpoint required');invariant(typeof next?.renderSnapshot==='function','Actual atomic render provider required');const frame=next.renderSnapshot();invariant(frame.snapshot.battleId===state.run.state.pendingBattle.battleId,'Battle/controller mismatch');controller=next;controllerOwner=boundary.owner();lastFrame=frame;return true;},
  drawBattle(options={}){invariant(controller&&same(controllerOwner,boundary.owner()),'Stale or missing battle renderer');if(boundary.canAdvance())lastFrame=controller.renderSnapshot();const run=boundary.state().run,node=run.graphs[run.state.chapter-1]?.nodes[run.state.currentNode];return renderer.draw(lastFrame,{...options,chapter:run.state.chapter,row:node?.row??0,paused:isPaused()});},
  async retry(){if(destroyed)return false;const accepted=await boundary.retry();if(!destroyed)refresh();return accepted;},
  destroy(){if(destroyed)return;destroyed=true;formationInput?.destroy();formationInput=null;modal.destroy();document.removeEventListener('click',action);renderer.reset();controller=null;lastFrame=null;destroyed=true;}
 });
}

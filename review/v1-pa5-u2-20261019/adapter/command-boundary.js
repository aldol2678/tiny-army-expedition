import {invariant,immutableCopy,copyData,exactKeys} from './data.js';
const FIELDS=Object.freeze({selectNode:['nodeId'],setFormation:['slots'],setCommands:['skills'],equipResearch:['skillId','variantId'],startBattle:['battleId','commandMode'],finishBattle:['battleId','commands'],claimReward:['rewardId','candidateId','opportunityId'],skipReward:['rewardId','opportunityId'],rerollReward:['rewardId'],serviceAction:['serviceId','candidateId'],leaveService:['serviceId'],eventChoice:['eventId','choiceId'],awaken:['unitId'],skipAwakening:[],settle:[]});
export function commandOwner(run) {const s=run.state;return immutableCopy({runId:run.runId,revision:run.revision,phase:s.phase,nodeId:s.currentNode??null,serviceId:s.pendingService?.id??null,rewardId:s.pendingReward?.id??null,eventId:s.pendingEvent?.id??null});}
function commandData(action) {const data=copyData(action);invariant(Object.hasOwn(FIELDS,data.type),'Unsupported UI command');exactKeys(data,['type',...FIELDS[data.type]]);return immutableCopy(data);}
// Storage is injected. This module does not read/write browser keys and does not
// claim that localStorage read-then-write is an atomic compare-and-set operation.
export function createCommandBoundary({initialRun,initialRaw,transition,serialize,parse,read,compareAndSet,makeTransactionId,notify=()=>{}}) {
 for(const fn of [transition,serialize,parse,read,compareAndSet,makeTransactionId])invariant(typeof fn==='function','Missing boundary dependency');
 let run=immutableCopy(initialRun),raw=initialRaw,pending=null,busy=false,conflict=false,error='';
 invariant(typeof raw==='string'&&serialize(run)===raw,'Initial raw does not match acknowledged run');parse(raw);
 // Run/action/next were independently copied and frozen on entry. Preserve their
 // immutable identities instead of cloning an entire replay ledger on every render.
 const state=()=>Object.freeze({run,busy,pending:pending?Object.freeze({transactionId:pending.transactionId,action:pending.action,next:pending.next}):null,conflict,error,canAdvance:!busy&&!pending&&!conflict});
 const publish=()=>{try{notify(state());}catch{/* Observer failure cannot alter acknowledged commit. */}};
 const acknowledge=()=>{run=immutableCopy(parse(pending.nextRaw));raw=pending.nextRaw;pending=null;conflict=false;error='';publish();return true;};
 function observedResult(observed) {if(observed===pending.nextRaw)return acknowledge();if(observed!==pending.expectedRaw){conflict=true;throw Object.assign(new Error('Saved data changed; export and reload.'),{code:'SAVE_CONFLICT'});}return false;}
 async function persist() {
  try {if(observedResult(await read()))return true;
   const accepted=await compareAndSet(pending.expectedRaw,pending.nextRaw);
   const observed=await read();if(observedResult(observed))return true;
   invariant(accepted===true,'Compare-and-set did not accept the write','SAVE_NOT_CONFIRMED');
   throw Object.assign(new Error('Save readback did not confirm next bytes'),{code:'SAVE_NOT_CONFIRMED'});
  }catch(e){
   // The write may have happened before an exception. Reconcile exact bytes once.
   try {if(pending&&observedResult(await read()))return true;}catch(reconcile){if(reconcile.code==='SAVE_CONFLICT')e=reconcile;}
   error=e.message||String(e);publish();return false;
  }
 }
 async function retry() {if(busy||!pending||conflict)return false;busy=true;publish();try{return await persist();}finally{busy=false;publish();}}
 async function dispatch(action,owner) {
  if(busy||pending||conflict)return false;
  try {invariant(JSON.stringify(owner)===JSON.stringify(commandOwner(run)),'Stale UI owner','STALE_UI_OWNER');const safe=commandData(action);busy=true;error='';publish();
   const transactionId=makeTransactionId();invariant(typeof transactionId==='string'&&transactionId.length>0,'Transaction ID required');
   const next=immutableCopy(await transition(run,safe,transactionId,run.revision));
   invariant(next.runId===run.runId&&next.revision===run.revision+1,'Unexpected transition identity');
   const nextRaw=serialize(next);invariant(typeof nextRaw==='string'&&serialize(parse(nextRaw))===nextRaw,'Invalid serialized transition');
   pending={transactionId,action:safe,next,nextRaw,expectedRaw:raw};publish();return await persist();
  }catch(e){error=e.message||String(e);publish();return false;}finally{busy=false;publish();}
 }
 return Object.freeze({state,owner:()=>commandOwner(run),dispatch,retry,canAdvance:()=>!busy&&!pending&&!conflict,exportPendingRaw:()=>pending?.nextRaw??raw});
}

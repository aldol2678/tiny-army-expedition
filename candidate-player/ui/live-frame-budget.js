// Scheduling only. Never yield inside a controller tick or change the engine STEP.
export const LIVE_FRAME_STEP_MS=1000/60;
export const LIVE_FRAME_BUDGET_MS=8;
export const LIVE_FRAME_MAX_TICKS=12;
export function consumeLiveFrame({debtMs,controller,tick,canContinue,now}){
 const started=now(),due=Math.min(LIVE_FRAME_MAX_TICKS,Math.floor(debtMs/LIVE_FRAME_STEP_MS+1e-12));
 let executedTicks=0,attemptedTicks=0,tickMs=0,budgetExhausted=false;
 for(let i=0;i<due&&canContinue();i++){
  const before=controller.tickCount();
  tick();attemptedTicks++;
  const advanced=controller.tickCount()-before;
  if(!Number.isSafeInteger(advanced)||advanced<0||advanced>1)throw Error('Invalid atomic tick progress');
  executedTicks+=advanced;tickMs=Math.max(0,now()-started);
  budgetExhausted=tickMs>=LIVE_FRAME_BUDGET_MS;
  if(!advanced||controller.isFinished()||budgetExhausted)break;
 }
 // Compensate only sub-ulp fixed-step residue, never unexecuted simulation debt.
 return {debtMs:Math.max(0,debtMs-executedTicks*LIVE_FRAME_STEP_MS),executedTicks,attemptedTicks,tickMs,budgetExhausted};
}

// UA2 shared per-primary-cycle delay budget. No mana refunds or cooldown resets.
import {planMageSecondary} from '../progression/combat.js';
import {invariant} from '../runtime/hash.js';
import {safeCopy} from './foundation.js';
export const RESOURCE_BUDGET_VERSION='ua2-combined-mage-primary-budget-1';
export function installUltimateResourceBudget(game){let cycles={},journal=[];const now=()=>game.tickCount;
 function plan(unit,cost,occupancyTicks,extra={}){const target=game.enemies.some(e=>e.hp>0&&Math.hypot(unit.x-e.x,unit.y-e.y)<=unit.range+.01);const p=planMageSecondary({tick:now(),mana:unit.mana,maxMana:unit.maxMana,manaRegen:unit.manaRegen,primaryCost:unit.skill.manaCost,primaryReadyTick:unit.unitSkillReadyTick,secondaryCost:cost,occupancyTicks,primaryTargetAvailable:target,...extra});if(!p.allowed)return p;const c=cycles[unit.id],baseline=c?.baselineTick??p.primaryWithoutSecondaryTick,aggregateDelayTicks=Math.max(0,p.primaryAfterSecondaryTick-baseline);return {...p,allowed:aggregateDelayTicks<=240,reason:aggregateDelayTicks<=240?'combined-paid-weave':'combined-primary-delay-limit',baselinePrimaryTick:baseline,aggregateDelayTicks,maxAggregateDelayTicks:240};}
 game.ultimateResourcePlan=plan;
 game.ultimateResourceCommitted=(unit,decision,detail)=>{invariant(decision.allowed&&decision.aggregateDelayTicks<=240,'Paid extra action exceeds combined primary budget');cycles[unit.id]??={baselineTick:decision.primaryWithoutSecondaryTick,primaryReadyTick:unit.unitSkillReadyTick,extras:[]};cycles[unit.id].extras.push({tick:now(),...safeCopy(detail),predictedPrimaryTick:decision.primaryAfterSecondaryTick,aggregateDelayTicks:decision.aggregateDelayTicks});journal.push({type:'extra-paid',unitId:unit.id,tick:now(),...safeCopy(detail),...safeCopy(decision)});};
 game.ultimatePrimaryCommitted=unit=>{journal.push({type:'primary-paid',unitId:unit.id,tick:now(),previous:cycles[unit.id]?safeCopy(cycles[unit.id]):null});delete cycles[unit.id];};
 const snapshot=()=>({version:RESOURCE_BUDGET_VERSION,battleId:game.battleId,cycles:safeCopy(cycles),journal:safeCopy(journal)});game._v10CheckpointParticipants.push({id:'ua2-mage-resource-budget',capture:snapshot,restore:s=>{invariant(s.version===RESOURCE_BUDGET_VERSION&&s.battleId===game.battleId,'Foreign combined resource budget');cycles=safeCopy(s.cycles);journal=safeCopy(s.journal);}});return {snapshot,plan};
}

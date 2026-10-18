'use strict';
const M=require('./spear-skills.cjs');
/** Executable interface, not attached to the v09 live engine.
 * Host snapshot() returns stable IDs, projected source stats, starting slots,
 * current positions/life/deployment, public telegraph ticks, actual guardian links.
 * Host applyDamageOnce(event) MUST atomically journal eventId and return the same
 * {eventId, actualDamage} on retry, including after a restored checkpoint.
 * Events already contain projected damage. Do not reapply relic/stat/condition.
 */
function resolveThroughHost(state,host,tick){
 for(const key of ['snapshot','applyDamageOnce'])if(typeof host[key]!=='function')throw Error(`Missing adapter ${key}`);
 const result=M.resolveAction(state,host.snapshot(),tick);
 if(result.state.action?.status!=='awaiting_receipts')return result;
 // Recovery of a checkpoint captured between resolution and settlement uses its
 // stored intents. The host journal prevents replay damage, not a volatile Set.
 const events=result.state.action.events;
 const receipts=events.map(e=>host.applyDamageOnce(Object.freeze({...e})));
 return {state:M.acknowledgeEffects(result.state,receipts,tick),events:result.events};
}
module.exports={resolveThroughHost};

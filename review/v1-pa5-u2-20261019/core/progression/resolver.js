// Pure validation/selection contract. Host alone owns damage/healing modifiers.
export const compareIds=(a,b)=>typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'en');
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function selectTargets(candidates,source,{range=Infinity,team='enemy',mode='damage',focusId=null,amount=0}={}){
 const valid=candidates.filter(u=>u.hp>0&&u.team===team&&distance(source,u)<=range+.01&&(mode!=='heal'||u.hp<u.maxHp-1e-9)&&(mode!=='protection'||(u.barrier?.amount??0)<amount-1e-9));
 return valid.sort((a,b)=>mode==='heal'?a.hp/a.maxHp-b.hp/b.maxHp||(b.maxHp-b.hp)-(a.maxHp-a.hp)||distance(source,a)-distance(source,b)||compareIds(a.id,b.id):mode==='protection'?(a.telegraphTick??Infinity)-(b.telegraphTick??Infinity)||a.hp/a.maxHp-b.hp/b.maxHp||distance(source,a)-distance(source,b)||compareIds(a.id,b.id):Number(b.id===focusId)-Number(a.id===focusId)||distance(source,a)-distance(source,b)||compareIds(a.id,b.id));
}
export function protectionReduction({incoming,mitigated,remainingBudget,rate}){if([incoming,mitigated,remainingBudget,rate].some(n=>!Number.isFinite(n)||n<0))return 0;return Math.max(0,Math.min(remainingBudget,incoming*Math.min(rate,.55),mitigated-.45*incoming));}
export function resolveIntent(world,intent){
 const fail=reason=>({effects:[],reason}),units=world?.units??[],source=units.find(u=>u.id===intent.sourceId),target=units.find(u=>u.id===intent.targetId);
 if(!source||source.hp<=0)return fail('source-dead');if(!target||target.hp<=0)return fail('target-dead');
 if(!Number.isFinite(intent.amount)||intent.amount<0)return fail('invalid-amount');if(intent.range!==undefined&&distance(source,target)>intent.range+.01)return fail('out-of-range');
 if(['heal','shield','cleanse'].includes(intent.effectKind)&&target.team!==source.team)return fail('wrong-team');if(['damage','slow'].includes(intent.effectKind)&&target.team===source.team)return fail('wrong-team');
 if(intent.effectKind==='heal'&&target.hp>=target.maxHp)return fail('no-missing-hp');if(intent.effectKind==='shield'&&(target.barrier?.amount??0)>=intent.amount)return fail('not-stronger');
 if(!['damage','heal','shield','slow','cleanse','protection'].includes(intent.effectKind))return fail('unsupported-effect');
 // Never pre-clip healing: curse scales raw healing before host missing-HP cap.
 return {effects:[{...intent,maximumEffectiveAmount:intent.effectKind==='heal'?Math.min(intent.amount,target.maxHp-target.hp):intent.amount}],reason:null};
}
export function settleIntents(world,intents,apply){const seen=new Set(),receipts=[];for(const intent of intents){if(seen.has(intent.eventId))continue;seen.add(intent.eventId);const resolved=resolveIntent(world,intent);receipts.push({eventId:intent.eventId,reason:resolved.reason,effects:resolved.effects.map(e=>apply?apply(e):e)});}return receipts;}

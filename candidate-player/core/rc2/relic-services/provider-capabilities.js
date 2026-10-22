// Browser-safe, closed provider registry. Event nodes remain event nodes throughout.
import {serviceStock,trainingAccessEnabled} from './training-access.js';
import {assert,canonical,clone,deepFreeze} from './registry.js';
export const PROVIDER_CAPABILITY_VERSION='event-provider-capability-1';
export const PROVIDER_CAPABILITIES=deepFreeze({trainer:{definitionId:'trainer',serviceKind:'training'},field_forge:{definitionId:'field_forge',serviceKind:'forge'},strategist:{definitionId:'strategist',serviceKind:'lab'}});
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_.:-]{1,240}$/.test(id);
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&canonical(Object.keys(value).sort())===canonical([...keys].sort());
export function validateProviderCapability(capability,node,chapter){
 assert(exactKeys(capability,['version','eventId','definitionId','providerKind','serviceKind','nodeId','chapter']),'Invalid provider capability shape');
 const registered=Object.hasOwn(PROVIDER_CAPABILITIES,capability.providerKind)?PROVIDER_CAPABILITIES[capability.providerKind]:null;
 assert(registered&&capability.version===PROVIDER_CAPABILITY_VERSION&&capability.definitionId===registered.definitionId&&capability.serviceKind===registered.serviceKind,'Unregistered event provider capability');
 assert(node?.kind==='event'&&validId(node.id)&&validId(capability.eventId)&&capability.nodeId===node.id&&Number.isInteger(chapter)&&chapter>=1&&chapter<=5&&capability.chapter===chapter,'Provider source node/chapter mismatch');
 return registered.serviceKind;
}
export function createProviderCapability(state,node,context){
 assert(exactKeys(context,['eventId','definitionId','providerKind']),'Explicit registered event provider context required');
 const registered=Object.hasOwn(PROVIDER_CAPABILITIES,context.providerKind)?PROVIDER_CAPABILITIES[context.providerKind]:null;
 const capability={version:PROVIDER_CAPABILITY_VERSION,...clone(context),serviceKind:registered?.serviceKind,nodeId:node?.id,chapter:state.chapter};
 validateProviderCapability(capability,node,state.chapter);return deepFreeze(capability);
}
export function validatePendingProvider(state,node,capability,offer=null){
 const kind=validateProviderCapability(capability,node,state.chapter),event=state.pendingEvent,service=state.pendingService;
 assert(state.phase==='service'&&!state.pendingBattle&&!state.campaignComplete&&state.currentNode===node.id,'Provider unavailable outside its current service opportunity');
 assert(event&&event.id===capability.eventId&&event.eventId===capability.eventId&&event.definitionId===capability.definitionId&&event.chapter===capability.chapter&&event.node?.kind==='event'&&event.node.id===node.id,'Provider differs from pending event source');
 assert(service&&service.node?.kind==='event'&&service.node.id===node.id&&service.chapter===state.chapter&&canonical(service.providerCapability)===canonical(capability),'Provider differs from pending service capability');
 const original=event.choices?.find(c=>c.providerOffer?.id===service.id)?.providerOffer;
 assert(original&&original.node?.kind==='event'&&original.node.id===node.id&&canonical(original.providerCapability)===canonical(capability),'Provider was not offered by the pending event');
 if(service.trainingAccess!==undefined){assert(trainingAccessEnabled(original)&&original.trainingAccess.preparationAdditions.length===0,'Provider training extension requires original capability');serviceStock(service,state);}
 if(original.stock)assert(canonical(service.stock)===canonical(original.stock)&&service.stockHash===original.stockHash,'Provider frozen stock differs from original event offer');
 else assert(canonical(service.choices)===canonical(original.choices),'Provider choices differ from original event offer');
 if(offer)assert(service.id===offer.id&&service.offerHash===offer.offerHash&&canonical(service)===canonical(offer),'Provider differs from exact pending service offer');
 return kind;
}

// UI boundary data only. No storage, gameplay rules, globals or third-party dependencies.
export function invariant(condition, message, code='INVALID_ADAPTER_INPUT') {
 if (!condition) throw Object.assign(new Error(message), {code});
}
export function copyData(value, seen=new Set()) {
 if (value===null || typeof value==='string' || typeof value==='boolean') return value;
 if (typeof value==='number') { invariant(Number.isFinite(value),'Non-finite data'); return value; }
 invariant(value && typeof value==='object','Only plain data is allowed');
 invariant(!seen.has(value),'Cyclic data');
 invariant(Array.isArray(value) || Object.getPrototypeOf(value)===Object.prototype || Object.getPrototypeOf(value)===null,'Non-plain object');
 seen.add(value); const result=Array.isArray(value)?[]:{};
 for (const key of Object.keys(value)) {
  invariant(!['__proto__','constructor','prototype'].includes(key),'Unsafe key');
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  invariant(descriptor && 'value' in descriptor,'Accessors are not allowed');
  result[key]=copyData(descriptor.value,seen);
 }
 seen.delete(value); return result;
}
export function deepFreeze(value) { if (value && typeof value==='object') { for(const child of Object.values(value))deepFreeze(child); Object.freeze(value); } return value; }
export const immutableCopy=value=>deepFreeze(copyData(value));
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function exactKeys(value,allowed) { invariant(value && !Array.isArray(value) && typeof value==='object','Object required'); for(const key of Object.keys(value))invariant(allowed.includes(key),'Unexpected field: '+key); }

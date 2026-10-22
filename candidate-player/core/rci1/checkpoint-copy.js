// Equivalent to JSON.parse(RC2 canonical(value)), without constructing/parsing
// an intermediate string. Every original finite/acyclic/unsafe-key check stays.
function copyJSON(value,neutralPrototypes=false){
 const seen=new Set();
 function copy(v){
  if(v===null||typeof v==='boolean'||typeof v==='string')return v;
  if(typeof v==='number'&&Number.isFinite(v))return v===0?0:v;
  if(!v||typeof v!=='object'||seen.has(v))throw TypeError('Checkpoint requires finite acyclic JSON values');
  seen.add(v);let out;
  if(Array.isArray(v)){out=Array.from(v,copy);if(neutralPrototypes)Object.setPrototypeOf(out,null);}
  else{const keys=Object.keys(v).sort();if(keys.some(k=>k==='__proto__'||k==='prototype'||k==='constructor'))throw TypeError('Unsafe checkpoint key');out=Object.create(null);for(const k of keys)out[k]=copy(v[k]);if(!neutralPrototypes)Object.setPrototypeOf(out,Object.prototype);}
  seen.delete(v);return out;
 }
 return copy(value);
}
export const cloneCheckpointJSON=value=>copyJSON(value);
// Both sides still undergo the full original validation on EVERY comparison.
// Native stringify orders integer keys differently from RC2's canonical text,
// but identically on both normalized copies, so equality is unchanged. This is
// NEVER used to produce persisted signatures, identity digests or receipts.
export function equalCheckpointJSON(left,right){return JSON.stringify(copyJSON(left,true))===JSON.stringify(copyJSON(right,true));}

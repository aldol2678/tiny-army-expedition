import {copyKnownShape} from './checkpoint-shapes.js';
import {cloneCheckpointJSON} from '../rci1/checkpoint-copy.js';

// Only the fresh, privately owned output of the ordinary native parser may be
// normalized in place. Generic checkpoint copying keeps its original contract.
// Recheck after serialization: getters/toJSON may change ambient behavior.
const descriptor=Object.getOwnPropertyDescriptor;
const functionText=Function.prototype.toString;
const owns=Object.prototype.hasOwnProperty;
const dataValue=d=>d&&apply(owns,d,['value'])?d.value:undefined;
const apply=Reflect.apply;
const nativeParse=JSON.parse,nativeStringify=JSON.stringify;
const native=(fn,name)=>typeof fn==='function'&&functionText.call(fn)===`function ${name}() { [native code] }`;
const arrayIterator=descriptor(Array.prototype,Symbol.iterator);
const iteratorPrototype=native(dataValue(arrayIterator),'values')?Object.getPrototypeOf([][Symbol.iterator]()):null;
const guards=[
 [Array,'from','from'],[Array,'isArray','isArray'],
 [Array.prototype,Symbol.iterator,'values'],[Array.prototype,'sort','sort'],
 [Array.prototype,'some','some'],
 [Set.prototype,'has','has'],[Set.prototype,'add','add'],[Set.prototype,'delete','delete'],
 [Object,'keys','keys'],[Object,'create','create'],[Object,'setPrototypeOf','setPrototypeOf'],
 [Number,'isFinite','isFinite'],
 ...(iteratorPrototype?[[iteratorPrototype,'next','next']]:[])
].map(([owner,key,name])=>({owner,key,name,saved:descriptor(owner,key)}));
const initialArray=Array,initialObject=Object,initialNumber=Number,initialSet=Set;
const realm=globalThis;
function globalValue(name,value){const d=descriptor(realm,name);return !!d&&dataValue(d)===value;}
const eligible=native(nativeParse,'parse')&&native(nativeStringify,'stringify')&&native(descriptor,'getOwnPropertyDescriptor')&&native(functionText,'toString')&&native(apply,'apply')&&native(owns,'hasOwnProperty')&&native(Array,'Array')&&native(Object,'Object')&&native(Number,'Number')&&iteratorPrototype!==null&&native(Set,'Set')&&guards.every(({saved,name})=>saved&&native(dataValue(saved),name));
function unchanged(){
 if(!eligible||!globalValue('Array',initialArray)||!globalValue('Object',initialObject)||!globalValue('Number',initialNumber)||!globalValue('Set',initialSet))return false;
 for(let i=0;i<guards.length;i++){
  const {owner,key,saved}=guards[i],current=descriptor(owner,key);
  if(!current||!apply(owns,current,['value'])||current.value!==saved.value||current.writable!==saved.writable||current.enumerable!==saved.enumerable||current.configurable!==saved.configurable)return false;
 }
 return true;
}
const invalidOwnedValue={};
function normalizeOwned(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return value;
 if(typeof value==='number'&&Number.isFinite(value))return value===0?0:value;
 if(!value||typeof value!=='object')throw invalidOwnedValue;
 if(Array.isArray(value)){
  // Native JSON arrays are dense own data properties. No iterator override is
  // eligible; preserving this private array avoids a second allocation.
  for(let i=0;i<value.length;i++)value[i]=normalizeOwned(value[i]);
  return value;
 }
 const original=Object.keys(value);
 const known=copyKnownShape(value,original,normalizeOwned);
 if(known!==undefined)return known;
 const keys=Object.keys(value).sort();
 let ordered=true;
 for(let i=0;i<keys.length;i++){
  const key=keys[i];
  if(key==='__proto__'||key==='prototype'||key==='constructor')throw invalidOwnedValue;
  if(key!==original[i])ordered=false;
 }
 if(ordered){for(let i=0;i<keys.length;i++){const key=keys[i];value[key]=normalizeOwned(value[key]);}return value;}
 // A new null-prototype object avoids inherited setters while restoring the
 // same canonical insertion order and ordinary public prototype as before.
 const out=Object.create(null);
 for(let i=0;i<keys.length;i++){const key=keys[i];out[key]=normalizeOwned(value[key]);}
 Object.setPrototypeOf(out,Object.prototype);return out;
}
export function captureCheckpointJSON(value){
 const owned=unchanged();
 if(!owned)return cloneCheckpointJSON(JSON.parse(JSON.stringify(value)));
 // Preserve method evaluation order and receivers, including getters/proxies:
 // parse is selected before stringify and before user toJSON/getter callbacks.
 // Compare the actual selected methods, not merely their property descriptors.
 const parserReceiver=JSON,parser=parserReceiver.parse;
 const stringifierReceiver=JSON,stringifier=stringifierReceiver.stringify;
 const text=apply(stringifier,stringifierReceiver,[value]);
 const parsed=apply(parser,parserReceiver,[text]);
 if(owned&&parser===nativeParse&&stringifier===nativeStringify&&unchanged()){
  try{return normalizeOwned(parsed);}catch{
   // Validation errors must retain the original iterator-closing semantics,
   // including inherited return hooks. Never inspect the prototype chain, which
   // could contain a Proxy. Reparse private text so fallback sees the untouched
   // original property order, not a partially normalized tree.
   return cloneCheckpointJSON(apply(nativeParse,parserReceiver,[text]));
  }
 }
 return cloneCheckpointJSON(parsed);
}

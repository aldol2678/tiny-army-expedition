import {sha256} from '../core/runtime/hash.js';

// SG1 storage representation only. The game, validators and exported save keep
// their exact original JSON bytes. No history is shortened or migrated on read.
export const STORAGE_CODEC_PREFIX='TINY-ARMY-SAVE\u0000LZW1\n';
const FAMILY_PREFIX='TINY-ARMY-SAVE\u0000';
export const STORAGE_CODEC_MAX_BYTES=16*1024*1024;
const CLEAR=32767,OFFSET=256,MIN_LENGTH=128*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const check=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'SAVE_CODEC_INVALID'});};

// Fixed-width LZW, with explicit reset. Dictionary keys are numeric (prefix,
// byte) pairs. Codes fit below the surrogate range after adding OFFSET.
function compress(bytes){
 const dictionary=new Map(),chunks=[];let codes=[],next=256,current=bytes[0];
 const emit=code=>{codes.push(code+OFFSET);if(codes.length===8192){chunks.push(String.fromCharCode(...codes));codes=[];}};
 for(let i=1;i<bytes.length;i++){
  const byte=bytes[i],key=current*256+byte,found=dictionary.get(key);
  if(found!==undefined){current=found;continue;}
  emit(current);
  if(next<CLEAR)dictionary.set(key,next++);
  else{emit(CLEAR);dictionary.clear();next=256;}
  current=byte;
 }
 if(bytes.length)emit(current);
 if(codes.length)chunks.push(String.fromCharCode(...codes));
 return chunks.join('');
}

function decompress(payload,byteLength){
 // Allocate only the bounded, declared output, never a growing expansion.
 const out=new Uint8Array(byteLength),prefix=new Uint16Array(CLEAR),suffix=new Uint8Array(CLEAR),stack=new Uint8Array(CLEAR);
 let next=256,previous=-1,position=0;
 const expand=code=>{
  let size=0;
  while(code>=256){check(code<next&&size<CLEAR,'Invalid save dictionary reference');stack[size++]=suffix[code];code=prefix[code];}
  stack[size++]=code;
  check(position+size<=byteLength,'Save expansion exceeds declared bound');
  for(let j=size-1;j>=0;j--)out[position++]=stack[j];
  return code;
 };
 for(let i=0;i<payload.length;i++){
  const code=payload.charCodeAt(i)-OFFSET;
  check(code>=0&&code<=CLEAR,'Invalid save code');
  if(code===CLEAR){check(previous>=0&&next===CLEAR,'Unexpected save dictionary reset');next=256;previous=-1;continue;}
  let first;
  if(code<next)first=expand(code);
  else{check(code===next&&previous>=0&&next<CLEAR,'Invalid forward save reference');first=expand(previous);check(position<byteLength,'Save expansion exceeds declared bound');out[position++]=first;}
  if(previous>=0&&next<CLEAR){prefix[next]=previous;suffix[next]=first;next++;}
  previous=code;
 }
 check(position===byteLength&&previous>=0,'Truncated save payload');
 return out;
}

export function decodeStoredSave(stored){
 if(typeof stored!=='string'||!stored.startsWith(FAMILY_PREFIX))return stored;
 check(stored.startsWith(STORAGE_CODEC_PREFIX),'Unsupported save storage version');
 check(stored.length<=STORAGE_CODEC_MAX_BYTES+1024,'Stored save exceeds codec bound');
 const end=stored.indexOf('\n',STORAGE_CODEC_PREFIX.length);
 check(end>0&&end-STORAGE_CODEC_PREFIX.length<=128,'Invalid save storage header');
 let header;try{header=JSON.parse(stored.slice(STORAGE_CODEC_PREFIX.length,end));}catch{check(false,'Invalid save storage header');}
 check(Array.isArray(header)&&header.length===3,'Invalid save storage header');
 const [characters,bytes,hash]=header;
 check(Number.isSafeInteger(characters)&&characters>0&&characters<=STORAGE_CODEC_MAX_BYTES&&Number.isSafeInteger(bytes)&&bytes>0&&bytes<=STORAGE_CODEC_MAX_BYTES&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash),'Invalid save storage limits');
 const raw=decoder.decode(decompress(stored.slice(end+1),bytes));
 check(raw.length===characters&&sha256(raw)===hash,'Stored save integrity check failed');
 return raw;
}

export function encodeStoredSave(raw){
 check(typeof raw==='string','Save must be a string');
 if(raw.length<MIN_LENGTH||raw.length>STORAGE_CODEC_MAX_BYTES||raw.startsWith(FAMILY_PREFIX))return raw;
 const bytes=encoder.encode(raw);
 if(bytes.length>STORAGE_CODEC_MAX_BYTES||decoder.decode(bytes)!==raw)return raw; // Lone surrogates remain lossless plain strings.
 const packed=STORAGE_CODEC_PREFIX+JSON.stringify([raw.length,bytes.length,sha256(raw)])+'\n'+compress(bytes);
 if(packed.length>=raw.length)return raw;
 // Verify before the only durable write, including dictionary-reset boundaries.
 check(decodeStoredSave(packed)===raw,'Save codec round trip differs');
 return packed;
}

export function createSaveStorage(storage,{keys}={}){
 check(storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function','Storage unavailable');
 check(Array.isArray(keys)&&keys.length>0&&keys.length<=2&&keys.every(k=>typeof k==='string'),'Explicit save keys required');
 const allowed=new Set(keys),cache=new Map();
 const conflict=()=>Object.assign(new Error('다른 탭에서 저장이 바뀌었어요. 새로고침해 주세요.'),{code:'SAVE_CONFLICT'});
 return Object.freeze({
  getItem(key){
   const physical=storage.getItem(key); // Always observe backing storage, even on cache hits.
   if(!allowed.has(key))return physical;
   const prior=cache.get(key);if(prior&&prior.physical===physical)return prior.raw;
   let raw;try{raw=decodeStoredSave(physical);}catch{raw=physical;}
   // Invalid/unknown encoded records deliberately enter the existing malformed
   // save recovery route. Preserve and export those original physical bytes.
   cache.set(key,{physical,raw});return raw;
  },
  setItem(key,raw){
   if(!allowed.has(key))return storage.setItem(key,raw);
   const physical=storage.getItem(key),prior=cache.get(key);
   if(prior&&prior.physical!==physical)throw conflict();
   const packed=encodeStoredSave(raw);
   if(storage.getItem(key)!==physical)throw conflict();
   // One native replacement only. Quota/Security errors are not reclassified,
   // retried, or swallowed. Read/write is still not an atomic cross-tab CAS.
   storage.setItem(key,packed);
   cache.set(key,{physical:packed,raw});
  }
 });
}

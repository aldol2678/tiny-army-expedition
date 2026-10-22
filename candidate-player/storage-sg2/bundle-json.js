// SG2 external BACKUP CONTAINER parser, not a widened game-record validator.
// Up to eight immutable records plus bounded root; each decoded record is still
// independently checked at 16MiB / 500,000 nodes by unpack + core validation.
import {invariant} from '../core/runtime/hash.js';
// Full JSON reader with duplicate-key checks before value normalization. No repair.
export function parseBundleJSON(raw){
 const byteLengthBounded=text=>{let bytes=0;for(let j=0;j<text.length;j++){const c=text.charCodeAt(j);if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff&&j+1<text.length&&text.charCodeAt(j+1)>=0xdc00&&text.charCodeAt(j+1)<=0xdfff){bytes+=4;j++;}else bytes+=3;if(bytes>416*1024*1024)return bytes;}return bytes;};
 invariant(typeof raw==='string'&&raw.length<=320*1024*1024&&byteLengthBounded(raw)<=416*1024*1024,'SG2 backup container exceeds bounded eight-record transport size');let i=0,nodes=0;
 const ws=()=>{while(/[ \n\r\t]/.test(raw[i]||'x'))i++;};
 function string(){const start=i++;let escaped=false;while(i<raw.length){const c=raw[i++];if(!escaped&&c==='"')return JSON.parse(raw.slice(start,i));if(!escaped&&c==='\\')escaped=true;else escaped=false;}throw Error('Unterminated JSON string');}
 function value(depth){invariant(++nodes<=500000,'SG2 container structure exceeds original 500000-node bound');invariant(depth<=64,'JSON depth exceeds profile envelope bound');ws();const c=raw[i];
  if(c==='"')return string();
  if(c==='{'){i++;const out={},seen=new Set();ws();if(raw[i]==='}'){i++;return out;}while(true){ws();invariant(raw[i]==='"','Object key expected');const k=string();invariant(!seen.has(k),'Duplicate JSON key');invariant(!['__proto__','prototype','constructor'].includes(k),'Unsafe JSON key');seen.add(k);invariant(seen.size<=10000,'SG2 container object exceeds key bound');ws();invariant(raw[i++]===':','Missing colon');out[k]=value(depth+1);ws();const next=raw[i++];if(next==='}')return out;invariant(next===',','Missing object separator');}}
  if(c==='['){i++;const out=[];ws();if(raw[i]===']'){i++;return out;}while(true){invariant(out.length<10000,'Array exceeds profile envelope bound');out.push(value(depth+1));ws();const next=raw[i++];if(next===']')return out;invariant(next===',','Missing array separator');}}
  for(const [word,v] of [['true',true],['false',false],['null',null]])if(raw.startsWith(word,i)){i+=word.length;return v;}
  const match=raw.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);invariant(match,'Invalid JSON value');i+=match[0].length;const n=Number(match[0]);invariant(Number.isFinite(n),'Non-finite JSON number');return n;
 }
 const out=value(0);ws();invariant(i===raw.length,'Trailing JSON data');return out;
}

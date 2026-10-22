import {invariant} from '../runtime/hash.js';
// Full JSON reader with duplicate-key checks before value normalization. No repair.
export function parseStrictJSON(raw){
 invariant(typeof raw==='string'&&new TextEncoder().encode(raw).length<=16*1024*1024,'Save exceeds the 16MB isolated profile-envelope bound');let i=0;const number=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
 const ws=()=>{for(;;){const c=raw.charCodeAt(i);if(c!==32&&c!==10&&c!==13&&c!==9)return;i++;}};
 // Most durable strings have no escapes. Their already-scanned content can be
 // sliced directly after enforcing the exact JSON control-character rule.
 // Escaped forms still use the native JSON string decoder without normalization.
 function string(){const start=i++;let escaped=false,hasEscape=false;while(i<raw.length){const code=raw.charCodeAt(i++);if(!escaped&&code===34)return hasEscape?JSON.parse(raw.slice(start,i)):raw.slice(start+1,i-1);invariant(code>=32,'Invalid JSON string control character');if(!escaped&&code===92){escaped=true;hasEscape=true;}else escaped=false;}throw Error('Unterminated JSON string');}
 function value(depth){invariant(depth<=64,'JSON depth exceeds profile envelope bound');ws();const c=raw[i];
  if(c==='"')return string();
  if(c==='{'){i++;const out={},seen=new Set();ws();if(raw[i]==='}'){i++;return out;}while(true){ws();invariant(raw[i]==='"','Object key expected');const k=string();invariant(!seen.has(k),'Duplicate JSON key');invariant(!['__proto__','prototype','constructor'].includes(k),'Unsafe JSON key');seen.add(k);ws();invariant(raw[i++]===':','Missing colon');out[k]=value(depth+1);ws();const next=raw[i++];if(next==='}')return out;invariant(next===',','Missing object separator');}}
  if(c==='['){i++;const out=[];ws();if(raw[i]===']'){i++;return out;}while(true){invariant(out.length<10000,'Array exceeds profile envelope bound');out.push(value(depth+1));ws();const next=raw[i++];if(next===']')return out;invariant(next===',','Missing array separator');}}
  if(c==='t'&&raw.startsWith('true',i)){i+=4;return true;}if(c==='f'&&raw.startsWith('false',i)){i+=5;return false;}if(c==='n'&&raw.startsWith('null',i)){i+=4;return null;}
  number.lastIndex=i;const match=number.exec(raw);invariant(match,'Invalid JSON value');i+=match[0].length;const n=Number(match[0]);invariant(Number.isFinite(n),'Non-finite JSON number');return n;
 }
 const out=value(0);ws();invariant(i===raw.length,'Trailing JSON data');return out;
}

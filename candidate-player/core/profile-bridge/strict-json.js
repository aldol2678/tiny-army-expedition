import {invariant} from './hash.js';
// Full JSON reader with duplicate-key checks before value normalization. No repair.
export function parseStrictJSON(raw){
 invariant(typeof raw==='string'&&new TextEncoder().encode(raw).length<=2e6,'Save exceeds the conservative 2MB bridge bound');let i=0;
 const ws=()=>{while(/[ \n\r\t]/.test(raw[i]||'x'))i++;};
 function string(){const start=i++;let escaped=false;while(i<raw.length){const c=raw[i++];if(!escaped&&c==='"')return JSON.parse(raw.slice(start,i));if(!escaped&&c==='\\')escaped=true;else escaped=false;}throw Error('Unterminated JSON string');}
 function value(depth){invariant(depth<=24,'JSON depth exceeds legacy bound');ws();const c=raw[i];
  if(c==='"')return string();
  if(c==='{'){i++;const out={},seen=new Set();ws();if(raw[i]==='}'){i++;return out;}while(true){ws();invariant(raw[i]==='"','Object key expected');const k=string();invariant(!seen.has(k),'Duplicate JSON key');invariant(!['__proto__','prototype','constructor'].includes(k),'Unsafe JSON key');seen.add(k);ws();invariant(raw[i++]===':','Missing colon');out[k]=value(depth+1);ws();const next=raw[i++];if(next==='}')return out;invariant(next===',','Missing object separator');}}
  if(c==='['){i++;const out=[];ws();if(raw[i]===']'){i++;return out;}while(true){invariant(out.length<10000,'Array exceeds legacy bound');out.push(value(depth+1));ws();const next=raw[i++];if(next===']')return out;invariant(next===',','Missing array separator');}}
  for(const [word,v] of [['true',true],['false',false],['null',null]])if(raw.startsWith(word,i)){i+=word.length;return v;}
  const match=raw.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);invariant(match,'Invalid JSON value');i+=match[0].length;const n=Number(match[0]);invariant(Number.isFinite(n),'Non-finite JSON number');return n;
 }
 const out=value(0);ws();invariant(i===raw.length,'Trailing JSON data');return out;
}

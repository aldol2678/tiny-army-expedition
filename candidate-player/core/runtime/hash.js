// Independently reconstructed portable SHA-256; tested against Node's crypto.
export function invariant(ok, message) { if (!ok) throw new Error(message); }
export const clone = value => JSON.parse(JSON.stringify(value));
// Only immutable, short property-name strings are retained. Never cache an
// object's serialized bytes: callers mutate runtime/history records in place.
const escapedKeys = new Map(), maxEscapedKeys = 2048, maxEscapedKeyLength = 128;
const needsStringEscape = /["\\\u0000-\u001f\ud800-\udfff]/;
const quoteString = value => needsStringEscape.test(value) ? JSON.stringify(value) : '"' + value + '"';
function propertyPrefix(key) {
  if (key.length > maxEscapedKeyLength) return quoteString(key) + ':';
  let prefix = escapedKeys.get(key);
  if (prefix === undefined) {
    prefix = quoteString(key) + ':';
    if (escapedKeys.size >= maxEscapedKeys) escapedKeys.clear();
    escapedKeys.set(key, prefix);
  }
  return prefix;
}
export function canonical(value) {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string': return quoteString(value);
    case 'number': return Number.isFinite(value) ? String(value) : 'null';
    case 'boolean': return value ? 'true' : 'false';
    case 'object': break;
    default: return JSON.stringify(value);
  }
  // Preserve map/join semantics for holes, undefined, inherited array elements,
  // custom map methods and species. They are part of the existing wire format.
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value);
  // Parsed canonical saves already have lexicographically ordered properties,
  // except integer-like keys which Object.keys enumerates numerically.
  for (let i = 1; i < keys.length; i++) {
    if (keys[i - 1] > keys[i]) { keys.sort(); break; }
  }
  let result = '{';
  for (let i = 0; i < keys.length; i++) {
    if (i) result += ',';
    const key = keys[i];
    result += propertyPrefix(key) + canonical(value[key]);
  }
  return result + '}';
}
// SHA-256 words are modulo 2^32. Signed typed storage keeps arithmetic on the
// integer fast path instead of widening the working state to floating point.
const K = new Int32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rr=(x,n)=>(x>>>n)|(x<<(32-n));
export function sha256(text) {
 const b=new TextEncoder().encode(text), n=Math.ceil((b.length+9)/64)*64, a=new Uint8Array(n);a.set(b);a[b.length]=128;
 const dv=new DataView(a.buffer), bits=b.length*8;dv.setUint32(n-8,Math.floor(bits/4294967296));dv.setUint32(n-4,bits>>>0);
 const h=new Int32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Int32Array(64);
 for(let p=0;p<n;p+=64){for(let i=0;i<16;i++)w[i]=dv.getInt32(p+i*4);for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rr(x,7)^rr(x,18)^(x>>>3))+w[i-7]+(rr(y,17)^rr(y,19)^(y>>>10)))|0;}
 // Keep state scalar within each block: no per-block array/iterator/callback.
 let A=h[0],B=h[1],C=h[2],D=h[3],E=h[4],F=h[5],G=h[6],H=h[7];for(let i=0;i<64;i++){const t1=(H+(rr(E,6)^rr(E,11)^rr(E,25))+((E&F)^(~E&G))+K[i]+w[i])|0,t2=((rr(A,2)^rr(A,13)^rr(A,22))+((A&B)^(A&C)^(B&C)))|0;H=G;G=F;F=E;E=(D+t1)|0;D=C;C=B;B=A;A=(t1+t2)|0;}
 h[0]=(h[0]+A)|0;h[1]=(h[1]+B)|0;h[2]=(h[2]+C)|0;h[3]=(h[3]+D)|0;h[4]=(h[4]+E)|0;h[5]=(h[5]+F)|0;h[6]=(h[6]+G)|0;h[7]=(h[7]+H)|0;}
 return Array.from(h,v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}
export const digest=value=>sha256(canonical(value));
export function safeParse(raw,maxBytes=16*1024*1024){invariant(typeof raw==='string'&&new TextEncoder().encode(raw).length<=maxBytes,'Invalid or oversized save');return JSON.parse(raw,(k,v)=>{invariant(!['__proto__','prototype','constructor'].includes(k),'Unsafe object key');if(typeof v==='number')invariant(Number.isFinite(v),'Non-finite number');return v;});}
export function exactKeys(value,keys){invariant(value&&typeof value==='object'&&!Array.isArray(value)&&canonical(Object.keys(value).sort())===canonical([...keys].sort()),'Invalid fields');}

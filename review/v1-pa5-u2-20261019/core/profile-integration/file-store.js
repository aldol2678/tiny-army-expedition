import fs from 'node:fs';
import {invariant} from '../runtime/hash.js';
import {validateProfileCommit} from './store.js';
// Explicit caller-owned isolated path only. Never chooses a production key/path.
export class FileProfileStore{
 constructor(filename){this.filename=filename;}
 load(){try{return fs.readFileSync(this.filename,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 commit(expectedRaw,nextRaw){let fd;const lock=this.filename+'.lock';try{fd=fs.openSync(lock,'wx');const old=this.load();invariant(old===expectedRaw,'Profile store exact-parent conflict');validateProfileCommit(old,nextRaw);const tmp=this.filename+`.next-${process.pid}`;fs.writeFileSync(tmp,nextRaw);const f=fs.openSync(tmp,'r');try{fs.fsyncSync(f);}finally{fs.closeSync(f);}fs.renameSync(tmp,this.filename);return nextRaw;}finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}}}
}

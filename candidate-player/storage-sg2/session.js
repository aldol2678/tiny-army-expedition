// Asynchronous SG2 session. The only main-thread work is lifecycle control,
// structured transfer, native IDB transaction callbacks, and small UI projection.
export function createRecordSession({store,worker,slot,kind,id=()=>crypto.randomUUID(),onChange=()=>{}}){
 if(!store||!worker||!['profile','runtime'].includes(kind)||typeof slot!=='string')throw Error('Explicit isolated SG2 dependencies required');
 let epoch=0,root=null,summary=null,projection=null,observedRoot=null,importBackup=null,lastPreview=null,pending=null,closed=false,active=null,phase='idle',lastError=null;
 const listeners=new Set();
 const state=()=>({phase,rootHash:root?.hash??null,summary,projection,hasSavedBytes:observedRoot!==null||root!==null,observedRoot,pendingProjection:pending?.projection??null,pending:!!pending,error:lastError,closed});
 const notify=()=>{const current=state();for(const listener of [onChange,...listeners])try{listener(current);}catch{}};
 const own=job=>!closed&&active===job&&epoch===job.epoch&&!job.controller.signal.aborted;
 const check=job=>{if(!own(job))throw Object.assign(Error('SG2 operation ownership changed'),{name:'AbortError'});};
 function begin(name){if(closed||active)throw Error('SG2 session busy or closed');const job={epoch:++epoch,controller:new AbortController()};active=job;phase=name;lastError=null;notify();return job;}
 function end(job){if(active===job){active=null;phase=pending?'pending':'ready';notify();}}
 async function bundleFor(current,incoming=[]){const byId=new Map(incoming.map(r=>[r.id,r]));const records=await Promise.all(current.recordIds.map(x=>byId.get(x)??store.readRecord(x)));if(records.some(x=>x===null))throw Error('Missing immutable SG2 archive');return {format:'tiny-army-sg2-bundle-1',root:current,records};}
 async function boot(){if(pending)throw Error('Export or retry pending SG2 operation before reloading');const job=begin('loading');try{const next=await store.read(slot);check(job);observedRoot=next;if(next){const bundle=await bundleFor(next);check(job);const inspected=await worker.request(kind+':inspect',{bundle},{signal:job.controller.signal,ownerToken:job.epoch});check(job);root=next;summary=inspected.summary;projection=inspected.projection;}else{root=null;summary=null;projection=null;}return state();}catch(e){root=null;projection=null;summary=null;lastError=e;throw e;}finally{end(job);}}
 async function commit(job){const p=pending;check(job);phase='committing';notify();try{
  const result=await store.commit({...p.commit,ownerToken:job.epoch,assertOwner:()=>own(job)&&pending===p,signal:job.controller.signal});
  // A completed native commit is authoritative. Never turn its durable receipt
  // into a second write because an acknowledgment or a UI notification was lost.
  if(result.committedRootHash!==p.commit.root.hash)throw Error('Unexpected SG2 commit receipt');
  if(own(job)){root=result.currentRoot;observedRoot=root;summary=root?.hash===p.commit.root.hash?p.summary:null;projection=root?.hash===p.commit.root.hash?p.projection:null;importBackup=p.backup??importBackup;pending=null;lastError=null;}
  return {committed:true,replayed:result.replayed,currentRootHash:result.currentRoot?.hash??null,needsReload:result.currentRoot?.hash!==p.commit.root.hash};
 }catch(e){if(own(job)){lastError=e;phase='pending';notify();}throw e;}}
 async function prepare(type,payload){if(pending)throw Error('Same pending SG2 transaction must be retried or exported first');if(observedRoot&&!root)throw Error('Unverified SG2 original requires recovery, not replacement');const job=begin('preparing'),expectedRootHash=root?.hash??null,transactionId='sg2:'+id();try{
  let request={...payload,slot,transactionId,expectedRootHash};if(type==='transition'||type==='new'&&root){if(!root)throw Error('No SG2 record');request={...request,bundle:await bundleFor(root),expectedRootHash};}
  check(job);const prepared=await worker.request(kind+':'+type,request,{signal:job.controller.signal,ownerToken:job.epoch});check(job);
  if(root?.hash!==undefined&&root.hash!==expectedRootHash)throw Error('SG2 in-memory base changed');
  if(prepared.commit.expectedRootHash!==expectedRootHash)throw Error('Prepared SG2 base differs');
  pending=prepared;return await commit(job);
 }catch(e){if(own(job))lastError=e;throw e;}finally{end(job);}}
 return Object.freeze({state,boot,subscribe(listener){if(typeof listener!=='function')throw Error('Listener required');listeners.add(listener);return ()=>listeners.delete(listener);},transition:action=>prepare('transition',{action}),
  importExplicit(raw,{confirmed=false}={}){if(root)throw Error('SG2 import only targets a verified empty isolated slot');return prepare('import',{raw,confirmed,previewDigest:lastPreview?.raw===raw?lastPreview.previewDigest:undefined});},
  async retry(){if(!pending)return false;const job=begin('retrying');try{return await commit(job);}finally{end(job);}},
  async exportBundle({pending:wantPending=false}={}){if(wantPending){if(!pending)throw Error('No pending SG2 operation');return bundleFor(pending.commit.root,pending.commit.records);}const current=await store.read(slot);if(!current)throw Error('No durable SG2 record');return bundleFor(current);},
  exportImportBackup(){return pending?.backup??importBackup;},
  newRun:options=>prepare('new',options),
  async checkChanged(){const durable=await store.read(slot);return (durable?.hash??null)!==(root?.hash??null);},
  async preview(raw){const job=begin('preview');try{const result=await worker.request(kind+':preview',{raw,transactionId:'sg2:preview:'+id()},{signal:job.controller.signal,ownerToken:job.epoch});check(job);lastPreview={raw,...result};return result;}catch(e){lastError=e;throw e;}finally{end(job);}},
  async audit(){const job=begin('audit');try{if(!root)throw Error('No SG2 save');const captured=root.hash,bundle=await bundleFor(root);check(job);const result=await worker.request(kind+':audit',{bundle},{signal:job.controller.signal,ownerToken:job.epoch});check(job);if((await store.read(slot))?.hash!==captured)throw Error('SG2 audit base changed');return result;}catch(e){lastError=e;throw e;}finally{end(job);}},
  async exportRaw({pending:wantPending=false}={}){if(!wantPending&&observedRoot&&observedRoot!==root){let records=[];for(const recordId of Array.isArray(observedRoot.recordIds)?observedRoot.recordIds:[]){try{records.push({recordId,value:await store.readRecord(recordId)});}catch(error){records.push({recordId,error:error.message});}}return worker.request('serializeBackup',{format:'sg2-unverified-backup-1',root:observedRoot,records});}const bundle=wantPending?pending&&await bundleFor(pending.commit.root,pending.commit.records):root&&await bundleFor(root);if(!bundle)throw Error('No requested SG2 save');const result=await worker.request(kind+':export',{bundle});return result.exportRaw;},
  async exportPreservedOriginal(){if(!root)return null;const result=await worker.request(kind+':preserved',{bundle:await bundleFor(root)});return result.raw;},
  cancel(){if(!active||phase==='committing')return false;active.controller.abort();epoch++;return true;},
  close(){closed=true;epoch++;active?.controller.abort();worker.close();store.close();notify();listeners.clear();}
 });
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer(async(req,res)=>{
  try {
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name==='/ci/smoke.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Code-only storage smoke</title>');return;}
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)||!['.js','.json'].includes(path.extname(file))){res.writeHead(404);res.end();return;}
    const content=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/json','Cache-Control':'no-store'});res.end(content);
  } catch {res.writeHead(404);res.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser, evaluationTimer;
try {
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  page.setDefaultTimeout(45000);
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/ci/smoke.html`);
  const result=await Promise.race([page.evaluate(async()=>{
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    const [{openRecordStore},{createStorageWorker},{createNativeProfileSession},{LR29_R2_PROFILE}]=await Promise.all([
      import('/storage-sg2/idb-store.js'),import('/storage-sg2/worker-client.js'),
      import('/storage-sg2/native-session.js'),import('/core/lightweight-records/identity.js')]);
    const database='ci-code-only-'+crypto.randomUUID(),slot='ci-native-profile';
    const make=async()=>createNativeProfileSession({store:await openRecordStore({indexedDB,name:database}),worker:createStorageWorker({rules:'lr29-r2'}),slot});
    let session=await make();
    try {
      await session.boot();check(session.state().rootHash===null,'Expected empty fresh IndexedDB');
      await session.newRun({profileId:'ci-fresh-player'});
      const initial=session.state();
      check(initial.summary.tokens===0&&initial.projection.view.tokens===0,'New profile must start with zero tokens');
      check(initial.projection.view.native===true,'Expected native player origin');
      check(initial.summary.completedRuns===0,'No inherited completed runs');
      const firstHash=initial.rootHash;check(/^[a-f0-9]{64}$/.test(firstHash),'Durable profile hash missing');
      session.close();session=await make();await session.boot();
      check(session.state().rootHash===firstHash,'Cold worker/IndexedDB reload changed profile');
      check(session.state().projection.view.tokens===0,'Cold reload changed balance');
      let rejection='';try{await session.transition({type:'purchaseUnlock',unlockId:'whistle'});}catch(error){rejection=error.message;}
      check(/Insufficient tokens/.test(rejection),'Unearned unlock must reject for insufficient tokens');
      check(session.state().pending===false,'Rejected purchase left a pending transaction');
      session.close();session=await make();await session.boot();
      check(session.state().rootHash===firstHash,'Rejected purchase changed durable IndexedDB root');
      check(session.state().projection.view.tokens===0,'Rejected purchase changed durable balance');
      const runId=session.state().projection.view.nextRunId;
      await session.transition({type:'startRun',runId,seed:67,tactic:'balanced',encounterProfile:LR29_R2_PROFILE});
      const started=session.state();check(started.projection.run.runId===runId,'Native startRun did not start requested run');
      check(started.projection.view.tokens===0,'Starting run changed zero balance');
      const runHash=started.rootHash;check(runHash!==firstHash,'Starting run did not persist');
      session.close();session=await make();await session.boot();
      check(session.state().rootHash===runHash,'Cold reload changed active run');
      check(session.state().projection.run.runId===runId,'Cold reload lost active run');
      const audit=await session.audit();check(audit.verification==='FULL_REPLAY_VERIFIED','Fresh generated segment audit failed');
      return {nativeIndexedDB:true,dedicatedModuleWorker:true,freshZeroBalance:true,rejectedUnearnedUnlock:true,coldProfileReload:true,coldRunReload:true,freshSegmentReplay:true,assetParityClaimed:false,fullCampaignClaimed:false};
    } finally {session.close();}
  }),new Promise((_,reject)=>{evaluationTimer=setTimeout(()=>reject(Error('Browser storage smoke exceeded 120 seconds')),120000);})]);
  clearTimeout(evaluationTimer);
  assert.deepEqual(pageErrors,[]);
  console.log(JSON.stringify(result));
  await context.close();
} finally {
  clearTimeout(evaluationTimer);
  try {if(browser)await browser.close();}
  finally {await new Promise(resolve=>server.close(resolve));}
}

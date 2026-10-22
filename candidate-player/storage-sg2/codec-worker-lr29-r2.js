import {dispatchStorageTask} from './worker-tasks.js';
import {startStorageWorker} from './worker-port.js';
import {ensureWorkerEngine} from './worker-engine.js';
import {installCombinedRules} from '../core/lightweight-records/install.js';
// Distinct filename also works in Node workers, which discard entry URL queries.
let initialization;
async function dispatch(kind,payload,options){
 if(/^(runtime|profile|native):/.test(kind))await(initialization??=(async()=>{await ensureWorkerEngine();installCombinedRules();})());
 if(/^native:/.test(kind)){const {dispatchNativeProfileTask}=await import('./native-profile-tasks.js');return dispatchNativeProfileTask(kind,payload,options);}
 return dispatchStorageTask(kind,payload,options);
}
await startStorageWorker(dispatch);

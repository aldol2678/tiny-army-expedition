import {dispatchStorageTask} from './worker-tasks.js';
import {installStorageWorker as installPort,startStorageWorker} from './worker-port.js';
// Original SG2 rules and public test adapter remain unchanged.
export function installStorageWorker(port,{dispatch=dispatchStorageTask}={}){return installPort(port,{dispatch});}
await startStorageWorker(dispatchStorageTask);

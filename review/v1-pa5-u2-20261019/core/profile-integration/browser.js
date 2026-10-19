// The caller must load and hash-check these scripts in an isolated legacy realm.
// This module never reads live storage, fetches a save, or performs migration.
import {createProfileBridge} from '../profile-bridge/bridge.js';
import {canonical,invariant} from '../runtime/hash.js';
import {SOURCE_HASHES} from './source-pins.js';
import {installLegacyProfileSupport} from './start.js';
export function initializeLegacyProfileCompatibility({legacyApi,content,verifiedSourceHashes}){
 invariant(canonical(verifiedSourceHashes)===canonical(SOURCE_HASHES),'Verified pinned legacy source hashes required');
 const bridge=createProfileBridge({legacyApi,content,sourceHashes:SOURCE_HASHES});
 return installLegacyProfileSupport({bridge,content});
}
export * from './portable.js';
export * from './store.js';
export * from './current-store.js';
export {SOURCE_HASHES};

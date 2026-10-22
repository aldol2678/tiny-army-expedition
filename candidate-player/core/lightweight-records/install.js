import {LR29_PROFILE} from '../lightweight-release/identity.js';
import {LR29_CAPABILITY} from '../lightweight-release/projection.js';
import {installLightweightRelease} from '../lightweight-release/integration.js';
import {LR29_R2_PROFILE} from './identity.js';
// Deliberately exact r2, not a profile prefix, fallback, or dynamic allowlist.
export function installCombinedRules(){
 if(LR29_PROFILE!==LR29_R2_PROFILE)throw Error('Combined candidate requires the exact reviewed LR29-r2 rules');
 return installLightweightRelease({capability:LR29_CAPABILITY});
}

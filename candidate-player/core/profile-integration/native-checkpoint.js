// Bounded segment semantics. Storage owns immutable archive chain resolution.
// An imported checkpoint is NEVER self-authenticating: audit each preceding
// segment from a fresh origin before passing its computed checkpoint here.
import {canonical,clone,digest,invariant} from '../runtime/hash.js';
import {NATIVE_VERSION,NATIVE_POLICY_VERSION,isNativeOrigin,validateNativeOrigin,nativeEarnedLevel} from './native.js';
import {createNativeProfileFromOrigin,validateProfileEnvelopeRecordsCurrent,validateProfileEnvelopeRecordsStrictAsync} from './portable.js';
export function createNativeCheckpointCurrent(segment){
 validateProfileEnvelopeRecordsCurrent(segment);invariant(isNativeOrigin(segment.origin)&&segment.activeRun===null&&segment.completedRuns.length>0,'Checkpoint requires nonempty fully archived native segment');
 const previous=segment.origin.checkpoint;
 const earnedLevel=nativeEarnedLevel(segment);
 return {version:'native-player-checkpoint-2',...(earnedLevel>1?{earnedLevel}:{}),originalOrigin:clone(previous?.originalOrigin??segment.origin),previousSegmentDigest:digest(segment),priorCheckpointDigest:previous?digest(previous):null,archivedRecords:clone(segment.candidateRecords),creditedTokens:segment.tokenAccount.creditedTokens,purchases:clone(segment.purchases),segmentNumber:(previous?.segmentNumber??0)+1};
}
export function createNativeFromCheckpoint(checkpoint){
 const origin={version:NATIVE_VERSION,kind:'native-player-checkpoint-origin',profile:clone(checkpoint.originalOrigin.profile),policyVersion:NATIVE_POLICY_VERSION,originDigest:digest(checkpoint),checkpoint:clone(checkpoint)};
 validateNativeOrigin(origin);return createNativeProfileFromOrigin(origin);
}
export async function validateNativeSegmentStrictAsync(segment,{verifiedCheckpoint=null,...options}={}){
 invariant(isNativeOrigin(segment.origin),'Native segment required');
 invariant(canonical(segment.origin.checkpoint??null)===canonical(verifiedCheckpoint),'Native segment must follow exactly the independently verified previous checkpoint');
 await validateProfileEnvelopeRecordsStrictAsync(segment,{...options,verifiedCheckpoint});return true;
}
export async function createNativeCheckpoint(segment,options={}){await validateNativeSegmentStrictAsync(segment,options);return createNativeCheckpointCurrent(segment);}

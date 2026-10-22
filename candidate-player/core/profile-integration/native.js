// Private release policy, not a claim that the original two-chapter economy
// specified chapter 3–5 or event awards. No fabricated legacy save is created.
import {canonical,clone,digest,invariant,exactKeys} from '../runtime/hash.js';
export const NATIVE_SCHEMA='tiny-army-native-player-private-1';
export const NATIVE_VERSION='native-player-private-1';
export const NATIVE_POLICY_VERSION='private-five-chapter-economy-1';
export const NATIVE_POLICY=Object.freeze({version:NATIVE_POLICY_VERSION,normal:1,elite:3,boss:5,completionBonus:20,eventRate:'SAME_KIND_AND_CHAPTER',disclosure:'Private design extension: original kind rate × chapter 1–5; original two-chapter completion 8 scaled to five chapters =20. Not previously approved historical values.'});
export const isNativeOrigin=o=>['native-fresh-player-origin','native-player-checkpoint-origin'].includes(o?.kind);
export function nativeOrigin(profileId){
 invariant(typeof profileId==='string'&&/^[A-Za-z0-9_.:-]{1,90}$/.test(profileId),'Explicit native profile ID required');
 const profile={version:NATIVE_VERSION,id:profileId,revision:0,tokens:0,level:1,unlocks:{relics:['banner','seal','spear_tip','medic'],tactics:['balanced'],branches:[],training:[]},settledRunIds:[],legacyAggregate:null,newCampaignRecords:{runs:0,wins:0,bestChapter:0,battles:0}};
 return {version:NATIVE_VERSION,kind:'native-fresh-player-origin',profile,policyVersion:NATIVE_POLICY_VERSION,originDigest:digest(profile)};
}
export function validateNativeOrigin(o){if(o?.kind==='native-player-checkpoint-origin'){exactKeys(o,['version','kind','profile','policyVersion','originDigest','checkpoint']);const c=o.checkpoint;exactKeys(c,['version','originalOrigin','previousSegmentDigest','priorCheckpointDigest','archivedRecords','creditedTokens','purchases','segmentNumber',...(Object.hasOwn(c,'earnedLevel')?['earnedLevel']:[])]);invariant(!Object.hasOwn(c,'earnedLevel')||Number.isInteger(c.earnedLevel)&&c.earnedLevel>=2&&c.earnedLevel<=4,'Invalid earned profile level');invariant(c.version==='native-player-checkpoint-2','Unsupported native checkpoint version');validateNativeOrigin(c.originalOrigin);invariant(c.originalOrigin.kind==='native-fresh-player-origin','Checkpoint must preserve actual fresh origin');invariant(canonical(o.profile)===canonical(c.originalOrigin.profile)&&o.version===NATIVE_VERSION&&o.policyVersion===NATIVE_POLICY_VERSION&&o.originDigest===digest(c),'Checkpoint origin differs');invariant(/^[a-f0-9]{64}$/.test(c.previousSegmentDigest)&&(c.priorCheckpointDigest===null||/^[a-f0-9]{64}$/.test(c.priorCheckpointDigest))&&Number.isSafeInteger(c.segmentNumber)&&c.segmentNumber>0&&Number.isSafeInteger(c.creditedTokens)&&c.creditedTokens>=0&&c.creditedTokens<=1e9,'Invalid checkpoint link/credit');exactKeys(c.archivedRecords,['runs','wins','bestChapter','battles']);invariant(Object.values(c.archivedRecords).every(x=>Number.isSafeInteger(x)&&x>=0)&&c.archivedRecords.wins<=c.archivedRecords.runs&&c.archivedRecords.bestChapter<=5,'Invalid checkpoint aggregate');return true;}invariant(canonical(o)===canonical(nativeOrigin(o?.profile?.id)),'Native origin differs from zero-balance fresh player');return true;}
export const unlockGroup=x=>({relic:'relics',branch:'branches',training:'training',tactic:'tactics'})[x.type];
export function effectiveNativeProfile(origin,purchases,catalog,{earnedVanguard=false,earnedLevel=1}={}){
 validateNativeOrigin(origin);invariant(Array.isArray(purchases)&&purchases.length<=catalog.length,'Invalid permanent purchase ledger');const p=clone(origin.profile),seen=new Set(),transactions=new Set();
 for(const purchase of purchases){exactKeys(purchase,['transactionId','unlockId','cost']);const item=catalog.find(x=>x.id===purchase.unlockId);invariant(item&&item.cost===purchase.cost&&!seen.has(item.id)&&typeof purchase.transactionId==='string'&&!transactions.has(purchase.transactionId),'Invalid or duplicate permanent purchase');seen.add(item.id);transactions.add(purchase.transactionId);invariant(!p.unlocks[unlockGroup(item)].includes(item.id),'Already owned');p.unlocks[unlockGroup(item)].push(item.id);}
 if(earnedVanguard||origin.checkpoint?.archivedRecords.bestChapter>=1)p.unlocks.tactics.push('vanguard');p.level=Math.max(origin.checkpoint?.earnedLevel??1,earnedLevel);invariant(Number.isInteger(p.level)&&p.level>=1&&p.level<=4,'Invalid effective profile level');p.revision=purchases.length;return p;
}
export function nativeSnapshot(origin,purchases,catalog,{runId,campaignRulesVersion,tactic,earnedVanguard=false,earnedLevel=1}){
 const p=effectiveNativeProfile(origin,purchases,catalog,{earnedVanguard,earnedLevel});invariant(p.unlocks.tactics.includes(tactic),'Tactic not owned');
 const body={version:NATIVE_VERSION,runId,campaignRulesVersion,sourceProfileId:p.id,sourceProfileRevision:p.revision,sourceProfileDigest:digest(p),unlocks:clone(p.unlocks),tactic,sourceRawSHA256:null,grantsUnits:false,grantsCurrency:false};return {...body,digest:digest(body)};
}
export function projectNativeRun(run){
 const s=run.state,credits=[],accrued=[],seen=new Set(),defeat=s.phase==='defeat'||s.phase==='complete'&&s.settlement?.outcome==='defeat';
 for(const b of s.battles){const result=b.receipt?.result;invariant(result&&typeof result.win==='boolean','Missing native battle result');invariant(!seen.has(result.battleId),'Duplicate native battle credit');seen.add(result.battleId);if(!result.win)continue;
 invariant(['normal','elite','boss'].includes(b.kind)&&['route','event'].includes(b.origin.type)&&Number.isInteger(b.chapter)&&b.chapter>=1&&b.chapter<=5,'Unsupported native credit evidence');
 const reason=s.milestones.chapterBosses.includes(b.chapter)?'CHAPTER_CLEAR':defeat?'DEFEAT':null;
 const entry={runId:run.runId,battleId:result.battleId,resultDigest:b.receipt.resultDigest,chapter:b.chapter,kind:b.kind,originType:b.origin.type,amount:NATIVE_POLICY[b.kind]*b.chapter};
 (reason?credits:accrued).push({...entry,...(reason?{reason}:{status:'EARNED_AWAITING_CHAPTER_CLEAR_OR_DEFEAT'})});
 }
 if(s.phase==='complete'&&s.settlement?.outcome==='victory'){
 invariant(s.campaignComplete&&canonical(s.milestones.chapterBosses)===canonical([1,2,3,4,5])&&s.battles.at(-1)?.chapter===5&&s.battles.at(-1)?.milestoneOrigin==='chapter-boss'&&s.battles.at(-1)?.receipt.result.win,'Five actual chapter bosses required for completion award');
 credits.push({runId:run.runId,battleId:'native-completion-bonus',resultDigest:digest(s.settlement),chapter:5,kind:'completion',originType:'campaign',amount:20,reason:'FIVE_CHAPTER_VICTORY'});
 }
 return {runId:run.runId,version:NATIVE_POLICY_VERSION,credits,accrued,unknown:[],creditedTokens:credits.reduce((n,x)=>n+x.amount,0),accruedTokens:accrued.reduce((n,x)=>n+x.amount,0),completionBonusStatus:'PRIVATE_VERSIONED_POLICY',actualCreditRequiresProfile:true};
}
export function nativeAccount(e){
 const seen=new Set(),entries=[...e.completedRuns,...(e.activeRun?[e.activeRun]:[])].map(run=>{invariant(!seen.has(run.runId),'Duplicate native run');seen.add(run.runId);return projectNativeRun(run);});
 const creditedTokens=(e.origin.checkpoint?.creditedTokens??0)+entries.reduce((n,x)=>n+x.creditedTokens,0),debitedTokens=e.purchases.reduce((n,x)=>n+x.cost,0),balance=creditedTokens-debitedTokens;
 invariant(Number.isSafeInteger(balance)&&balance>=0&&balance<=1e9,'Insufficient native tokens or balance overflow');
 return {version:NATIVE_POLICY_VERSION,profileId:e.profileId,originDigest:digest(e.origin),preservedTokens:0,creditedTokens,debitedTokens,balance,entries};
}

// Original v18 settlement formula is per terminal expedition, not lifetime wins.
export function nativeRunEarnedLevel(run){const s=run?.state;if(s?.phase!=='complete')return 1;return Math.max(s.battles.filter(b=>b.receipt.result.win).length>=3?2:1,s.milestones.chapterBosses.includes(1)?3:1,s.settlement?.outcome==='victory'?4:1);}
export function nativeEarnedLevel(e){return Math.max(e.origin.checkpoint?.earnedLevel??1,...e.completedRuns.map(nativeRunEarnedLevel),nativeRunEarnedLevel(e.activeRun));}

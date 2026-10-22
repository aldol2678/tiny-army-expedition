// TS2: recovered, bounded v09 battle awards. No prices, purchases, or guessed
// chapter 3–5/event/5-chapter-completion awards. Called only after run validation.
import {canonical,clone,digest,invariant,exactKeys} from '../runtime/hash.js';
export const TOKEN_SETTLEMENT_VERSION='official-v09-battle-awards-partial-ts2-1';
export const TOKEN_PROFILE_SCHEMA='isolated-preserved-profile-token-settlement-ts2-1';
export const TOKEN_PROFILE_VERSION='legacy-entitlement-token-settlement-ts2-1';
export const TOKEN_POLICY=Object.freeze({version:TOKEN_SETTLEMENT_VERSION,source:'production-og-patch/dist/js/campaign.js',sourceScope:'two-chapter-v09',normal:1,elite:3,boss:5,chapterMultipliers:Object.freeze({1:1,2:2}),fiveChapterCompletionBonus:'UNKNOWN',eventBattleAwards:'UNKNOWN',laterChapterAwards:'UNKNOWN'});
const MAX=1e9;
const amount=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX;
// A projection, not an independent combat verifier. The profile boundary verifies
// the input run. This function never grants trust or touches storage.
export function projectRunTokenSettlement(run){
 const s=run.state;invariant(s&&Array.isArray(s.battles)&&Array.isArray(s.milestones?.chapterBosses),'Token projection requires battle/milestone evidence');
 const seen=new Set(),credits=[],accrued=[],unknown=[];
 const defeat=s.phase==='defeat'||s.phase==='complete'&&s.settlement?.outcome==='defeat';
 for(const b of s.battles){
  const result=b.receipt?.result;invariant(result&&typeof result.win==='boolean','Token battle result is missing');
  const key=`${run.runId}|${result.battleId}`;invariant(!seen.has(key),'Duplicate token battle identity');seen.add(key);
  if(!result.win)continue;
  invariant(['normal','elite','boss'].includes(b.kind)&&Number.isInteger(b.chapter)&&b.chapter>=1&&b.chapter<=5,'Unsupported token evidence');
  const item={runId:run.runId,battleId:result.battleId,resultDigest:b.receipt.resultDigest,chapter:b.chapter,kind:b.kind,originType:b.origin.type};
  if(b.origin.type!=='route'||b.chapter>2){unknown.push({...item,status:'UNKNOWN',reason:b.origin.type!=='route'?'EVENT_BATTLE_POLICY_NOT_ESTABLISHED':'CHAPTER_3_TO_5_POLICY_NOT_ESTABLISHED'});continue;}
  const value=TOKEN_POLICY[b.kind]*TOKEN_POLICY.chapterMultipliers[b.chapter];
  const reason=s.milestones.chapterBosses.includes(b.chapter)?'CHAPTER_CLEAR':defeat?'DEFEAT':null;
  (reason?credits:accrued).push({...item,amount:value,...(reason?{reason}:{status:'EARNED_AWAITING_CHAPTER_CLEAR_OR_DEFEAT'})});
 }
 if(s.campaignComplete)unknown.push({runId:run.runId,kind:'five-chapter-completion-bonus',status:'UNKNOWN',reason:'FIVE_CHAPTER_BONUS_POLICY_NOT_ESTABLISHED'});
 const creditedTokens=credits.reduce((n,x)=>n+x.amount,0),accruedTokens=accrued.reduce((n,x)=>n+x.amount,0);
 invariant(amount(creditedTokens)&&amount(accruedTokens),'Token award overflow');
 return {runId:run.runId,version:TOKEN_SETTLEMENT_VERSION,credits,accrued,unknown,creditedTokens,accruedTokens,completionBonusStatus:'UNKNOWN_NOT_ZERO',actualCreditRequiresProfile:true};
}
export function projectTokenAccount(e){
 const runs=[...e.completedRuns,...(e.activeRun?[e.activeRun]:[])],legacy=new Set(e.preservedProfile.settledRunIds),seen=new Set();
 const entries=runs.map(run=>{invariant(!legacy.has(run.runId)&&!seen.has(run.runId),'Run already exists or was settled in preserved profile');seen.add(run.runId);return projectRunTokenSettlement(run);});
 const creditedTokens=entries.reduce((n,x)=>n+x.creditedTokens,0),balance=e.preservedProfile.tokens+creditedTokens;
 invariant(amount(creditedTokens)&&amount(balance),'Token balance exceeds preserved-profile compatibility bound');
 return {version:TOKEN_SETTLEMENT_VERSION,profileId:e.profileId,originDigest:digest(e.origin),preservedTokens:e.preservedProfile.tokens,creditedTokens,balance,entries};
}
export function validateTokenAccount(e){
 exactKeys(e.tokenAccount,['version','profileId','originDigest','preservedTokens','creditedTokens','balance','entries']);
 invariant(e.schema===TOKEN_PROFILE_SCHEMA&&e.version===TOKEN_PROFILE_VERSION,'Token profile identity mismatch');
 invariant(canonical(e.tokenAccount)===canonical(projectTokenAccount(e)),'Token account differs from unique validated battle awards');return true;
}
export function tokenReceiptFields(account,runId){
 const entry=account.entries.find(x=>x.runId===runId);invariant(entry,'Terminal token account entry is missing');
 return {tokensDelta:entry.creditedTokens,tokenSettlement:entry.unknown.length?'PARTIAL_CONFIRMED_UNKNOWN_PENDING':'CONFIRMED_OFFICIAL_BATTLE_AWARDS',tokenSettlementVersion:account.version};
}
export function tokenSummaryText(run,{account=null,profileBound=false}={}){
 if(account?.version==='private-five-chapter-economy-1'){const entry=account.entries.find(x=>x.runId===run.runId);return `증표 ${account.balance}개 · 이번 원정 정산 ${entry?.creditedTokens??0}개 · 다음 정산 대기 ${entry?.accruedTokens??0}개. 비공개 5장 정책: 전투 종류 기본값 × 장 번호, 사건 전투 동일, 실제 5장 완주 +20.`;}
 const entry=account?.entries.find(x=>x.runId===run.runId)??projectRunTokenSettlement(run);
 const bound=!!account&&profileBound;
 return `${bound?'확인된 증표 정산':'확인된 증표 정산 가능액'} ${entry.creditedTokens}개 · 다음 정산 대기 ${entry.accruedTokens}개${entry.unknown.length?` · 정책 미정 ${entry.unknown.length}건`:''}. ${bound?'보존 잔액과 별도 원장이 함께 저장됩니다.':'프로필 정산 연결 전에는 실제 지급되지 않습니다.'} 3~5장·사건·5장 완주 보너스는 정책 미정입니다.`;
}

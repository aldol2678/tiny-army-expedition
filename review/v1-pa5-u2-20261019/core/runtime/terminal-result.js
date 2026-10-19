// The pinned vendor revives allies AFTER recording contributions on victory.
// Never derive campaign casualties from presentation/live units after finish().
import {canonical,invariant} from './hash.js';
export const TERMINAL_RESULT_VERSION='terminal-contributions-ko-1';
export function terminalResultLedger(result,frozenRoster){
 invariant(result&&typeof result.win==='boolean'&&Array.isArray(frozenRoster)&&frozenRoster.length>0,'Invalid terminal outcome/roster');
 invariant(Array.isArray(result.contributions)&&result.contributions.length===frozenRoster.length&&result.unitCount===frozenRoster.length,'Terminal full roster count mismatch');
 invariant(Number.isInteger(result.survivors)&&result.survivors>=0&&result.survivors<=result.unitCount,'Invalid terminal survivor count');
 const identity=u=>({id:u.id,type:u.type,slot:u.slot,training:u.training||0,trainingTrack:u.trainingTrack||null,condition:u.condition??100});
 const expected=frozenRoster.map(identity),ids=new Set(expected.map(u=>u.id));
 invariant(ids.size===expected.length&&expected.every(u=>Number.isSafeInteger(u.id)&&u.id>0),'Invalid frozen roster identity');
 invariant(canonical(result.startingRoster)===canonical(expected),'Terminal starting roster mismatch');
 const seen=new Set(),knockedOut=[];let alive=0,hp=0,maxHp=0;
 for(const c of result.contributions){
  invariant(c&&ids.has(c.id)&&!seen.has(c.id),'Terminal unknown/duplicate unit identity');seen.add(c.id);
  invariant(canonical(identity(c))===canonical(expected.find(u=>u.id===c.id)),'Terminal unit identity changed');
  invariant(typeof c.hp==='number'&&Number.isFinite(c.hp)&&c.hp>=0&&typeof c.maxHp==='number'&&Number.isFinite(c.maxHp)&&c.maxHp>0&&c.hp<=c.maxHp,'Invalid terminal HP bounds');
  hp+=c.hp;maxHp+=c.maxHp;if(c.hp===0)knockedOut.push(c.id);else alive++;
 }
 invariant(alive===result.survivors&&alive+knockedOut.length===result.unitCount,'Terminal survivor/KO ledger mismatch');
 invariant(typeof result.hpRatio==='number'&&Number.isFinite(result.hpRatio)&&Math.abs(result.hpRatio-hp/maxHp)<=1e-10,'Terminal HP ratio mismatch');
 return {version:TERMINAL_RESULT_VERSION,source:'AUTHORITATIVE_TERMINAL_CONTRIBUTIONS',knockedOut:knockedOut.sort((a,b)=>a-b),survivors:alive,unitCount:result.unitCount};
}

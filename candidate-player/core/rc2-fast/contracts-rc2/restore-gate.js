import {captureGame,restoreGame as originalRestore} from '../spear-skills-rb6/browser.js';
import {assert,canonical,clone} from '../relic-services/registry.js';
import {bindInternalRestores} from './checkpoint.js';
const CORE=['rb6-final-damage','fh1-first-hp-hit','rb5-companion','rb5-paid-actions','hb1-heal-barrier','rb2-relic-effects'];
const IDENTITY=['battleId','initialSeed','startingRoster','relics','skills','encounter','combatRulesVersion'];
export function installRestoreGate(game){
 assert(!game._rc2Contracts,'Unique RC2 restore gate required');
 let active=0,restoring=false,dirty=false,sealed=null;
 const ids=()=>game._v10CheckpointParticipants.map(p=>p.id);
 function assertUsable(){assert(!dirty&&!restoring,'RC2 owner unavailable after uncertain restoration');}
 function withOwner(fn){assertUsable();active++;try{return fn();}finally{active--;}}
 function validateSnapshot(s,{dependency=false}={}){
  assert(s&&s.data&&Array.isArray(s.participants),'Complete RC2 snapshot required');
  for(const key of IDENTITY)assert(canonical(s.data[key])===canonical(game[key]),'Foreign RC2 identity '+key);
  const names=s.participants.map(p=>p.id),expected=sealed??ids();
  assert(new Set(names).size===names.length,'Duplicate checkpoint participant');
  // The private spear journal may retain an earlier host snapshot from before
  // class/ultimate registration. It is validation-only, never used as replacement
  // public state. Its exact registration prefix and all core owners are required.
  assert(canonical(names)===canonical(dependency?expected.slice(0,names.length):expected),'RC2 participant manifest mismatch');
  for(const id of CORE)assert(names.includes(id),'Missing RC2 participant '+id);
  // Preflight every registered validator before any Game/participant mutation.
  const registered=new Map(game._v10CheckpointParticipants.map(p=>[p.id,p]));
  for(const row of s.participants)registered.get(row.id)?.validate?.(row.state,{data:s.data,participants:s.participants,dependency});
  const get=id=>s.participants.find(p=>p.id===id).state;
  game._rb6FinalDamage.validate(get(CORE[0]));
  game._fh1FirstHp.validateAggregate(s.participants);
  game._rb4PaidLifecycle.validateAggregate(s.participants);
  game._hb1Healing.validate(get(CORE[4]),s.data);
  game._rc2Command.validateAggregate(get(CORE[5]),s.data);
  const cls=s.participants.find(p=>p.id==='class-combat')?.state;
  if(cls){
   assert(cls.version==='v10-class-combat-rc2-unified-1'&&cls.battleId===game.battleId,'Foreign RC2 class owner');
   const live=game._v10CheckpointParticipants.find(p=>p.id==='class-combat').capture();
   assert(Array.isArray(cls.states)&&cls.states.length===live.states.length&&new Set(cls.states.map(x=>x.unitId)).size===cls.states.length,'Invalid class owner roster');
   for(const row of cls.states)assert(live.states.some(x=>x.unitId===row.unitId&&x.classId===row.classId&&x.tier===row.tier),'Class source owner mismatch');
   for(const r of get(CORE[4]).normalActions){
    const root=get(CORE[4]).roots.find(x=>x.rootActionId===r.rootActionId);
    const row=cls.states.find(x=>x.unitId===r.sourceId);
    const commit=cls.journal.find(x=>x.rootActionId===r.rootActionId&&x.phase==='commit'&&x.skillId==='normal_heal');
    assert(row&&commit&&commit.unitId===r.sourceId&&r.rootActionId.startsWith(`${game.battleId}:${r.sourceId}:class:`)&&root.originKind==='normal','Normal heal is not bound to class owner');
    const notes=cls.journal.filter(x=>x.rootActionId===r.rootActionId&&x.phase==='effect'&&x.skillId==='normal_heal');
    assert(notes.length===1,'Missing or duplicate normal class effect note');const note=notes[0];
    const explicitDerived=new Set(get(CORE[4]).derivedEvents.map(x=>x.healReceiptId));
    const heals=get(CORE[4]).heals.filter(x=>x.rootActionId===r.rootActionId&&x.targetId===r.targetId&&x.tick===root.tick&&!explicitDerived.has(x.id));
    // Class note.actual is the endpoint delta of the whole supportHeal call,
    // including its native emergency-case child, not just the normal receipt.
    // Explicit derivedHeal calls after that owner returns are excluded even
    // when they occur at the same tick and share the original root.
    const actual=heals.length?heals.at(-1).after-heals[0].before:0;
    assert(note.unitId===r.sourceId&&note.classId===row.classId&&note.targetId===r.targetId&&note.tick===root.tick&&note.actual===actual,'Normal class effect/healing endpoint mismatch');
   }
   for(const b of get(CORE[4]).barriers.filter(x=>x.explicitRootActionId&&x.eventId.startsWith(x.explicitRootActionId+':effect:'))){
    const receipt=cls.receipts.find(x=>x.eventId===b.eventId);
    const note=cls.journal.find(x=>x.eventId===b.eventId&&x.phase==='effect'&&x.effectKind==='shield');
    assert(receipt&&note&&note.unitId===b.sourceId&&note.targetId===b.targetId&&receipt.actual===b.grantedAmount,'Class shield/grant receipt mismatch');
   }
  }
  return true;
 }
 function restoreSnapshot(snapshot){
  assert(!dirty&&!restoring,'RC2 restore unavailable');
  const next=clone(snapshot);validateSnapshot(next);const before=captureGame(game);restoring=true;
  try{originalRestore(game,next);}
  catch(error){try{originalRestore(game,before);}catch(rollbackError){dirty=true;throw Object.assign(Error('RC2 rollback uncertain; owners blocked'),{cause:error,rollbackError});}throw error;}
  finally{restoring=false;}
 }
 function restoreComposite(saved,{reason},child){
  assert(!dirty&&!restoring,'RC2 composite unavailable');
  assert(saved?.schema==='ua2-ultimate-composite-host-1'&&saved.dependencies?.spear&&Object.keys(saved.dependencies).length===1,'Unsupported RC2 composite');
  validateSnapshot(saved.game);validateSnapshot(saved.dependencies.spear.host,{dependency:true});
  if(reason==='initialize')child.validatePrivateCheckpoint(saved.dependencies.spear);
  else assert(canonical(child.capturePrivateCheckpoint())===canonical(saved.dependencies.spear),'Cannot rewind changed child journal');
  const before=captureGame(game);
  try{restoreSnapshot(saved.game);if(reason==='initialize')child.adoptPrivateCheckpoint(saved.dependencies.spear);}
  catch(error){try{restoreSnapshot(before);}catch(rollbackError){dirty=true;throw Object.assign(Error('RC2 composite rollback uncertain; owners blocked'),{cause:error,rollbackError});}throw error;}
 }
 function assertExternal(){assertUsable();assert(active===0,'Cannot checkpoint an active RC2 owner');}
 bindInternalRestores(game,restoreSnapshot,restoreComposite);
 const api=Object.freeze({validateSnapshot,withOwner,assertUsable,assertExternal,
  seal(){assert(!sealed,'RC2 gate already sealed');sealed=ids();assert(new Set(sealed).size===sealed.length,'Duplicate owner installation');},
  exportCheckpoint(){assertExternal();assert(!game._v10SpearAdapter,'Use full composite checkpoint for private spear owner');return {schema:'rc2-public-checkpoint-1',game:captureGame(game)};},
  importCheckpoint(cp){assertExternal();assert(!game._v10SpearAdapter&&cp?.schema==='rc2-public-checkpoint-1','Use matching RC2 composite checkpoint');restoreSnapshot(cp.game);},
  status:()=>({active,restoring,dirty,sealed:!!sealed})});
 Object.defineProperty(game,'_rc2Contracts',{value:api});return api;
}

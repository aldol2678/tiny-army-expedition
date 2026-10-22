// Pure browser-safe reducers. The runtime owns the ledger, phase authority,
// actual engine outcome, gold/XP/fatigue settlement, and checkpoint/CAS safety.
import {allowsUnitFamily} from '../family-selection/contract.js';
import {createEncounter} from '../encounters/content.js';
import {EVENT_VERSION, EVENT_RNG_NAMESPACE, EVENT_COMBAT_RNG_NAMESPACE, EVENT_TRIAL_VALUES as V,
  EVENT_DEFINITIONS, EVENT_IDS, CAPTIVE_TYPES, clone, assert, freeze} from './registry.js';
export {EVENT_VERSION, EVENT_RNG_NAMESPACE, EVENT_COMBAT_RNG_NAMESPACE, EVENT_TRIAL_VALUES,
  EVENT_DEFINITIONS, EVENT_IDS, CAPTIVE_TYPES} from './registry.js';

export function createEventServices({services: R, content: C, digest}) {
  assert(typeof digest === 'function' && R && C, 'Deterministic digest, services and content are required');
  for (const name of ['snapshotOf','checkState','previewRelic','eligibleRelics','makeProviderOffer','previewEventGrant','applyEventGrant'])
    assert(typeof R[name] === 'function', `Event service capability missing: ${name}`);
  const pick = (items, scope) => items.length ? items[parseInt(digest([EVENT_RNG_NAMESPACE, scope]).slice(0, 8), 16) % items.length] : null;
  const snapshot = state => ({...R.snapshotOf(state), runId: state.runId, seed: String(state.seed), nextUnitId: state.nextUnitId ?? null});
  const seal = payload => freeze({...payload, offerHash: digest(payload)});
  function verifyHash(offer) {
    assert(offer && typeof offer === 'object', 'Missing frozen event offer');
    const {offerHash, ...payload} = offer;
    assert(typeof offerHash === 'string' && digest(payload) === offerHash, 'Frozen event contents changed');
  }
  function conditions(state, amount) {
    return state.roster.map(unit => {
      const after = Math.max(0, Math.min(100, unit.condition + amount));
      return {unitId: unit.id, before: unit.condition, after, delta: after - unit.condition,
        reserve: unit.slot === null || unit.slot === undefined || unit.slot < 0};
    });
  }
  const total = changes => changes.reduce((sum, x) => sum + x.delta, 0);
  const grantPreview = (state, grant) => grant ? R.previewEventGrant(state, grant) : {valid: false, reason: 'No legal useful fixed grant is available; no replacement or reroll'};
  function relicGrant(state, rarity, scope, preferred = null) {
    const pool = R.eligibleRelics(state, rarity).filter(id => R.previewRelic(state, id).currentUtility === true).sort();
    const id = preferred && pool.includes(preferred) ? preferred : pick(pool, scope);
    return id ? {kind: 'relic', relic: {id, evolution: 1}} : null;
  }
  function grantName(grant) {
    if (!grant) return '받을 수 있는 고정 보상 없음';
    return grant.kind === 'relic' ? `${R.RELICS[grant.relic.id]?.name || grant.relic.id} I`
      : `${C.TYPES[grant.type]?.name || grant.type} 1명 (예비대, 훈련 0)`;
  }
  function combat(state, node, eventId, choiceId, kind, specialGrant = null, special = false) {
    const encounterRow = Math.max(1, Math.min(6, Math.floor(node.row)));
    return {eventId, choiceId, encounterKind: kind, milestoneOrigin: 'event',
      rngNamespace: EVENT_COMBAT_RNG_NAMESPACE, encounterRow,
      encounter: createEncounter(state.chapter, {kind, row: encounterRow}),
      ...clone(V.encounterEconomy[kind]),
      candidateBalance: true, trialConfigVersion: V.version,
      rewardMode: special ? 'event-special-replacement' : 'ordinary',
      specialGrant: clone(specialGrant), ordinaryRewardSelectionBudget: special ? 0 : 1,
      eventRewardSelectionBudget: special ? 1 : 0,
      settlementAuthority: 'actual-engine-victory-only',
      advancesMilestone: false, grantsGuaranteedKey: false, grantsAwakeningPreparation: false};
  }
  function makeEventOffer(state, node) {
    R.checkState(state);
    assert(!state.campaignComplete && Number.isInteger(state.chapter) && state.chapter >= 1 && state.chapter <= 5, 'No active event chapter');
    assert(typeof state.runId === 'string' && state.runId.length && node?.kind === 'event' && typeof node.id === 'string' && Number.isFinite(node.row), 'A genuine identified event node is required');
    const eventId = `event:${digest([EVENT_VERSION, state.runId, String(state.seed), state.chapter, node.id]).slice(0, 32)}`;
    const definitionId = node.eventDefinitionId ?? pick(EVENT_IDS, [String(state.seed), state.chapter, node.id, 'definition']);
    const definition = EVENT_DEFINITIONS[definitionId];
    assert(definition, 'Unknown event definition');
    const selectionScope = [String(state.seed), state.chapter, node.id, definitionId];
    const choices = [];
    const add = (suffix, name, details = {}) => {
      const choice = {id: `${eventId}:${suffix}`, choiceId: `${eventId}:${suffix}`, kind: 'event-choice', name,
        goldCost: 0, goldGranted: 0, xp: 0, disabled: false, reason: '', ...details};
      choice.affordable = state.gold >= choice.goldCost;
      choice.affordabilityReason = choice.affordable ? '' : `${choice.goldCost}G 필요, 현재 ${state.gold}G`;
      choice.goldBefore = state.gold;
      choice.goldAfter = choice.affordable ? state.gold - choice.goldCost + choice.goldGranted : null;
      choices.push(choice); return choice;
    };
    if (definition.providerKind) {
      const providerOffer = R.makeProviderOffer(state, node, {eventId, definitionId, providerKind: definition.providerKind});
      const names = {trainer: '훈련 상담', field_forge: '단조 대상 보기', strategist: '연구 비교: 20G'};
      add('provider', names[definitionId], {next: 'provider', providerKind: definition.providerKind, providerOffer,
        preview: {entryGrantsNothing: true, entryGoldCost: 0, fixedStock: !providerOffer.trainingAccess, ...(providerOffer.trainingAccess?{initialStockFixed:true,preparationExtension:'paid-original-training-newly-eligible-same-unit-once'}:{}),
          prices: clone(V.providerPrices), onlyThisVisit: true, stock: clone(providerOffer.choices)}});
      add('leave', '지나간다', {next: 'complete', leave: true});
    } else if (definitionId === 'treasure') {
      const safe = relicGrant(state, 'common', [...selectionScope, 'safe'], 'long_sight');
      const rare = relicGrant(state, 'rare', [...selectionScope, 'guarded']);
      const safePreview = grantPreview(state, safe), rarePreview = grantPreview(state, rare);
      add('safe', `작은 상자: ${grantName(safe)}`, {next: 'complete', grant: safe, preview: safePreview,
        disabled: !safePreview.valid, reason: safePreview.reason || ''});
      const battle = add('fight', `정예 도전: ${grantName(rare)}`, {next: 'battle', grant: rare, preview: rarePreview,
        disabled: !rarePreview.valid, reason: rarePreview.reason || ''});
      battle.combat = combat(state, node, eventId, battle.id, 'elite', rare, true);
    } else if (definitionId === 'prisoner') {
      const type = pick(CAPTIVE_TYPES.filter(type=>allowsUnitFamily(state,type)), [...selectionScope, 'captive']);
      const grant = type ? {kind: 'recruit', type, count: 1, training: 0, trainingTrack: null, condition: 100, slot: null} : null;
      const preview = grantPreview(state, grant);
      const battle = add('fight', `구출 전투: ${grantName(grant)}`, {next: 'battle', grant, preview,
        disabled: !preview.valid, reason: preview.reason || ''});
      battle.combat = combat(state, node, eventId, battle.id, 'normal', grant, true);
      add('ransom', `몸값 ${V.prisonerRansomGold}G: ${grantName(grant)}`, {next: 'complete', grant,
        goldCost: V.prisonerRansomGold, preview, disabled: !preview.valid, reason: preview.reason || ''});
    } else if (definitionId === 'ambush') {
      const kind = node.eventEncounterKind ?? pick(['normal', 'elite', 'boss'], [...selectionScope, 'strength']);
      assert(['normal', 'elite', 'boss'].includes(kind), 'Unknown event encounter strength');
      const battle = add('fight', `${{normal: '일반', elite: '정예', boss: '보스'}[kind]} 전투`, {next: 'battle'});
      battle.combat = combat(state, node, eventId, battle.id, kind);
      const changes = conditions(state, -V.ambushEscapeCondition);
      add('escape', `도주: 전원 컨디션 최대 ${V.ambushEscapeCondition} 손실`, {next: 'complete', escape: true,
        conditionDelta: -V.ambushEscapeCondition, actualConditionChanges: changes,
        totalActualConditionDelta: total(changes), preview: {scope: V.escapeScope, beforeBattleCommitmentOnly: true,
          knockout: false, extraKnockoutCost: 0, reserveVictoryRecovery: 0, wins: 0, battleRewards: 0, interest: 0}});
    } else if (definitionId === 'supplies') {
      const changes = conditions(state, V.suppliesConditionRecovery);
      add('recover', `치료: 컨디션 최대 +${V.suppliesConditionRecovery}`, {next: 'complete',
        conditionDelta: V.suppliesConditionRecovery, actualConditionChanges: changes,
        totalActualConditionDelta: total(changes), disabled: total(changes) === 0,
        reason: total(changes) === 0 ? '전원 컨디션이 가득 차 회복할 수 없습니다.' : ''});
      add('sell', `군수품 매각: +${V.suppliesGold}G`, {next: 'complete', goldGranted: V.suppliesGold,
        preview: {explicitEventGrant: true, oneShot: true, notCombatIncome: true, notInterest: true}});
    } else if (definitionId === 'scout') {
      const recovery = conditions(state, V.scoutConditionRecovery), cost = conditions(state, -V.scoutConditionCost);
      add('rest', `휴식: 컨디션 최대 +${V.scoutConditionRecovery}`, {next: 'complete', conditionDelta: V.scoutConditionRecovery,
        actualConditionChanges: recovery, totalActualConditionDelta: total(recovery), existingDefinition: 'E01:shade'});
      assert(Number.isFinite(C.CONDITION?.preparedDamageBonus) && Number.isFinite(C.CONDITION?.preparedDuration), 'Existing prepared consumer definition is required');
      add('scout', `정찰: 전원 컨디션 최대 ${V.scoutConditionCost} 손실, 다음 전투 준비`, {next: 'complete',
        conditionDelta: -V.scoutConditionCost, actualConditionChanges: cost, totalActualConditionDelta: total(cost),
        prepared: true, existingDefinition: 'E01:scout',
        disabled: state.prepared === true, reason: state.prepared === true ? '이미 다음 전투 준비가 되어 있습니다.' : '',
        preview: {preparedBefore: state.prepared === true, preparedAfter: true, stackable: false,
          scope: 'next-actual-battle-only', damageBonus: C.CONDITION.preparedDamageBonus,
          durationSeconds: C.CONDITION.preparedDuration, consumedOnBattleFinish: true}});
    }
    assert(choices.length === 2, 'Every event must freeze exactly two choices');
    const savedSnapshot = snapshot(state);
    // A utility close is not a third event reward and never bypasses ambush cost.
    const safeCloseAllowed = definitionId === 'prisoner' || definitionId === 'treasure' && choices.some(c => c.disabled || !c.affordable);
    return seal({id: eventId, eventId, contentVersion: EVENT_VERSION, definitionVersion: EVENT_VERSION,
      definitionId, name: definition.name, text: definition.text, chapter: state.chapter, node: clone(node),
      snapshot: savedSnapshot, snapshotHash: digest(savedSnapshot), startingGold: state.gold,
      choices, selectionBudget: 1, safeCloseAllowed,
      trialConfig: clone(V), candidateBalance: true, visitGrantsNothing: true,
      grantPolicy: 'one-choice-only-no-reroll-no-fallback-no-permanent-unlock',
      repeatSafetyAuthority: 'core-event-ledger-and-CAS'});
  }
  function validateOffer(offer) {
    verifyHash(offer);
    assert(offer.contentVersion === EVENT_VERSION && offer.definitionVersion === EVENT_VERSION && offer.id === offer.eventId
      && EVENT_DEFINITIONS[offer.definitionId] && offer.node?.kind === 'event' && offer.selectionBudget === 1,
    'Invalid event identity or version');
    assert(offer.choices?.length === 2 && new Set(offer.choices.map(c => c.id)).size === 2
      && offer.choices.every(c => c.choiceId === c.id) && digest(offer.snapshot) === offer.snapshotHash,
    'Invalid frozen event choices or snapshot');
    assert(digest(offer.trialConfig) === digest(V), 'Event trial configuration changed');
  }
  function receiptFor(offer, choice) {
    return {eventId: offer.eventId, definitionId: offer.definitionId, definitionVersion: offer.definitionVersion,
      nodeId: offer.node.id, choiceId: choice?.id ?? null, offerHash: offer.offerHash,
      selectionBudgetUsed: 1, goldCost: 0, goldGranted: 0, xp: 0, battles: 0, wins: 0,
      rewards: 0, interest: 0, milestoneOrigin: 'event', candidateBalance: true};
  }
  function applyEventChoice(state, offer, choiceId) {
    validateOffer(offer); R.checkState(state);
    assert(!state.pendingBattle && !state.eventResolution && !state.campaignComplete
      && (state.phase === undefined || state.phase === 'event'), 'Event choice unavailable after battle commitment or campaign end');
    assert(state.chapter === offer.chapter && digest(snapshot(state)) === offer.snapshotHash, 'Event preview snapshot changed; fixed choices cannot be rerolled');
    if (choiceId === null) {
      assert(offer.safeCloseAllowed, 'This event has no free safe-close alternative');
      return {state: clone(state), receipt: {...receiptFor(offer, null), safeClose: true, grantsNothing: true}, next: 'complete'};
    }
    const choice = offer.choices.find(c => c.id === choiceId);
    assert(choice && !choice.disabled, choice?.reason || 'Unknown or unavailable event choice');
    assert(Number.isSafeInteger(choice.goldCost) && choice.goldCost >= 0 && state.gold >= choice.goldCost,
      `Event choice requires ${choice?.goldCost ?? '?'}G`);
    const receipt = receiptFor(offer, choice);
    if (choice.next === 'provider') return {state: clone(state), receipt: {...receipt, providerKind: choice.providerKind,
      entryGrantsNothing: true}, next: 'provider', providerKind: choice.providerKind, providerOffer: clone(choice.providerOffer)};
    if (choice.next === 'battle') {
      if (choice.grant) assert(grantPreview(state, choice.grant).valid, 'Fixed special reward is no longer legal');
      return {state: clone(state), receipt: {...receipt, battleCommitted: true, settlementPending: true}, next: 'battle', combat: clone(choice.combat)};
    }
    let next = clone(state), effect = null;
    if (choice.grant) {
      assert(grantPreview(next, choice.grant).valid, 'Fixed event grant is no longer legal');
      const applied = R.applyEventGrant(next, clone(choice.grant), {eventId: offer.eventId, choiceId: choice.id});
      next = applied.state; effect = applied.receipt;
    }
    if (choice.conditionDelta !== undefined) {
      const changes = conditions(next, choice.conditionDelta);
      assert(digest(changes) === digest(choice.actualConditionChanges), 'Condition preview no longer matches actual changes');
      for (const change of changes) next.roster.find(u => u.id === change.unitId).condition = change.after;
      effect = {actualConditionChanges: changes, totalActualConditionDelta: total(changes), scope: 'all-owned-including-reserve', knockout: false};
    }
    if (choice.prepared) next.prepared = true;
    assert(Number.isSafeInteger(choice.goldGranted) && choice.goldGranted >= 0
      && (!choice.goldGranted || offer.definitionId === 'supplies' && choice.goldGranted === V.suppliesGold), 'Invalid explicit event currency grant');
    next.gold = next.gold - choice.goldCost + choice.goldGranted;
    R.checkState(next);
    return {state: next, receipt: {...receipt, goldCost: choice.goldCost, goldGranted: choice.goldGranted,
      eventGrant: choice.grant ? clone(choice.grant) : choice.goldGranted ? {kind: 'gold', amount: choice.goldGranted} : null,
      prepared: choice.prepared === true, escaped: choice.escape === true, effect}, next: 'complete'};
  }
  function makeCombatReward(state, offer, choiceId) {
    validateOffer(offer); R.checkState(state);
    const choice = offer.choices.find(c => c.id === choiceId);
    assert(choice?.next === 'battle' && choice.combat.rewardMode === 'event-special-replacement'
      && choice.combat.milestoneOrigin === 'event' && choice.grant, 'No special reward for this fixed event choice');
    assert(state.runId === offer.snapshot.runId && String(state.seed) === offer.snapshot.seed
      && state.chapter === offer.chapter && state.battleCount === offer.snapshot.battleCount + 1,
      'Special reward requires the one associated victory settlement');
    const preview = grantPreview(state, choice.grant), id = `${offer.eventId}:reward`, savedSnapshot = snapshot(state);
    const original = [{id: `${id}:grant`, candidateId: `${id}:grant`, slot: 0,
      kind: choice.grant.kind, name: grantName(choice.grant), grant: clone(choice.grant), preview,
      disabled: !preview.valid, reason: preview.reason || '', goldCost: 0}];
    return seal({id, contentVersion: EVENT_VERSION, mode: 'event-special-replacement',
      eventId: offer.eventId, choiceId, definitionId: offer.definitionId, sourceOfferHash: offer.offerHash,
      battleNumber: state.battleCount, original, reroll: null, rerolled: false, selectionBudget: 1,
      snapshot: savedSnapshot, snapshotHash: digest(savedSnapshot), chapter: state.chapter,
      ordinaryRewardSelectionBudget: 0, skipAllowed: true, candidateBalance: true,
      grant: clone(choice.grant), permanentUnlocksGranted: false});
  }
  function validateCombatReward(state, reward) {
    verifyHash(reward); R.checkState(state);
    assert(reward.contentVersion === EVENT_VERSION && reward.mode === 'event-special-replacement'
      && reward.selectionBudget === 1 && reward.original?.length === 1 && reward.reroll === null && reward.rerolled === false
      && reward.ordinaryRewardSelectionBudget === 0, 'Invalid special event reward');
    assert(state.chapter === reward.chapter && state.battleCount === reward.battleNumber
      && digest(reward.snapshot) === reward.snapshotHash && digest(snapshot(state)) === reward.snapshotHash,
    'Special reward snapshot changed');
    return true;
  }
  function applyCombatReward(state, reward, candidateId = null) {
    validateCombatReward(state, reward);
    const base = {rewardId: reward.id, eventId: reward.eventId, choiceId: reward.choiceId,
      mode: reward.mode, selectionBudgetUsed: 1, ordinaryRewardSelectionBudget: 0, goldCost: 0,
      goldGranted: 0, xp: 0, permanentUnlocksGranted: false};
    if (candidateId === null) return {state: clone(state), receipt: {...base, skipped: true, grant: null}};
    const candidate = reward.original.find(c => c.candidateId === candidateId);
    assert(candidate && !candidate.disabled && digest(candidate.grant) === digest(reward.grant), 'Unavailable fixed special reward; skip explicitly');
    assert(grantPreview(state, candidate.grant).valid, 'Fixed special reward no longer legal; skip explicitly');
    const applied = R.applyEventGrant(clone(state), clone(candidate.grant), {eventId: reward.eventId, choiceId: reward.choiceId});
    R.checkState(applied.state);
    return {state: applied.state, receipt: {...base, grant: clone(candidate.grant), effect: applied.receipt}};
  }
  return {version: EVENT_VERSION, definitions: EVENT_DEFINITIONS, trialValues: V,
    validateOffer, validateCombatReward, makeEventOffer, applyEventChoice, makeCombatReward, applyCombatReward};
}

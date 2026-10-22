import {createRB4Projection} from '../relic-batch-4/projection.js';
import {RB4_CAPABILITY} from '../relic-batch-4/registry.js';
import {assert, deepFreeze} from '../relic-services/registry.js';
import {
  RB5_CAPABILITY, RB5_VERSION, RB5_REGISTRY, RB5_BY_ID,
  RB5_IMPLEMENTED_IDS, RB5_BLOCKED_IDS, isRB5, value
} from './registry.js';

export function createRB5Projection(C, {capability = null} = {}) {
  assert(capability === null || capability === RB5_CAPABILITY, 'Unknown RB5 capability');
  const enabled = capability === RB5_CAPABILITY;
  const base = createRB4Projection(C, enabled ? {capability: RB4_CAPABILITY} : {});
  const RELICS = deepFreeze(Object.assign(Object.create(null), base.RELICS,
    enabled ? Object.fromEntries(RB5_REGISTRY.map(def => [def.id, def])) : {}));
  const supportedRelicIds = Object.freeze(Object.keys(RELICS));
  const blockedRelicIds = enabled ? RB5_BLOCKED_IDS : Object.freeze([]);
  const implementedRelicIds = Object.freeze(supportedRelicIds.filter(id => !blockedRelicIds.includes(id)));

  // The adapter owns lifetime/alive checks and all runtime state. This closure only
  // binds actual unit objects to a read-only numeric provider; IDs are never keys.
  const defenseProviders = new WeakMap();
  function bindRB5DefenseUnits(units, provider) {
    assert(enabled, 'RB5 defense binding requires test capability');
    assert(Array.isArray(units) && typeof provider === 'function', 'Unit array and defense provider required');
    const validated = Array.from(units, unit => {
      assert(unit && typeof unit === 'object' && !Array.isArray(unit), 'Unit object required');
      return unit;
    });
    // Validate the entire request before registration to avoid a partial binding.
    for (const unit of validated) defenseProviders.set(unit, provider);
  }
  function projectDefense(unit, projection, ...rest) {
    const provider = enabled && unit && typeof unit === 'object' ? defenseProviders.get(unit) : null;
    if (!provider) return base.projectDefense(unit, projection, ...rest);
    const relicFlatDef = provider(unit);
    assert(Number.isFinite(relicFlatDef) && relicFlatDef >= 0, 'Finite nonnegative RB5 defense required');
    if (relicFlatDef === 0) return base.projectDefense(unit, projection, ...rest);
    assert(projection && typeof projection === 'object' && !Array.isArray(projection) &&
      Array.isArray(projection.ledger), 'Defense projection ledger required');
    const ledger = projection.ledger.filter(entry =>
      !(entry.sourceId === 'relic:charge_sheath' && entry.effectId === 'charge_sheath:runtime-defense'));
    ledger.push({sourceId: 'relic:charge_sheath', effectId: 'charge_sheath:runtime-defense',
      category: 'relic', affectedField: 'defense', operation: 'flat_gain',
      value: relicFlatDef, applied: true, positiveCapKey: 'relicDefense'});
    // Preserve every inherited entry, including RB3 hit-local plate and training.
    // The unchanged projector applies shared D40 and all original defense rules.
    return base.projectDefense(unit, {...projection, ledger}, ...rest);
  }

  // Validate the outer boundary even while OFF, before delegating to frozen RB4.
  function normalizeRelics(relics = []) {
    assert(Array.isArray(relics), 'Relic array required');
    const seen = new Set();
    return Array.from(relics, relic => {
      assert(relic && typeof relic === 'object' && !Array.isArray(relic) &&
        Object.hasOwn(relic, 'id') && typeof relic.id === 'string' &&
        Object.hasOwn(RELICS, relic.id), 'Supported own string relic ID required');
      assert(!seen.has(relic.id), 'Duplicate relic ID');
      seen.add(relic.id);
      const def = RELICS[relic.id];
      for (const field of ['evolution', 'evolutionStage', 'stacks', 'rarity', 'intrinsicRarity', 'definitionVersion'])
        assert(!(field in relic) || Object.hasOwn(relic, field), 'Own relic fields required');
      for (const field of ['evolution', 'evolutionStage']) {
        assert(relic[field] === undefined || (Number.isInteger(relic[field]) &&
          relic[field] >= 1 && relic[field] <= def.maxEvolution), 'Invalid relic evolution');
      }
      assert(relic.evolution === undefined || relic.evolutionStage === undefined ||
        relic.evolution === relic.evolutionStage, 'Conflicting evolution');
      assert(relic.stacks === undefined || relic.stacks === 1, 'Duplicate stacking');
      assert((relic.rarity === undefined || relic.rarity === def.intrinsicRarity) &&
        (relic.intrinsicRarity === undefined || relic.intrinsicRarity === def.intrinsicRarity), 'Intrinsic rarity mismatch');
      assert(relic.definitionVersion === undefined || (typeof relic.definitionVersion === 'string' &&
        relic.definitionVersion === def.definitionVersion), 'Foreign relic definition');
      if (!isRB5(relic.id)) return base.normalizeRelic(relic);
      return {id: relic.id, rarity: def.intrinsicRarity,
        evolution: relic.evolution ?? relic.evolutionStage ?? 1, stacks: 1};
    });
  }

  // New action-local definitions never enter inherited static-stat paths.
  const filtered = options => ({...options,
    relics: normalizeRelics(options.relics === undefined ? [] : options.relics).filter(relic => !isRB5(relic.id))});
  return {
    ...base,
    RELICS,
    RELIC_LIST: Object.freeze(Object.values(RELICS)),
    supportedRelicIds,
    implementedRelicIds,
    blockedRelicIds,
    definitionCount: supportedRelicIds.length,
    implementedMechanismCount: implementedRelicIds.length,
    normalizeRelics,
    bindRB5DefenseUnits,
    projectDefense,
    normalizeRelic: relic => normalizeRelics([relic])[0],
    projectUnit: (unit, options = {}) => base.projectUnit(unit, filtered(options)),
    guardianLinks: (roster = [], options = {}) => base.guardianLinks(roster, filtered(options)),
    getRelicEffects: (relics = [], skills = []) =>
      base.getRelicEffects(normalizeRelics(relics).filter(relic => !isRB5(relic.id)), skills),
    ...(enabled ? {
      rb5Capability: RB5_CAPABILITY,
      rb5Status: deepFreeze({
        definitionCount: supportedRelicIds.length,
        inheritedImplementedMechanismCount: base.supportedRelicIds.length,
        newImplementedMechanismCount: RB5_IMPLEMENTED_IDS.length,
        implementedMechanismCount: implementedRelicIds.length,
        implementedIds: RB5_IMPLEMENTED_IDS,
        blockedIds: RB5_BLOCKED_IDS,
        reviewStatus: 'PENDING_REVIEW',
        balanceApproved: false,
        acquisitionEnabled: false
      })
    } : {})
  };
}

// Pure metadata preview, not a battle simulation, forge offer or measured benefit.
export function previewRB5Relic(C, state, id, evolution = 1) {
  assert(isRB5(id), 'Unknown RB5 ID');
  assert(state && typeof state === 'object' && !Array.isArray(state), 'Preview state required');
  const projection = createRB5Projection(C, {capability: RB5_CAPABILITY});
  const owned = projection.normalizeRelics(state.relics === undefined ? [] : state.relics);
  const previous = owned.find(relic => relic.id === id);
  const next = projection.normalizeRelics([...owned.filter(relic => relic.id !== id), {id, evolution}]);
  const def = RB5_BY_ID[id];
  return deepFreeze({
    version: RB5_VERSION,
    id,
    evolution,
    previousEvolution: previous?.evolution ?? null,
    definition: def,
    changes: [],
    conditional: true,
    notObservedBenefit: true,
    combatEffectObserved: false,
    staticProjectionChanges: false,
    canForge: false,
    acquisition: false,
    acquisitionEnabled: false,
    locked: def.locked,
    effectEnabled: def.effectEnabled,
    implementationStatus: def.implementationStatus,
    reviewStatus: def.reviewStatus,
    lockedReason: def.lockedReason,
    conditionalValues: {
      before: value(owned, id), after: value(next, id),
      unit: def.conditional.metric,
      eligibility: def.conditional.eligibility,
      limits: def.conditional.limits,
      consumption: def.conditional.consumption,
      testOnlyAssumptions: def.conditional.testOnlyAssumptions
    },
    definitionValues: {
      before: previous ? def.values[previous.evolution - 1] : 0,
      after: def.values[evolution - 1],
      prospectiveOnly: def.locked,
      effectiveWhileLocked: false
    },
    tradeoff: def.conditional.cost,
    reason: def.locked ? def.lockedReason :
      'TEST_ONLY conditional definition data pending review. The adapter must evaluate charge-root, full-mana, deployed-awakened snapshot, paid-commit, cap and consumption requirements. No observed benefit or forge eligibility is claimed.'
  });
}

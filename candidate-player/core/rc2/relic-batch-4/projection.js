import {createRB3Projection} from '../relic-batch-3/projection.js';
import {RB3_CAPABILITY} from '../relic-batch-3/registry.js';
import {assert, deepFreeze} from '../relic-services/registry.js';
import {RB4_CAPABILITY, RB4_VERSION, RB4_REGISTRY, RB4_BY_ID, isRB4, value} from './registry.js';

export function createRB4Projection(C, {capability = null} = {}) {
  assert(capability === null || capability === RB4_CAPABILITY, 'Unknown RB4 capability');
  const enabled = capability === RB4_CAPABILITY;
  const base = createRB3Projection(C, enabled ? {capability: RB3_CAPABILITY} : {});
  const RELICS = deepFreeze(Object.assign(Object.create(null), base.RELICS,
    enabled ? Object.fromEntries(RB4_REGISTRY.map(def => [def.id, def])) : {}));

  // The outer facade owns validation even while OFF, before any inherited lookup.
  // Valid baseline projections remain delegated byte-for-byte to the old facade.
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
      if (!isRB4(relic.id)) return base.normalizeRelic(relic);
      return {id: relic.id, rarity: def.intrinsicRarity,
        evolution: relic.evolution ?? relic.evolutionStage ?? 1, stacks: 1};
    });
  }

  const filtered = options => ({...options,
    relics: normalizeRelics(options.relics === undefined ? [] : options.relics).filter(relic => !isRB4(relic.id))});
  return {
    ...base,
    RELICS,
    RELIC_LIST: Object.freeze(Object.values(RELICS)),
    supportedRelicIds: Object.freeze(Object.keys(RELICS)),
    normalizeRelics,
    normalizeRelic: relic => normalizeRelics([relic])[0],
    projectUnit: (unit, options = {}) => base.projectUnit(unit, filtered(options)),
    guardianLinks: (roster = [], options = {}) => base.guardianLinks(roster, filtered(options)),
    getRelicEffects: (relics = [], skills = []) =>
      base.getRelicEffects(normalizeRelics(relics).filter(relic => !isRB4(relic.id)), skills),
    ...(enabled ? {rb4Capability: RB4_CAPABILITY} : {})
  };
}

// Definition preview, not a simulation, forge offer, or measured combat benefit.
export function previewRB4Relic(C, state, id, evolution = 1) {
  assert(isRB4(id), 'Unknown RB4 ID');
  assert(state && typeof state === 'object' && !Array.isArray(state), 'Preview state required');
  const projection = createRB4Projection(C, {capability: RB4_CAPABILITY});
  const owned = projection.normalizeRelics(state.relics === undefined ? [] : state.relics);
  const previous = owned.find(relic => relic.id === id);
  const next = projection.normalizeRelics([...owned.filter(relic => relic.id !== id), {id, evolution}]);
  const def = RB4_BY_ID[id];
  return deepFreeze({
    version: RB4_VERSION,
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
    conditionalValues: {
      before: value(owned, id), after: value(next, id),
      unit: def.conditional.metric,
      eligibility: def.conditional.eligibility,
      limits: def.conditional.limits,
      consumption: def.conditional.consumption,
      testOnlyAssumptions: def.conditional.testOnlyAssumptions
    },
    tradeoff: def.conditional.cost,
    reason: 'TEST_ONLY definition data; paid-commit/root-success eligibility, E/U caps and consumption must be evaluated by the adapter. No observed benefit or forge eligibility is claimed.'
  });
}

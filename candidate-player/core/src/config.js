// Isolated implementation trial. These are NOT approved production balance values.
export const TRIAL = Object.freeze({
  schemaVersion: 'v10-event-expedition-skeleton-save-1',
  generatorVersion: 'v10-parallel-event-map-1',
  mapRngNamespace: 'v10-variable-service-map-1', // Preserve C1 draws; original T1 facility draws, including its E02-to-shop repair. Added event draws use their own namespace.
  rulesVersion: 'v10-parallel-event-rules-1',
  configVersion: 'v10-variable-route-xp-trial-1',
  storageKey: 'tiny-army-v10-event-expedition-skeleton-e1',
  chapters: 5,
  xpByBattle: Object.freeze([3, 1, 1, 1, 1, 2, 1]),
  eliteXPBonus: 1, // Trial default only, not owner-approved balance.
  rewardPolicy: 'one-per-victory-except-final-boss',
  maxSaveBytes: 2 * 1024 * 1024,
  maxActions: 300,
});
export function deploymentCap(xp) { return xp >= 13 ? 9 : xp >= 9 ? 8 : xp >= 4 ? 7 : 6; }
// Frozen integration contract values from IMPLEMENTATION-BASELINE.md.
// Not used to grant resources or mutate units by this campaign skeleton.
export const INTEGRATION_TRIAL_VALUES = Object.freeze({
  baselineId: 'v10-trial-p0', releaseReady: false,
  rewardSlots: 3, selectionBudget: 1, rerollGold: 5, maxRerolls: 1,
  categoryWeights: Object.freeze({ recruit: 1, growth: 1, relic: 1 }), fallback: 'pass-zero-value',
  goldByEncounter: Object.freeze({ normal: 10, elite: 20, boss: 30 }),
  fatigueByEncounter: Object.freeze({ normal: 1, elite: 2, boss: 3 }), knockoutExtraFatigue: 4,
  startingReserveRecoveryOnWin: 6, optionalRestRecovery: 20, optionalRestGold: 0,
  awakeningMaxUnits: null, awakeningPreparationGold: 60, awakeningGold: 0, awakeningMinKeyEvolution: 1, awakeningConsumesKey: false,
});

// UA2 isolated experiment. These are TRIAL coefficients, not approved balance.
// No economy, identity registry, awakening prerequisite or production flag changes.
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const ULTIMATE_TRIAL_VERSION = 'ultimate-trial-config-ua2-1';
export const ULTIMATE_TRIAL_FLAGS = freeze({
  classification: 'TRIAL_NOT_FINAL_BALANCE',
  trialOnly: true,
  productionEnabled: false,
  releaseEligible: false,
  automatic: true,
  retargetAtResolve: false,
  redistributeFizzledBudget: false,
  allowEchoRefund: false,
  allowBasicAttackProcs: false,
  allowNormalHealProcs: false,
  allowCritical: false,
  allowBossPatternDelay: false,
});

export const ULTIMATE_TRIAL_CONFIG = freeze({
  id: 'ua2-independent-ultimate-effects-trial',
  version: ULTIMATE_TRIAL_VERSION,
  classification: ULTIMATE_TRIAL_FLAGS.classification,
  flags: ULTIMATE_TRIAL_FLAGS,
  ticksPerSecond: 60,
  readyTicks: 300,
  useLimitPerUnit: 1,
  maximumIntents: 12,
  maximumTargets: 3,
  threatHorizonTicks: 60,
  basicThreatHorizonTicks: 30,
  caps: { damageReduction: .55, slow: .25, mageSkillDamageBonus: .35, shieldBonus: .35 },
  geometry: {
    epsilon: .01,
    arena: { minX: 75, maxX: 830, minY: 128, maxY: 477 },
    rangedThreshold: 100,
    // Pinned spear-skills VARIANT_RULES. These are existing reach, not new boosts.
    counterRange: 80,
    pursuitRange: 110,
  },
  timing: {
    spear: { windupTicks: 15, recoveryTicks: 27, manaCost: 0 },
    archer: { windupTicks: 24, recoveryTicks: 18, manaCost: 0 },
    mage: { windupTicks: 21, recoveryTicks: 21, manaCost: 10 },
    support: { windupTicks: 18, recoveryTicks: 24, manaCost: 0 },
  },
  variants: {
    bastion: { maxTargets: 2, protectionAP: 1, rate: .2, durationTicks: 180 },
    sentinel: { maxTargets: 1, damageATK: .8, damageAP: 0, attackDelayTicks: 18, immunityTicks: 240 },
    vanguard: { maxTargets: 2, damageATK: .8, damageAP: 0, width: 35, slow: .15, slowDurationTicks: 60 },
    pursuer: { maxTargets: 2, damageATK: .5, damageAP: 0, slow: .2, totalSlowDurationTicks: 120 },
    marksman: { maxTargets: 1, damageATK: 1.2, damageAP: .3 },
    watcher: { maxTargets: 1, damageATK: .8, damageAP: .2, attackDelayTicks: 18, immunityTicks: 240, fallbackWaitTicks: 180 },
    skirmisher: { maxTargets: 2, damageATK: 1.2, damageAP: .3, width: 35 },
    suppressor: { maxTargets: 3, damageATK: .8, damageAP: .2, halfAngle: Math.PI / 6, slow: .15, slowDurationTicks: 60 },
    ember_tactician: { maxTargets: 3, damageATK: 0, damageAP: 1.2, radius: 45, durationTicks: 180, pulseOffsetsTicks: [0, 60, 120] },
    heat_warden: { maxTargets: 2, protectionAP: .9, rate: .2, width: 50, length: 120, durationTicks: 180 },
    frost_weaver: { maxTargets: 3, damageATK: 0, damageAP: .6, width: 50, length: 120, durationTicks: 180, slow: .2, slowDurationTicks: 60 },
    frost_binder: { maxTargets: 2, damageATK: 0, damageAP: .6, totalAttackDelayTicks: 36, immunityTicks: 240 },
    surgeon: { maxTargets: 2, healingAP: 1.6, healthThreshold: .5 },
    cleanser: { maxTargets: 2, healingAP: .8, maxCleansesPerTarget: 1, fallbackHealthThreshold: .35 },
    barrier_keeper: { maxTargets: 2, shieldAP: 1.6, durationTicks: 180 },
    ward_keeper: { maxTargets: 2, shieldAP: 1, durationTicks: 180, wardCharges: 1 },
  },
  deviations: [
    'All targets are frozen at commit. No optional v3 retarget, target refill or fizzled-share redistribution.',
    'Fire field uses three fixed pulses at resolve + 0/60/120 ticks; original targets must remain in the field.',
    'Frost boundary affects only its frozen initial targets, once; no newly entering target can enlarge its budget.',
    'Attack delay binds a public/current basic-attack sequence and never postpones boss patterns.',
    'No basic-attack, normal-heal or echo-refund proc amplification. Existing primary skill investments stay untouched.',
  ],
});

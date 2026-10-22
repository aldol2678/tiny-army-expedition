import {assert,deepFreeze} from '../relic-services/registry.js';
export const FH1_VERSION='first-hp-hit-fh1-1';
export const FH1_CAPABILITY='TEST_ONLY_FIRST_HP_HIT_FH1';
export const FH1_ARITHMETIC='v09-binary64-raw-shield-residual-endpoint-1';

// This engine uses IEEE-754 binary64 throughout HP resolution: no floor/round.
// Keep pre-HP-cap precision. Never reconstruct from integer or actual-HP damage.
export function evaluateFirstHpReduction({incoming,mitigated,absorbed,hpBefore,bonus,preProtectionMitigated=mitigated,protectionReduction=0}) {
  for(const [key,value] of Object.entries({incoming,mitigated,absorbed,hpBefore,bonus,preProtectionMitigated,protectionReduction}))
    assert(Number.isFinite(value)&&value>=0,'Finite nonnegative '+key+' required');
  assert(absorbed<=mitigated,'Barrier cannot absorb more than entering damage');
  const rawRemaining=Math.max(0,mitigated-absorbed);
  const baseDamage=Math.min(hpBefore,rawRemaining),baseHpAfter=Math.max(0,hpBefore-baseDamage);
  // The exact same R55 damage floor as the pinned protection pipeline.
  const damageFloor=.45*incoming;
  // Subtract the already allocated provider budget in its ORIGINAL arithmetic.
  // A saturated provider must remain saturated even if its amount rescaling adds one ULP.
  const originalHeadroom=Math.max(0,preProtectionMitigated-damageFloor);
  assert(protectionReduction<=originalHeadroom,'Prior protection exceeds R55 budget');
  const availableReduction=Math.min(Math.max(0,mitigated-damageFloor),Math.max(0,originalHeadroom-protectionReduction));
  const requestedReduction=incoming*bonus;
  assert(Number.isFinite(requestedReduction),'Finite requested reduction required');
  const allocatedReduction=Math.min(requestedReduction,availableReduction);
  const hypotheticalMitigated=allocatedReduction>0?Math.max(damageFloor,mitigated-allocatedReduction):mitigated;
  // No-barrier branch preserves the exact raw post-R amount without a divide/multiply round trip.
  const hypotheticalRemaining=allocatedReduction>0&&mitigated>0?
    absorbed===0?hypotheticalMitigated:rawRemaining*(hypotheticalMitigated/mitigated):rawRemaining;
  const hypotheticalDamage=Math.min(hpBefore,hypotheticalRemaining);
  const hypotheticalHpAfter=Math.max(0,hpBefore-hypotheticalDamage);
  const endpointBenefit=hypotheticalHpAfter-baseHpAfter;
  assert(hypotheticalRemaining>=0&&hypotheticalRemaining<=rawRemaining,'Monotone HP budget required');
  assert(endpointBenefit>=0,'Monotone HP endpoint required');
  // Reducing only overkill or an unobservable sub-ULP fraction is not a benefit.
  // Preserve ALL original damage arithmetic in that case; do not spend the token.
  const consumed=endpointBenefit>0;
  return deepFreeze({arithmetic:FH1_ARITHMETIC,incoming,mitigated,absorbed,hpBefore,bonus,preProtectionMitigated,protectionReduction,originalHeadroom,
    rawRemaining,baseDamage,baseHpAfter,damageFloor,availableReduction,requestedReduction,
    allocatedReduction,hypotheticalMitigated,hypotheticalRemaining,hypotheticalDamage,
    hypotheticalHpAfter,remaining:consumed?hypotheticalRemaining:rawRemaining,
    reportedDamage:consumed?hypotheticalDamage:baseDamage,
    hpAfter:consumed?hypotheticalHpAfter:baseHpAfter,hpBenefit:consumed?endpointBenefit:0,consumed});
}

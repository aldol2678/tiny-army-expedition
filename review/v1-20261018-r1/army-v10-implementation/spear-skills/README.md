# Spear skills: isolated executable P0 slice

Status: module implementation, NOT a playable game or a completed new class system. No file in tiny-army-sites or tiny-army-v09 was changed. No production build, release, save migration, deploy, or external communication was performed.

Profile: `v10-trial-p0`. Scope: guardian / charger only. Source contracts: army-v10-planning/IMPLEMENTATION-BASELINE.md §§5–6 and skill-implementation-contracts.md §§1–3.2, 4.1. All timing is fixed 60 Hz integer ticks. No random draws are introduced.

## Run

From workspace root:

    node --test army-v10-implementation/spear-skills/test.cjs

Tests load actual `tiny-army-sites/dist/js/content.js` and `v09-content.js` read-only via Node vm, rather than duplicating their training and relic formulas. Modules use `.cjs` so they can coexist with the campaign ESM package.

## Implemented behavior

- Existing guardian / charger IDs remain unchanged; tier 2 lists two skills and tier 3 retains both plus iron_oath. Unsupported families are rejected. Tier 1 charger can retain charge without charge_cover. Original projection, training track, slot, condition and identity are preserved.
- Explicit commit / windup / resolve / receipt settlement / recovery. No target means no resource, cooldown or ultimate spend. Both spear abilities cost zero mana by design. Cooldown and one-use ultimate are consumed once at commit and are not refunded on fizzle or cancellation.
- Normal attack availability is gated during action occupancy; its remaining attack timer is shifted, not reset. Movement must obey the same occupancy gate in a host integration. The module does not emit normal attacks or apply their relic bonuses again.
- Guardian guard uses actual strongest guardian-link beneficiaries supplied by the host, retains starting-slot adjacency and excludes guardian targets. Normal guard has one hit; iron_oath distributes the same AP × condition × .5 budget over at most three hits in two seconds. Protection remains `unit_skill/protection`, never shield or heal.
- Charge targets fixed ground with projected range/radius/damage/cooldown. It is physical, noncritical, and not a basic attack. Ultimate only moves .25 seconds from windup to recovery. Actual positive damage receipts unlock one charge-cover window and .25-second extra recovery. Empty or fully absorbed damage yields no cover. Handling defense-after remains available in the once-resolved record; no stat bonus is double-applied.
- Protection applies after legacy mitigation and before shields. It never increases combined ordinary mitigation beyond 55%. Only the strongest effective stance is consumed, ties use source ID. Zero prevention does not spend a hit or extend time. Death/link loss discards remaining protection.
- Root-event identifiers, exact-once settlement, bounded root trigger claims (three), and rejection of derived trigger chains. No unbounded proc recursion. State is JSON serializable, and reducers clone inputs.

## Host adapter contract

`adapter.cjs` exports `resolveThroughHost(state, host, tick)` and is exercised by an executable fixture. It does not monkey-patch a live engine.

1. Before creating state, call existing v09 projectUnit exactly once with the real roster, relics, training and condition. Pass its projected result to createUnitState. For new guardian guard cooldown, pass the existing ledger-derived unitCooldownCostFactor separately; existing projected charge cooldown must not receive CDR a second time.
2. The campaign must independently validate evolution + training II and optional chapter-4 tier-3 awakening (matching nonconsumed key, one per run). createUnitState checks supported branch/tier/training only; it is NOT an awakening authorization or campaign transaction validator.
3. host.snapshot() supplies units with stable ID, team, position, hp/maxHp, type, deployed and slot/startSlot; ally source state must remain a fixed deployment for a battle. Enemy units need no formation slot. Supply actual v09 guardianLinks in world.links and active foreign protection states in world.protections. Public telegraphTick and focusId are optional. No hidden future trajectory is inspected.
4. At each tick, process prior resolution events in stable `(resolveTick, sourceId, actionSeq, subeventIndex)` order before new commits. Resolve exactly on its scheduled tick. Process events sequentially and refresh the world after deaths. The host owns multi-unit ordering; this module is a per-unit reducer, not an entire battle scheduler.
5. host.applyDamageOnce(event) must durably journal eventId and atomically apply the damage through the legacy hit path, returning `{eventId, actualDamage}`. It must return the same receipt after retry or checkpoint restore. The amount is already projected. Forward original tags. Do not reapply ATK/AP, condition, basic-attack relics, critical RNG, or ultimate damage multipliers.
6. Acknowledge every damage event once on its resolve tick using acknowledgeEffects. Invalid/incomplete receipts are rejected. The pending state prevents another action until settlement. Root action journal, host HP and module state need a common checkpoint; a volatile Set is not sufficient for save safety. The fixture demonstrates the interface, not production persistence.
7. Apply handling temporaryDefense from lastResolved once per actionId, capped through the existing defense path. A real charge-relic hook must also claim its root trigger once. The reducer reports the existing training value; it does not change runtime DEF itself. Derived effects cannot claim new root procs.
8. Feed all participating module states to applyProtection after the existing DEF/link/commander calculation, before grantBarrier absorption. Update those states with its return. Refresh on death/link loss/expiry before exposing normal attack or movement availability. Command skills remain on their independent existing path.
9. Keep all state under the isolated v10-trial-p0 save boundary. This module neither accesses localStorage nor migrates v09 saves. BattleId may use campaign `runId:c{chapter}:nodeId`.

## Verified and unverified

19 Node tests passed initially; final log is test-results.txt. Coverage includes both training paths in both branches, inheritance, projection values, no-target atomicity, timer debt, normal/ultimate equal damage or protection budget, timing, reserves/death, fixed-ground fizzle, zero actual damage, replay, malformed receipts, strongest source/tie-break, cap, link loss, permutation/snapshot determinism, and real spear_tip/condition nonduplication.

Not implemented or verified: live engine scheduling and hit-hook insertion, actual movement lock, UI/cards/animations, persistent host receipt journal, campaign awakening transaction, new relic implementations or all-25 relic validation, normal attack simulation or DPS/win-rate balance, other six second-tier jobs, 35 real battles, full-run playability, production compatibility or save migration. Guardian_link itself deliberately remains the existing host implementation; the new slice consumes its result rather than replacing it.

Next feasible vertical slice: copy the v09 runner into a separate trial host; wire only these two branches' action occupancy, fixed-tick resolution, existing hit/DEF/barrier pipeline and journal; run short/long/empty-radius/death fixtures with real normal attacks before connecting campaign outcomes. Keep legacy branches in their legacy mode, with no invented second-/third-tier completion labels. Only then measure same-seed normal attack opportunity cost, charge-cover mitigation, handling defense, relic contribution and battle results. This is the missing step before any claim that the two new jobs are playable.

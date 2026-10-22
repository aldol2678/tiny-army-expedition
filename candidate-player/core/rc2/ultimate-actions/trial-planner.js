import { SECOND_CLASSES, CAPS } from '../progression/registry.js';
import { ULTIMATE_TRIAL_CONFIG } from './trial-config.js';

// Pure observation only: do not call Game.focusTarget(), refreshGuardianLinks(),
// projection builders, protection candidates or status mutation APIs here.
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const byId = (a, b) => typeof a.id === 'number' && typeof b.id === 'number'
  ? a.id - b.id : String(a.id).localeCompare(String(b.id), 'en');
const point = u => ({ x: u.x, y: u.y });
const freeze = x => {
  if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); }
  return x;
};
const copy = x => JSON.parse(JSON.stringify(x));
const held = reason => freeze({ allowed: false, reason });
const live = u => u && u.hp > 0 && Number.isFinite(u.x) && Number.isFinite(u.y);
const validId = id => Number.isSafeInteger(id) && id > 0 || typeof id === 'string' && id.length > 0;
const missingRatio = u => Math.max(0, 1 - u.hp / u.maxHp);
const healthOrder = (a, b) => a.hp / a.maxHp - b.hp / b.maxHp || byId(a, b);
const clampBonus = (n, cap) => Math.max(0, Math.min(cap, finite(n)));

/** Public JSON shape contract; the executor must recheck at every due effect. */
export function ultimateShapeContains(shape, target, epsilon = .01) {
  if (!shape || !target) return false;
  if (shape.kind === 'targets' || shape.kind === 'linked') return shape.targetIds.includes(target.id);
  if (shape.kind === 'target') return shape.targetId === target.id;
  if (shape.kind === 'circle') return distance(shape, target) <= shape.radius + epsilon;
  const origin = shape.origin ?? shape;
  const dir = shape.direction ?? { x: shape.dx, y: shape.dy };
  const norm = Math.hypot(dir.x, dir.y);
  if (!(norm > 0)) return false;
  const dx = target.x - origin.x, dy = target.y - origin.y;
  const along = (dx * dir.x + dy * dir.y) / norm;
  const across = Math.abs(dx * dir.y - dy * dir.x) / norm;
  if (shape.kind === 'cone') return along >= -epsilon && Math.hypot(dx, dy) <= (shape.range ?? shape.radius) + epsilon && Math.atan2(across, along) <= shape.halfAngle + 1e-9;
  if (shape.kind === 'segment' || shape.kind === 'rectangle') {
    const longitudinal = shape.centered ? Math.abs(along) <= shape.length / 2 + epsilon : along >= -epsilon && along <= shape.length + epsilon;
    return longitudinal && across <= shape.width / 2 + epsilon;
  }
  return false;
}
function patternContains(shape, target, epsilon) {
  if (shape?.kind === 'target') return shape.targetId === target.id && distance(shape.origin, target) <= shape.range + epsilon;
  return ultimateShapeContains(shape, target, epsilon);
}
function lineFrom(source, target, length, width, kind = 'segment') {
  const d = distance(source, target), dx = d ? (target.x - source.x) / d : 1, dy = d ? (target.y - source.y) / d : 0;
  return { kind, origin: point(source), direction: { x: dx, y: dy }, length, width };
}
function lineEndpoint(shape) {
  return { x: shape.origin.x + shape.direction.x * shape.length, y: shape.origin.y + shape.direction.y * shape.length };
}
function centeredRectangle(source, center, length, width) {
  const d = distance(source, center), dx = d ? (center.x - source.x) / d : 1, dy = d ? (center.y - source.y) / d : 0;
  return { kind: 'rectangle', origin: point(center), direction: { x: dx, y: dy }, length, width, centered: true };
}
function shares(total, count, weights = null) {
  if (!count) return [];
  const ws = weights ?? Array(count).fill(1), sum = ws.reduce((n, x) => n + x, 0);
  if (!(sum > 0)) return Array(count).fill(0);
  let used = 0;
  return ws.map((w, i) => { const n = i === count - 1 ? Math.max(0, total - used) : total * w / sum; used += n; return n; });
}
function barrierAmount(u, tick) { return u.barrier?.untilTick > tick ? Math.max(0, finite(u.barrier.amount)) : 0; }

/**
 * No mana/use/cooldown mutation. Host owns entitlement, action arbiter, paid
 * commit and planMageSecondary. Offsets are relative to commit, not resolve.
 * Requires actual deployed Game projections, never raw roster ATK/AP.
 */
export function planUltimate(game, rosterUnit, { statusAdapter = null, config = ULTIMATE_TRIAL_CONFIG, tick = game?.tickCount } = {}) {
  if (!game || game.phase !== 'battle') return held('battle-not-active');
  if (!Number.isSafeInteger(tick) || tick < 0) return held('invalid-tick');
  if (!config || config.classification !== 'TRIAL_NOT_FINAL_BALANCE' || config.flags?.productionEnabled !== false) return held('invalid-trial-config');
  const c = SECOND_CLASSES[rosterUnit?.secondClassId], v = config.variants?.[rosterUnit?.secondClassId];
  if (!c || !v || rosterUnit.classStage !== 3 || rosterUnit.type !== c.firstClassId || rosterUnit.training !== 2) return held('not-awakened');
  const source = game.units?.find(u => u.id === rosterUnit.id);
  if (!live(source)) return held('source-dead-or-not-deployed');
  if (source.deployed === false || !Number.isInteger(rosterUnit.slot) || rosterUnit.slot < 0 || rosterUnit.slot >= 12) return held('source-not-deployed');
  if (tick < config.readyTicks) return held('charging');
  const timing = config.timing?.[c.family];
  if (!timing) return held('missing-family-timing');
  if (![source.attackPower, source.abilityPower, source.conditionMultiplier].every(n => Number.isFinite(n) && n >= 0)) return held('invalid-projected-stats');
  if (!Number.isFinite(source.mana) && timing.manaCost > 0 || finite(source.mana) < timing.manaCost) return held('insufficient-mana');
  const eps = config.geometry.epsilon, windup = timing.windupTicks;
  const all = [...(game.units ?? []), ...(game.enemies ?? [])];
  if (all.some(u => !validId(u.id)) || new Set(all.map(u => u.id)).size !== all.length) return held('invalid-or-duplicate-target-ids');
  const allies = game.units.filter(u => live(u) && u.team === source.team && u.deployed !== false && u.maxHp > 0);
  const opponents = game.enemies.filter(u => live(u) && u.team !== source.team);
  const inRange = (u, range) => Number.isFinite(range) && range >= 0 && distance(source, u) <= range + eps;
  const priority = (a, b) => Number(b.id === game.focusTargetId && finite(game.focusUntilTick) > tick) - Number(a.id === game.focusTargetId && finite(game.focusUntilTick) > tick) || distance(source, a) - distance(source, b) || byId(a, b);
  const enemies = (range = source.range) => opponents.filter(e => inRange(e, range)).sort(priority);
  const basicTell = e => Number.isSafeInteger(e.publicAttackReadyTick) && e.publicAttackReadyTick >= tick && e.publicAttackReadyTick - tick <= config.threatHorizonTicks && e.publicAttackSequence === e.attacks;
  const nearestAlly = e => allies.slice().sort((a, b) => distance(e, a) - distance(e, b) || byId(a, b))[0];
  const rangedEnemy = e => e.range > config.geometry.rangedThreshold;
  function threats(target, { rangedOnly = false, horizon = config.threatHorizonTicks } = {}) {
    const out = [];
    for (const e of opponents) {
      if ((!rangedOnly || rangedEnemy(e)) && basicTell(e) && nearestAlly(e)?.id === target.id && distance(e, target) <= e.range + eps && e.publicAttackReadyTick <= tick + horizon)
        out.push({ tick: e.publicAttackReadyTick, sourceId: e.id, kind: 'basic' });
    }
    for (const tell of game.telegraphs ?? []) {
      const e = opponents.find(e => e.id === tell.owner?.id);
      if (!e || rangedOnly && !rangedEnemy(e) || !Number.isFinite(tell.left) || tell.left < 0) continue;
      const at = tick + Math.ceil(tell.left * config.ticksPerSecond - 1e-9);
      if (at <= tick + horizon && distance(tell, target) <= tell.radius + eps) out.push({ tick: at, sourceId: e.id, kind: 'pattern' });
    }
    for (const tell of game.encounterTelegraphs ?? []) {
      const e = opponents.find(e => e.id === tell.sourceId);
      const ranged = tell.ranged === true || ['cone', 'target'].includes(tell.shape?.kind);
      if (!e || rangedOnly && !ranged || !Number.isSafeInteger(tell.resolveTick) || tell.resolveTick < tick || tell.resolveTick > tick + horizon) continue;
      if (patternContains(tell.shape, target, eps)) out.push({ tick: tell.resolveTick, sourceId: e.id, kind: 'pattern' });
    }
    return out.sort((a, b) => a.tick - b.tick || byId({ id: a.sourceId }, { id: b.sourceId }));
  }
  const threatTick = u => threats(u)[0]?.tick ?? Infinity;
  const threatened = u => threats(u).length > 0 || opponents.some(e => distance(e, u) <= e.range + eps);
  const protectOrder = (a, b) => threatTick(a) - threatTick(b) || healthOrder(a, b);
  function statuses(u) {
    const list = statusAdapter?.statusesFor ? statusAdapter.statusesFor(u.id) : u.statuses ?? [];
    return list.filter(s => s.dispellable && (!Number.isFinite(s.expiresTick) || s.expiresTick > tick));
  }
  // Observational getters only, never protection candidates (which carry consume callbacks).
  const spearStates = game._v10SpearAdapter?.states ?? {};
  const classStates = typeof game._v10ClassCombat?.states === 'function' ? game._v10ClassCombat.states() : [];
  const ultimateGroups = typeof game.ultimateProtectionGroups === 'function' ? game.ultimateProtectionGroups() : [];
  function usefulProtection(u, rate, rangedOnly = false) {
    const guard = tick < finite(u.guardUntilTick) ? clampBonus(typeof game.commandGuardReduction === 'function' ? game.commandGuardReduction(u) : .2, config.caps.damageReduction) : 0;
    const remaining = Math.max(1 - config.caps.damageReduction, 100 / (100 + Math.max(0, finite(u.defense))) * (1 - guard));
    if (remaining <= 1 - config.caps.damageReduction + 1e-9) return false;
    const existing = Object.values(spearStates).flatMap(s => s.protections ?? []).filter(p => p.targetId === u.id && p.untilTick > tick && p.remainingBudget > 0 && p.hitsLeft > 0 && allies.some(a => a.id === p.sourceId));
    if (existing.some(p => p.rate >= rate)) return false;
    if (ultimateGroups.some(g => g.kind === 'protection' && g.untilTick > tick && g.remainingBudget > 0 && g.rate >= rate && g.targetIds.includes(u.id) && (!g.rangedOnly || rangedOnly) && allies.some(a => a.id === g.sourceId) && ultimateShapeContains(g.shape, u, eps) && (g.shape.kind !== 'linked' || game.formationLinks?.[u.id]?.sourceId === g.shape.sourceId))) return false;
    if (rangedOnly && classStates.some(s => s.field?.kind === 'heat' && s.field.until > tick && s.field.remainingBudget > 0 && .15 >= rate && distance(s.field, u) <= 50 + eps)) return false;
    return true;
  }
  const atk = source.attackPower * source.conditionMultiplier, ap = source.abilityPower * source.conditionMultiplier;
  const magicBonus = clampBonus(source.mageSkillDamageBonus, Math.min(CAPS.mageSkillDamageBonus, config.caps.mageSkillDamageBonus));
  const shieldBonus = clampBonus(source.shieldBonus, Math.min(CAPS.shieldBonus, config.caps.shieldBonus));
  const damageTotal = (atk * finite(v.damageATK) + ap * finite(v.damageAP)) * (c.family === 'mage' ? 1 + magicBonus : 1);
  const healingTotal = ap * finite(v.healingAP), shieldTotal = ap * finite(v.shieldAP) * (1 + shieldBonus);
  const protectionTotal = ap * finite(v.protectionAP);
  const intents = [], budgets = { damage: damageTotal, healing: healingTotal, shield: shieldTotal, protection: protectionTotal, slowDurationTicks: 0, attackDelayTicks: 0, cleanse: 0, wardCharges: 0, maxTargets: v.maxTargets, maxIntents: config.maximumIntents };
  let targets = [], shape = null, range = source.range, notes = [];
  const targetShape = ts => ({ kind: 'targets', targetIds: ts.map(t => t.id) });
  function add(kind, target, amount, extra = {}) {
    intents.push({ kind, sourceId: source.id, targetId: target.id, dueOffsetTicks: windup, amount, skillId: c.ultimateSkillId, variantId: c.id, ...(Number.isFinite(range) ? { range } : {}), shape: copy(shape), ...extra });
  }
  function damage(ts, total = damageTotal, offset = windup) {
    shares(total, ts.length).forEach((n, i) => { if (n > 0) add('damage', ts[i], n, { damageType: c.family === 'mage' ? 'magic' : 'physical', dueOffsetTicks: offset, sourceKind: c.family === 'mage' && v.pulseOffsetsTicks ? 'derived' : 'ultimate', derived: !!v.pulseOffsetsTicks, paidCast: false, noProc: true }); });
  }
  function slows(ts, totalTicks = null) {
    const durations = totalTicks === null ? ts.map(() => v.slowDurationTicks) : shares(totalTicks, ts.length);
    ts.forEach((t, i) => {
      const d = durations[i], current = (t.slows ?? []).filter(s => s.untilTick > tick).reduce((n, s) => Math.max(n, finite(s.value)), 0);
      const effective = Math.min(config.caps.slow, v.slow) * (t.type === 'boss' ? .5 : 1);
      if (effective > current + 1e-9 && !(t.slowImmuneUntilTick > tick)) {
        add('slow', t, v.slow * d, { value: v.slow, durationTicks: d, bossMultiplier: .5, maxSlow: config.caps.slow });
        budgets.slowDurationTicks += d;
      }
    });
  }
  function delays(ts, totalTicks = null) {
    const durations = totalTicks === null ? ts.map(() => v.attackDelayTicks) : shares(totalTicks, ts.length);
    ts.forEach((t, i) => {
      const immunity = Math.max(finite(t._v10SealImmuneUntil), finite(t._v10WatchImmuneUntil), finite(t._ua2DelayImmuneUntil));
      if (t.type === 'boss' || tick < immunity || t._v10FrostSeal || !Number.isSafeInteger(t.attacks)) return;
      if (t._ua2DelaySequence === t.attacks) return;
      add('attackDelay', t, durations[i] / config.ticksPerSecond, { durationTicks: durations[i], expectedAttackSequence: t.attacks, immunityTicks: v.immunityTicks, basicAttackOnly: true });
      budgets.attackDelayTicks += durations[i];
    });
  }
  function protection(ts, rangedOnly) {
    if (protectionTotal > 0) add('protection', ts[0], protectionTotal, { targetIds: ts.map(t => t.id), totalBudget: protectionTotal, sharedBudgetKey: 'protection', rate: v.rate, durationTicks: v.durationTicks, rangedOnly, cap: config.caps.damageReduction });
  }
  function heal(ts) {
    shares(healingTotal, ts.length, ts.map(missingRatio)).forEach((n, i) => { if (n > 0) add('heal', ts[i], n, { sourceKind: 'ultimate_special_heal', noProc: true }); });
  }
  function shieldCandidates(list) {
    // Discard impossible full-budget upgrades, then shrink one at a time so two
    // non-improving half shares can still become one useful full-budget rescue.
    let ts = list.filter(t => shieldTotal > barrierAmount(t, tick) + 1e-9).slice(0, v.maxTargets);
    while (ts.length) {
      const allocations = shares(shieldTotal, ts.length);
      const rejected = ts.map((t, i) => allocations[i] <= barrierAmount(t, tick) + 1e-9 ? i : -1).filter(i => i >= 0);
      if (!rejected.length) return ts;
      ts = ts.filter((_, i) => i !== rejected.at(-1));
    }
    return [];
  }
  function shields(ts) {
    shares(shieldTotal, ts.length).forEach((n, i) => add('shield', ts[i], n, { durationTicks: v.durationTicks, stacking: 'replace-only-if-stronger' }));
  }
  const cid = c.id;
  if (cid === 'bastion') {
    range = null;
    targets = allies.filter(u => u.id !== source.id && game.formationLinks?.[u.id]?.sourceId === source.id && threats(u).length && usefulProtection(u, v.rate)).sort(protectOrder).slice(0, v.maxTargets);
    shape = { kind: 'linked', sourceId: source.id, targetIds: targets.map(t => t.id), relationship: 'guardian-link' };
    if (targets.length) protection(targets, false);
  } else if (cid === 'sentinel') {
    range = config.geometry.counterRange;
    const attackers = new Set(allies.flatMap(u => threats(u)).map(t => t.sourceId));
    targets = enemies(range).filter(e => attackers.has(e.id)).slice(0, v.maxTargets);
    shape = targetShape(targets); damage(targets); delays(targets.filter(basicTell));
  } else if (cid === 'vanguard') {
    range = source.skill?.range;
    for (const anchor of enemies(range)) {
      const candidate = lineFrom(source, anchor, Math.min(range, distance(source, anchor)), v.width);
      const a = config.geometry.arena, p = lineEndpoint(candidate);
      if (p.x < a.minX || p.x > a.maxX || p.y < a.minY || p.y > a.maxY || (game.obstacles ?? []).some(o => ultimateShapeContains(o, p, eps))) continue;
      const hit = enemies(range).filter(e => ultimateShapeContains(candidate, e, eps)).slice(0, v.maxTargets);
      if (!hit.length) continue;
      targets = hit; shape = candidate;
      if (distance(source, p) > eps) add('move', source, distance(source, p), { destination: p, maxDistance: range, origin: point(source) });
      damage(targets); slows(targets); break;
    }
  } else if (cid === 'pursuer') {
    range = config.geometry.pursuitRange;
    const rear = allies.filter(u => u.row === 'back' || (u.startingSlot ?? u.slot) >= 8);
    targets = enemies(range).filter(e => e.speed > 0 && e.move > 0 && rear.length && rear.some(a => nearestAlly(e)?.id === a.id && distance(e, a) > e.range + eps)).slice(0, v.maxTargets);
    shape = targetShape(targets); damage(targets); slows(targets, v.totalSlowDurationTicks);
  } else if (cid === 'marksman') {
    targets = enemies().slice(0, v.maxTargets); shape = targetShape(targets); damage(targets);
  } else if (cid === 'watcher') {
    targets = enemies().filter(basicTell).slice(0, v.maxTargets);
    if (!targets.length && tick >= config.readyTicks + v.fallbackWaitTicks) { targets = enemies().slice(0, v.maxTargets); notes.push('damage-only-after-three-second-wait'); }
    shape = targetShape(targets); damage(targets); if (!notes.length) delays(targets);
  } else if (cid === 'skirmisher') {
    const anchor = enemies()[0];
    if (anchor) { shape = lineFrom(source, anchor, range, v.width); targets = enemies().filter(e => ultimateShapeContains(shape, e, eps)).slice(0, v.maxTargets); damage(targets); }
  } else if (cid === 'suppressor') {
    const anchor = enemies()[0];
    if (anchor) { const d = distance(source, anchor) || 1; shape = { kind: 'cone', origin: point(source), direction: { x: (anchor.x - source.x) / d, y: (anchor.y - source.y) / d }, range, halfAngle: v.halfAngle }; targets = enemies().filter(e => ultimateShapeContains(shape, e, eps)).slice(0, v.maxTargets); damage(targets); slows(targets); }
  } else if (cid === 'ember_tactician' || cid === 'frost_weaver') {
    const choices = enemies().map(anchor => {
      const s = cid === 'ember_tactician' ? { kind: 'circle', ...point(anchor), radius: v.radius } : centeredRectangle(source, anchor, v.length, v.width);
      const ts = enemies().filter(e => ultimateShapeContains(s, e, eps)).slice(0, v.maxTargets);
      return { anchor, shape: s, targets: ts };
    }).sort((a, b) => b.targets.length - a.targets.length || priority(a.anchor, b.anchor));
    if (choices.length) {
      ({ shape, targets } = choices[0]);
      if (cid === 'ember_tactician') {
        const totals = shares(damageTotal, v.pulseOffsetsTicks.length);
        v.pulseOffsetsTicks.forEach((offset, i) => damage(targets, totals[i], windup + offset));
      } else { damage(targets); slows(targets); }
    }
  } else if (cid === 'heat_warden') {
    const potential = allies.filter(u => inRange(u, range) && usefulProtection(u, v.rate, true) && (threats(u, { rangedOnly: true }).length || opponents.some(e => rangedEnemy(e) && distance(e, u) <= e.range + eps))).sort(protectOrder);
    const choices = potential.map(anchor => {
      const s = centeredRectangle(source, anchor, v.length, v.width);
      return { anchor, shape: s, targets: potential.filter(u => ultimateShapeContains(s, u, eps)).slice(0, v.maxTargets) };
    }).sort((a, b) => b.targets.length - a.targets.length || protectOrder(a.anchor, b.anchor));
    if (choices.length) { ({ shape, targets } = choices[0]); protection(targets, true); }
  } else if (cid === 'frost_binder') {
    targets = enemies().slice(0, v.maxTargets); shape = targetShape(targets); damage(targets); delays(targets, v.totalAttackDelayTicks);
  } else if (cid === 'surgeon' || cid === 'cleanser') {
    range = source.healRange;
    const patients = allies.filter(u => inRange(u, range)).sort(healthOrder);
    if (cid === 'surgeon') targets = patients.filter(u => u.hp / u.maxHp <= v.healthThreshold).slice(0, v.maxTargets);
    else {
      targets = patients.filter(u => statuses(u).length).slice(0, v.maxTargets);
      if (!targets.length) { targets = patients.filter(u => u.hp / u.maxHp <= v.fallbackHealthThreshold).slice(0, v.maxTargets); if (targets.length) notes.push('cleanse-opportunity-spent-on-emergency-heal'); }
    }
    shape = targetShape(targets);
    if (cid === 'cleanser' && !notes.length) targets.forEach(t => { add('cleanse', t, v.maxCleansesPerTarget, { max: v.maxCleansesPerTarget }); budgets.cleanse += v.maxCleansesPerTarget; });
    heal(targets);
  } else if (cid === 'barrier_keeper' || cid === 'ward_keeper') {
    range = source.shield?.range ?? source.healRange;
    targets = shieldCandidates(allies.filter(u => inRange(u, range) && (cid === 'barrier_keeper' ? threats(u).length : threatened(u))).sort(protectOrder));
    shape = targetShape(targets); shields(targets);
    if (cid === 'ward_keeper' && targets.length) {
      add('ward', targets[0], v.wardCharges, { targetIds: targets.map(t => t.id), totalBudget: v.wardCharges, sharedBudgetKey: 'ward', charges: v.wardCharges, durationTicks: v.durationTicks, requiresOwnedBarrier: true, tieBreak: 'stable-target-id' });
      budgets.wardCharges = v.wardCharges;
    }
  }
  if (!intents.length || !targets.length) return held('no-effective-target');
  const targetIds = [...new Set(targets.map(t => t.id))];
  if (targetIds.length > v.maxTargets || targetIds.length > config.maximumTargets || intents.length > config.maximumIntents) return held('invalid-plan-budget');
  if (intents.some(e => !Number.isFinite(e.amount) || e.amount < 0 || !Number.isSafeInteger(e.dueOffsetTicks) || !e.shape)) return held('invalid-plan-intent');
  return freeze({
    allowed: true,
    classification: config.classification,
    configId: config.id,
    configVersion: config.version,
    skillId: c.ultimateSkillId,
    variantId: cid,
    sourceId: source.id,
    windupTicks: timing.windupTicks,
    recoveryTicks: timing.recoveryTicks,
    manaCost: timing.manaCost,
    targetIds,
    intents,
    budgets,
    telegraph: { shape, targetIds, durationTicks: timing.windupTicks },
    resourcePolicy: { primarySpellPriority: c.family === 'mage', paidCastCount: timing.manaCost > 0 ? 1 : 0, echoRefund: false },
    statBasis: { projectedATK: source.attackPower, projectedAP: source.abilityPower, conditionMultiplier: source.conditionMultiplier, effectiveATK: atk, effectiveAP: ap, magicBonusApplied: c.family === 'mage' ? magicBonus : 0, shieldBonusApplied: v.shieldAP ? shieldBonus : 0, normalHealBonusApplied: 0 },
    resolvePolicy: { frozenTargetIds: true, retarget: false, redistribute: false, recheckRange: true, recheckShape: true, recheckImmunity: true },
    notes,
  });
}

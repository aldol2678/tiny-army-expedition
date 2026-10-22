// EV1 observation only. No engine, command, RNG, storage, clock or timer imports.
import {immutableCopy, invariant} from './data.js';

export const ENEMY_VIEW_VERSION = 'enemy-pattern-d2-e4-test-only-1';
export const ENEMY_HOST_CAPABILITY = 'enemy-pattern-host-eh1-test-only-1';
const VISIBLE_PHASES = ['announce', 'commit', 'resolve'];
const PHASES = [...VISIBLE_PHASES, 'waiting', 'cancelled', 'recovery', 'ended'];
const PHASE_LABELS = {announce: '예고', commit: '시전 확정', resolve: '판정 중'};
const PATTERNS = {
  EP02: {name: '치유병 견제', shape: 'target', skin: 'assassin-target'},
  EP03: {name: '직선 관통창', shape: 'segment', skin: 'line'},
  EP04: {name: '고정 부채 일제', shape: 'cone', skin: 'fan'},
  EP09: {name: '회복 저주', shape: 'target', skin: 'assassin-target'},
  EP10: {name: '쇠약', shape: 'target', skin: 'assassin-target'},
};
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const id = n => Number.isSafeInteger(n) && n > 0;
const stable = v => v && typeof v === 'object'
  ? Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
    : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  : JSON.stringify(v);
const same = (a, b) => stable(a) === stable(b);
const hidden = (data = {}) => immutableCopy({
  supported: false, battleId: null, tickCount: null, phase: 'waiting',
  telegraphs: [], error: null, hiddenReason: null, ...data,
});

// Asset choice only. A missing/out-of-range progress is not a timer starting at 0.
// Current EH1 has no normalizedProgress field, so it always chooses static assets.
export function selectEnemyAsset(skin, phase, progress, reducedMotion = false) {
  invariant(['line', 'fan', 'assassin-target'].includes(skin), 'Unknown BR2 skin');
  invariant(VISIBLE_PHASES.includes(phase), 'Nonvisible BR2 phase');
  const valid = typeof progress === 'number' && Number.isFinite(progress) && progress >= 0 && progress <= 1;
  let suffix = '-static', sample = null;
  if (!reducedMotion && valid) {
    if (phase === 'announce') {
      sample = Math.floor(progress * 4) / 4;
      suffix = '-p' + String(sample * 100).padStart(3, '0');
    } else suffix = '';
  }
  return Object.freeze({assetId: `br2-${skin}-${phase}${suffix}`, sample});
}

function validateGeometry(s) {
  invariant(s && typeof s === 'object', 'Missing host geometry');
  if (s.kind === 'segment') {
    invariant(point(s.origin) && point(s.direction) &&
      Math.abs(s.direction.x ** 2 + s.direction.y ** 2 - 1) <= 1e-12 &&
      Math.abs(s.origin.x) <= 1e6 && Math.abs(s.origin.y) <= 1e6 &&
      Number.isFinite(s.length) && s.length >= .001 && s.length <= 1e4 &&
      Number.isFinite(s.width) && s.width >= .001 && s.width <= 1e4 &&
      s.centered === false, 'Invalid host segment');
  } else if (s.kind === 'cone') {
    invariant(point(s) && [s.dx, s.dy, s.radius, s.halfAngle].every(Number.isFinite) &&
      Math.abs(s.dx ** 2 + s.dy ** 2 - 1) <= 1e-12 &&
      s.radius > 0 && s.halfAngle > 0 && s.halfAngle <= Math.PI, 'Invalid host cone');
  } else if (s.kind === 'target') {
    invariant(point(s) && point(s.origin) && id(s.targetId) &&
      Number.isFinite(s.range) && s.range > 0, 'Invalid host target');
  } else invariant(false, 'Unsupported EH1 shape');
}

// Forward geometry projection only. Does not import/read SVG geometry or hit-test.
export function enemyPrimitive(shape, liveTarget = null) {
  validateGeometry(shape);
  if (shape.kind === 'segment') {
    const o = shape.origin, d = shape.direction, w = shape.width / 2, l = shape.length;
    // The accepted segment direction is used verbatim, never renormalized.
    return immutableCopy({kind: 'polygon', points: [
      [o.x - d.y * w, o.y + d.x * w],
      [o.x + d.x * l - d.y * w, o.y + d.y * l + d.x * w],
      [o.x + d.x * l + d.y * w, o.y + d.y * l - d.x * w],
      [o.x + d.y * w, o.y - d.x * w],
    ]});
  }
  if (shape.kind === 'cone') return immutableCopy(shape);
  invariant(point(liveTarget), 'Explicit live target position required');
  // This fixed-size foot marker identifies a target. It is NOT a damage radius.
  return immutableCopy({kind: 'target-marker', targetId: shape.targetId, x: liveTarget.x, y: liveTarget.y,
    radiusX: 30, radiusY: 12, damageGeometry: false});
}

function readFrame(input, reducedMotion) {
  const frame = immutableCopy(input), s = frame.snapshot, p = frame.projection;
  invariant(frame.available === true && s && p && typeof s.battleId === 'string' &&
    s.battleId === p.battleId && Number.isSafeInteger(s.tickCount) && s.tickCount >= 0 &&
    s.tickCount === p.tickCount, 'Atomic enemy render frame required');
  const supported = s.encounter?.contentVersion === ENEMY_VIEW_VERSION && s.encounter?.testOnly === true;
  const base = {supported, battleId: s.battleId, tickCount: s.tickCount};
  if (!supported) return hidden(base);
  const owners = (s.integration || []).filter(x => x?.version === ENEMY_VIEW_VERSION);
  invariant(owners.length === 1 && owners[0].capability === ENEMY_HOST_CAPABILITY,
    'Explicit serialized EH1 host required');
  const view = s.encounterPattern;
  if (s.phase !== 'battle') return hidden({...base, phase: 'ended', hiddenReason: 'BATTLE_ENDED'});
  // The initial host has not published yet. It is not an announce.
  if (view == null) {
    invariant(!(s.encounterTelegraphs || []).length, 'Missing enemy view with live telegraph');
    return hidden(base);
  }
  invariant(PHASES.includes(view.phase), 'Unknown host enemy phase');
  invariant(same(view, owners[0].view), 'Host/published enemy view mismatch');
  const activeId = view.active?.actionId ?? null;
  if (!VISIBLE_PHASES.includes(view.phase) || view.cancelReason) {
    return hidden({...base, phase: view.cancelReason ? 'cancelled' : view.phase,
      actionId: activeId, hiddenReason: view.cancelReason || 'NO_ACTIVE_WARNING'});
  }
  invariant(Array.isArray(view.telegraphs) && view.telegraphs.length <= 1 &&
    same(view.telegraphs, s.encounterTelegraphs), 'Enemy view/telegraph mismatch');
  invariant(Array.isArray(s.units) && Array.isArray(s.enemies) &&
    s.units.length + s.enemies.length <= 100, 'Bounded actor snapshot required');
  invariant(view.telegraphs.length === 1 && view.active, 'Active enemy view required');
  const t = view.telegraphs[0], a = view.active, spec = PATTERNS[t.patternId];
  invariant(spec && t.battleId === s.battleId && typeof t.actionId === 'string' &&
    t.actionId.length <= 512 && t.actionId === a.actionId && t.patternId === a.pattern &&
    t.phase === view.phase && t.sourceId === a.ownerId && id(t.sourceId) &&
    t.targetId === a.targetId && same(t.shape, a.shape) && t.shape.kind === spec.shape,
    'Enemy action identity mismatch');
  validateGeometry(t.shape);
  const projected = p.encounterTelegraphs?.filter(x => x.id === t.actionId) || [];
  invariant(projected.length === 1 && projected[0].sourceId === t.sourceId &&
    projected[0].targetId === t.targetId && same(projected[0].shape, t.shape),
    'Enemy projection geometry/identity mismatch');
  const source = s.enemies.find(x => x.id === t.sourceId);
  if (!(source?.hp > 0)) return hidden({...base, phase: 'cancelled', actionId: activeId, hiddenReason: 'SOURCE_DEAD'});
  let liveTarget = null;
  if (t.shape.kind === 'target') {
    invariant(t.targetId === t.shape.targetId, 'Target marker identity mismatch');
    const target = s.units.find(x => x.id === t.targetId);
    if (!(target?.hp > 0)) return hidden({...base, phase: 'cancelled', actionId: activeId, hiddenReason: 'TARGET_DEAD'});
    invariant(point(t.liveTarget) && t.liveTarget.x === target.x && t.liveTarget.y === target.y,
      'Live target position mismatch');
    liveTarget = t.liveTarget;
  }
  const asset = selectEnemyAsset(spec.skin, t.phase, t.normalizedProgress, reducedMotion);
  const name = spec.name;
  return immutableCopy({...base, phase: t.phase, actionId: activeId, error: null, hiddenReason: null,
    telegraphs: [{actionId: t.actionId, patternId: t.patternId, sourceId: t.sourceId, targetId: t.targetId,
      phase: t.phase, shape: t.shape, primitive: enemyPrimitive(t.shape, liveTarget), liveTarget,
      assetId: asset.assetId, progressSample: asset.sample, reducedMotion,
      label: `${name} · ${PHASE_LABELS[t.phase]}${t.targetId ? ` · 대상 #${t.targetId}` : ''}`,
      targetIdentityOnly: t.shape.kind === 'target'}]});
}

export function createEnemyPresentationObserver() {
  let battleId = null, tick = -1, disposed = false, ended = false;
  let lastAction = null, retiredAction = null, phaseRank = -1, last = hidden();
  function reset() {
    battleId = null; tick = -1; ended = false; lastAction = null; retiredAction = null;
    phaseRank = -1; last = hidden();
  }
  function sample(frame, {reducedMotion = false} = {}) {
    if (disposed) return hidden({supported: true, hiddenReason: 'DISPOSED'});
    let next;
    try {
      next = readFrame(frame, reducedMotion === true);
      invariant(battleId === null || next.battleId === battleId, 'Enemy owner changed without reset');
      invariant(next.tickCount >= tick, 'Late enemy frame');
      if (battleId === null) battleId = next.battleId;
      const previousTick = tick; tick = next.tickCount;
      if (ended) return last = hidden({...next, telegraphs: [], hiddenReason: 'BATTLE_ENDED'});
      // An action ending is not the battle ending. The next host action may
      // legitimately announce later in the same battle.
      if (next.hiddenReason === 'BATTLE_ENDED') ended = true;
      if (!next.telegraphs.length) {
        if (lastAction) retiredAction = lastAction;
        return last = next;
      }
      invariant(next.actionId !== retiredAction, 'Retired enemy action');
      const rank = VISIBLE_PHASES.indexOf(next.phase);
      if (next.actionId === lastAction) invariant(rank >= phaseRank, 'Late enemy phase');
      else {
        invariant(lastAction === null || tick > previousTick, 'Same-tick enemy action replacement');
        phaseRank = -1;
      }
      lastAction = next.actionId; phaseRank = rank;
      return last = next;
    } catch (error) {
      // A malformed/stale frame removes EV1 warnings; no fallback harmful fill.
      return last = hidden({supported: true, battleId, tickCount: tick,
        error: 'ENEMY_PRESENTATION_UNAVAILABLE', hiddenReason: String(error.message).slice(0, 160)});
    }
  }
  return Object.freeze({sample, state: () => last, reset,
    dispose() { if (!disposed) { reset(); disposed = true; } }});
}

function trace(ctx, primitive) {
  ctx.beginPath();
  if (primitive.kind === 'polygon') {
    primitive.points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath();
  } else if (primitive.kind === 'cone') {
    const angle = Math.atan2(primitive.dy, primitive.dx);
    ctx.moveTo(primitive.x, primitive.y);
    ctx.arc(primitive.x, primitive.y, primitive.radius, angle - primitive.halfAngle, angle + primitive.halfAngle);
    ctx.closePath();
  } else {
    ctx.ellipse(primitive.x, primitive.y, primitive.radiusX, primitive.radiusY, 0, 0, Math.PI * 2);
  }
}

// Called once BELOW actors, inside the existing camera transform. sy is applied
// once here. No foreground labels, badges, CSS overlays or canvas size changes.
export function drawEnemyGround(ctx, state, {sy = 1} = {}) {
  invariant(Number.isFinite(sy) && sy > 0, 'Positive enemy vertical scale required');
  let count = 0;
  ctx.save();
  try {
    ctx.scale(1, sy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const t of state?.telegraphs || []) {
      const announce = t.phase === 'announce', resolve = t.phase === 'resolve';
      const color = announce ? '#bc5953' : resolve ? '#f6c772' : '#ee9861';
      if (!resolve && !t.targetIdentityOnly) {
        ctx.globalAlpha = announce ? .07 : .1; ctx.fillStyle = color;
        trace(ctx, t.primitive); ctx.fill();
      }
      ctx.globalAlpha = announce ? .95 : resolve ? .38 : 1;
      ctx.setLineDash(announce ? [7, 5] : []);
      const widths = announce ? [5, 2.8, 1] : resolve ? [2.6, 1.4, .6] : [6, 3.7, 1.5];
      for (const [i, stroke] of ['#fff9e7', '#203548', color].entries()) {
        ctx.lineWidth = widths[i]; ctx.strokeStyle = stroke; trace(ctx, t.primitive); ctx.stroke();
      }
      count++;
    }
  } finally { ctx.restore(); }
  return count;
}

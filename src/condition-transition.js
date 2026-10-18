/* Tiny Army v0.7.1: bounded, presentation-only condition changes.
 * Call only after the gameplay result is committed. No storage, RNG, rewards,
 * completion callbacks or state writes; static final semantics survive cancellation.
 */
(function (global) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => { let n; try { n = Number(value); } catch (_) { n = 0; } return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; };
  const number = value => String(Math.round(value * 10) / 10);
  function rows(data) {
    data = data || {};
    const result = [{key:'mean', label:'평균 컨디션', before:normalize(data.before), after:normalize(data.after)}];
    if (data.beforeMin != null && data.afterMin != null) result.push({key:'min', label:'최저 컨디션', before:normalize(data.beforeMin), after:normalize(data.afterMin)});
    return result;
  }
  function createController(host) {
    const doc = host.document, media = host.matchMedia?.('(prefers-reduced-motion: reduce)');
    let active = null, timer = null, disposed = false, scene = null;
    const art = () => host.TinyArmyConditionArt;
    const reduced = () => { const prefs = host.TinyArmyGraphics?.effective?.() || {}; return !!(media?.matches || prefs.reducedMotion || prefs.systemReducedMotion || prefs.uiAnimation === false); };
    function markup(data) {
      const values = rows(data), direction = values[0].after > values[0].before ? 'gain' : values[0].after < values[0].before ? 'loss' : 'same';
      return '<div class="ta-condition-transition condition-transition" data-direction="' + direction + '" aria-label="' + escape(data?.reason || '컨디션 변화') + '">' + values.map(row => {
        const delta = (Math.round(row.after * 10) - Math.round(row.before * 10)) / 10;
        const text = number(row.before) + ' → ' + number(row.after) + ' (' + (delta > 0 ? '+' : '') + number(delta) + ')';
        return '<div class="ta-condition-transition__row" role="meter" aria-label="' + row.label + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + row.after + '" aria-valuetext="' + row.label + ' ' + text + '">' +
          '<span class="ta-condition-transition__label">' + (row.key === 'mean' ? '평균' : '최저') + '</span>' +
          '<span class="ta-condition-transition__visual" data-condition-transition="' + row.key + '" aria-hidden="true">' + (art()?.svg(row.after, {compact:true}) || '') + '</span>' +
          '<span class="ta-condition-transition__delta" aria-hidden="true">' + text + '</span></div>';
      }).join('') + '</div>';
    }
    function draw(effect, progress) {
      for (const row of effect.rows) {
        const value = row.before + (row.after - row.before) * progress;
        const band = art().bandFor(value), width = value / 100 * 114;
        row.fill?.setAttribute('width', width.toFixed(3));
        row.fill?.setAttribute('fill', band.color);
        row.light?.setAttribute('d', 'M3 4.5h' + width.toFixed(3));
        row.light?.setAttribute('stroke', band.light);
      }
    }
    function clear() {
      if (timer !== null) host.clearTimeout(timer);
      timer = null;
      if (active) draw(active, 1);
      active = null;
    }
    function play(element, data) {
      clear();
      if (disposed || !element || !art()) return false;
      const values = rows(data).map(row => ({...row, node:element.querySelector('[data-condition-transition="' + row.key + '"]')})).filter(row => row.node);
      if (!values.length) return false;
      // Allocate once. Starting with a full track guarantees a fill node even
      // for zero→positive and positive→zero changes. Frames only edit attributes.
      for (const row of values) {
        row.node.innerHTML = art().svg(100, {compact:true});
        row.fill = row.node.querySelector('.ta-condition__fill');
        row.light = row.fill?.nextElementSibling;
      }
      const effect = {element, rows:values, frame:0};
      draw(effect, 1);
      if (doc?.hidden || element.isConnected === false || element.hidden || element.closest?.('[hidden]') || reduced() || values.every(row => row.before === row.after)) return false;
      active = effect;
      draw(effect, 0);
      function tick() {
        timer = null;
        if (active !== effect) return;
        if (disposed || doc?.hidden || element.isConnected === false || element.hidden || element.closest?.('[hidden]') || reduced()) { clear(); return; }
        effect.frame += 1;
        const progress = Math.min(1, effect.frame / 24);
        draw(effect, 1 - Math.pow(1 - progress, 3));
        if (progress === 1) { active = null; return; }
        timer = host.setTimeout(tick, 30);
      }
      timer = host.setTimeout(tick, 30);
      return true;
    }
    function setScene(next) { if (next !== scene) { clear(); scene = next; } }
    const visibility = () => { if (doc?.hidden) clear(); };
    const preferences = () => { if (reduced()) clear(); };
    doc?.addEventListener?.('visibilitychange', visibility);
    host.addEventListener?.('pagehide', clear);
    if (media?.addEventListener) media.addEventListener('change', preferences); else media?.addListener?.(preferences);
    const unsubscribe = host.TinyArmyGraphics?.subscribe?.(preferences);
    function destroy() {
      clear(); disposed = true;
      doc?.removeEventListener?.('visibilitychange', visibility);
      host.removeEventListener?.('pagehide', clear);
      if (media?.removeEventListener) media.removeEventListener('change', preferences); else media?.removeListener?.(preferences);
      if (typeof unsubscribe === 'function') unsubscribe();
    }
    return Object.freeze({markup, play, clear, setScene, destroy});
  }
  global.TinyArmyConditionTransition?.destroy?.();
  const api = createController(global);
  global.TinyArmyConditionTransition = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.freeze({...api, createController});
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* Tiny Army v0.5.1 visual preferences.
 * Independent of campaign saves, combat ticks and random-number generation.
 * Consumers scale only canvas backing pixels, never the 900 x 580 game space.
 */
(() => {
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'tiny-army-v051-graphics-v1';
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const choices = Object.freeze({
    renderScale: Object.freeze([0.75, 1, 1.25]),
    pixelRatioCap: Object.freeze([1, 1.5, 2]),
    particleAmount: Object.freeze([0, 0.5, 1])
  });
  const booleanFields = Object.freeze(['decorativeBackground', 'glow', 'uiAnimation', 'reducedMotion']);
  const fields = Object.freeze([...Object.keys(choices), ...booleanFields]);
  const presets = Object.freeze({
    low: Object.freeze({ renderScale: 0.75, pixelRatioCap: 1, particleAmount: 0, decorativeBackground: false, glow: false, uiAnimation: false, reducedMotion: false }),
    default: Object.freeze({ renderScale: 1, pixelRatioCap: 1.5, particleAmount: 0.5, decorativeBackground: true, glow: true, uiAnimation: true, reducedMotion: false }),
    high: Object.freeze({ renderScale: 1.25, pixelRatioCap: 2, particleAmount: 1, decorativeBackground: true, glow: true, uiAnimation: true, reducedMotion: false })
  });
  const labels = Object.freeze({
    low: '낮음', default: '균형', high: '높음', custom: '사용자 설정',
    renderScale: '화면 해상도', pixelRatioCap: '고해상도 화면 배율', particleAmount: '장식 입자',
    decorativeBackground: '배경 장식', glow: '광채 효과', uiAnimation: '화면 전환 효과', reducedMotion: '움직임 줄이기'
  });
  const listeners = new Set();
  let state = { version: VERSION, preset: 'default', ...presets.default };
  let storage = null, storageError = null, storageWriteBlocked = false, persistedState = null, mediaQuery = null, systemMotion = false;

  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fieldValid = (key, value) => own(choices, key) ? choices[key].includes(value) : booleanFields.includes(key) && typeof value === 'boolean';
  const snapshot = () => Object.freeze({ ...state });

  // A complete imported/stored record is all-or-nothing. No coercion or unknown
  // fields: a future schema must not silently overwrite the user's original.
  function validate(value) {
    try {
      const keys = ['version', 'preset', ...fields];
      if (!record(value) || Reflect.ownKeys(value).length !== keys.length || keys.some(key => !own(value, key))) return { valid: false, error: '그래픽 설정 형식이 올바르지 않아요.' };
      if (value.version !== VERSION || !['low', 'default', 'high', 'custom'].includes(value.preset)) return { valid: false, error: '지원하지 않는 그래픽 설정 버전이에요.' };
      if (fields.some(key => !fieldValid(key, value[key]))) return { valid: false, error: '그래픽 설정 값이 허용 범위를 벗어났어요.' };
      // Accessibility preference is independent of the selected quality preset.
      if (value.preset !== 'custom' && fields.some(key => key !== 'reducedMotion' && value[key] !== presets[value.preset][key])) return { valid: false, error: '그래픽 프리셋과 상세 설정이 일치하지 않아요.' };
      return { valid: true, value: Object.freeze({ version: VERSION, preset: value.preset, ...Object.fromEntries(fields.map(key => [key, value[key]])) }) };
    } catch (_) {
      return { valid: false, error: '그래픽 설정을 읽을 수 없어요.' };
    }
  }

  function systemReducedMotion() {
    try { if (mediaQuery && typeof mediaQuery.matches === 'boolean') systemMotion = mediaQuery.matches; } catch (_) { /* Keep the last usable accessibility preference. */ }
    return systemMotion;
  }

  function effective() {
    const systemReduced = systemReducedMotion(), reduced = systemReduced || state.reducedMotion;
    return Object.freeze({ ...state, systemReducedMotion: systemReduced, reducedMotion: reduced,
      uiAnimation: state.uiAnimation && !reduced, particleAmount: reduced ? 0 : state.particleAmount });
  }

  function notify() {
    const saved = snapshot(), active = effective();
    // One failing view must not interrupt persistence or another subscriber.
    for (const listener of [...listeners]) {
      try { listener(saved, active); } catch (_) { /* Presentation consumers are isolated. */ }
    }
  }

  function persist(force = false) {
    if (!storage) {
      storageError = '그래픽 설정을 저장할 수 없어 이번 창에서만 적용해요.';
      return false;
    }
    if (storageWriteBlocked && !force) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      persistedState = JSON.stringify(state);
      storageWriteBlocked = false;
      storageError = null;
      return true;
    } catch (_) {
      storageError = '그래픽 설정을 저장하지 못했어요. 이번 창에서는 계속 적용돼요.';
      return false;
    }
  }

  function commit(next, force = false) {
    if (!force && fields.every(key => state[key] === next[key]) && state.preset === next.preset) return { ok: true, persisted: !storageError && persistedState === JSON.stringify(state) };
    state = { ...next };
    const persisted = persist(force);
    notify();
    return { ok: true, persisted };
  }

  function set(value) {
    try {
      if (typeof value === 'string') {
        if (!own(presets, value)) return { ok: false, error: '알 수 없는 그래픽 프리셋이에요.' };
        // Raising quality never cancels an explicitly requested motion reduction.
        return commit({ version: VERSION, preset: value, ...presets[value], reducedMotion: state.reducedMotion });
      }
      if (!record(value)) return { ok: false, error: '그래픽 설정 형식이 올바르지 않아요.' };
      const keys = Reflect.ownKeys(value);
      if (keys.length === 1 && keys[0] === 'preset') return set(value.preset);
      if (!keys.length || keys.some(key => typeof key !== 'string' || !fields.includes(key) || !fieldValid(key, value[key]))) return { ok: false, error: '그래픽 설정 값이 허용 범위를 벗어났어요.' };
      if (keys.every(key => state[key] === value[key])) return { ok: true, persisted: !storageError && persistedState === JSON.stringify(state) };
      return commit({ ...state, ...Object.fromEntries(keys.map(key => [key, value[key]])), preset: 'custom' });
    } catch (_) {
      return { ok: false, error: '그래픽 설정을 적용할 수 없어요.' };
    }
  }

  // This explicit action is the only operation allowed to replace malformed or
  // unreadable stored graphics settings. It never reads/writes campaign keys.
  function reset() {
    return commit({ version: VERSION, preset: 'default', ...presets.default }, true);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Graphics subscriber must be a function.');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  try {
    storage = globalThis.localStorage || null;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') storage = null;
  } catch (_) { storage = null; }
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw !== null && raw !== undefined) {
        const result = typeof raw === 'string' && raw.length <= 4096 ? validate(JSON.parse(raw)) : { valid: false };
        if (result.valid) { state = { ...result.value }; persistedState = JSON.stringify(state); }
        else {
          storageWriteBlocked = true;
          storageError = '저장된 그래픽 설정을 읽지 못해 균형 설정을 사용해요. 원본은 초기화 전까지 보관해요.';
        }
      }
    } catch (_) {
      storageWriteBlocked = true;
      storageError = '저장된 그래픽 설정을 읽지 못해 균형 설정을 사용해요. 원본은 초기화 전까지 보관해요.';
    }
  } else storageError = '그래픽 설정을 저장할 수 없어 이번 창에서만 적용해요.';

  try {
    if (typeof globalThis.matchMedia === 'function') mediaQuery = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
    systemReducedMotion();
    const changed = event => {
      try { if (event && typeof event.matches === 'boolean') systemMotion = event.matches; } catch (_) { /* Fall back to the query. */ }
      notify();
    };
    if (mediaQuery && typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', changed);
    else if (mediaQuery && typeof mediaQuery.addListener === 'function') mediaQuery.addListener(changed);
  } catch (_) { /* Optional browser accessibility APIs must not prevent play. */ }

  globalThis.TinyArmyGraphics = Object.freeze({
    VERSION, STORAGE_KEY, presets, choices, fields, labels, snapshot, effective, validate, set, reset, subscribe,
    get storageError() { return storageError; },
    get storageWriteBlocked() { return storageWriteBlocked; }
  });
})();

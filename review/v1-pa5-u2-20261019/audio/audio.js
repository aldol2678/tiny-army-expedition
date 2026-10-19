// Reconstructed from the retained candidate adapter. Presentation only:
// no campaign writes, simulation ticks, new audio, or listening approval.
export const AUDIO_MUTE_KEY = 'tinyArmy.eventExpeditionE1.audio.muted.v1';
const legacy = (gain, bus = 'effect') => Object.freeze({ formats: Object.freeze(['ogg', 'wav']), gain, bus });
const ui = (ogg, mp3) => Object.freeze({ formats: Object.freeze(['ogg', 'mp3']), gains: Object.freeze({ ogg: 10 ** (ogg / 20), mp3: 10 ** (mp3 / 20) }), bus: 'effect' });
export const AUDIO_CLIPS = Object.freeze({
  victory_v2: legacy(.327), relic_gain: legacy(.327), evolution: legacy(.394), boss_warning: legacy(.700),
  bgm_title: legacy(10 ** (-13.3 / 20), 'music'), bgm_map: legacy(10 ** (-13.3 / 20), 'music'),
  bgm_battle: legacy(10 ** (-13.2 / 20), 'music'), bgm_elite: legacy(10 ** (-12.9 / 20), 'music'), bgm_boss: legacy(10 ** (-12.6 / 20), 'music'),
  purchase_success: ui(-5.8, -5.5), purchase_fail: ui(-1.1, -.8), ui_cancel: ui(-4.9, -4.6),
  ui_click: ui(.5, .7), place_confirm: ui(-.3, 0), swap_confirm: ui(-2.7, -2.4),
});
const PRIORITY = Object.freeze({ boss_warning: 3, victory_v2: 3, evolution: 2, relic_gain: 2, purchase_success: 2 });
const COMMITTED = Object.freeze({ reward: 'relic_gain', purchase: 'purchase_success', evolve: 'evolution', place: 'place_confirm', swap: 'swap_confirm', victory: 'victory_v2' });
const UI = Object.freeze({ unit_select: 'ui_click', cancel_back: 'ui_cancel', purchase_fail: 'purchase_fail' });
const own = (map, key) => typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : null;

export function musicScene(view, nodeType) {
  if (view === 'title' || view === 'camp') return 'title';
  if (view === 'battle') return ['elite', 'boss'].includes(nodeType) ? nodeType : 'battle';
  return ['starter', 'map', 'prepare', 'formation', 'roster', 'relics', 'history', 'reward', 'rest', 'shop', 'service', 'event', 'forge', 'awakening', 'nodeComplete', 'settlement', 'complete', 'defeat'].includes(view) ? 'map' : null;
}

/** Call committed ONLY after durable save success, never during render/import/
 * resume. One run/revision consumes at most one cue even if playback is dropped.
 * No SFX queues. Construction downloads nothing; only the current scene/role
 * warms after a genuine gesture. BGM is separately opt-in and resets OFF.
 * Native gesture, browser codecs, audible playback and file:// fetch remain
 * separate verification requirements. A local HTTP server may be necessary.
 */
export function createCandidateAudio({ window: w = globalThis, document: d = globalThis.document } = {}) {
  let muted = false, bgmEnabled = false, gesture = false, context = null, disposed = false;
  let active = null, music = null, view = null, nodeType = null, currentScene = null;
  const buffers = new Map(), loading = new Map(), formats = new Map(), commits = new Map(), warnings = new Set(), listeners = [];
  try { muted = w.localStorage?.getItem(AUDIO_MUTE_KEY) === 'true'; } catch { /* Optional preference. */ }
  const eligible = () => !disposed && !muted && gesture && !d?.hidden && !!context;
  const running = () => eligible() && context.state === 'running';
  const stop = source => { try { source?.stop(); } catch { /* Already ended. */ } };
  function stopEffect() { const s = active; active = null; stop(s); }
  function stopMusic() { const s = music?.source; music = null; stop(s); }
  function silence() { gesture = false; stopEffect(); stopMusic(); }

  function load(name) {
    if (!eligible() || !own(AUDIO_CLIPS, name)) return Promise.resolve(false);
    if (buffers.has(name)) return Promise.resolve(true);
    if (loading.has(name)) return loading.get(name);
    const decoder = context;
    let cancelled = false;
    const promise = (async () => {
      for (const ext of AUDIO_CLIPS[name].formats) {
        if (!eligible()) { cancelled = true; return false; }
        try {
          const response = await w.fetch('./assets/audio/' + name + '.' + ext);
          if (!response.ok) continue;
          const data = await response.arrayBuffer();
          if (!eligible()) { cancelled = true; return false; }
          const buffer = await decoder.decodeAudioData(data);
          if (disposed) return false;
          buffers.set(name, buffer); formats.set(name, ext); return true;
        } catch { /* Try only the preserved fallback format. */ }
      }
      return false;
    })().catch(() => false).finally(() => {
      // Cancelled by mute/hide may retry on a later genuine interaction, not
      // automatically. Real failures stay cached, preventing per-frame storms.
      if (cancelled && loading.get(name) === promise) loading.delete(name);
    });
    loading.set(name, promise);
    return promise;
  }

  function source(name, loop) {
    let s, volume;
    try {
      s = context.createBufferSource(); volume = context.createGain();
      const clip = AUDIO_CLIPS[name]; s.buffer = buffers.get(name); s.loop = loop;
      volume.gain.value = clip.gains ? clip.gains[formats.get(name)] : clip.gain;
      s.connect(volume); volume.connect(context.destination);
      s.onended = () => {
        try { s.disconnect(); volume.disconnect(); } catch { /* Best effort. */ }
        if (active === s) active = null;
        if (music?.source === s) music = null;
      };
      return s;
    } catch (error) {
      try { s?.disconnect(); volume?.disconnect(); } catch { /* Best effort. */ }
      throw error;
    }
  }

  function reconcile() {
    const name = currentScene && 'bgm_' + currentScene;
    if (!bgmEnabled || !running() || !name) { stopMusic(); return; }
    if (music?.name === name) return;
    stopMusic();
    if (!buffers.has(name)) {
      if (!loading.has(name)) load(name).then(ok => { if (ok) reconcile(); });
      return;
    }
    try { const s = source(name, true); music = { name, source: s }; s.start(); }
    catch { stopMusic(); }
  }

  function warmScene() {
    if (!eligible()) return;
    const names = view === 'battle' ? ['victory_v2', ...(nodeType === 'boss' ? ['boss_warning'] : [])]
      : view === 'reward' ? ['relic_gain', 'evolution']
        : ['service', 'shop', 'event', 'forge'].includes(view) ? ['purchase_success', 'purchase_fail', 'relic_gain', 'evolution']
          : view === 'awakening' ? ['evolution']
            : ['map', 'prepare', 'formation'].includes(view) ? ['ui_click', 'ui_cancel', 'place_confirm', 'swap_confirm'] : [];
    for (const name of names) load(name);
  }

  function unlock(event) {
    if (disposed || muted || d?.hidden || event?.isTrusted !== true || !['click', 'pointerup', 'keydown'].includes(event.type)) return false;
    try {
      const Context = w.AudioContext || w.webkitAudioContext;
      if (!Context) return false;
      context ||= new Context(); gesture = true;
      if (context.state !== 'running') Promise.resolve(context.resume()).then(reconcile, () => {});
      warmScene(); reconcile(); return true;
    } catch { return false; }
  }

  function effect(name) {
    if (!running() || !own(AUDIO_CLIPS, name)) return false;
    // A miss primes the next action but NEVER plays this action after decoding.
    if (!buffers.has(name)) { load(name); return false; }
    const priority = PRIORITY[name] || 1;
    if (active && active.audioPriority > priority) return false;
    try { stopEffect(); const s = source(name, false); s.audioPriority = priority; active = s; s.start(); return true; }
    catch { stopEffect(); return false; }
  }

  function committed(runId, revision, event) {
    const name = own(COMMITTED, event);
    if (disposed || !name || typeof runId !== 'string' || !runId || !Number.isSafeInteger(revision) || revision < 0) return false;
    let seen = commits.get(runId);
    if (!seen) commits.set(runId, seen = new Set());
    if (seen.has(revision)) return false;
    seen.add(revision); return effect(name);
  }

  function telegraphs(snapshot, battleId = snapshot?.battleId) {
    if (disposed || snapshot?.phase !== 'battle' || typeof battleId !== 'string' || !battleId) return false;
    let played = false;
    for (const t of snapshot.encounterTelegraphs || []) {
      const owner = snapshot.enemies?.find(e => e.id === t.sourceId);
      if (!owner || owner.hp <= 0 || (owner.type !== 'boss' && owner.encounterRole !== 'boss') || !(t.remainingTicks > 0) || typeof t.actionId !== 'string') continue;
      const key = JSON.stringify([battleId, 'pattern', t.actionId]);
      if (warnings.has(key)) continue;
      warnings.add(key); played = effect('boss_warning') || played;
    }
    for (const t of snapshot.telegraphs || []) {
      if (t.team !== 'enemy' || t.owner?.type !== 'boss' || !(t.owner.hp > 0) || !(t.left > 0) || !Number.isSafeInteger(snapshot.tickCount)) continue;
      const key = JSON.stringify([battleId, 'native', t.owner.id, snapshot.tickCount + Math.round(t.left * 60), t.x, t.y, t.radius]);
      if (warnings.has(key)) continue;
      warnings.add(key); played = effect('boss_warning') || played;
    }
    return played;
  }

  function listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener?.(type, handler, options));
  }
  listen(d, 'pointerup', unlock, { passive: true }); listen(d, 'keydown', unlock); listen(d, 'click', unlock);
  listen(d, 'visibilitychange', () => { if (d.hidden) silence(); }); listen(w, 'pagehide', silence);
  return Object.freeze({
    unlock,
    scene(nextView, nextNodeType) {
      if (disposed) return;
      view = nextView; nodeType = nextNodeType; currentScene = musicScene(view, nodeType); warmScene(); reconcile();
    },
    settings: () => Object.freeze({ muted, bgmEnabled, unlocked: running(), scene: currentScene }),
    setMuted(value, event) {
      if (disposed) return;
      muted = !!value;
      try { w.localStorage?.setItem(AUDIO_MUTE_KEY, String(muted)); } catch { /* Independent of game storage. */ }
      if (muted) silence(); else unlock(event);
    },
    setBgmEnabled(value, event) {
      if (disposed) return;
      bgmEnabled = !!value; if (!bgmEnabled) stopMusic(); unlock(event); reconcile();
    },
    ui: role => effect(own(UI, role)), committed, telegraphs,
    dispose() {
      if (disposed) return;
      disposed = true; silence(); for (const remove of listeners) remove();
      try { Promise.resolve(context?.close?.()).catch(() => {}); } catch { /* Optional. */ }
      buffers.clear(); formats.clear(); loading.clear(); commits.clear(); warnings.clear();
    },
  });
}

// In-flow thumbnail in the existing combat note, not a battlefield hitbox.
// No layout stylesheet, external URLs, timers, fetches or async redraws.
export function createEnemyCue({document, node}) {
  let disposed = false, epoch = 0, signature = '';
  function reset(baseText = '') {
    epoch++; signature = ''; node.textContent = baseText;
  }
  function update(state, {baseText = ''} = {}) {
    if (disposed) return false;
    const t = state?.telegraphs?.[0], key = JSON.stringify([baseText, t?.actionId, t?.assetId, t?.label]);
    if (signature === key) return true;
    signature = key; const token = ++epoch; node.textContent = baseText;
    if (!t) return true;
    const wrap = document.createElement('span');
    wrap.style.display = 'block'; wrap.style.maxWidth = '100%'; wrap.style.overflowWrap = 'anywhere';
    const text = document.createElement('span');
    text.textContent = `${t.label} · ${t.targetIdentityOnly ? '대상 표시, 광역 범위 아님' : '모양 예시, 실제 범위는 전장 표시'}`;
    // Only the trusted adapter's fixed asset IDs can form a local relative URL.
    if (/^br2-(line|fan|assassin-target)-(announce-(static|p000|p025|p050|p075|p100)|commit(-static)?|resolve(-static)?)$/.test(t.assetId)) {
      const image = document.createElement('img');
      image.width = 48; image.height = 32; image.alt = ''; image.setAttribute('aria-hidden', 'true');
      image.style.maxWidth = '100%'; image.style.objectFit = 'contain'; image.style.verticalAlign = 'middle';
      image.onerror = () => { if (!disposed && token === epoch) image.remove(); };
      image.src = `./assets/telegraphs/br2/${t.assetId}.svg`;
      wrap.appendChild(image);
    }
    wrap.appendChild(text); node.appendChild(wrap); return true;
  }
  return Object.freeze({update, reset, dispose() { if (!disposed) { reset(); disposed = true; } }});
}

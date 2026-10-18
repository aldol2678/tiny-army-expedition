/* Tiny Army v0.5 rarity presentation. Original icon art is composed, never redrawn.
 * Offline, no dependencies in browser, no motion, no game-state side effects. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../icons/tiny-army-relic-art.js'));
  } else {
    root.TinyArmyRarityArt = factory(root.TinyArmyRelicArt);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (art) {
  'use strict';
  const tiers = Object.freeze([
    { id: 'common', nameKo: '일반', nameEn: 'Common', rank: 1, color: '#FFFFFF', highlight: '#FFFFFF', glowOpacity: 0.12, glowRadius: 27, iconGlow: 0.14, blur: 0.7, rimWidth: 2.0 },
    { id: 'uncommon', nameKo: '고급', nameEn: 'Uncommon', rank: 2, color: '#57D978', highlight: '#C6FFD0', glowOpacity: 0.24, glowRadius: 29, iconGlow: 0.27, blur: 1.1, rimWidth: 2.5 },
    { id: 'rare', nameKo: '희귀', nameEn: 'Rare', rank: 3, color: '#4CA9FF', highlight: '#C5E7FF', glowOpacity: 0.40, glowRadius: 32, iconGlow: 0.43, blur: 1.6, rimWidth: 3.0 },
    { id: 'epic', nameKo: '영웅', nameEn: 'Epic', rank: 4, color: '#B67AFF', highlight: '#E8D1FF', glowOpacity: 0.60, glowRadius: 35, iconGlow: 0.62, blur: 2.2, rimWidth: 3.5 },
    { id: 'legendary', nameKo: '전설', nameEn: 'Legendary', rank: 5, color: '#FFA33D', highlight: '#FFE1A6', glowOpacity: 0.82, glowRadius: 39, iconGlow: 0.85, blur: 2.9, rimWidth: 4.0 }
  ].map(Object.freeze));
  const palette = Object.freeze({ ink: '#203548', shadow: '#142633', parchment: '#FFF0CB', badgeInk: '#FFFFFF' });
  const digitPaths = Object.freeze({
    1: 'M-1.4-2.4L0-3.5V3.5M-2 3.5H2',
    2: 'M-2.4-2.2Q-2.3-3.6 0-3.6Q2.4-3.6 2.4-1.7Q2.4-.5 0 .8L-2.4 3.5H2.4',
    3: 'M-2.2-3.2Q2.5-4.3 2.5-1.7Q2.5 0 0 0Q2.5 0 2.5 1.8Q2.5 4.3-2.2 3.2',
    4: 'M1.5 3.5V-3.5L-2.5 1.3H3',
    5: 'M2.3-3.5H-2.1V-.3Q2.6-1.2 2.6 1.8Q2.6 4.3-2.2 3.1'
  });
  let serial = 0;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function tier(value) { return tiers.find(t => t.id === value || t.nameKo === value || t.rank === value); }
  function size(value) { return Number.isFinite(value) && value > 0 ? Math.min(4096, Math.max(16, value)) : 64; }
  function defs(t, p) {
    return `<defs><radialGradient id="${p}-halo"><stop offset="0" stop-color="${t.color}" stop-opacity="${t.glowOpacity}"/><stop offset=".66" stop-color="${t.color}" stop-opacity="${t.glowOpacity * .76}"/><stop offset="1" stop-color="${t.color}" stop-opacity="0"/></radialGradient><linearGradient id="${p}-rim" x1="0" y1="0" x2="0.75" y2="1"><stop stop-color="${t.highlight}"/><stop offset=".45" stop-color="${t.color}"/><stop offset="1" stop-color="${t.color}"/></linearGradient><filter id="${p}-frame-glow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${0.7 + t.rank * .55}"/></filter><filter id="${p}-icon-glow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${t.blur}" result="blur"/><feFlood flood-color="${t.color}" flood-opacity="${t.iconGlow}"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  }
  function background(t, p) {
    return `<circle cx="40" cy="40" r="${t.glowRadius}" fill="url(#${p}-halo)"/><rect x="9" y="9" width="62" height="62" rx="12" fill="none" stroke="${t.color}" stroke-width="${2 + t.rank}" opacity="${t.glowOpacity}" filter="url(#${p}-frame-glow)"/><rect x="8" y="8" width="64" height="64" rx="13" fill="${palette.shadow}" stroke="${palette.ink}" stroke-width="4"/><rect x="9" y="9" width="62" height="62" rx="12" fill="none" stroke="url(#${p}-rim)" stroke-width="${t.rimWidth}"/><rect x="13" y="13" width="54" height="54" rx="8.5" fill="${palette.parchment}" stroke="${palette.ink}" stroke-width="1.3"/><rect x="14" y="14" width="52" height="52" rx="8" fill="${t.color}" opacity="${.035 + (t.rank - 1) * .026}"/><path d="M20 16H49" fill="none" stroke="${t.highlight}" stroke-width="1" opacity=".65"/>`;
  }
  function foreground(t, n) {
    const compact = n <= 48, bx = compact ? 55 : 58, bw = compact ? 23 : 17, center = bx + bw / 2, digitScale = compact ? 1.55 : 1;
    const glints = t.rank >= 3 ? `<path d="M12 8L13 11L16 12L13 13L12 16L11 13L8 12L11 11Z" fill="${t.highlight}" stroke="${palette.ink}" stroke-width=".6"/>` : '';
    const second = t.rank >= 4 ? `<path d="M66 8L67.3 11.7L71 13L67.3 14.3L66 18L64.7 14.3L61 13L64.7 11.7Z" fill="${t.highlight}" stroke="${palette.ink}" stroke-width=".6"/>` : '';
    const crown = t.rank === 5 ? `<path d="M27 9L30 4L35 8L40 3L45 8L50 4L53 9" fill="${t.color}" stroke="${palette.ink}" stroke-width="1.4" stroke-linejoin="round"/>` : '';
    return `${glints}${second}${crown}<g aria-hidden="true"><rect x="${bx}" y="${bx}" width="${bw}" height="${bw}" rx="5" fill="${palette.ink}" stroke="${t.color}" stroke-width="1.7"/><path d="${digitPaths[t.rank]}" transform="translate(${center} ${center}) scale(${digitScale})" fill="none" stroke="${palette.badgeInk}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  function render(t, inner, label, options) {
    const o = options || {}, p = 'tar-' + (++serial), n = size(o.size);
    const a11y = o.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(label)}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 80 80" ${a11y} focusable="false" data-rarity="${t.id}" data-rarity-rank="${t.rank}">${o.decorative ? '' : `<title>${esc(label)}</title>`}${defs(t,p)}${background(t,p)}${inner ? `<g transform="translate(12 10) scale(.875)" filter="url(#${p}-icon-glow)">${inner}</g>` : ''}${foreground(t, n)}</svg>`;
  }
  function icon(id, rarity, options) {
    const t = tier(rarity), o = options || {};
    if (!t || !art || typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(art.icons, id)) return undefined;
    const meta = art.manifest.find(i => i.id === id);
    const label = o.label === undefined ? `${meta.nameKo}, ${t.nameKo} 등급 ${t.rank}` : `${o.label}, ${t.nameKo} 등급 ${t.rank}`;
    const body = art.icons[id].replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    // Original source relies on inherited round joins/caps. Preserve them verbatim.
    return render(t, `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</g>`, label, o);
  }
  function frame(rarity, options) {
    const t = tier(rarity);
    return t ? render(t, '', `${t.nameKo} 등급 ${t.rank} 프레임`, options) : undefined;
  }
  function dataURI(id, rarity, options) {
    const svg = icon(id, rarity, options);
    return svg === undefined ? undefined : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function markup(id, rarity, options) {
    const t = tier(rarity), o = options || {}, svg = icon(id, rarity, {size: o.size, decorative: true});
    if (!svg) return undefined;
    const meta = art.manifest.find(i => i.id === id), name = o.label === undefined ? meta.nameKo : o.label;
    return `<span class="ta-rarity-item" data-rarity="${t.id}">${svg}<span class="ta-rarity-copy"><span class="ta-rarity-name">${esc(name)}</span><span class="ta-rarity-label">${t.nameKo} · ${t.rank}/5</span></span></span>`;
  }
  return Object.freeze({version: '0.5.0', tiers, palette, tier, icon, frame, dataURI, markup});
});

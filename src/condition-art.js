/* Tiny Army v0.7 — original code-native condition artwork.
 * Bands are display labels only, NOT combat/stat thresholds. No IDs, filters,
 * external resources, animation or mutable counters: safe for large rosters. */
(function (global) {
  'use strict';
  const bands = Object.freeze([
    Object.freeze({ key: 'exhausted', label: '탈진', color: '#c74d48', light: '#f4a39a', start: 0 }),
    Object.freeze({ key: 'tired', label: '피로', color: '#d87730', light: '#ffc28b', start: 25 }),
    Object.freeze({ key: 'fair', label: '보통', color: '#c99b29', light: '#ffe49b', start: 50 }),
    Object.freeze({ key: 'good', label: '양호', color: '#42885d', light: '#a4dfac', start: 75 })
  ]);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function normalize(value) {
    let n; try { n = Number(value); } catch (_) { n = 0; }
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
  }
  function bandFor(value) { return bands[Math.min(3, Math.floor(normalize(value) / 25))]; }
  // Round captions to one decimal; exact values still determine the band,
  // meter semantics and artwork fill. Display bands are not stat thresholds.
  const number = value => String(Math.round(normalize(value) * 10) / 10);
  // A reusable 40×40 icon plate. This fragment contains no semantic content.
  function iconFrame(value) {
    const band = bandFor(value);
    return '<g class="ta-condition__icon" aria-hidden="true">' +
      '<path d="M5 2h28l5 5v28l-5 5H5l-4-5V7z" fill="#172b3b" opacity=".28" transform="translate(0 2)"/>' +
      '<path d="M5 2h28l5 5v28l-5 5H5l-4-5V7z" fill="#b8c8c8" stroke="#203548" stroke-width="2"/>' +
      '<path d="M6 5h26l3 3v24l-3 4H6l-2-4V8z" fill="#fff0cb" stroke="#7c8f91"/>' +
      '<path d="M6 6h26l2 2M5 9v21" fill="none" stroke="#fffdf1" stroke-width="2"/>' +
      '<path d="M25 8 12 23h8l-3 11 13-17h-9z" fill="' + band.color + '" stroke="#203548" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="m23 11-8 10h6" fill="none" stroke="' + band.light + '" stroke-width="1.6"/></g>';
  }
  function svg(value, options) {
    const n = normalize(value), compact = !!(options && options.compact);
    const band = bandFor(n);
    // One continuous fill communicates the current value and current display
    // band. Quarter ticks are landmarks, never separately colored segments.
    const fill = (x, y, width, height) => n > 0
      ? '<rect class="ta-condition__fill" x="' + x + '" y="' + y + '" width="' + (n / 100 * width).toFixed(3) + '" height="' + height + '" rx="1" fill="' + band.color + '"/>' +
        '<path d="M' + x + ' ' + (y + 1.5) + 'h' + (n / 100 * width).toFixed(3) + '" stroke="' + band.light + '" stroke-opacity=".6"/>'
      : '';
    const ticks = (x, y, width, height) => [25, 50, 75].map(value =>
      '<path class="ta-condition__tick" data-tick="' + value + '" d="M' + (x + width * value / 100) + ' ' + y + 'v' + height + '" stroke="#fff0cb" stroke-opacity=".7"/>').join('');
    if (compact) {
      return '<svg class="ta-condition__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 18" width="120" height="18" aria-hidden="true" focusable="false">' +
        '<rect x="1" y="2" width="118" height="15" rx="3" fill="#172b3b" opacity=".2"/>' +
        '<rect x="1" y="1" width="118" height="14" rx="3" fill="#a9babc" stroke="#203548"/>' +
        '<path d="M4 2h112" stroke="#fffef5" stroke-opacity=".8"/>' +
        '<rect x="3" y="3" width="114" height="10" rx="1" fill="#384750"/>' + fill(3, 3, 114, 10) + ticks(3, 3, 114, 3) + '</svg>';
    }
    const track = '<rect x="54" y="17" width="194" height="18" rx="2" fill="#384750"/>' +
      fill(54, 17, 194, 18) + ticks(54, 17, 194, 4);
    const pointer = 54 + n / 100 * 194;
    return '<svg class="ta-condition__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 264 62" width="264" height="62" aria-hidden="true" focusable="false">' +
      '<rect x="2" y="9" width="260" height="46" rx="10" fill="#172b3b" opacity=".26"/>' +
      '<rect x="2" y="5" width="260" height="46" rx="10" fill="#a9babc" stroke="#203548" stroke-width="2"/>' +
      '<rect x="5" y="8" width="254" height="39" rx="7" fill="#fff0cb" stroke="#71858b"/>' +
      '<path d="M10 10h243M7 14v25" fill="none" stroke="#fffef5" stroke-width="2"/>' +
      '<path d="M10 47h244" stroke="#72858b" stroke-width="2"/>' +
      '<g transform="translate(8 6) scale(.88)">' + iconFrame(n) + '</g>' +
      '<rect x="51" y="14" width="200" height="24" rx="4" fill="#172b3b" stroke="#7b8b85"/>' + track +
      '<path d="M' + (pointer - 3).toFixed(3) + ' 11h6l-3 5z" fill="#fffef5" stroke="#203548" stroke-width="1"/>' +
      '<g fill="#203548" font-family="system-ui,sans-serif" font-size="8" font-weight="700" text-anchor="middle">' +
      '<text x="54" y="45">0</text><text x="102.5" y="45">25</text><text x="151" y="45">50</text><text x="199.5" y="45">75</text><text x="248" y="45">100</text></g>' +
      '</svg>';
  }
  function markup(value, options) {
    options = options || {};
    const n = normalize(value), band = bandFor(n), label = options.label == null ? '컨디션' : String(options.label);
    const display = number(n), accessible = label + ' ' + display + '/100 · ' + band.label + ' (표시 등급)';
    const parts = [];
    if (options.showLabel !== false) parts.push('<span class="ta-condition__label">' + escape(label) + '</span>');
    if (options.showValue !== false) parts.push('<span class="ta-condition__value">' + display + '/100</span>');
    if (options.showState !== false) parts.push('<span class="ta-condition__band">' + band.label + '</span>');
    const caption = options.showCaption === false || parts.length === 0 ? '' :
      '<span class="ta-condition__caption" aria-hidden="true">' + parts.join(' ') + '</span>';
    return '<span class="ta-condition' + (options.compact ? ' is-compact' : '') + '" data-condition-band="' + band.key + '" role="meter" aria-label="' + escape(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + n + '" aria-valuetext="' + escape(accessible) + '">' + svg(n, options) + caption + '</span>';
  }
  const api = Object.freeze({ bands, normalize, bandFor, iconFrame, svg, markup });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.TinyArmyConditionArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

'use strict';
// Packaging and UI-render proof only. Never rewrites or resizes the selected PNGs.
// Run: node tools/build-portrait-sheets.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const assetRoot = path.join(root, 'assets-local', 'portraits');
const runtimeRoot = path.join(assetRoot, 'runtime');
const version = '0.8.2-casual-v2-conditions-1';
const states = ['fresh', 'tired', 'exhausted'];
const selected = {
  spear: 'spear-condition-sheet.png',
  archer: 'archer-condition-sheet.png',
  support: 'support-condition-sheet.png',
  guardian: 'guardian-condition-sheet-v2.png',
  charger: 'charger-condition-sheet.png',
  sniper: 'sniper-condition-sheet.png',
  volley: 'volley-condition-sheet.png',
  mage: 'mage-condition-sheet.png'
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function comparePixels(source, runtime) {
  if (source.length !== runtime.length) throw new Error('Decoded RGBA length mismatch');
  let visibleRgbaMismatches = 0, alphaMismatches = 0, invisibleRgbChanges = 0;
  for (let i = 0; i < source.length; i += 4) {
    const rgbEqual = source[i] === runtime[i] && source[i + 1] === runtime[i + 1] && source[i + 2] === runtime[i + 2];
    const alphaEqual = source[i + 3] === runtime[i + 3];
    if (!alphaEqual) alphaMismatches++;
    if (source[i + 3] || runtime[i + 3]) {
      if (!rgbEqual || !alphaEqual) visibleRgbaMismatches++;
    } else if (!rgbEqual) invisibleRgbChanges++;
  }
  if (visibleRgbaMismatches || alphaMismatches) throw new Error('Lossless packaging did not preserve visible RGBA');
  return { visibleRgbaMismatches, alphaMismatches, invisibleRgbChanges };
}

function cellGeometry(rgba, width, height) {
  const cellWidth = width / 3;
  const cells = states.map((state, i) => ({ state, x: i * cellWidth, y: 0, width: cellWidth, height }));
  // Ignore only faint extraction fringe for framing; no image pixels are edited.
  // One padded union across expressions keeps the scale/position fixed per class.
  const bounds = { left: cellWidth, top: height, right: 0, bottom: 0 };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3] < 16) continue;
    const localX = x % cellWidth;
    bounds.left = Math.min(bounds.left, localX);
    bounds.top = Math.min(bounds.top, y);
    bounds.right = Math.max(bounds.right, localX + 1);
    bounds.bottom = Math.max(bounds.bottom, y + 1);
  }
  const left = Math.max(0, bounds.left - 16), top = Math.max(0, bounds.top - 16);
  const right = Math.min(cellWidth, bounds.right + 16), bottom = Math.min(height, bounds.bottom + 16);
  const viewport = { x: left, y: top, width: right - left, height: bottom - top };
  if (!(viewport.width > 0 && viewport.height > 0)) throw new Error('Empty portrait sheet');
  return { cells, viewport, visibleBoundsAlphaAtLeast16: bounds, framingPaddingPixels: 16 };
}

async function renderProof(api) {
  const width = 1380, rowHeight = 262, height = 124 + rowHeight * api.types.length + 190;
  let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#f4ecd3"/>`;
  const label = (str, x, y, size = 16, color = '#203548') => `<text x="${x}" y="${y}" fill="${color}" font-family="DejaVu Sans, sans-serif" font-size="${size}">${str}</text>`;
  labels += label('TINY ARMY / CASUAL CONDITION PORTRAITS', 24, 36, 25);
  labels += label('Actual helper geometry. 160 x 200 + native 64 x 80. PNG transport for librsvg; runtime uses pixel-equal lossless WebP.', 24, 63, 14);
  for (const [i, state] of states.entries()) labels += label(`${state.toUpperCase()} / ${[100, 50, 10][i]}`, 190 + i * 386, 102, 17);
  const composites = [];
  // This librsvg build cannot decode WebP inside SVG, despite Sharp's own WebP
  // decoder supporting it. Substitute only the original pixel-equal PNG URI for
  // the proof; helper markup, clipping, coordinates and framing stay identical.
  const proofUris = Object.fromEntries(Object.entries(selected).map(([type, filename]) => [type,
    'data:image/png;base64,' + fs.readFileSync(path.join(assetRoot, filename)).toString('base64')
  ]));
  const render = async (type, opts) => {
    const markup = api.portrait(type, opts);
    const proofMarkup = markup.replace(globalThis.TinyArmyPortraitSheets.sheets[type].dataUri, proofUris[type]);
    const rendered = await sharp(Buffer.from(proofMarkup)).png().toBuffer();
    // An accidental unsupported transport must fail the proof, not produce blank frames.
    const withoutImage = await sharp(Buffer.from(proofMarkup.replace(/<image\b[^>]*\/>/, ''))).png().toBuffer();
    if (rendered.equals(withoutImage)) throw new Error(`Blank portrait proof for ${type}`);
    return rendered;
  };
  for (const [row, type] of api.types.entries()) {
    const y = 120 + row * rowHeight;
    labels += `<rect x="20" y="${y}" width="1340" height="248" rx="10" fill="${row % 2 ? '#fff9e7' : '#eee6ce'}"/>`;
    labels += label(type.toUpperCase(), 34, y + 38, 17);
    for (let col = 0; col < 3; col++) {
      const x = 190 + col * 386, condition = [100, 50, 10][col];
      for (const [size, offsetX, offsetY] of [[160, 0, 15], [64, 190, 91]]) {
        const svg = api.portrait(type, { size, condition });
        if (!svg.includes(`data-portrait-state="${states[col]}"`) || !svg.includes('<image ')) throw new Error('Portrait helper did not use selected atlas cell');
        composites.push({ input: await render(type, { size, condition }), left: x + offsetX, top: y + offsetY });
      }
      labels += label('160 px', x + 54, y + 235, 12, '#58776f');
      labels += label('64 px', x + 203, y + 190, 12, '#58776f');
    }
  }
  const footerY = 124 + rowHeight * api.types.length;
  labels += label('SELECTION / DISABLED FRAME PRESERVATION', 24, footerY + 25, 16);
  for (const [i, state] of ['normal', 'selected', 'disabled'].entries()) {
    composites.push({ input: await render('spear', { size: 64, state, condition: 50 }), left: 24 + i * 180, top: footerY + 43 });
    labels += label(state, 24 + i * 180, footerY + 146, 13);
  }
  labels += '</svg>';
  await sharp(Buffer.from(labels)).composite(composites).png().toFile(path.join(runtimeRoot, 'portrait-contact-sheet.png'));
  return { path: 'runtime/portrait-contact-sheet.png', width, height, renderer: `sharp ${sharp.versions.sharp} / librsvg ${sharp.versions.rsvg}`, transport: 'Original PNG URI substituted for the pixel-equal lossless WebP URI because this librsvg image loader does not support embedded WebP. All helper geometry is unchanged. This proof is not browser-decoding verification.', blankImageGuard: true, sizes: [160, 64], conditions: [100, 50, 10], count: 51 };
}

(async () => {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const sheets = {}, records = [];
  for (const [type, filename] of Object.entries(selected)) {
    const source = fs.readFileSync(path.join(assetRoot, filename));
    const sourceHash = hash(source), metadata = await sharp(source).metadata();
    if (metadata.width !== 2172 || metadata.height !== 724 || !metadata.hasAlpha) throw new Error(`${type}: Expected original 2172 x 724 alpha PNG`);
    const sourcePixels = await sharp(source).ensureAlpha().raw().toBuffer();
    const runtime = await sharp(source).webp({ lossless: true, effort: 6 }).toBuffer();
    const runtimePixels = await sharp(runtime).ensureAlpha().raw().toBuffer();
    const parity = comparePixels(sourcePixels, runtimePixels);
    const geometry = cellGeometry(sourcePixels, metadata.width, metadata.height);
    const runtimeName = `${type}-condition-sheet.lossless.webp`;
    fs.writeFileSync(path.join(runtimeRoot, runtimeName), runtime);
    sheets[type] = {
      version, width: metadata.width, height: metadata.height,
      sourceSha256: sourceHash, sha256: hash(runtime),
      cells: geometry.cells, viewport: geometry.viewport,
      dataUri: `data:image/webp;base64,${runtime.toString('base64')}`
    };
    records.push({
      type, source: filename, sourceBytes: source.length, sourceSha256: sourceHash,
      runtime: `runtime/${runtimeName}`, runtimeBytes: runtime.length, runtimeSha256: hash(runtime),
      width: metadata.width, height: metadata.height, ...geometry, parity
    });
    if (hash(fs.readFileSync(path.join(assetRoot, filename))) !== sourceHash) throw new Error(`${type}: Source PNG changed during build`);
    console.log(`${type}: ${source.length} -> ${runtime.length} bytes, visible RGBA + alpha exact`);
  }
  const registry = { version, states, thresholds: { freshMin: 75, tiredMin: 25 }, sheets };
  const registryCode = `/* Generated by build-portrait-sheets.cjs. Selected originals are untouched; lossless runtime copies only. */\n(function (global) {\n  'use strict';\n  const registry = ${JSON.stringify(registry)};\n  for (const entry of Object.values(registry.sheets)) {\n    entry.cells.forEach(Object.freeze); Object.freeze(entry.cells); Object.freeze(entry.viewport); Object.freeze(entry);\n  }\n  Object.freeze(registry.sheets); Object.freeze(registry.states); Object.freeze(registry.thresholds); Object.freeze(registry);\n  global.TinyArmyPortraitSheets = registry;\n  if (typeof module !== 'undefined' && module.exports) module.exports = registry;\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
  const registryPath = path.join(root, 'assets-local', 'portrait-sheets.js');
  fs.writeFileSync(registryPath, registryCode);
  delete require.cache[require.resolve(registryPath)];
  require(registryPath);
  const api = require(path.join(root, 'src', 'card-assets.js'));
  const proof = await renderProof(api);
  const manifest = {
    version, purpose: 'Selected generated casual-v2 portraits; presentation only. Four condition mechanics bands remain unchanged.',
    sourcePolicy: 'Only the explicitly selected original PNGs are listed. Earlier drafts remain preserved but are not packaged in the registry.',
    packaging: { format: 'lossless WebP', resize: false, imageEdits: false, effort: 6, parity: 'All alpha bytes and RGBA of every nontransparent pixel match the original PNG. Fully transparent RGB values can change during lossless WebP encoding.', sharp: sharp.versions.sharp },
    framing: 'Equal 724 x 724 source cells. SVG viewBox uses one padded alpha>=16 bounding union per class; no physical source crop or transform. Every visible pixel at alpha>=16 stays inside its selected cell and viewport.',
    states: [{ name: 'fresh', min: 75, max: 100 }, { name: 'tired', min: 25, maxExclusive: 75 }, { name: 'exhausted', min: 0, maxExclusive: 25 }],
    invalidConditionDefault: 100, conditionClamp: [0, 100],
    sourceBytes: records.reduce((n, r) => n + r.sourceBytes, 0), runtimeBytes: records.reduce((n, r) => n + r.runtimeBytes, 0),
    registry: { path: '../portrait-sheets.js', bytes: Buffer.byteLength(registryCode), sha256: hash(registryCode) },
    proof, selected: records
  };
  fs.writeFileSync(path.join(assetRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Built ${records.length} sheets; registry ${manifest.registry.bytes} bytes. Render proof: ${proof.path}`);
})().catch(error => { console.error(error); process.exitCode = 1; });

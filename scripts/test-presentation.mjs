import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loadSource(path) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const compiledModule = { exports: {} };
  const sourceRequire = name => {
    if (!name.startsWith('@/')) return require(name);
    const dependency = ['.ts', '.tsx'].map(extension => name.slice(2) + extension).find(existsSync);
    if (!dependency) throw new Error(`Missing source dependency: ${name}`);
    return loadSource(dependency);
  };
  new Function('exports', 'module', 'require', code)(compiledModule.exports, compiledModule, sourceRequire);
  return compiledModule.exports;
}

const { RaceStartOverlay } = loadSource('src/ui/RaceStartOverlay.tsx');
const render = (phase, countdown = 3, paused = false) => renderToStaticMarkup(createElement(RaceStartOverlay, {
  phase, countdown, paused, onBegin() {}, onRetry() {},
}));
for (const phase of ['loading', 'rules', 'error']) {
  assert(!render(phase).includes('race-countdown'), `${phase} never shares a screen with start numbers`);
}
assert(render('loading').includes('Загружаем трассу'));
assert(!render('loading').includes('НАЧАТЬ ЗАЕЗД'));
assert(render('rules').includes('НАЧАТЬ ЗАЕЗД'));
assert(!render('rules').includes('game-loading'));
assert(render('rules').includes('/icons/lucide/pointer.svg'));
assert(render('rules').includes('/icons/lucide/move-horizontal.svg'));
assert(render('rules').includes('УДЕРЖИВАЙ'));
assert(render('rules').includes('Пауза — справа вверху'));
assert(render('error').includes('ПОВТОРИТЬ ЗАГРУЗКУ'));
assert(!render('error').includes('НАЧАТЬ ЗАЕЗД'));
for (const n of [3, 2, 1]) {
  const html = render('race', n);
  assert(html.includes(`Старт через ${n}`));
  assert(!html.includes('game-loading') && !html.includes('race-rules'));
}
assert.equal(render('race', 3, true), '', 'Pause hides the countdown');
assert.equal(render('race', 0), '', 'Driving leaves no start overlay');

const { repaintBody } = loadSource('src/game/paint.ts');
const { BOY_COLORS, GIRL_COLORS } = loadSource('src/config/game.ts');
for (const { value } of [...BOY_COLORS, ...GIRL_COLORS]) {
  const highlights = new Uint8ClampedArray([0, 194, 238, 255, 180, 188, 192, 160]);
  repaintBody(highlights, value, 'blue');
  assert.deepEqual(Array.from(highlights), [238, 238, 238, 255, 192, 192, 192, 160], 'Cyan glare becomes neutral white light for every selected paint, preserving brightness and alpha');
}
for (const sourcePaint of ['pink', 'blue']) for (const { value, name } of [...BOY_COLORS, ...GIRL_COLORS]) {
  const base = sourcePaint === 'blue' ? [23, 72, 163] : [238, 91, 158];
  const pixels = new Uint8ClampedArray([...base, 255, 35, 35, 35, 255, 220, 15, 15, 255, 245, 245, 245, 255, ...base, 0]);
  const original = pixels.slice();
  repaintBody(pixels, value, sourcePaint);
  const expected = [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  expected.forEach((channel, index) => assert(Math.abs(pixels[index] - channel) <= 1, `${name} is painted as selected`));
  assert.deepEqual(pixels.slice(4), original.slice(4), 'Trim, red brake lights, white lights and transparent pixels stay intact');
  assert.equal(pixels[3], 255);
}
console.log('PASS: loading, rules, errors and countdown stay separate; every selected paint maps correctly and preserves neutral parts, lights and alpha.');

const sharp = createRequire(require.resolve('next/package.json'))('sharp');
for (const [sourcePaint, file, crop] of [
  ['blue', 'public/art/st9-dealer.png', null],
  ['pink', 'public/art/traffic-atlas.png', { left: 427, top: 20, width: 308, height: 470 }],
]) {
  let decoder = sharp(file);
  if (crop) decoder = decoder.extract(crop);
  const raw = await decoder.ensureAlpha().raw().toBuffer();
  const paletteHashes = new Set();
  for (const { value } of [...BOY_COLORS, ...GIRL_COLORS]) {
    const painted = new Uint8ClampedArray(raw);
    repaintBody(painted, value, sourcePaint);
    paletteHashes.add(createHash('sha256').update(painted).digest('hex'));
    for (let i = 3; i < raw.length; i += 4) assert.equal(painted[i], raw[i], 'Real assets keep their alpha channel');
  }
  assert.equal(paletteHashes.size, 14, `${file}: all 14 paints produce distinct rendered pixels`);
}
console.log('PASS: the actual garage PNG and racing pickup sprite render all 14 paints distinctly, with alpha preserved.');

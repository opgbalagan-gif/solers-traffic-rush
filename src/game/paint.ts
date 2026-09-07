/** Repaint body panels from the source paint while preserving light and neutral materials. */
export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  let h = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: delta / (1 - Math.abs(2 * l - 1)), l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = l - c / 2;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb.map(channel => Math.round((channel + m) * 255));
}

export function repaintBody(data: Uint8ClampedArray, color: string, sourcePaint: 'pink' | 'blue' = 'pink') {
  if (!/^#[a-f\d]{6}$/i.test(color)) return;
  const target = rgbToHsl(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
  const baseLightness = sourcePaint === 'blue' ? (23 + 163) / 510 : (238 + 91) / 510;
  const minHue = sourcePaint === 'blue' ? 195 : 290, maxHue = sourcePaint === 'blue' ? 265 : 350;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const source = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    // Neutral trim, glass, white lighting and red brake lights retain their original pixels.
    if (source.h < minHue || source.h > maxHue || source.s < .12) continue;
    const mask = Math.min(1, (source.h - minHue) / 12, (maxHue - source.h) / 8, (source.s - .12) / .2);
    const lightness = source.l <= baseLightness
      ? target.l * source.l / baseLightness
      : target.l + (1 - target.l) * (source.l - baseLightness) / (1 - baseLightness);
    const rgb = hslToRgb(target.h, target.s * Math.min(1, source.s / .7), lightness);
    for (let c = 0; c < 3; c++) data[i + c] += (rgb[c] - data[i + c]) * mask;
  }
}

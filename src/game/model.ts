export const BIOMES = [
  { name: 'ЛЕСНАЯ ТРАССА', ground: 0x34482a, verge: 0x697448, tree: 0xffffff, sky: 0xaccbc0 },
  { name: 'ЗОЛОТАЯ ОСЕНЬ', ground: 0x695232, verge: 0x94724a, tree: 0xffbe67, sky: 0xf2cfac },
  { name: 'ЗИМНИЙ ПЕРЕВАЛ', ground: 0x9daeb5, verge: 0xcbd8db, tree: 0xc5e8ee, sky: 0xd8eaf7 },
] as const;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const roadHalf = (y: number) => 64 + y * .213;
export const laneX = (lane: number, y: number) => 215 + (lane - 1) * roadHalf(y) * 2 / 3;
export const depthScale = (y: number) => .28 + clamp(y / 780, 0, 1.3) * .9;
export const biomeAt = (distance: number) => Math.floor(distance / 750) % BIOMES.length;
export const hitTest = (px: number, py: number, pw: number, ph: number, x: number, y: number, w: number, h: number) => Math.abs(px - x) < (pw + w) * .34 && Math.abs(py - y) < (ph + h) * .35;
export function advanceRun(state: { clock: number; distance: number; charge: number; boostUntil: number; ghostUntil: number }, dt: number) {
  const clock = state.clock + clamp(dt, 0, .05);
  const boost = clock < state.boostUntil;
  const speed = (Math.min(172, 100 + state.distance * .018) + (boost ? 60 : 0)) * (clock < state.ghostUntil ? .82 : 1);
  return { ...state, clock, distance: state.distance + speed / 3.6 * clamp(dt, 0, .05), charge: boost ? state.charge : Math.min(100, state.charge + clamp(dt, 0, .05) * 6), speed, boost };
}

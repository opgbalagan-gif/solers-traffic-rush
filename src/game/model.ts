export const BIOMES = [
  { name: 'ЛЕСНАЯ ТРАССА', ground: 0x425035, verge: 0x7e8058, tree: 'pine', sky: 0xb4c9bc },
  { name: 'ЗОЛОТАЯ ОСЕНЬ', ground: 0x6b5938, verge: 0x9d8b64, tree: 'autumn', sky: 0xe5ba85 },
  { name: 'ЗИМНИЙ ПЕРЕВАЛ', ground: 0xb2c0c2, verge: 0xe0e7e3, tree: 'snow-pine', sky: 0xd8eaf0 },
] as const;

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const biomeAt = (distance: number) => Math.floor(Math.max(0, distance) / 750) % BIOMES.length;
export const LANE_WIDTH = 2.7;
export const ROAD_HALF = 4.28;
export const laneWorldX = (lane: number) => (lane - 1) * LANE_WIDTH;
export const roadCurve = (s: number) => 16 * Math.sin(s / 83) + 7 * Math.sin(s / 49);
export const roadSlope = (s: number) => 16 / 83 * Math.cos(s / 83) + 7 / 49 * Math.cos(s / 49);

/** Every road marking, vehicle and roadside prop uses this one world-to-screen projection. */
export function projectRoad(z: number, x = 0, distance = 0, cameraLean = 0) {
  const scale = 430 / Math.max(3, z + 10);
  const bend = roadCurve(distance + z) - roadCurve(distance) - roadSlope(distance) * z;
  return { x: 215 + (x + bend - cameraLean) * scale, y: -75 + 17.7 * scale, scale };
}
export type RaceEvent = { type: 'start' | 'crash' | 'exhausted' | 'boost' | 'bonus' | 'near' | 'milestone'; x?: number; value?: number };
export type Vehicle = {
  id: number; lane: number; x: number; z: number; speed: number; desiredSpeed: number;
  kind: 'blue' | 'yellow' | 'red' | 'white' | 'truck' | 'bonus'; width: number; length: number;
  hit: boolean; passed: boolean; clearance: number; signal: number; targetLane: number;
};
export const VEHICLE_RATIOS = { blue: 386 / 295, yellow: 380 / 294, red: 432 / 313, white: 431 / 306, truck: 477 / 295, bonus: 351 / 301 };

/** Narrow, forgiving footprints follow the visible sprites, including the elevated camera angle. */
export function vehicleContact(playerX: number, distance: number, car: Vehicle) {
  const hero = projectRoad(0, playerX, distance), other = projectRoad(car.z, car.x, distance);
  const heroHeight = 3.49 * hero.scale, carHeight = car.width * other.scale * VEHICLE_RATIOS[car.kind];
  const vertical = other.y + carHeight * .08 > hero.y - heroHeight * .77 && other.y - carHeight * .76 < hero.y + heroHeight * .08;
  const clearance = (Math.abs(hero.x - other.x) - (2.32 * hero.scale + car.width * other.scale) * .35) / ((hero.scale + other.scale) / 2);
  return { vertical, clearance, touching: vertical && clearance < 0 };
}
export type RunState = {
  clock: number; distance: number; charge: number; speed: number; boostUntil: number; ghostUntil: number;
  lives: number; combo: number; score: number; overtakes: number; bonuses: number; nearMisses: number;
};

export function planWave(distance: number, previousGap: number, random: () => number) {
  const step = random() < .5 ? -1 : 1;
  const gap = clamp(previousGap + (random() < .68 ? step : 0), 0, 2);
  const lanes = [0, 1, 2].filter(lane => lane !== gap);
  return { gap, lanes: distance > 450 && random() < .55 ? lanes : [lanes[Math.floor(random() * 2)]] };
}

export class RaceSimulation {
  readonly state: RunState = { clock: 0, distance: 0, charge: 100, speed: 72, boostUntil: 0, ghostUntil: 0, lives: 3, combo: 0, score: 0, overtakes: 0, bonuses: 0, nearMisses: 0 };
  vehicles: Vehicle[] = [];
  lane = 1;
  x = 0;
  lateralVelocity = 0;
  paused = false;
  countdown = 3;
  private random: () => number;
  private nextId = 1;
  private nextWave = 1.8;
  private nextBonus = 5;
  private nextChange = 10;
  private nextMilestone = 500;
  private previousGap = 1;
  private bonusScore = 0;
  private events: RaceEvent[] = [];

  constructor(random = Math.random) {
    this.random = random;
    this.spawn(0, 24, 'blue', 13);
    this.spawn(2, 40, 'truck', 13);
    this.spawn(1, 64, 'yellow', 14);
  }

  spawn(lane: number, z: number, kind: Vehicle['kind'], speed = 14) {
    const object: Vehicle = {
      id: this.nextId++, lane, x: laneWorldX(lane), z, speed, desiredSpeed: speed, kind,
      width: kind === 'truck' ? 2.15 : kind === 'bonus' ? 1.05 : 1.9,
      length: kind === 'truck' ? 6.3 : kind === 'bonus' ? 1 : 4.4,
      hit: false, passed: false, clearance: Infinity, signal: 0, targetLane: lane,
    };
    this.vehicles.push(object);
    return object;
  }

  move(direction: -1 | 1) {
    if (this.paused || this.state.lives === 0) return;
    this.lane = clamp(this.lane + direction, 0, 2);
  }

  setPaused(paused: boolean) {
    if (!paused && this.state.lives === 0) return;
    this.paused = paused;
  }

  continueRace() {
    if (this.state.lives > 0) return false;
    this.state.lives = 3;
    this.state.ghostUntil = this.state.clock + 3;
    this.countdown = 1.2;
    this.paused = false;
    return true;
  }

  boost() {
    if (this.paused || this.countdown > 0 || this.state.lives === 0 || this.state.charge < 100) return false;
    this.state.charge = 0;
    this.state.boostUntil = this.state.clock + 4;
    this.events.push({ type: 'boost' });
    return true;
  }

  damage(object: Vehicle) {
    if (this.state.lives === 0 || object.hit) return;
    object.hit = true;
    if (this.state.clock < this.state.ghostUntil) return;
    this.state.lives--;
    this.state.combo = 0;
    this.state.ghostUntil = this.state.clock + 2.8;
    this.events.push({ type: 'crash', x: object.x });
    if (this.state.lives === 0) {
      this.paused = true;
      this.events.push({ type: 'exhausted' });
    }
  }

  private traffic(dt: number) {
    // Vehicles brake behind their leaders and signal before changing into a clear lane.
    const sorted = [...this.vehicles].filter(v => v.kind !== 'bonus').sort((a, b) => b.z - a.z);
    for (const car of sorted) {
      const leader = sorted.find(other => other.id !== car.id && other.z > car.z && Math.abs(other.x - car.x) < 2.2);
      const gap = leader ? leader.z - car.z - (leader.length + car.length) / 2 : Infinity;
      const desired = leader && gap < 12 ? Math.min(car.desiredSpeed, leader.speed * clamp(gap / 7, .15, 1)) : car.desiredSpeed;
      car.speed += (desired - car.speed) * Math.min(1, dt * 3);
      if (car.signal > 0) {
        car.signal = Math.max(0, car.signal - dt);
        if (car.signal === 0) {
          const clear = car.z > 19 && !sorted.some(other => other.id !== car.id && Math.abs(other.z - car.z) < 15 && Math.abs(other.x - laneWorldX(car.targetLane)) < 2.3);
          if (clear) car.lane = car.targetLane;
          else car.targetLane = car.lane;
        }
      }
      car.x += (laneWorldX(car.lane) - car.x) * Math.min(1, dt * 1.8);
    }
    this.nextChange -= dt;
    if (this.nextChange <= 0) {
      this.nextChange = 9 + this.random() * 7;
      const car = sorted.find(v => v.z > 25 && v.z < 48 && v.kind !== 'truck');
      if (car) {
        const target = clamp(car.lane + (this.random() < .5 ? -1 : 1), 0, 2);
        const clear = !sorted.some(v => v.id !== car.id && Math.abs(v.z - car.z) < 18 && (v.lane === target || v.targetLane === target));
        // Never merge into the deliberately open passage of the current traffic group.
        const closesGap = sorted.some(v => v.id !== car.id && Math.abs(v.z - car.z) < 10 && v.lane !== car.lane && v.lane !== target);
        if (clear && !closesGap && target !== car.lane) { car.targetLane = target; car.signal = 1.6; }
      }
    }
  }

  step(elapsed: number) {
    if (this.paused) return [];
    let remaining = clamp(elapsed, 0, .05);
    while (remaining > .000001 && !this.paused) {
      const dt = Math.min(1 / 120, remaining);
      remaining -= dt;
      // Critically damped steering stays consistent at 30, 60 and 120 fps.
      const acceleration = (laneWorldX(this.lane) - this.x) * 165 - this.lateralVelocity * 25;
      this.lateralVelocity += acceleration * dt;
      this.x += this.lateralVelocity * dt;
      this.x = clamp(this.x, -LANE_WIDTH, LANE_WIDTH);
      if (this.countdown > 0) {
        this.countdown = Math.max(0, this.countdown - dt);
        if (this.countdown === 0) this.events.push({ type: 'start' });
        continue;
      }
      const state = this.state;
      state.clock += dt;
      const boosting = state.clock < state.boostUntil;
      const ghost = state.clock < state.ghostUntil;
      const cruise = Math.min(170, 108 + state.distance * .018);
      const targetSpeed = (cruise + (boosting ? 57 : 0)) * (ghost ? .78 : 1);
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * (boosting ? 2 : .85));
      state.distance += state.speed / 3.6 * dt;
      if (!boosting) state.charge = Math.min(100, state.charge + dt * 6);
      this.traffic(dt);
      for (const car of this.vehicles) {
        car.z -= (state.speed / 3.6 - (car.kind === 'bonus' ? 0 : car.speed)) * dt;
        const contact = vehicleContact(this.x, state.distance, car);
        const longitudinal = contact.vertical;
        const clearance = contact.clearance;
        if (longitudinal) {
          car.clearance = Math.min(car.clearance, clearance);
          if (clearance < 0) {
            if (car.kind === 'bonus') {
              car.z = -20;
              state.bonuses++;
              this.bonusScore += 10;
              state.charge = Math.min(100, state.charge + 12);
              this.events.push({ type: 'bonus', x: car.x, value: 10 });
            } else this.damage(car);
          }
        }
        if (this.paused) break;
        if (car.kind !== 'bonus' && !car.passed && car.z < -4.8) {
          car.passed = true;
          state.overtakes++;
          if (!car.hit && state.clock >= state.ghostUntil) {
            state.combo = Math.min(5, state.combo + 1);
            this.bonusScore += state.combo;
            if (car.clearance > 0 && car.clearance < .7) {
              state.nearMisses++;
              this.bonusScore += 15;
              state.charge = Math.min(100, state.charge + 8);
              this.events.push({ type: 'near', x: car.x, value: 15 });
            }
          }
        }
      }
      this.vehicles = this.vehicles.filter(car => car.z > -13);
      state.score = Math.floor(state.distance / 10) + this.bonusScore;
      if (state.distance >= this.nextMilestone) { this.events.push({ type: 'milestone', value: this.nextMilestone }); this.nextMilestone += 500; }
      this.nextWave -= dt;
      this.nextBonus -= dt;
      if (this.nextWave <= 0) {
        const wave = planWave(state.distance, this.previousGap, this.random);
        this.previousGap = wave.gap;
        const velocity = 13 + this.random() * 4;
        const types = ['blue', 'yellow', 'white', 'red', 'truck'] as const;
        for (const lane of wave.lanes) {
          if (this.vehicles.some(v => Math.abs(v.z - 65) < 17 && (v.lane === lane || v.targetLane === lane))) continue;
          this.spawn(lane, 65, types[Math.floor(this.random() * types.length)], velocity);
        }
        this.nextWave = Math.max(1.45, 2.55 - state.distance * .00035);
      }
      if (this.nextBonus <= 0) {
        const freeLane = [this.previousGap, 0, 1, 2].find(lane => !this.vehicles.some(v => v.kind !== 'bonus' && v.lane === lane && Math.abs(v.z - 45) < 14));
        if (freeLane !== undefined) this.spawn(freeLane, 45, 'bonus', 0);
        this.nextBonus = 5 + this.random() * 2;
      }
    }
    const events = this.events;
    this.events = [];
    return events;
  }
}

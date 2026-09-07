import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const js = ts.transpile(readFileSync('src/game/model.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const modelModule = { exports: {} };
new Function('exports', 'module', js)(modelModule.exports, modelModule);
const { RaceSimulation, projectRoad, biomeAt, planWave, laneWorldX, vehicleContact } = modelModule.exports;
const seeded = (seed = 123) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const advance = (race, seconds, fps = 60) => { const events = []; for (let i = 0; i < seconds * fps; i++) events.push(...race.step(1 / fps)); return events; };
const emptyRace = () => { const race = new RaceSimulation(seeded()); race.vehicles = []; race.nextWave = 99999; race.nextBonus = 99999; return race; };

assert.equal(biomeAt(0), 0); assert.equal(biomeAt(750), 1); assert.equal(biomeAt(1500), 2); assert.equal(biomeAt(2250), 0);
const near = projectRoad(0), far = projectRoad(60);
assert(near.y > far.y && near.scale > far.scale, 'Perspective shrinks objects consistently with distance');
assert.equal(projectRoad(0, 0, 731).x, 215, 'Road remains centred under the player on curves');
for (let distance = 0; distance < 4000; distance += 5) for (let z = -1.5; z < 160; z += 2) {
  const p = projectRoad(z, 0, distance);
  assert(Number.isFinite(p.x) && Number.isFinite(p.y) && p.scale > 0);
}
assert(projectRoad(0, laneWorldX(0)).x > 45 && projectRoad(0, laneWorldX(2)).x < 385);
const visualRace = new RaceSimulation(seeded());
const distantCar = visualRace.spawn(1, 3, 'red');
assert(!vehicleContact(0, 0, distantCar).touching, 'Separated visible bumpers must not collide');
distantCar.z = 0;
assert(vehicleContact(0, 0, distantCar).touching, 'Overlapping body footprints collide');

const countdown = emptyRace();
advance(countdown, 2);
assert.equal(countdown.state.distance, 0);
assert(!countdown.boost(), 'Boost cannot be consumed before the start');
countdown.setPaused(true);
const frozenCountdown = countdown.countdown;
advance(countdown, 10);
assert.equal(countdown.countdown, frozenCountdown);
countdown.setPaused(false);
const startEvents = advance(countdown, 2);
assert.equal(startEvents.filter(e => e.type === 'start').length, 1);
assert(countdown.state.distance > 0);

const waiting = new RaceSimulation(seeded(), { waitForStart: true });
const parkedTraffic = JSON.stringify(waiting.vehicles);
waiting.move(1); waiting.setPaused(false);
assert(!waiting.boost());
assert.deepEqual(advance(waiting, 60), [], 'Loading and reading rules produce no race events');
assert.equal(waiting.countdown, 3, 'Reading rules never consumes the countdown');
assert.equal(waiting.state.distance, 0);
assert.equal(waiting.lane, 1);
assert.equal(JSON.stringify(waiting.vehicles), parkedTraffic, 'Traffic waits behind the start screen');
assert(waiting.beginRace());
assert(!waiting.beginRace(), 'Repeated start presses cannot restart the race');
advance(waiting, 1.1); assert.equal(Math.ceil(waiting.countdown), 2);
advance(waiting, 1); assert.equal(Math.ceil(waiting.countdown), 1);
assert.equal(advance(waiting, 1).filter(event => event.type === 'start').length, 1);
assert.equal(waiting.countdown, 0);
assert(waiting.state.distance > 0);

const thirty = emptyRace(), sixty = emptyRace(), oneTwenty = emptyRace();
for (const [race, fps] of [[thirty, 30], [sixty, 60], [oneTwenty, 120]]) {
  race.move(1); advance(race, 23, fps);
}
assert(Math.abs(thirty.state.distance - sixty.state.distance) < .03, 'Frame-rate independent distance');
assert(Math.abs(oneTwenty.x - sixty.x) < .001, 'Frame-rate independent steering');
assert(Math.abs(sixty.x - laneWorldX(2)) < .001);

const damage = emptyRace(); damage.countdown = 0;
const hit1 = damage.spawn(1, 0, 'red');
damage.step(1 / 60); assert.equal(damage.state.lives, 2); assert(hit1.hit);
advance(damage, .2); assert.equal(damage.state.lives, 2, 'Overlapping frames do not repeat damage');
damage.spawn(1, 0, 'white'); damage.step(1 / 60);
assert.equal(damage.state.lives, 2, 'A different car during protection does not remove a life');
damage.vehicles = []; advance(damage, 3);
damage.spawn(1, 0, 'red'); damage.step(1 / 60); assert.equal(damage.state.lives, 1);
damage.vehicles = []; advance(damage, 3);
damage.spawn(1, 0, 'blue');
const stopEvents = damage.step(1 / 60);
assert.equal(damage.state.lives, 0); assert(damage.paused);
assert.equal(stopEvents.filter(e => e.type === 'exhausted').length, 1);
damage.setPaused(false); assert(damage.paused, 'Pause cannot bypass the continuation gate');
const before = JSON.stringify(damage.state);
advance(damage, 20); assert.equal(JSON.stringify(damage.state), before);
assert(damage.continueRace()); assert.equal(damage.state.lives, 3); assert(!damage.paused);
assert.equal(damage.state.score, JSON.parse(before).score, 'Continuation retains the score');
assert(damage.state.ghostUntil > damage.state.clock);
assert(!damage.continueRace(), 'Continuation cannot reset a healthy run');

const boost = emptyRace(); boost.countdown = 0;
assert(boost.setBoostHeld(true));
advance(boost, 2); assert(boost.state.speed > 140); assert(Math.abs(boost.state.charge - 50) < .1);
boost.setBoostHeld(false);
assert.equal(boost.state.boostUntil, boost.state.clock, 'Release immediately ends nitro');
advance(boost, 1); assert(boost.state.charge > 55, 'Release regenerates unused charge');
assert(boost.setBoostHeld(true)); advance(boost, .5);
boost.setPaused(true); const boostClock = boost.state.clock; advance(boost, 3); assert.equal(boost.state.clock, boostClock);
boost.setPaused(false); advance(boost, .5); assert.equal(boost.state.boostUntil, boost.state.clock, 'Resume requires a fresh hold');
boost.setBoostHeld(true); advance(boost, 5);
assert.equal(boost.state.boostUntil, boost.state.clock, 'An empty tank cannot repeatedly reactivate while still held');
boost.setBoostHeld(false); advance(boost, 1); assert(boost.setBoostHeld(true));

const gestureCode = ts.transpile(readFileSync('src/game/RaceGestures.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const gestureModule = { exports: {} };
new Function('exports', 'module', gestureCode)(gestureModule.exports, gestureModule);
const gesture = new gestureModule.exports.RaceGestures();
gesture.begin(1, 100, 300, 0); assert(!gesture.holding(100)); assert(gesture.holding(181));
gesture.end(1); assert(!gesture.holding(500), 'Release immediately cancels a hold');
gesture.begin(1, 100, 300, 0); assert.equal(gesture.move(1, 132, 300), 1); assert(!gesture.holding(900), 'A swipe never becomes nitro');
gesture.cancel(); gesture.begin(1, 100, 300, 0); gesture.move(1, 100, 330); assert(!gesture.holding(900), 'Vertical scrolling is not nitro');
gesture.cancel(); gesture.begin(1, 100, 300, 0); gesture.end(2); assert(gesture.holding(900), 'Another pointer cannot release the active hold');
gesture.cancel(); assert(!gesture.holding(900));

const bonus = emptyRace(); bonus.countdown = 0; bonus.state.charge = 50;
bonus.spawn(1, 0, 'bonus');
const pickup = bonus.step(1 / 60);
assert.equal(bonus.state.bonuses, 1); assert.equal(bonus.state.score, 10);
assert(bonus.state.charge >= 62); assert.equal(pickup.filter(e => e.type === 'bonus').length, 1);
advance(bonus, .2); assert.equal(bonus.state.bonuses, 1);

const reward = emptyRace(); reward.countdown = 0;
const damagedCar = reward.spawn(1, 0, 'red'); reward.step(1 / 60);
damagedCar.z = -5; reward.state.ghostUntil = 0; reward.step(1 / 60);
assert.equal(reward.state.combo, 0, 'A collided car never earns a clean-pass reward');
const closeCar = reward.spawn(1, 0, 'white'); closeCar.x = 2;
reward.step(1 / 120); closeCar.z = -5;
const nearEvents = reward.step(1 / 120);
assert(nearEvents.some(e => e.type === 'near')); assert.equal(reward.state.nearMisses, 1);

const rng = seeded(983); let gap = 1;
for (let i = 0; i < 10000; i++) {
  const wave = planWave(i, gap, rng);
  assert(wave.lanes.length <= 2);
  assert(!wave.lanes.includes(wave.gap));
  assert(Math.abs(wave.gap - gap) <= 1, 'Open passage never jumps across two lanes at once');
  gap = wave.gap;
}

// Long deterministic drives check bounded object counts and physical stability.
let maxObjects = 0;
for (let seed = 1; seed <= 12; seed++) {
  const race = new RaceSimulation(seeded(seed));
  for (let frame = 0; frame < 60 * 180; frame++) {
    if (race.paused) race.continueRace();
    if (frame % 12 === 0 && race.countdown === 0) {
      const threats = race.vehicles.filter(v => v.kind !== 'bonus' && v.z > -4 && v.z < 24);
      const choices = [0, 1, 2].map(lane => ({ lane, danger: threats.reduce((sum, v) => sum + (Math.abs(v.x - laneWorldX(lane)) < 2.1 ? 30 - v.z : 0), 0) + Math.abs(lane - race.lane) * .4 }));
      choices.sort((a, b) => a.danger - b.danger);
      if (choices[0].lane !== race.lane) race.move(choices[0].lane > race.lane ? 1 : -1);
    }
    race.step(1 / 60);
    maxObjects = Math.max(maxObjects, race.vehicles.length);
    assert(Number.isFinite(race.state.distance) && Number.isFinite(race.x));
    assert(race.state.lives >= 0 && race.state.lives <= 3);
    assert(race.state.charge >= 0 && race.state.charge <= 100);
  }
  assert(race.state.distance > 4500, 'Playable multi-biome drive');
  assert(race.state.score <= 180 * 18 + 30, 'Legitimate upgraded scoring satisfies the server time budget');
}
assert(maxObjects < 30, 'Traffic does not accumulate without bound');
console.log('PASS: projection and curves, countdown, 30/60/120 fps consistency, three lives, invincibility, pause, continuation, boost, pickups, clean-pass scoring, 10,000 fair wave layouts and 12 simulated three-minute drives.');

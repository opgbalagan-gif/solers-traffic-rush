import * as Phaser from 'phaser';
import { assetUrl } from '@/src/config/game';
import { PAINT_FILTERS } from '@/src/ui/Visuals';
import { BIOMES, RaceSimulation, biomeAt, type RaceEvent } from '@/src/game/model';
import { RoadRenderer } from '@/src/game/RoadRenderer';

export type HudState = {
  score: number; speed: number; boost: number; distance: number; biome: string; ghost: boolean;
  combo: number; overtakes: number; bonuses: number; lives: number; countdown: number;
  boosting: boolean; nearMisses: number;
};
export type TrafficSceneOptions = {
  carColor: string; onHud: (hud: HudState) => void; onReady: () => void;
  onError: () => void; onExhausted: () => void; onSound?: (event: RaceEvent['type']) => void;
};
const FRAMES: [string, number, number, number, number][] = [
  ['pickup-black', 48, 22, 312, 469], ['pickup-pink', 427, 20, 308, 470],
  ['blue', 813, 88, 295, 386], ['yellow', 1197, 95, 294, 380],
  ['red', 45, 550, 313, 432], ['white', 430, 545, 306, 431],
  ['truck', 816, 503, 295, 477],
];
const SCENERY: [string, number, number, number, number][] = [
  ['pine', 48, 30, 304, 454], ['autumn', 412, 16, 325, 468],
  ['snow-pine', 820, 27, 290, 463], ['cottage', 1180, 82, 338, 371],
  ['billboard', 35, 561, 325, 418], ['warehouse', 410, 582, 342, 359],
  ['rocks', 802, 570, 324, 392], ['crate', 1196, 574, 301, 351],
];

export class TrafficScene extends Phaser.Scene {
  private options: TrafficSceneOptions;
  private simulation = new RaceSimulation();
  private player!: Phaser.GameObjects.Image;
  private playerGlow!: Phaser.GameObjects.Image;
  private roadView!: RoadRenderer;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private signals!: Phaser.GameObjects.Graphics;
  private hudTimer = 0;
  private pointerX = 0;
  private didSwipe = false;
  private failed = false;
  private lastBiome = 0;
  private reducedMotion = false;

  constructor(options: TrafficSceneOptions) {
    super({ key: 'TrafficScene' });
    this.options = options;
  }

  preload() {
    this.load.image('atlas', assetUrl('/art/traffic-atlas.png'));
    this.load.image('scenery', assetUrl('/art/scenery-atlas.png'));
    this.load.on('loaderror', () => { this.failed = true; this.options.onError(); });
  }

  create() {
    if (this.failed || !this.textures.exists('atlas') || !this.textures.exists('scenery')) return;
    FRAMES.forEach(([name, x, y, w, h]) => this.textures.get('atlas').add(name, 0, x, y, w, h));
    SCENERY.forEach(([name, x, y, w, h]) => this.textures.get('scenery').add(name, 0, x, y, w, h));
    const selected = this.options.carColor === '#10161d' ? 'pickup-black' : 'pickup-pink';
    const source = this.textures.getFrame('atlas', selected);
    const paint = this.textures.createCanvas('player-paint', source.width, source.height)!;
    paint.context.filter = this.options.carColor === '#10161d' ? 'none' : (PAINT_FILTERS[this.options.carColor] || 'none');
    paint.context.drawImage(this.textures.get('atlas').getSourceImage() as HTMLImageElement, source.cutX, source.cutY, source.cutWidth, source.cutHeight, 0, 0, source.width, source.height);
    paint.refresh();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.roadView = new RoadRenderer(this);
    this.playerGlow = this.add.image(215, 650, 'soft-particle').setTint(0x24d7f6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.player = this.add.image(215, 650, 'player-paint').setOrigin(.5, .86);
    this.signals = this.add.graphics().setDepth(1450);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.pointerX = pointer.x; this.didSwipe = false; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const movement = pointer.x - this.pointerX;
      if (Math.abs(movement) >= 28) {
        this.move(movement > 0 ? 1 : -1);
        this.pointerX = pointer.x;
        this.didSwipe = true;
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => { if (!this.didSwipe) this.move(pointer.x < 215 ? -1 : 1); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.roadView.destroy());
    this.roadView.update(0, this.simulation);
    this.renderVehicles();
    this.emitHud();
    this.options.onReady();
  }

  move(direction: -1 | 1) { this.simulation.move(direction); }

  setPaused(paused: boolean) {
    this.simulation.setPaused(paused);
    this.time.paused = this.simulation.paused;
    if (this.simulation.paused) this.tweens.pauseAll(); else this.tweens.resumeAll();
  }

  continueRace() {
    if (!this.simulation.continueRace()) return;
    this.time.paused = false;
    this.tweens.resumeAll();
    this.emitHud();
  }

  activateBoost() { return this.simulation.boost(); }

  private emitHud() {
    const state = this.simulation.state;
    this.options.onHud({
      score: state.score, speed: Math.round(state.speed), boost: Math.floor(state.charge),
      distance: Math.floor(state.distance), biome: BIOMES[biomeAt(state.distance)].name,
      ghost: state.clock < state.ghostUntil, combo: state.combo, overtakes: state.overtakes,
      bonuses: state.bonuses, lives: state.lives, countdown: Math.ceil(this.simulation.countdown),
      boosting: state.clock < state.boostUntil, nearMisses: state.nearMisses,
    });
  }

  private event(event: RaceEvent) {
    this.options.onSound?.(event.type);
    switch (event.type) {
      case 'start': this.roadView.notify('ПОЕХАЛИ', 'ДЕРЖИТЕ ТРАССУ', '#f6f8f0'); break;
      case 'boost': this.roadView.notify('4H BOOST', 'ПОЛНЫЙ ПРИВОД. ПОЛНЫЙ ГАЗ.', '#6df2ff'); break;
      case 'crash':
        if (!this.reducedMotion) this.cameras.main.shake(180, .004);
        this.roadView.burst(this.player.x, this.player.y - 50, 'crash');
        this.roadView.notify('−1 ЖИЗНЬ', '3 СЕКУНДЫ ЗАЩИТЫ', '#ffb18f');
        break;
      case 'exhausted':
        this.setPaused(true);
        this.emitHud();
        this.options.onExhausted();
        break;
      case 'bonus':
        this.roadView.burst(this.player.x, this.player.y - 65, 'bonus');
        this.roadView.notify('+10', 'БОНУС И ЗАРЯД УСКОРЕНИЯ', '#bdff97');
        break;
      case 'near': this.roadView.notify('НА ГРАНИ · +15', 'ЧИСТЫЙ ОБГОН', '#ffd17e'); break;
      case 'milestone':
        if (event.value && event.value % 1000 === 0) this.roadView.notify((event.value / 1000) + ' КМ', 'ПРОДОЛЖАЙТЕ В ТОМ ЖЕ ДУХЕ');
        break;
    }
  }

  private renderVehicles() {
    const { state, vehicles } = this.simulation;
    const active = new Set(vehicles.map(v => v.id));
    for (const [id, sprite] of this.sprites) if (!active.has(id)) { sprite.destroy(); this.sprites.delete(id); }
    this.signals.clear();
    for (const car of vehicles) {
      let sprite = this.sprites.get(car.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, car.kind === 'bonus' ? 'scenery' : 'atlas', car.kind === 'bonus' ? 'crate' : car.kind).setOrigin(.5, .86);
        this.sprites.set(car.id, sprite);
      }
      const p = this.roadView.project(car.z, car.x, state.distance);
      const width = car.width * p.scale;
      const ratio = sprite.frame.height / sprite.frame.width;
      sprite.setPosition(p.x, p.y).setDisplaySize(width, width * ratio).setDepth(p.y);
      sprite.setVisible(car.z > -8 && p.y > -30);
      sprite.setRotation(car.signal > 0 ? 0 : (car.lane === car.targetLane ? (car.x - (car.lane - 1) * 2.7) * -.02 : 0));
      if (car.kind === 'bonus') {
        this.signals.lineStyle(Math.max(1, p.scale * .04), 0xadff8f, .35 + Math.sin(state.clock * 5) * .2);
        this.signals.strokeEllipse(p.x, p.y + 2, width * 1.3, width * .55);
      }
      if (car.signal > 0 && Math.sin(state.clock * 12) > 0) {
        const side = car.targetLane > car.lane ? 1 : -1;
        this.signals.fillStyle(0xffbd3f, .95).fillEllipse(p.x + side * width * .37, p.y - width * .03, Math.max(2, width * .09), Math.max(2, width * .05));
      }
      if (car.speed < car.desiredSpeed - 1.3) for (const side of [-1, 1]) {
        this.signals.fillStyle(0xff3d2c, .8).fillEllipse(p.x + side * width * .34, p.y - width * .06, Math.max(2, width * .085), Math.max(1, width * .04));
      }
    }
    const hero = this.roadView.project(0, this.simulation.x, state.distance);
    const boosting = state.clock < state.boostUntil, ghost = state.clock < state.ghostUntil;
    const breathing = this.reducedMotion || this.simulation.countdown > 0 ? 0 : Math.sin(state.distance * 1.3) * .55;
    this.player.setPosition(hero.x, hero.y + breathing).setDisplaySize(2.32 * hero.scale, 3.49 * hero.scale).setDepth(hero.y + .1);
    this.player.setRotation(this.reducedMotion ? 0 : this.simulation.lateralVelocity * .007);
    this.player.setAlpha(ghost ? (this.reducedMotion ? .42 : .25 + (Math.sin(state.clock * 19) + 1) * .17) : 1);
    this.playerGlow.setPosition(hero.x, hero.y - 18).setDisplaySize(130, 170).setDepth(hero.y - 1).setAlpha(boosting ? .24 : ghost ? .1 : 0);
  }

  update(_time: number, deltaMs: number) {
    if (!this.player || this.failed || this.simulation.paused) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const events = this.simulation.step(dt);
    this.roadView.update(dt, this.simulation);
    this.renderVehicles();
    for (const event of events) this.event(event);
    const biome = biomeAt(this.simulation.state.distance);
    if (biome !== this.lastBiome) { this.lastBiome = biome; this.roadView.notify(BIOMES[biome].name, 'НОВЫЙ УЧАСТОК ТРАССЫ'); }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.emitHud(); this.hudTimer = .08; }
  }
}

import * as Phaser from 'phaser';
import { BIOMES, ROAD_HALF, biomeAt, clamp, laneWorldX, projectRoad, type RaceSimulation } from './model';

type Prop = { sprite: Phaser.GameObjects.Image; z: number; x: number; width: number; frame: string };
type Particle = { sprite: Phaser.GameObjects.Image; vx: number; vy: number; age: number; life: number; size: number };
const colorMix = (a: number, b: number, t: number) => {
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

export class RoadRenderer {
  private scene: Phaser.Scene;
  private ground: Phaser.GameObjects.TileSprite;
  private asphalt: Phaser.GameObjects.TileSprite;
  private roadMask: Phaser.GameObjects.Graphics;
  private paint: Phaser.GameObjects.Graphics;
  private atmosphere: Phaser.GameObjects.Graphics;
  private props: Prop[] = [];
  private particles: Particle[] = [];
  private lean = 0;
  private exhaustTimer = 0;
  private text?: Phaser.GameObjects.Container;
  private reducedMotion: boolean;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.makeMaterial('terrain', '#9da09c', .22);
    this.makeMaterial('asphalt', '#363b3c', .12);
    this.ground = scene.add.tileSprite(215, 390, 430, 780, 'terrain').setDepth(-10);
    this.asphalt = scene.add.tileSprite(215, 390, 430, 780, 'asphalt').setDepth(0);
    this.roadMask = scene.make.graphics({ x: 0, y: 0 });
    this.asphalt.setMask(this.roadMask.createGeometryMask());
    this.paint = scene.add.graphics().setDepth(1);
    this.atmosphere = scene.add.graphics().setDepth(1800);
    const glow = scene.textures.createCanvas('soft-particle', 64, 64)!;
    const gradient = glow.context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,.85)');
    gradient.addColorStop(.3, 'rgba(255,255,255,.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    glow.context.fillStyle = gradient; glow.context.fillRect(0, 0, 64, 64); glow.refresh();
    const vignette = scene.textures.createCanvas('vignette', 430, 780)!;
    const shade = vignette.context.createRadialGradient(215, 430, 130, 215, 400, 480);
    shade.addColorStop(0, 'rgba(2,8,14,0)');
    shade.addColorStop(.65, 'rgba(2,8,14,.06)');
    shade.addColorStop(1, 'rgba(2,8,14,.52)');
    vignette.context.fillStyle = shade; vignette.context.fillRect(0, 0, 430, 780); vignette.refresh();
    scene.add.image(215, 390, 'vignette').setDepth(1900);
    for (let i = 0; i < 64; i++) {
      const prop = { sprite: scene.add.image(0, 0, 'scenery', 'pine'), z: -7 + Math.floor(i / 2) * 4.3, x: 0, width: 3, frame: 'pine' };
      this.placeProp(prop, i, 0);
      this.props.push(prop);
    }
  }

  private makeMaterial(key: string, base: string, contrast: number) {
    const texture = this.scene.textures.createCanvas(key, 256, 256)!;
    const context = texture.context;
    context.fillStyle = base; context.fillRect(0, 0, 256, 256);
    let seed = 73127;
    for (let i = 0; i < 18000; i++) {
      seed = (seed * 16807) % 2147483647; const x = seed % 256;
      seed = (seed * 16807) % 2147483647; const y = seed % 256;
      context.fillStyle = i % 3 ? `rgba(0,0,0,${contrast})` : `rgba(240,246,238,${contrast})`;
      context.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
    }
    texture.refresh();
  }

  private placeProp(prop: Prop, index: number, distance: number) {
    const biome = BIOMES[biomeAt(distance + prop.z)];
    const side = index % 2 ? 1 : -1;
    prop.frame = index % 19 === 0 ? 'billboard' : index % 17 === 0 ? 'warehouse' : index % 11 === 0 ? 'cottage' : index % 5 === 0 ? 'rocks' : biome.tree;
    const tree = ['pine', 'autumn', 'snow-pine'].includes(prop.frame);
    prop.width = tree ? 2.7 + (index % 3) * .55 : prop.frame === 'cottage' ? 5.7 : prop.frame === 'warehouse' ? 6.4 : prop.frame === 'billboard' ? 3.9 : 2.1;
    prop.x = side * (tree ? 5.8 + (index % 4) * 1.35 : prop.frame === 'rocks' ? 5.3 : prop.frame === 'billboard' ? 6.8 : 9);
    prop.sprite.setTexture('scenery', prop.frame).setOrigin(.5, .91);
    prop.sprite.setFlipX(tree && index % 3 === 0);
  }

  project(z: number, x: number, distance: number) { return projectRoad(z, x, distance, this.lean); }

  notify(title: string, subtitle = '', color = '#fff1d4') {
    if (this.text) { this.scene.tweens.killTweensOf(this.text); this.text.destroy(); }
    const headline = this.scene.add.text(0, 0, title, { fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color, stroke: '#0a1516', strokeThickness: 5 }).setOrigin(.5);
    const detail = this.scene.add.text(0, 31, subtitle, { fontFamily: 'Arial', fontSize: '12px', color: '#e3e9e8', stroke: '#0a1516', strokeThickness: 3 }).setOrigin(.5);
    this.text = this.scene.add.container(215, 265, [headline, detail]).setDepth(2200).setAlpha(0).setScale(.9);
    const current = this.text;
    this.scene.tweens.add({ targets: current, alpha: 1, scale: 1, duration: 160, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: current, alpha: 0, y: 235, delay: 1150, duration: 420, onComplete: () => { if (this.text === current) this.text = undefined; current.destroy(); } });
  }

  burst(x: number, y: number, kind: 'crash' | 'bonus' | 'boost' | 'dust') {
    if (this.reducedMotion && kind === 'dust') return;
    const count = kind === 'crash' ? 24 : kind === 'bonus' ? 14 : 6;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 90) break;
      const spark = kind === 'crash';
      const sprite = this.scene.add.image(x, y, 'soft-particle').setDepth(1500);
      sprite.setTint(spark ? (i % 2 ? 0xff9c35 : 0xffe49c) : kind === 'bonus' ? 0xc5ff8f : kind === 'boost' ? 0x46e6ff : 0xb3afa1);
      if (spark || kind === 'bonus' || kind === 'boost') sprite.setBlendMode(Phaser.BlendModes.ADD);
      this.particles.push({ sprite, vx: (Math.random() - .5) * (spark ? 230 : 75), vy: (Math.random() - .4) * 180, age: 0, life: .35 + Math.random() * .45, size: spark ? 6 : kind === 'dust' ? 25 : 15 });
    }
  }

  update(dt: number, simulation: RaceSimulation) {
    const state = simulation.state;
    const boosting = state.clock < state.boostUntil;
    this.lean += (simulation.x * .085 - this.lean) * (1 - Math.exp(-dt * 3));
    const bIndex = biomeAt(state.distance), previous = BIOMES[(bIndex + 2) % 3], biome = BIOMES[bIndex];
    const transition = state.distance < 750 ? 1 : clamp((state.distance % 750) / 50, 0, 1);
    this.ground.setTint(colorMix(previous.ground, biome.ground, transition));
    this.ground.tilePositionY = -state.distance * 13;
    this.asphalt.tilePositionY = -state.distance * 18;
    const g = this.paint;
    g.clear();
    const p = (z: number, x: number) => this.project(z, x, state.distance);
    const quad = (z1: number, z2: number, x1: number, x2: number, color: number, alpha = 1, rise = 0) => {
      const points = [p(z1, x1), p(z1, x2), p(z2, x2), p(z2, x1)];
      if (rise) for (const point of points) point.y -= point.scale * rise;
      g.fillStyle(color, alpha).fillPoints(points, true);
    };
    const zs = Array.from({ length: 76 }, (_, i) => -1.7 + (i / 75) ** 1.9 * 162);
    const outline = [...zs.map(z => p(z, -ROAD_HALF)), ...zs.slice().reverse().map(z => p(z, ROAD_HALF))];
    this.roadMask.clear().fillStyle(0xffffff).fillPoints(outline, true);
    // Geometry is drawn far to near. All phases are in world metres, including curbs and lane markings.
    for (let i = zs.length - 2; i >= 0; i--) {
      const z1 = zs[i], z2 = zs[i + 1];
      const localBiome = BIOMES[biomeAt(state.distance + Math.max(0, z1))];
      for (const side of [-1, 1]) {
        quad(z1, z2, side * ROAD_HALF, side * (ROAD_HALF + .48), localBiome.verge);
        quad(z1, z2, side * (ROAD_HALF - .17), side * (ROAD_HALF - .13), 0xf4efdc, .68);
      }
      for (const lane of [0, 1, 2]) for (const side of [-1, 1]) {
        const x = laneWorldX(lane) + side * .63;
        quad(z1, z2, x - .13, x + .13, 0x080e12, .095);
      }
      quad(z1, z2, -ROAD_HALF, ROAD_HALF, 0x101a1f, clamp(z1 / 180, 0, .3));
    }
    const startMark = Math.floor((state.distance - 2) / 7) * 7;
    for (let world = startMark; world < state.distance + 155; world += 7) {
      const z = Math.max(-1.7, world - state.distance), end = Math.max(-1.7, world + 3.1 - state.distance);
      if (end <= -1.7) continue;
      for (const x of [-1.35, 1.35]) quad(z, end, x - .035, x + .035, 0xe6e6d8, .76);
    }
    for (let world = Math.floor((state.distance - 2) / 2) * 2; world < state.distance + 135; world += 2) {
      const z = Math.max(-1.7, world - state.distance), end = Math.max(-1.7, world + 2 - state.distance);
      if (end <= -1.7) continue;
      for (const side of [-1, 1]) {
        quad(z, end, side * ROAD_HALF, side * (ROAD_HALF + .12), Math.round(world / 2) % 2 ? 0xe8e8de : 0xa95141);
        if (Math.round(world / 2) % 2 === 0) {
          const a = p(z, side * (ROAD_HALF + .65));
          g.lineStyle(Math.max(.5, a.scale * .052), 0x525d5a, .85).lineBetween(a.x, a.y, a.x, a.y - a.scale * .6);
          g.lineStyle(Math.max(.5, a.scale * .017), 0xdbded6, .8).lineBetween(a.x - 1, a.y, a.x - 1, a.y - a.scale * .6);
        }
      }
    }
    for (let i = zs.length - 2; i >= 0; i--) for (const side of [-1, 1]) {
      quad(zs[i], zs[i + 1], side * (ROAD_HALF + .55), side * (ROAD_HALF + .69), 0xb7c1bc, .85, .53);
    }
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i];
      if (simulation.countdown <= 0) prop.z -= state.speed / 3.6 * dt;
      if (prop.z < -9) { prop.z += 138; this.placeProp(prop, i, state.distance); }
      const position = p(prop.z, prop.x);
      const frame = this.scene.textures.getFrame('scenery', prop.frame);
      const width = prop.width * position.scale;
      prop.sprite.setPosition(position.x, position.y).setDisplaySize(width, width * frame.height / frame.width).setDepth(position.y);
      prop.sprite.setVisible(position.y > -50 && position.y < 1550 && position.x + width > -40 && position.x - width < 470);
      prop.sprite.setAlpha(clamp(1 - prop.z / 400, .68, 1));
    }
    const fog = this.atmosphere; fog.clear();
    for (let i = 0; i < 10; i++) fog.fillStyle(biome.sky, (1 - i / 10) * .12).fillRect(0, i * 12, 430, 12);
    if (bIndex === 2) for (let i = 0; i < 36; i++) {
      const x = (i * 97 + Math.sin(state.clock + i) * 11 + 430) % 430;
      const y = (i * 53 + state.clock * 43) % 780;
      fog.fillStyle(0xf5fcff, .65).fillCircle(x, y, i % 3 === 0 ? 1.5 : .8);
    }
    if (boosting && !this.reducedMotion) for (let i = 0; i < 10; i++) {
      const x = i % 2 ? 12 + i * 3 : 418 - i * 3, y = (i * 81 + state.clock * 700) % 780;
      fog.lineStyle(1, 0xb5f3ff, .22).lineBetween(x, y, x + (x - 215) * .09, y + 65);
    }
    const hero = p(0, simulation.x);
    this.exhaustTimer -= dt;
    if (this.exhaustTimer <= 0 && simulation.countdown <= 0) {
      if (boosting) this.burst(hero.x, hero.y + 4, 'boost');
      else if (Math.abs(simulation.lateralVelocity) > 2) this.burst(hero.x, hero.y, 'dust');
      this.exhaustTimer = boosting ? .11 : .2;
    }
    for (const particle of this.particles) {
      particle.age += dt;
      const t = particle.age / particle.life;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += (particle.vy + 50) * dt;
      particle.sprite.setAlpha(Math.max(0, (1 - t) * .72)).setDisplaySize(particle.size * (1 + t * 1.6), particle.size * (1 + t * 1.6));
    }
    this.particles = this.particles.filter(particle => { if (particle.age >= particle.life) { particle.sprite.destroy(); return false; } return true; });
  }

  destroy() {
    this.roadMask.destroy();
    this.particles.forEach(particle => particle.sprite.destroy());
    this.particles = [];
  }
}

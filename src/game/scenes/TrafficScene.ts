import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, LANE_X, ROAD_LEFT, ROAD_RIGHT } from '@/src/config/game';

export type HudState = {
  score: number;
  speed: number;
  boost: number;
};

export type TrafficSceneOptions = {
  carColor: string;
  onHud: (hud: HudState) => void;
  onCrash: (score: number) => void;
};

type MovingObject = Phaser.GameObjects.GameObject & {
  y: number;
  x: number;
  setPosition: (x: number, y: number) => unknown;
  getData: (key: string) => unknown;
  setData: (key: string, value: unknown) => unknown;
  destroy: () => void;
};

export class TrafficScene extends Phaser.Scene {
  private options: TrafficSceneOptions;
  private player!: Phaser.Physics.Arcade.Image;
  private traffic!: Phaser.Physics.Arcade.Group;
  private bonuses!: Phaser.Physics.Arcade.Group;
  private roadMarks!: Phaser.GameObjects.Group;
  private scenery!: Phaser.GameObjects.Group;
  private currentLane = 1;
  private worldSpeed = 250;
  private distance = 0;
  private bonusScore = 0;
  private spawnTimer = 400;
  private bonusTimer = 4200;
  private hudTimer = 0;
  private boostCharge = 100;
  private boostUntil = 0;
  private crashed = false;
  private pausedByPlayer = false;
  private pointerStartX = 0;

  constructor(options: TrafficSceneOptions) {
    super({ key: 'TrafficScene' });
    this.options = options;
  }

  create() {
    this.cameras.main.setBackgroundColor('#173d29');
    this.createTextures();
    this.drawWorld();

    this.traffic = this.physics.add.group();
    this.bonuses = this.physics.add.group();
    this.player = this.physics.add.image(LANE_X[1], 620, 'player-pickup').setDepth(8);
    this.player.body?.setSize(45, 92).setOffset(10, 12);

    this.physics.add.overlap(this.player, this.traffic, () => this.crash());
    this.physics.add.overlap(this.player, this.bonuses, (_player, bonus) => {
      const box = bonus as Phaser.Physics.Arcade.Image;
      const boxLabel = box.getData('label') as Phaser.GameObjects.Text | undefined;
      boxLabel?.destroy();
      box.destroy();
      this.bonusScore += 10;
      this.cameras.main.flash(100, 66, 255, 148, false);
      const label = this.add
        .text(this.player.x + 40, this.player.y - 40, '+10', {
          fontFamily: 'Arial Black',
          fontSize: '22px',
          color: '#a4ff70',
          stroke: '#15361f',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(20);
      this.tweens.add({ targets: label, y: label.y - 60, alpha: 0, duration: 650, onComplete: () => label.destroy() });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointerStartX = pointer.x;
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const distance = pointer.x - this.pointerStartX;
      if (Math.abs(distance) > 28) this.move(distance > 0 ? 1 : -1);
      else this.move(pointer.x < GAME_WIDTH / 2 ? -1 : 1);
    });

    const keys = this.input.keyboard?.addKeys('A,D,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    keys?.A.on('down', () => this.move(-1));
    keys?.LEFT.on('down', () => this.move(-1));
    keys?.D.on('down', () => this.move(1));
    keys?.RIGHT.on('down', () => this.move(1));
  }

  private createTextures() {
    const trafficColors = [0xef3e4d, 0xffc63d, 0x49bff1, 0xa16cec, 0xf37935, 0xd8e3ea];
    trafficColors.forEach((color, index) => this.drawVehicleTexture(`traffic-${index}`, color, false));
    const playerColor = Phaser.Display.Color.HexStringToColor(this.options.carColor).color;
    this.drawVehicleTexture('player-pickup', playerColor, true);

    const box = this.add.graphics();
    box.fillStyle(0xbd7929).fillRoundedRect(2, 5, 42, 40, 4);
    box.lineStyle(3, 0xf2bd55).strokeRoundedRect(2, 5, 42, 40, 4);
    box.lineStyle(3, 0x7a4519).lineBetween(4, 8, 42, 43).lineBetween(42, 8, 4, 43);
    box.generateTexture('bonus-box', 46, 48).destroy();
  }

  private drawVehicleTexture(key: string, color: number, pickup: boolean) {
    const width = pickup ? 66 : 50;
    const height = pickup ? 118 : 94;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x05090d, 0.55).fillRoundedRect(6, 8, width - 4, height - 4, 14);
    graphics.fillStyle(0x080d12);
    graphics.fillRoundedRect(0, 18, 7, 27, 2).fillRoundedRect(width - 7, 18, 7, 27, 2);
    graphics.fillRoundedRect(0, height - 43, 7, 27, 2).fillRoundedRect(width - 7, height - 43, 7, 27, 2);
    graphics.fillStyle(color).fillRoundedRect(5, 2, width - 10, height - 7, pickup ? 15 : 12);
    graphics.lineStyle(2, 0xdbe9ef, 0.35).strokeRoundedRect(8, 5, width - 16, height - 13, 12);
    graphics.fillStyle(0x183140).fillRoundedRect(12, 25, width - 24, pickup ? 34 : 27, 7);
    graphics.fillStyle(0x8bd5eb, 0.8).fillRoundedRect(15, 28, width - 30, 10, 4);
    graphics.fillStyle(0x0d171d).fillRect(width / 2 - 2, 25, 4, pickup ? 35 : 28);
    if (pickup) {
      graphics.fillStyle(0x111b21).fillRoundedRect(11, 69, width - 22, 34, 5);
      graphics.lineStyle(2, 0x81939e, 0.6).strokeRoundedRect(14, 72, width - 28, 27, 4);
      graphics.lineBetween(15, 86, width - 15, 86);
    } else {
      graphics.fillStyle(0x172b38).fillRoundedRect(12, 59, width - 24, 18, 5);
    }
    graphics.fillStyle(0xedfaff).fillRoundedRect(10, 6, 13, 7, 3).fillRoundedRect(width - 23, 6, 13, 7, 3);
    graphics.fillStyle(0xff2d4f).fillRect(10, height - 13, 14, 7).fillRect(width - 24, height - 13, 14, 7);
    graphics.generateTexture(key, width, height).destroy();
  }

  private drawWorld() {
    const world = this.add.graphics();
    world.fillGradientStyle(0x1c6c3c, 0x236f3c, 0x10462a, 0x164f2c, 1);
    world.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    world.fillStyle(0xbfc9c8).fillRect(ROAD_LEFT - 12, 0, ROAD_RIGHT - ROAD_LEFT + 24, GAME_HEIGHT);
    world.fillStyle(0x242c34).fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, GAME_HEIGHT);
    world.fillStyle(0x333d47, 0.65).fillRect(ROAD_LEFT + 4, 0, ROAD_RIGHT - ROAD_LEFT - 8, GAME_HEIGHT);

    this.roadMarks = this.add.group();
    for (let y = -120; y < GAME_HEIGHT + 120; y += 110) {
      [158, 272].forEach((x) => {
        const mark = this.add.rectangle(x, y, 5, 54, 0xe7edef, 0.92).setDepth(2);
        this.roadMarks.add(mark);
      });
      const curbLeft = this.add.rectangle(ROAD_LEFT - 6, y, 12, 55, 0xf3f3f0).setDepth(2);
      const curbRight = this.add.rectangle(ROAD_RIGHT + 6, y, 12, 55, 0xf3f3f0).setDepth(2);
      const curbLeftRed = this.add.rectangle(ROAD_LEFT - 6, y + 55, 12, 55, 0xd93b45).setDepth(2);
      const curbRightRed = this.add.rectangle(ROAD_RIGHT + 6, y + 55, 12, 55, 0xd93b45).setDepth(2);
      this.roadMarks.addMultiple([curbLeft, curbRight, curbLeftRed, curbRightRed]);
    }

    this.scenery = this.add.group();
    for (let y = -90; y < GAME_HEIGHT + 100; y += 145) {
      this.addTree(18, y);
      this.addTree(411, y + 72);
    }
    this.addBillboard(15, 210);
    this.addBillboard(414, 500);
  }

  private addTree(x: number, y: number) {
    const shadow = this.add.circle(x + 4, y + 7, 18, 0x07150d, 0.24).setDepth(1);
    const crown = this.add.circle(x, y, 17, 0x1a9b50).setDepth(2);
    const light = this.add.circle(x - 6, y - 6, 8, 0x62d76e).setDepth(2);
    [shadow, crown, light].forEach((part) => {
      part.setData('kind', 'tree');
      part.setData('groupY', y);
      this.scenery.add(part);
    });
  }

  private addBillboard(x: number, y: number) {
    const side = x < GAME_WIDTH / 2 ? 1 : -1;
    const board = this.add.rectangle(x + side * 5, y, 54, 30, 0x0a1118).setStrokeStyle(2, 0xff6817).setDepth(3);
    const text = this.add.text(x + side * 5, y, 'SOLLERS', {
      fontFamily: 'Arial Black',
      fontSize: '8px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(4);
    const post = this.add.rectangle(x + side * 5, y + 24, 4, 22, 0x7d8989).setDepth(2);
    [board, text, post].forEach((part) => {
      part.setData('kind', 'billboard');
      this.scenery.add(part);
    });
  }

  move(direction: -1 | 1) {
    if (this.crashed || this.pausedByPlayer) return;
    this.currentLane = Phaser.Math.Clamp(this.currentLane + direction, 0, LANE_X.length - 1);
    this.tweens.killTweensOf(this.player);
    this.tweens.add({ targets: this.player, x: LANE_X[this.currentLane], duration: 145, ease: 'Cubic.Out' });
  }

  setPaused(paused: boolean) {
    if (this.crashed) return;
    this.pausedByPlayer = paused;
    this.physics.world.isPaused = paused;
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
  }

  activateBoost() {
    if (this.crashed || this.pausedByPlayer || this.boostCharge < 100) return false;
    this.boostCharge = 0;
    this.boostUntil = this.time.now + 4000;
    this.cameras.main.flash(140, 64, 224, 255, false);
    return true;
  }

  private spawnTraffic() {
    const lane = Phaser.Math.Between(0, 2);
    const nearest = this.traffic.getChildren().some((child) => {
      const car = child as Phaser.Physics.Arcade.Image;
      return car.getData('lane') === lane && car.y < 145;
    });
    if (nearest) return;
    const texture = `traffic-${Phaser.Math.Between(0, 5)}`;
    const car = this.traffic.create(LANE_X[lane], -105, texture) as Phaser.Physics.Arcade.Image;
    car.setDepth(6).setData('lane', lane).setData('pace', Phaser.Math.Between(-25, 45));
    car.body?.setSize(38, 75).setOffset(6, 10);
  }

  private spawnBonus() {
    const lane = Phaser.Math.Between(0, 2);
    const box = this.bonuses.create(LANE_X[lane], -55, 'bonus-box') as Phaser.Physics.Arcade.Image;
    box.setDepth(5).setData('lane', lane);
    const plus = this.add.text(box.x, box.y, '+10', {
      fontFamily: 'Arial Black',
      fontSize: '13px',
      color: '#c7ff83',
      stroke: '#15361f',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(7).setData('bonusLabel', box);
    box.setData('label', plus);
  }

  private crash() {
    if (this.crashed) return;
    this.crashed = true;
    this.player.setTint(0xff6b6b);
    this.cameras.main.shake(330, 0.018);
    this.physics.world.isPaused = true;
    const score = Math.floor(this.distance / 11) + this.bonusScore;
    this.time.delayedCall(650, () => this.options.onCrash(score));
  }

  private puffExhaust() {
    const puff = this.add.circle(this.player.x + Phaser.Math.Between(-9, 9), this.player.y + 61, Phaser.Math.Between(4, 8), 0xdce4e6, 0.35).setDepth(4);
    this.tweens.add({ targets: puff, y: puff.y + 34, alpha: 0, scale: 1.8, duration: 520, onComplete: () => puff.destroy() });
  }

  update(time: number, deltaMs: number) {
    if (this.crashed || this.pausedByPlayer) return;
    const delta = Math.min(deltaMs, 50) / 1000;
    const boostActive = time < this.boostUntil;
    this.worldSpeed = Math.min(420, 250 + this.distance * 0.012) + (boostActive ? 105 : 0);
    this.distance += this.worldSpeed * delta;
    this.spawnTimer -= deltaMs;
    this.bonusTimer -= deltaMs;
    this.hudTimer -= deltaMs;
    if (!boostActive) this.boostCharge = Math.min(100, this.boostCharge + delta * 9);

    if (this.spawnTimer <= 0) {
      this.spawnTraffic();
      this.spawnTimer = Math.max(500, 980 - this.distance * 0.015) + Phaser.Math.Between(0, 230);
    }
    if (this.bonusTimer <= 0) {
      this.spawnBonus();
      this.bonusTimer = Phaser.Math.Between(5600, 8000);
    }

    this.roadMarks.getChildren().forEach((child) => {
      const mark = child as MovingObject;
      mark.y += this.worldSpeed * delta;
      if (mark.y > GAME_HEIGHT + 70) mark.y -= 990;
    });
    this.scenery.getChildren().forEach((child) => {
      const object = child as MovingObject;
      object.y += this.worldSpeed * 0.72 * delta;
      if (object.y > GAME_HEIGHT + 80) object.y -= 1015;
    });
    this.traffic.getChildren().forEach((child) => {
      const car = child as Phaser.Physics.Arcade.Image;
      car.y += (this.worldSpeed * 0.74 + Number(car.getData('pace'))) * delta;
      if (car.y > GAME_HEIGHT + 120) car.destroy();
    });
    this.bonuses.getChildren().forEach((child) => {
      const box = child as Phaser.Physics.Arcade.Image;
      box.y += this.worldSpeed * 0.9 * delta;
      const label = box.getData('label') as Phaser.GameObjects.Text | undefined;
      if (label) label.setPosition(box.x, box.y);
      if (box.y > GAME_HEIGHT + 80) {
        label?.destroy();
        box.destroy();
      }
    });

    if (Math.floor(time / 130) !== Math.floor((time - deltaMs) / 130)) this.puffExhaust();

    if (this.hudTimer <= 0) {
      const score = Math.floor(this.distance / 11) + this.bonusScore;
      this.options.onHud({
        score,
        speed: Math.round(82 + (this.worldSpeed - 250) * 0.32),
        boost: Math.round(this.boostCharge),
      });
      this.hudTimer = 100;
    }
  }
}

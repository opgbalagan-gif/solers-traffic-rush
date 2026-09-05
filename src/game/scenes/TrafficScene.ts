import * as Phaser from 'phaser';
import { assetUrl } from '@/src/config/game';
import { PAINT_FILTERS } from '@/src/ui/Visuals';
import { advanceRun, BIOMES, biomeAt, clamp, depthScale, hitTest, laneX, roadHalf } from '@/src/game/model';

export type HudState = { score: number; speed: number; boost: number; distance: number; biome: string; ghost: boolean; combo: number; overtakes: number; bonuses: number; lives: number };
export type TrafficSceneOptions = { carColor: string; onHud: (hud: HudState) => void; onReady: () => void; onError: () => void; onExhausted: () => void };
type RoadObject = { sprite: Phaser.GameObjects.Image; y: number; lane: number; width: number; ratio: number; kind: 'traffic' | 'bonus'; passed?: boolean; pace: number };
type Tree = { sprite: Phaser.GameObjects.Image; y: number; side: number; offset: number };
const FRAMES: [string, number, number, number, number][] = [
  ['pickup-black', 48, 22, 312, 469], ['pickup-pink', 427, 20, 308, 470],
  ['blue', 813, 88, 295, 386], ['yellow', 1197, 95, 294, 380],
  ['red', 45, 550, 313, 432], ['white', 430, 545, 306, 431],
  ['truck', 816, 503, 295, 477], ['tree', 1155, 520, 373, 474],
];
export class TrafficScene extends Phaser.Scene {
  private options: TrafficSceneOptions;
  private player!: Phaser.GameObjects.Image;
  private world!: Phaser.GameObjects.Graphics;
  private roadTexture!: Phaser.GameObjects.TileSprite;
  private roadObjects: RoadObject[] = [];
  private trees: Tree[] = [];
  private run = { clock: 0, distance: 0, charge: 100, boostUntil: 0, ghostUntil: 0 };
  private speed = 100;
  private currentLane = 1;
  private steer = 1;
  private pausedByPlayer = false;
  private spawnTimer = 1;
  private bonusTimer = 5;
  private hudTimer = 0;
  private bonusScore = 0;
  private combo = 0;
  private overtakes = 0;
  private bonuses = 0;
  private biome = -1;
  private pointerStartX = 0;
  private lastLane = -1;
  private failed = false;
  private lives = 3;

  constructor(options: TrafficSceneOptions) {
    super({ key: 'TrafficScene' });
    this.options = options;
  }
  preload() {
    this.load.image('atlas', assetUrl('/art/traffic-atlas.png'));
    this.load.on('loaderror', () => { this.failed = true; this.options.onError(); });
  }
  create() {
    if (this.failed || !this.textures.exists('atlas')) return;
    FRAMES.forEach(([name, x, y, w, h]) => this.textures.get('atlas').add(name, 0, x, y, w, h));
    const frame = this.options.carColor === '#10161d' ? 'pickup-black' : 'pickup-pink';
    const source = this.textures.getFrame('atlas', frame);
    const paint = this.textures.createCanvas('player-paint', source.width, source.height)!;
    paint.context.filter = this.options.carColor === '#10161d' ? 'none' : (PAINT_FILTERS[this.options.carColor] || 'none');
    paint.context.drawImage(this.textures.get('atlas').getSourceImage() as HTMLImageElement, source.cutX, source.cutY, source.cutWidth, source.cutHeight, 0, 0, source.width, source.height);
    paint.refresh();
    this.world = this.add.graphics().setDepth(0);
    const asphalt = this.textures.createCanvas('asphalt', 128, 128)!;
    const ctx = asphalt.context;
    ctx.fillStyle = '#333638'; ctx.fillRect(0, 0, 128, 128);
    let seed = 713;
    for (let i = 0; i < 6500; i++) {
      seed = (seed * 16807) % 2147483647; const x = seed % 128;
      seed = (seed * 16807) % 2147483647; const y = seed % 128;
      ctx.fillStyle = i % 2 ? 'rgba(220,224,218,.075)' : 'rgba(0,0,0,.15)';
      ctx.fillRect(x, y, 1, 1);
    }
    asphalt.refresh();
    this.roadTexture = this.add.tileSprite(215, 390, 430, 780, 'asphalt').setDepth(1);
    const mask = this.make.graphics({});
    mask.fillStyle(0xffffff).fillPoints([{x:151,y:0},{x:279,y:0},{x:445,y:780},{x:-15,y:780}],true);
    this.roadTexture.setMask(mask.createGeometryMask());
    this.world = this.add.graphics().setDepth(2);
    for(let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const sprite = this.add.image(0, 0, 'atlas', 'tree').setOrigin(.5,.9);
      this.trees.push({ sprite, y: -100 + Math.floor(i/2) * 77, side, offset: 18 + (i * 37) % 75 });
    }
    this.player = this.add.image(215, 624, 'player-paint').setDisplaySize(101, 152).setDepth(630);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.pointerStartX = pointer.x; });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.pointerStartX;
      this.move(Math.abs(dx) > 20 ? (dx > 0 ? 1 : -1) : (pointer.x < 215 ? -1 : 1));
    });
    this.options.onReady();
    this.spawnTraffic(0, 140); this.spawnTraffic(2, 350);
    this.emitHud();
  }
  move(direction: -1 | 1) {
    if (this.pausedByPlayer || !this.player) return;
    this.currentLane = clamp(this.currentLane + direction, 0, 2);
  }
  setPaused(paused: boolean) {
    if (!paused && this.lives === 0) return;
    this.pausedByPlayer = paused;
    if (paused) this.tweens.pauseAll(); else this.tweens.resumeAll();
  }
  continueRace() {
    this.lives = 3;
    this.run.ghostUntil = this.run.clock + 3;
    this.setPaused(false);
    this.emitHud();
  }
  activateBoost() {
    if (this.pausedByPlayer || !this.player || this.run.charge < 100) return false;
    this.run.charge = 0; this.run.boostUntil = this.run.clock + 4;
    this.floatingText('4H BOOST', '#2aeaf8', 570);
    return true;
  }
  private spawnTraffic(forcedLane?: number, startY = -75) {
    let lane = forcedLane ?? Phaser.Math.Between(0,2);
    if (lane === this.lastLane) lane = (lane + 1 + Phaser.Math.Between(0,1)) % 3;
    this.lastLane = lane;
    const keys = ['blue','yellow','red','white','truck'];
    const key = keys[Phaser.Math.Between(0,4)];
    const sprite = this.add.image(0,0,'atlas',key);
    const frame = this.textures.getFrame('atlas',key);
    this.roadObjects.push({ sprite, y: startY, lane, width: key === 'truck' ? 100 : 82, ratio: frame.height/frame.width, kind: 'traffic', pace: Phaser.Math.FloatBetween(.86,1.1) });
  }
  private spawnBonus() {
    // A readable functional collectible, distinct from all traffic.
    const canvas = this.textures.exists('bonus') ? null : this.textures.createCanvas('bonus',64,64);
    if(canvas) {
      const c=canvas.context; c.fillStyle='#b78538'; c.fillRect(8,8,48,48);
      c.strokeStyle='#f6c765'; c.lineWidth=4;c.strokeRect(8,8,48,48);
      c.beginPath();c.moveTo(8,8);c.lineTo(56,56);c.moveTo(56,8);c.lineTo(8,56);c.stroke();
      c.fillStyle='#87ed88';c.font='bold 25px Arial';c.textAlign='center';c.fillText('+',32,40);canvas.refresh();
    }
    let lane = Phaser.Math.Between(0,2);
    const nearby = this.roadObjects.filter(o=>o.y < 130).map(o=>o.lane);
    lane = [0,1,2].find(l=>!nearby.includes(l)) ?? lane;
    this.roadObjects.push({sprite:this.add.image(0,0,'bonus'),y:-60,lane,width:47,ratio:1,kind:'bonus',pace:1});
  }
  private floatingText(text:string,color:string,y=530) {
    const label = this.add.text(215,y,text,{fontFamily:'Arial',fontStyle:'bold',fontSize:'22px',color,stroke:'#08120d',strokeThickness:5}).setOrigin(.5).setDepth(1900);
    this.tweens.add({targets:label,y:y-45,alpha:0,duration:1100,onComplete:()=>label.destroy()});
  }
  private crash() {
    if(this.run.clock < this.run.ghostUntil) return;
    this.run.ghostUntil = this.run.clock + 2.8;
    this.lives--;
    this.combo=0;
    this.cameras.main.shake(180,.006);
    this.floatingText('ПРОЗРАЧНОСТЬ · 3 СЕК', '#e1f4ff');
    this.game.events.emit('race-sound','crash');
    if (this.lives === 0) {
      this.setPaused(true);
      this.emitHud();
      this.options.onExhausted();
    }
  }
  private emitHud() {
    this.options.onHud({score:Math.floor(this.run.distance/10)+this.bonusScore,speed:Math.round(this.speed),boost:Math.floor(this.run.charge),distance:Math.floor(this.run.distance),biome:BIOMES[biomeAt(this.run.distance)].name,ghost:this.run.clock < this.run.ghostUntil,combo:this.combo,overtakes:this.overtakes,bonuses:this.bonuses,lives:this.lives});
  }
  private drawRoad(dt:number, boosting:boolean) {
    const b = BIOMES[biomeAt(this.run.distance)];
    this.cameras.main.setBackgroundColor(b.ground);
    this.roadTexture.tilePositionY -= this.speed * dt * 3;
    const g=this.world;g.clear();
    const poly=(points:{x:number;y:number}[],color:number,alpha=1)=>{g.fillStyle(color,alpha);g.fillPoints(points,true);};
    const edge=(y:number,side:number,off=0)=>({x:215+side*(roadHalf(y)+off),y});
    for(const side of [-1,1]) {
      poly([edge(0,side,2),edge(0,side,14),edge(780,side,14),edge(780,side,2)],b.verge);
      for(let i=-1;i<20;i++) {
        const z=(i + (this.run.distance*.055)%1)/18;
        const z2=z+1/36;
        const y=z*z*850-40, y2=z2*z2*850-40;
        if(y2<0||y>790) continue;
        poly([edge(y,side),edge(y,side,5),edge(y2,side,5),edge(y2,side)],0xd8d9d0);
        const y3=(z+1/18)**2*850-40;
        poly([edge(y2,side),edge(y2,side,5),edge(y3,side,5),edge(y3,side)],0x9f463a);
      }
      g.lineStyle(1.5,0xf1e7ce,.7).lineBetween(215+side*61,0,215+side*227,780);
    }
    for(let i=-1;i<20;i++) {
      const z=(i+(this.run.distance*.033)%1)/17;
      const y=z*z*900-60, y2=(z+.023)**2*900-60;
      if(y2<0||y>790)continue;
      for(const fraction of [-1/3,1/3]) {
        const x=215+roadHalf(y)*fraction, x2=215+roadHalf(y2)*fraction;
        poly([{x:x-1,y},{x:x+1,y},{x:x2+1.8,y:y2},{x:x2-1.8,y:y2}],0xe7e7d7,.6);
      }
    }
    // Subtle wheel tracks in the asphalt material.
    for(const lane of [0,1,2]) for(const side of [-1,1]){
      g.lineStyle(10,0x080c0e,.07).lineBetween(laneX(lane,0)+side*12,0,laneX(lane,780)+side*27,780);
    }
    if(boosting) {
      for(let i=0;i<12;i++){
        const x=(i*103)%430, y=(i*157+this.run.clock*650)%780;
        g.lineStyle(1,0x83e9ed,.22).lineBetween(x,y,x+(x-215)*.06,y+45);
      }
    }
    for(const tree of this.trees) {
      tree.y += (35+Math.max(0,tree.y)*.6) * dt * this.speed/100;
      if(tree.y > 1000)tree.y=-70;
      const scale=depthScale(tree.y);
      tree.sprite.setPosition(215+tree.side*(roadHalf(tree.y)+tree.offset*scale),tree.y);
      tree.sprite.setDisplaySize((88+tree.offset*.4)*scale,(110+tree.offset*.5)*scale).setDepth(tree.y+20).setTint(b.tree);
    }
    // Atmospheric haze at the far end of the road.
    for(let j=0;j<8;j++){g.fillStyle(b.sky,.025*(8-j));g.fillRect(0,j*18,430,18);}
    if(biomeAt(this.run.distance)===2) for(let i=0;i<45;i++){
      const x=(i*97+Math.sin(this.run.clock+i)*13)%430;
      const y=(i*51+this.run.clock*35)%780;
      g.fillStyle(0xffffff,.55).fillCircle(x,y,i%3===0?1.7:1);
    }
  }
  update(_time:number, deltaMs:number) {
    if(this.pausedByPlayer||!this.player||this.failed)return;
    const dt=Math.min(deltaMs,50)/1000;
    const next=advanceRun(this.run,dt);this.run=next;this.speed=next.speed;
    const newBiome=biomeAt(this.run.distance);
    if(newBiome!==this.biome){if(this.biome>=0)this.floatingText(BIOMES[newBiome].name,'#ffffff',190);this.biome=newBiome;}
    this.drawRoad(dt,next.boost);
    this.steer += (this.currentLane-this.steer)*Math.min(1,dt*13);
    this.player.x=laneX(this.steer,624);
    this.player.rotation=(this.currentLane-this.steer)*.055;
    const ghost=this.run.clock<this.run.ghostUntil;
    this.player.setAlpha(ghost ? (.18 + (Math.sin(this.run.clock*24)+1)*.19) : 1);
    this.spawnTimer-=dt; this.bonusTimer-=dt; this.hudTimer-=dt;
    if(this.spawnTimer<=0){this.spawnTraffic();this.spawnTimer=Math.max(.85,1.5-this.run.distance*.00012);}
    if(this.bonusTimer<=0){this.spawnBonus();this.bonusTimer=Phaser.Math.FloatBetween(4.8,7.2);}
    for(const object of this.roadObjects) {
      object.y += (68+Math.max(0,object.y)*.46) * dt * this.speed/100 * object.pace;
      const scale=depthScale(object.y), w=object.width*scale, h=w*object.ratio;
      const x=laneX(object.lane,object.y);
      object.sprite.setPosition(x,object.y).setDisplaySize(w,h).setDepth(object.y);
      if(hitTest(this.player.x,624,91,136,x,object.y,w,h)) {
        if(object.kind==='traffic')this.crash();
        else { this.bonuses++;this.bonusScore+=10;this.run.charge=Math.min(100,this.run.charge+10);object.y=1000;this.floatingText('+10', '#a6ff86');this.game.events.emit('race-sound','bonus'); }
      }
      if(object.kind==='traffic'&&!object.passed&&object.y>735){
        object.passed=true;this.overtakes++;
        if(!ghost) {this.combo=Math.min(5,this.combo+1);this.bonusScore+=this.combo;if(this.combo>=3)this.floatingText('ОБГОН ×'+this.combo,'#ffc05e',470);}
      }
    }
    this.roadObjects=this.roadObjects.filter(object=>{if(object.y>980){object.sprite.destroy();return false;}return true;});
    if(this.hudTimer<=0){this.emitHud();this.hudTimer=.1;}
  }
}

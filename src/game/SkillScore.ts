import * as Phaser from 'phaser';
import type { RunState } from './model';

/** Transient, animated skill totals; never a persistent dashboard over the road. */
export class SkillScore {
  private group: Phaser.GameObjects.Container;
  private number: Phaser.GameObjects.Text;
  private multiplier: Phaser.GameObjects.Text;
  private caption: Phaser.GameObjects.Text;
  private displayed = 0;
  private remaining = 0;
  private reducedMotion: boolean;

  constructor(private scene: Phaser.Scene) {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const style = { fontFamily: 'Barlow Condensed, Arial', fontStyle: 'bold', stroke: '#071015', strokeThickness: 3, shadow: { offsetY: 2, blur: 8, color: '#000000', fill: true } };
    this.number = scene.add.text(0, 0, '0', { ...style, fontSize: '44px', color: '#ffe44b' }).setOrigin(1, .5);
    this.multiplier = scene.add.text(0, 0, '', { ...style, fontSize: '28px', color: '#fff8d6' }).setOrigin(0, .5);
    this.caption = scene.add.text(0, 43, '', { ...style, fontSize: '17px', color: '#ffffff' }).setOrigin(.5);
    this.group = scene.add.container(215, 77, [this.number, this.multiplier, this.caption]).setDepth(2400).setAlpha(0);
  }

  show(label: string, state: RunState, bonus = 0) {
    this.remaining = 2.7;
    this.multiplier.setText(state.combo > 1 ? ` ×${state.combo}` : '');
    this.caption.setText(bonus > 0 ? `${label}  +${bonus}` : label);
    this.number.setColor('#ffe44b');
    this.scene.tweens.killTweensOf(this.group);
    this.group.setAlpha(1).setScale(this.reducedMotion ? 1 : 1.12);
    if (!this.reducedMotion) this.scene.tweens.add({ targets: this.group, scale: 1, duration: 230, ease: 'Cubic.Out' });
  }

  crash(state: RunState) {
    this.show('СЕРИЯ ПРЕРВАНА', state);
    this.number.setColor('#ffac8e');
  }

  update(dt: number, score: number) {
    this.displayed = this.reducedMotion ? score : Phaser.Math.Linear(this.displayed, score, 1 - Math.exp(-dt * 13));
    if (Math.abs(score - this.displayed) < .1) this.displayed = score;
    this.number.setText(Math.round(this.displayed).toLocaleString('ru-RU'));
    const middle = (this.number.width - this.multiplier.width) / 2;
    this.number.x = this.multiplier.x = middle;
    this.remaining = Math.max(0, this.remaining - dt);
    this.group.setAlpha(Math.min(1, this.remaining / .55));
  }

  destroy() { this.scene.tweens.killTweensOf(this.group); this.group.destroy(true); }
}

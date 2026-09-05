import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/src/config/game';
import { TrafficScene, type TrafficSceneOptions } from '@/src/game/scenes/TrafficScene';

export function createTrafficGame(parent: HTMLElement, options: TrafficSceneOptions) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#173d29',
    transparent: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    scene: [new TrafficScene(options)],
    input: { activePointers: 3 },
  });
}

'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { HudState } from '@/src/game/scenes/TrafficScene';

export type PhaserGameHandle = {
  move: (direction: -1 | 1) => void;
  setPaused: (paused: boolean) => void;
  boost: () => boolean;
};

type Props = {
  carColor: string;
  onHud: (hud: HudState) => void;
  onCrash: (score: number) => void;
};

type SceneControls = {
  move: (direction: -1 | 1) => void;
  setPaused: (paused: boolean) => void;
  activateBoost: () => boolean;
};

type GameInstance = {
  destroy: (removeCanvas?: boolean) => void;
  scene: { getScene: (key: string) => unknown };
};

export const PhaserGame = forwardRef<PhaserGameHandle, Props>(function PhaserGame(
  { carColor, onHud, onCrash },
  ref,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const [loading, setLoading] = useState(true);

  const controls = () => gameRef.current?.scene.getScene('TrafficScene') as SceneControls | undefined;

  useImperativeHandle(ref, () => ({
    move: (direction) => controls()?.move(direction),
    setPaused: (paused) => controls()?.setPaused(paused),
    boost: () => controls()?.activateBoost() ?? false,
  }));

  useEffect(() => {
    let cancelled = false;
    const parent = parentRef.current;
    if (!parent) return;

    void import('@/src/game/createGame').then(({ createTrafficGame }) => {
      if (cancelled) return;
      gameRef.current = createTrafficGame(parent, { carColor, onHud, onCrash }) as GameInstance;
      setLoading(false);
    });

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [carColor, onCrash, onHud]);

  return (
    <div className="phaser-shell">
      {loading && <div className="game-loading">ЗАГРУЖАЕМ ТРАССУ…</div>}
      <div ref={parentRef} className="phaser-host" />
    </div>
  );
});

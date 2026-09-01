'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const GAME_W = 540;
const GAME_H = 760;
const ROAD_LEFT = 92;
const ROAD_RIGHT = 448;
const PLAYER_Y = 612;
const LANES = [168, 270, 372];
const TRAFFIC_COLORS = ['#ff4f5e', '#ffc93c', '#47c7f4', '#9b6cff', '#fb7c38'];

type Phase = 'ready' | 'running' | 'gameover';
type TrafficCar = {
  id: number;
  lane: number;
  y: number;
  speed: number;
  color: string;
  kind: number;
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawTree(context: CanvasRenderingContext2D, x: number, y: number, hue: number) {
  context.fillStyle = 'rgba(18, 35, 45, .22)';
  context.beginPath();
  context.ellipse(x + 6, y + 9, 25, 19, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = hue % 2 ? '#1c9c5d' : '#28b768';
  context.beginPath();
  context.arc(x, y, 21, 0, Math.PI * 2);
  context.arc(x - 12, y + 7, 14, 0, Math.PI * 2);
  context.arc(x + 13, y + 8, 15, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#70dd77';
  context.beginPath();
  context.arc(x - 7, y - 7, 8, 0, Math.PI * 2);
  context.fill();
}

function drawTrafficCar(context: CanvasRenderingContext2D, car: TrafficCar) {
  const width = car.kind === 2 ? 58 : 52;
  const height = car.kind === 1 ? 112 : 98;
  const x = LANES[car.lane] - width / 2;
  const y = car.y;

  context.save();
  context.fillStyle = 'rgba(5, 12, 20, .28)';
  roundedRect(context, x + 6, y + 8, width, height, 16);
  context.fill();

  context.fillStyle = '#111820';
  context.fillRect(x - 4, y + 18, 6, 23);
  context.fillRect(x + width - 2, y + 18, 6, 23);
  context.fillRect(x - 4, y + height - 42, 6, 23);
  context.fillRect(x + width - 2, y + height - 42, 6, 23);

  const body = context.createLinearGradient(x, y, x + width, y);
  body.addColorStop(0, car.color);
  body.addColorStop(0.48, '#ffffff');
  body.addColorStop(0.54, car.color);
  body.addColorStop(1, car.color);
  context.fillStyle = body;
  roundedRect(context, x, y, width, height, 15);
  context.fill();

  context.fillStyle = '#223b55';
  roundedRect(context, x + 9, y + 21, width - 18, 27, 7);
  context.fill();
  context.fillStyle = '#8dddf4';
  roundedRect(context, x + 12, y + 24, width - 24, 9, 4);
  context.fill();
  context.fillStyle = '#23394b';
  roundedRect(context, x + 9, y + 55, width - 18, 20, 6);
  context.fill();

  context.fillStyle = '#fff3b5';
  context.fillRect(x + 7, y + 5, 10, 6);
  context.fillRect(x + width - 17, y + 5, 10, 6);
  context.fillStyle = '#c9264f';
  context.fillRect(x + 7, y + height - 10, 11, 6);
  context.fillRect(x + width - 18, y + height - 10, 11, 6);
  context.restore();
}

function drawPickup(context: CanvasRenderingContext2D, xCenter: number, y: number) {
  const x = xCenter - 35;
  const width = 70;
  const height = 124;

  context.save();
  context.fillStyle = 'rgba(5, 12, 20, .38)';
  roundedRect(context, x + 8, y + 10, width, height, 19);
  context.fill();

  context.fillStyle = '#0b1015';
  roundedRect(context, x - 5, y + 17, 9, 29, 3);
  context.fill();
  roundedRect(context, x + width - 4, y + 17, 9, 29, 3);
  context.fill();
  roundedRect(context, x - 5, y + height - 46, 9, 29, 3);
  context.fill();
  roundedRect(context, x + width - 4, y + height - 46, 9, 29, 3);
  context.fill();

  const paint = context.createLinearGradient(x, y, x + width, y);
  paint.addColorStop(0, '#080c10');
  paint.addColorStop(0.3, '#202a33');
  paint.addColorStop(0.48, '#586773');
  paint.addColorStop(0.58, '#12191f');
  paint.addColorStop(1, '#030506');
  context.fillStyle = paint;
  roundedRect(context, x, y, width, height, 18);
  context.fill();

  context.strokeStyle = '#8696a1';
  context.lineWidth = 2;
  roundedRect(context, x + 3, y + 3, width - 6, height - 6, 16);
  context.stroke();

  const glass = context.createLinearGradient(x + 10, y + 25, x + 55, y + 66);
  glass.addColorStop(0, '#bceeff');
  glass.addColorStop(0.32, '#3b667a');
  glass.addColorStop(1, '#142a36');
  context.fillStyle = glass;
  roundedRect(context, x + 10, y + 25, width - 20, 35, 8);
  context.fill();
  context.fillStyle = '#101b22';
  context.fillRect(x + 33, y + 25, 4, 36);

  context.fillStyle = '#131a20';
  roundedRect(context, x + 8, y + 70, width - 16, 39, 7);
  context.fill();
  context.strokeStyle = '#60717c';
  context.lineWidth = 2;
  roundedRect(context, x + 11, y + 73, width - 22, 31, 5);
  context.stroke();
  context.beginPath();
  context.moveTo(x + 13, y + 88);
  context.lineTo(x + width - 13, y + 88);
  context.stroke();

  context.fillStyle = '#e7f8ff';
  roundedRect(context, x + 8, y + 5, 16, 7, 3);
  context.fill();
  roundedRect(context, x + width - 24, y + 5, 16, 7, 3);
  context.fill();
  context.fillStyle = '#ff325b';
  context.fillRect(x + 8, y + height - 10, 17, 6);
  context.fillRect(x + width - 25, y + height - 10, 17, 6);

  context.fillStyle = 'rgba(118, 224, 255, .7)';
  context.fillRect(x + 9, y + 18, width - 18, 3);
  context.restore();
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('ready');
  const playerLaneRef = useRef(1);
  const playerXRef = useRef(LANES[1]);
  const trafficRef = useRef<TrafficCar[]>([]);
  const lastTimeRef = useRef(0);
  const elapsedRef = useRef(0);
  const roadOffsetRef = useRef(0);
  const spawnClockRef = useRef(0);
  const nextIdRef = useRef(1);
  const lastHudUpdateRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(80);
  const [best, setBest] = useState(0);

  const finishGame = useCallback((finalScore: number) => {
    phaseRef.current = 'gameover';
    setPhase('gameover');
    setScore(finalScore);
    setBest((oldBest) => {
      const nextBest = Math.max(oldBest, finalScore);
      window.localStorage.setItem('solers-racer-best', String(nextBest));
      return nextBest;
    });
  }, []);

  const startGame = useCallback(() => {
    playerLaneRef.current = 1;
    playerXRef.current = LANES[1];
    trafficRef.current = [];
    elapsedRef.current = 0;
    roadOffsetRef.current = 0;
    spawnClockRef.current = 650;
    lastTimeRef.current = performance.now();
    phaseRef.current = 'running';
    setScore(0);
    setSpeed(80);
    setPhase('running');
  }, []);

  const move = useCallback((direction: -1 | 1) => {
    if (phaseRef.current !== 'running') return;
    playerLaneRef.current = Math.max(0, Math.min(2, playerLaneRef.current + direction));
  }, []);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem('solers-racer-best'));
    if (Number.isFinite(saved)) setBest(saved);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'a', 'd', ' ', 'enter'].includes(key)) {
        event.preventDefault();
      }
      if (event.repeat) return;
      if (key === 'arrowleft' || key === 'a') move(-1);
      if (key === 'arrowright' || key === 'd') move(1);
      if ((key === ' ' || key === 'enter') && phaseRef.current !== 'running') startGame();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [move, startGame]);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = true;
    let frame = 0;

    const render = (now: number) => {
      const delta = Math.min(lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0, 0.05);
      lastTimeRef.current = now;

      if (phaseRef.current === 'running') {
        elapsedRef.current += delta;
        const roadSpeed = 245 + Math.min(170, elapsedRef.current * 4.2);
        roadOffsetRef.current = (roadOffsetRef.current + roadSpeed * delta) % 120;
        spawnClockRef.current -= delta * 1000;
        playerXRef.current += (LANES[playerLaneRef.current] - playerXRef.current) * Math.min(1, delta * 13);

        if (spawnClockRef.current <= 0) {
          const lane = Math.floor(Math.random() * LANES.length);
          const nearest = trafficRef.current
            .filter((car) => car.lane === lane)
            .reduce((top, car) => Math.min(top, car.y), Infinity);
          if (nearest > 150) {
            trafficRef.current.push({
              id: nextIdRef.current++,
              lane,
              y: -125,
              speed: roadSpeed * (0.82 + Math.random() * 0.13),
              color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
              kind: Math.floor(Math.random() * 3),
            });
          }
          spawnClockRef.current = Math.max(480, 1050 - elapsedRef.current * 8) + Math.random() * 260;
        }

        trafficRef.current.forEach((car) => {
          car.y += car.speed * delta;
        });
        trafficRef.current = trafficRef.current.filter((car) => car.y < GAME_H + 130);

        const crashed = trafficRef.current.some((car) => {
          const otherWidth = car.kind === 2 ? 58 : 52;
          const otherHeight = car.kind === 1 ? 112 : 98;
          return (
            Math.abs(LANES[car.lane] - playerXRef.current) < otherWidth / 2 + 27 &&
            car.y + otherHeight > PLAYER_Y + 9 &&
            car.y < PLAYER_Y + 114
          );
        });
        const currentScore = Math.floor(elapsedRef.current * 18);
        if (crashed) finishGame(currentScore);
        else if (now - lastHudUpdateRef.current > 100) {
          setScore(currentScore);
          setSpeed(Math.round(80 + Math.min(115, elapsedRef.current * 2.5)));
          lastHudUpdateRef.current = now;
        }
      } else {
        playerXRef.current += (LANES[playerLaneRef.current] - playerXRef.current) * Math.min(1, delta * 10);
      }

      const sky = context.createLinearGradient(0, 0, GAME_W, GAME_H);
      sky.addColorStop(0, '#57d276');
      sky.addColorStop(1, '#21a85c');
      context.fillStyle = sky;
      context.fillRect(0, 0, GAME_W, GAME_H);

      context.fillStyle = '#d9eef0';
      context.fillRect(ROAD_LEFT - 13, 0, ROAD_RIGHT - ROAD_LEFT + 26, GAME_H);
      context.fillStyle = '#27313d';
      context.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, GAME_H);

      for (let y = -120 + roadOffsetRef.current; y < GAME_H + 120; y += 120) {
        context.fillStyle = '#ffffff';
        context.fillRect(ROAD_LEFT - 13, y, 13, 60);
        context.fillRect(ROAD_RIGHT, y, 13, 60);
        context.fillStyle = '#ff4e62';
        context.fillRect(ROAD_LEFT - 13, y + 60, 13, 60);
        context.fillRect(ROAD_RIGHT, y + 60, 13, 60);
      }

      context.fillStyle = 'rgba(255, 255, 255, .8)';
      for (const laneLine of [219, 321]) {
        for (let y = -90 + roadOffsetRef.current; y < GAME_H; y += 120) {
          roundedRect(context, laneLine - 3, y, 6, 58, 3);
          context.fill();
        }
      }

      for (let y = -80 + ((roadOffsetRef.current * 0.78) % 150); y < GAME_H + 100; y += 150) {
        drawTree(context, 42, y, Math.floor(y / 150));
        drawTree(context, 497, y + 72, Math.floor(y / 150) + 1);
      }

      context.fillStyle = 'rgba(255,255,255,.07)';
      for (let y = 30; y < GAME_H; y += 95) context.fillRect(ROAD_LEFT + 18, y, 3, 25);

      trafficRef.current.forEach((car) => drawTrafficCar(context, car));
      drawPickup(context, playerXRef.current, PLAYER_Y);

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [finishGame]);

  return (
    <main className="page-shell">
      <section className="game-card" aria-label="Дорожная аркада">
        <header className="game-header">
          <div>
            <p className="eyebrow">ONLINE ARCADE</p>
            <h1>TRAFFIC RUSH</h1>
          </div>
          <div className="live-pill"><span /> LIVE</div>
        </header>

        <div className="game-stage">
          <div className="hud" aria-live="polite">
            <div><span>СЧЁТ</span><strong>{String(score).padStart(4, '0')}</strong></div>
            <div className="speed"><span>СКОРОСТЬ</span><strong>{speed}<small> км/ч</small></strong></div>
            <div><span>РЕКОРД</span><strong>{String(best).padStart(4, '0')}</strong></div>
          </div>

          <canvas
            ref={canvasRef}
            width={GAME_W}
            height={GAME_H}
            className="game-canvas"
            aria-label="Трасса с видом сверху"
          />

          {phase !== 'running' && (
            <div className="game-overlay">
              <p className="overlay-kicker">{phase === 'ready' ? 'ГОТОВ К ЗАЕЗДУ?' : 'СТОЛКНОВЕНИЕ'}</p>
              <h2>{phase === 'ready' ? 'УКЛОНИСЬ ОТ ТРАФИКА' : `${score} ОЧКОВ`}</h2>
              <p>
                {phase === 'ready'
                  ? 'Пикап едет сам. Перестраивайся между полосами и не сбавляй темп.'
                  : score > 0 && score >= best
                    ? 'Новый рекорд! Сможешь проехать ещё дальше?'
                    : 'Трафик становится быстрее. Попробуй ещё раз!'}
              </p>
              <button type="button" onClick={startGame} className="play-button">
                {phase === 'ready' ? 'ИГРАТЬ' : 'ЕЩЁ РАЗ'} <span>→</span>
              </button>
              <small>ENTER / ПРОБЕЛ</small>
            </div>
          )}
        </div>

        <div className="controls">
          <button type="button" onPointerDown={() => move(-1)} aria-label="Перестроиться влево">
            <span>←</span><small>A</small>
          </button>
          <p><strong>МАНЕВРИРУЙ</strong><span>машина едет автоматически</span></p>
          <button type="button" onPointerDown={() => move(1)} aria-label="Перестроиться вправо">
            <span>→</span><small>D</small>
          </button>
        </div>
      </section>
    </main>
  );
}

'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { HudState } from '@/src/game/scenes/TrafficScene';

export type PhaserGameHandle = { move: (direction: -1 | 1) => void; setPaused: (paused: boolean) => void; boost: () => boolean; continueRace: () => void };
type SceneControls = { move: (direction: -1 | 1) => void; setPaused: (paused: boolean) => void; activateBoost: () => boolean; continueRace: () => void };
type GameInstance = { destroy: (removeCanvas?: boolean) => void; scene: { getScene: (key: string) => unknown } };
export const PhaserGame = forwardRef<PhaserGameHandle, { carColor:string;onHud:(hud:HudState)=>void;onExhausted:()=>void }>(function PhaserGame({carColor,onHud,onExhausted},ref) {
  const parentRef=useRef<HTMLDivElement>(null),gameRef=useRef<GameInstance|null>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const controls=()=>gameRef.current?.scene.getScene('TrafficScene') as SceneControls|undefined;
  useImperativeHandle(ref,()=>({move:d=>controls()?.move(d),setPaused:p=>controls()?.setPaused(p),boost:()=>controls()?.activateBoost()??false,continueRace:()=>controls()?.continueRace()}));
  useEffect(()=>{
    let cancelled=false;const parent=parentRef.current;if(!parent)return;
    import('@/src/game/createGame').then(({createTrafficGame})=>{
      if(cancelled)return;
      gameRef.current=createTrafficGame(parent,{carColor,onHud,onExhausted,onReady:()=>{if(!cancelled)setStatus('ready');},onError:()=>{if(!cancelled)setStatus('error');}}) as GameInstance;
    }).catch(()=>{if(!cancelled)setStatus('error');});
    return()=>{cancelled=true;gameRef.current?.destroy(true);gameRef.current=null;};
  },[carColor,onHud,onExhausted]);
  return <div className="phaser-shell"><div ref={parentRef} className="phaser-host" />{status!=='ready'&&<div className="game-loading" role="status">{status==='error'?<><strong>Не удалось загрузить трассу</strong><button className="button orange" onClick={()=>window.location.reload()}>ПОВТОРИТЬ</button></>:<><span className="loader" /><strong>ГОТОВИМ ВАШ ST9</strong><span>Выезжаем на трассу…</span></>}</div>}</div>;
});

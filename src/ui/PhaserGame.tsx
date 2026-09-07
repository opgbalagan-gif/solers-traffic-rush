'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { HudState } from '@/src/game/scenes/TrafficScene';
import type { RaceEvent } from '@/src/game/model';

export type PhaserGameHandle = { beginRace: () => void; move: (direction: -1 | 1) => void; setPaused: (paused: boolean) => void; boost: (held: boolean) => boolean; continueRace: () => void };
type SceneControls = { beginRace: () => void; move: (direction: -1 | 1) => void; setPaused: (paused: boolean) => void; activateBoost: (held: boolean) => boolean; continueRace: () => void };
type GameInstance = { destroy: (removeCanvas?: boolean) => void; scene: { getScene: (key: string) => unknown } };
export const PhaserGame = forwardRef<PhaserGameHandle, { carColor:string;onHud:(hud:HudState)=>void;onExhausted:()=>void;onSound:(event:RaceEvent['type'])=>void;onReady:()=>void;onError:()=>void }>(function PhaserGame({carColor,onHud,onExhausted,onSound,onReady,onError},ref) {
  const parentRef=useRef<HTMLDivElement>(null),gameRef=useRef<GameInstance|null>(null);
  const controls=()=>gameRef.current?.scene.getScene('TrafficScene') as SceneControls|undefined;
  useImperativeHandle(ref,()=>({beginRace:()=>controls()?.beginRace(),move:d=>controls()?.move(d),setPaused:p=>controls()?.setPaused(p),boost:held=>controls()?.activateBoost(held)??false,continueRace:()=>controls()?.continueRace()}));
  useEffect(()=>{
    let cancelled=false;const parent=parentRef.current;if(!parent)return;
    import('@/src/game/createGame').then(({createTrafficGame})=>{
      if(cancelled)return;
      gameRef.current=createTrafficGame(parent,{carColor,onHud,onExhausted,onSound,onReady:()=>{if(!cancelled)onReady();},onError:()=>{if(!cancelled)onError();}}) as GameInstance;
    }).catch(()=>{if(!cancelled)onError();});
    return()=>{cancelled=true;gameRef.current?.destroy(true);gameRef.current=null;};
  },[carColor,onHud,onExhausted,onSound,onReady,onError]);
  return <div className="phaser-shell" onContextMenu={event=>event.preventDefault()}><div ref={parentRef} className="phaser-host" /></div>;
});

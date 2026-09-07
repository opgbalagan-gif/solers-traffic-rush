'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BOY_COLORS, GIRL_COLORS, assetUrl } from '@/src/config/game';
import type { HudState } from '@/src/game/scenes/TrafficScene';
import { RaceAudio } from '@/src/game/RaceAudio';
import type { RaceEvent } from '@/src/game/model';
import { DEFAULT_STATE, loadGameState, saveGameState, type Driver } from '@/src/state/store';
import { PhaserGame, type PhaserGameHandle } from '@/src/ui/PhaserGame';
import { DriverAvatar, GameLogo, Icon, VehiclePreview } from '@/src/ui/Visuals';
import { gameApi as api } from '@/src/lib/gameApi';
import { RaceStartOverlay, type RacePhase } from '@/src/ui/RaceStartOverlay';
import { ControlIcon, DrivingGuide } from '@/src/ui/DrivingGuide';
import { NitroMeter } from '@/src/ui/NitroMeter';

type Screen='menu'|'driver'|'color'|'garage'|'game';
type Modal='none'|'settings'|'records'|'tasks'|'continue'|'phone'|'result';
type Config={socialUrl:string|null;socialLabel:string;phoneReady:boolean;privacyUrl:string|null;continueMode:string};
type Leader={name:string;score:number;distance:number};
const EMPTY:HudState={score:0,speed:72,boost:100,distance:0,biome:'ЛЕСНАЯ ТРАССА',ghost:false,combo:0,overtakes:0,bonuses:0,lives:3,countdown:3,boosting:false,nearMisses:0};
export function GameApp(){
  const game=useRef<PhaserGameHandle>(null);
  const [screen,setScreen]=useState<Screen>('menu'),[modal,setModal]=useState<Modal>('none');
  const [stored,setStored]=useState(DEFAULT_STATE),[hud,setHud]=useState(EMPTY),[paused,setPaused]=useState(false);
  const [runId,setRunId]=useState(0),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [racePhase,setRacePhase]=useState<RacePhase>('loading');
  const [leaderboard,setLeaderboard]=useState<Leader[]>([]),[leaderLoading,setLeaderLoading]=useState(false);
  const [name,setName]=useState(''),[phone,setPhone]=useState(''),[consent,setConsent]=useState(false);
  const [continuations,setContinuations]=useState(0),[socialOpened,setSocialOpened]=useState(false),[saved,setSaved]=useState(false);
  const [config,setConfig]=useState<Config>({socialUrl:null,socialLabel:'Соцсети дилера',phoneReady:false,privacyUrl:null,continueMode:'alternate'});
  const session=useRef<{id:string;token:string}|null>(null),hudRef=useRef(EMPTY);
  const modalRef=useRef<HTMLDialogElement>(null);
  const palette=stored.driver==='boy'?BOY_COLORS:GIRL_COLORS;
  const [sound,setSound]=useState(false);
  const audio=useRef<RaceAudio|null>(null);
  const updateStored=useCallback((patch:Partial<typeof DEFAULT_STATE>)=>setStored(old=>{const next={...old,...patch};saveGameState(next);return next;}),[]);
  useEffect(()=>{
    const hydrate=window.setTimeout(()=>{setStored(loadGameState());setReady(true);},0);
    api<Config>('config').then(setConfig).catch(()=>{});
    if('serviceWorker' in navigator&&process.env.NODE_ENV==='production') navigator.serviceWorker.register(assetUrl('/sw.js')).catch(()=>{});
    return()=>{window.clearTimeout(hydrate);audio.current?.close();audio.current=null;};
  },[]);
  useEffect(()=>{hudRef.current=hud;},[hud]);
  useEffect(()=>{audio.current?.setState(sound,screen==='game'&&racePhase==='race'&&!paused&&modal==='none',hud.speed,hud.boosting);},[sound,screen,racePhase,paused,modal,hud.speed,hud.boosting]);
  useEffect(()=>{
    const d=modalRef.current;if(!d)return;
    if(modal!=='none'&&!d.open)d.showModal();else if(modal==='none'&&d.open)d.close();
    setError('');
  },[modal]);
  const onHud=useCallback((value:HudState)=>setHud(value),[]);
  const onSound=useCallback((event:RaceEvent['type'])=>audio.current?.play(event),[]);
  const onExhausted=useCallback(()=>{setPaused(true);setModal('continue');setSocialOpened(false);},[]);
  const onGameReady=useCallback(()=>setRacePhase('rules'),[]);
  const onGameError=useCallback(()=>setRacePhase('error'),[]);
  const pause=useCallback(()=>{
    if(screen!=='game'||racePhase!=='race'||modal!=='none')return;
    setPaused(p=>{game.current?.setPaused(!p);return !p;});
  },[screen,racePhase,modal]);
  const boost=useCallback((held:boolean)=>{game.current?.boost(held);},[]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(screen!=='game'||racePhase!=='race'||modal!=='none'||(event.target as HTMLElement).matches('input,textarea,select,[contenteditable="true"]'))return;
      if((event.key===' '||event.key==='Enter')&&(event.target as HTMLElement).closest('button,a'))return;
      if(['ArrowLeft','ArrowRight',' ','a','d','A','D','Escape','p','P'].includes(event.key))event.preventDefault();
      if(event.repeat)return;
      if(event.key==='ArrowLeft'||event.key.toLowerCase()==='a')game.current?.move(-1);
      if(event.key==='ArrowRight'||event.key.toLowerCase()==='d')game.current?.move(1);
      if(event.key===' ')boost(true);
      if(event.key==='Escape'||event.key.toLowerCase()==='p')pause();
    };
    const release=(event:KeyboardEvent)=>{if(event.key===' ')boost(false);};
    const hidden=()=>{if(document.hidden&&screen==='game'&&racePhase==='race'){boost(false);game.current?.setPaused(true);setPaused(true);}};
    const blur=()=>{if(screen==='game'&&racePhase==='race'){boost(false);game.current?.setPaused(true);setPaused(true);}};
    window.addEventListener('keydown',key);window.addEventListener('keyup',release);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',release);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
  },[screen,racePhase,modal,pause,boost]);
  const initAudio=()=>{
    if(!audio.current)try{audio.current=new RaceAudio();}catch{}
    void audio.current?.resume();
  };
  const start=async()=>{
    initAudio();setBusy(true);setError('');session.current=null;
    try{session.current=await api<{id:string;token:string}>('runs',{});}catch{ /* Offline driving stays available; score publication is explicit. */ }
    setBusy(false);setHud(EMPTY);setPaused(false);setModal('none');setContinuations(0);setSaved(false);setRacePhase('loading');
    setRunId(n=>n+1);setScreen('game');
  };
  const beginRace=()=>{
    if(racePhase!=='rules')return;
    initAudio();game.current?.beginRace();setPaused(false);setRacePhase('race');
  };
  const retryLoading=()=>{setRacePhase('loading');setHud(EMPTY);setRunId(n=>n+1);};
  const chooseDriver=(driver:Driver)=>updateStored({driver,carColor:driver===stored.driver?stored.carColor:(driver==='boy'?BOY_COLORS:GIRL_COLORS)[0].value});
  const finish=()=>{
    game.current?.setPaused(true);setPaused(true);
    updateStored({bestScore:Math.max(stored.bestScore,hudRef.current.score),demoRuns:stored.demoRuns+1});
    setModal('result');
  };
  const closeModal=()=>{if(modal==='continue'||modal==='phone'){finish();return;}setModal('none');if(modal==='result'){setScreen('menu');setPaused(false);}};
  const records=async()=>{
    if(screen==='game'){setScreen('menu');setPaused(false);}
    setModal('records');setLeaderLoading(true);setLeaderboard([]);
    try{const data=await api<{rows:Leader[]}>('leaderboard');setLeaderboard(data.rows);}catch(e){setError((e as Error).message);}finally{setLeaderLoading(false);}
  };
  useEffect(()=>{
    if(modal!=='records')return;
    let disposed=false;
    const refresh=()=>{if(document.hidden)return;api<{rows:Leader[]}>('leaderboard').then(data=>{if(!disposed){setLeaderboard(data.rows);setError('');}}).catch(()=>{});};
    const timer=window.setInterval(refresh,15000);
    return()=>{disposed=true;window.clearInterval(timer);};
  },[modal]);
  const continueRace=()=>{setContinuations(n=>n+1);setModal('none');setPaused(false);game.current?.continueRace();};
  const sendLead=async()=>{
    setBusy(true);setError('');
    try{
      if(!session.current)throw new Error('Нет связи с сервером. Заявка не отправлена.');
      await api('leads',{...session.current,phone,consent,continuation:continuations+1,score:hud.score});
      continueRace();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const publishScore=async()=>{
    setBusy(true);setError('');
    try{
      if(!session.current)throw new Error('Этот заезд начат без сервера. Новый заезд можно будет записать в таблицу.');
      await api('scores',{...session.current,name,score:hud.score,distance:hud.distance});setSaved(true);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const phoneTurn=config.continueMode==='phone-third'?(continuations+1)%3===0:config.continueMode==='choice'?false:continuations%2===1;
  return <main className="experience-shell">
    <div className="ambient-word" aria-hidden="true">ST9</div>
    <header className="outside-brand"><strong>SOLLERS</strong><span>АВИЛОН</span></header>
    <section className={`phone-frame ${screen==='game'?'racing':''}`} aria-label="SOLLERS Traffic Rush">
      {screen==='menu'&&<div className="screen menu-screen">
        <button className="icon-button settings" aria-label="Настройки" onClick={()=>setModal('settings')}><Icon name="settings"/></button>
        <GameLogo/>
        <div className="menu-hero"><VehiclePreview color={stored.carColor} hero/></div>
        <div className="menu-actions"><button className="button orange play-button" disabled={!ready} onClick={()=>setScreen('driver')}>ИГРАТЬ</button><button className="button secondary" onClick={()=>setScreen('garage')}>ГАРАЖ</button></div>
        <nav className="bottom-nav"><button onClick={()=>setModal('tasks')}><Icon name="tasks"/><span>ЗАДАНИЯ</span></button><button onClick={()=>setScreen('garage')}><Icon name="garage"/><span>ГАРАЖ</span></button><button onClick={records}><Icon name="trophy"/><span>ЛИДЕРЫ</span></button></nav>
      </div>}
      {(screen==='driver'||screen==='color'||screen==='garage')&&<div className={`screen setup-screen ${screen}`}>
        <div className="screen-header"><button className="icon-button" aria-label="Назад" onClick={()=>setScreen(screen==='color'?'driver':'menu')}><Icon name="back"/></button><h1>{screen==='driver'?'ВЫБЕРИ ВОДИТЕЛЯ':screen==='garage'?'ГАРАЖ':'ВЫБЕРИ ЦВЕТ МАШИНЫ'}</h1></div>
        {screen==='driver'?<>
          <div className="driver-grid">{(['boy','girl'] as const).map(driver=><button key={driver} className={`driver-card ${stored.driver===driver?'selected':''}`} onClick={()=>chooseDriver(driver)} aria-label={driver==='boy'?'Выбрать парня':'Выбрать девушку'} aria-pressed={stored.driver===driver}><DriverAvatar driver={driver}/><b>{driver==='boy'?'♂':'♀'}</b></button>)}</div>
          <button className="button green setup-next" onClick={()=>setScreen('color')}>ДАЛЕЕ</button>
        </>:<>
          <div className="garage-preview"><VehiclePreview color={stored.carColor}/></div>
          <div className={`swatches ${stored.driver==='girl'?'eight':''}`} aria-label="Цвет кузова">{palette.map(color=><button key={color.value} aria-label={color.name} title={color.name} aria-pressed={stored.carColor===color.value} className={stored.carColor===color.value?'selected':''} style={{'--paint':color.value} as CSSProperties} onClick={()=>updateStored({carColor:color.value})}/>)}</div>
          <p className="paint-name">{palette.find(c=>c.value===stored.carColor)?.name}</p>
          {screen==='garage'&&<section className="garage-about" aria-labelledby="garage-about-title">
            <h2 id="garage-about-title">О МАШИНЕ</h2>
            <div className="vehicle-card"><div><strong>ST9</strong><span>ПИКАП</span></div><div className="stat-bars">{[['СКОРОСТЬ',45],['УПРАВЛЕНИЕ',65],['УСКОРЕНИЕ',50]].map(([label,width])=><span key={label}><em>{label}</em><i><b style={{width:width+'%'}}/></i></span>)}</div><div className="drive-type"><span>ПОЛНЫЙ<br/>ПРИВОД</span><strong>4×4</strong></div></div>
            <a className="dealer-link" href="https://sollers-avilon.ru/models/st9/" target="_blank" rel="noreferrer">ОБ АВТОМОБИЛЕ ST9 ↗</a>
          </section>}
          <button className="button green setup-next" onClick={start} disabled={busy}>{busy?'ВЫЕЗЖАЕМ…':'ПОЕХАЛИ'}</button>
        </>}
        {screen!=='garage'&&<div className="setup-steps"><i className="active"/><i className={screen==='color'?'active':''}/><span>{screen==='driver'?'01 / ВОДИТЕЛЬ':'02 / ВАШ ST9'}</span></div>}
      </div>}
      {screen==='game'&&<div className={`screen game-screen ${racePhase!=='race'||paused?'is-preparing':''} ${hud.boosting?'is-boosting':''}`}>
        <PhaserGame key={runId} ref={game} carColor={stored.carColor} onHud={onHud} onExhausted={onExhausted} onSound={onSound} onReady={onGameReady} onError={onGameError}/>
        {racePhase==='race'&&!paused&&modal==='none'&&<div className="race-corner">
          {hud.countdown===0&&<div className="race-vitals">
            <div className="race-hearts" role="status" aria-label={`Осталось жизней: ${hud.lives}`}>{[1,2,3].map(n=><span key={n} aria-hidden="true" className={n<=hud.lives?'':'lost'}>♥</span>)}</div>
            <NitroMeter charge={hud.boost} active={hud.boosting}/>
          </div>}
          <button className="race-pause-button" type="button" aria-label="Пауза" title="Пауза" onPointerDown={event=>event.stopPropagation()} onClick={pause}><ControlIcon name="pause" size={22}/></button>
        </div>}
        <RaceStartOverlay phase={racePhase} countdown={hud.countdown} paused={paused||modal!=='none'} onBegin={beginRace} onRetry={retryLoading}/>
        {racePhase==='race'&&paused&&modal==='none'&&<div className="pause-overlay" role="dialog" aria-labelledby="pause-title"><h2 id="pause-title">ПАУЗА</h2><p>{hud.score} очков · {(hud.distance/1000).toFixed(1)} км</p><button className="button green" onClick={pause} autoFocus>ПРОДОЛЖИТЬ</button><DrivingGuide compact/><button className="text-button" onClick={()=>{initAudio();setSound(!sound);}}>ЗВУК: {sound?'ВКЛ':'ВЫКЛ'}</button><button className="text-button" onClick={finish}>ЗАВЕРШИТЬ ЗАЕЗД</button></div>}
      </div>}
      <dialog ref={modalRef} className="modal-card" onCancel={event=>{event.preventDefault();closeModal();}}>
        <button className="modal-close icon-button" aria-label="Закрыть" onClick={closeModal}><Icon name="close"/></button>
        {modal==='settings'&&<><span className="eyebrow">SOLLERS TRAFFIC RUSH</span><h2>НАСТРОЙКИ</h2><button className="setting-row" onClick={()=>{initAudio();setSound(!sound);}}><Icon name={sound?'sound':'mute'}/><span>Звук двигателя</span><b>{sound?'ВКЛ':'ВЫКЛ'}</b></button><div className="instructions"><p><kbd>←</kbd> <kbd>→</kbd> или <kbd>A</kbd> <kbd>D</kbd> — сменить полосу</p><p>Удерживай <kbd>Пробел</kbd> — азот</p><p><kbd>Esc</kbd> — пауза</p><p>На телефоне: свайп — сменить полосу, удержание экрана — азот.</p><p>У вас 3 жизни. После удара ST9 на 3 секунды становится прозрачным.</p></div></>}
        {modal==='tasks'&&<><span className="eyebrow">КАЖДЫЙ ЗАЕЗД — НОВЫЙ ВЫЗОВ</span><h2>ЗАДАНИЯ</h2>{[['Обгони 20 машин',hud.overtakes,20],['Собери 5 бонусов',hud.bonuses,5],['Проедь 3 километра',hud.distance,3000]].map(([label,value,target])=><div className="mission" key={label}><div><span>{label}</span><b>{Number(value)>=Number(target)?'✓':`${value} / ${target}`}</b></div><progress value={Number(value)} max={Number(target)}/></div>)}<p className="muted">Собирайте ящики +10 и обгоняйте без столкновений — серия обгонов даёт больше очков.</p><button className="button green" onClick={()=>{setModal('none');setScreen('driver');}}>НА ТРАССУ</button></>}
        {modal==='records'&&<><span className="eyebrow">ОБЩИЙ ЗАЧЁТ</span><h2>ТАБЛИЦА ЛИДЕРОВ</h2><button className="text-button" onClick={records} disabled={leaderLoading}>ОБНОВИТЬ РЕЙТИНГ</button><div className="personal-best"><span>ВАШ РЕКОРД НА УСТРОЙСТВЕ</span><strong>{stored.bestScore}</strong></div>{leaderLoading?<p role="status">Загружаем результаты…</p>:leaderboard.length?<ol className="leaderboard">{leaderboard.map((row,i)=><li key={i}><b>{String(i+1).padStart(2,'0')}</b><span>{row.name}<small>{(row.distance/1000).toFixed(1)} км</small></span><strong>{row.score}</strong></li>)}</ol>:!error?<p className="muted">Пока нет результатов.<br/>Станьте первым на этой трассе.</p>:null}{error&&<p className="form-error" role="alert">{error}</p>}<button className="button green" onClick={()=>{setModal('none');setScreen('driver');}}>ПОБИТЬ РЕКОРД</button></>}
        {modal==='continue'&&<><span className="eyebrow">ТРИ ЖИЗНИ ПОТРАЧЕНЫ</span><h2>ЕЩЁ ОДИН<br/>ЗАЕЗД?</h2><div className="continue-score"><strong>{hud.score}</strong><span>ОЧКОВ · {(hud.distance/1000).toFixed(1)} КМ</span></div><p>Верните 3 жизни и продолжайте<br/>с того же места.</p>{phoneTurn?<><p className="muted">Оставьте телефон, чтобы получить ещё одну попытку.</p><button className="button orange" onClick={()=>setModal('phone')}>ОСТАВИТЬ ТЕЛЕФОН</button></>:<>{config.socialUrl?<><a className="button green" href={config.socialUrl} target="_blank" rel="noreferrer" onClick={()=>setSocialOpened(true)}>ПОДПИСАТЬСЯ · {config.socialLabel}</a>{socialOpened&&<><p className="muted">Подтвердите подписку. Автоматическая проверка пока не подключена.</p><button className="button orange" onClick={continueRace}>Я ПОДПИСАЛСЯ · ПРОДОЛЖИТЬ</button></>}</>:<><p className="muted">В демоверсии продолжение доступно без подписки.</p><button className="button green" onClick={continueRace}>ВЕРНУТЬ 3 ЖИЗНИ · ДЕМО</button></>}</>}{config.continueMode==='choice'&&<button className="text-button" onClick={()=>setModal('phone')}>ИЛИ ОСТАВИТЬ ТЕЛЕФОН</button>}<button className="text-button" onClick={finish}>ЗАВЕРШИТЬ И СОХРАНИТЬ РЕЗУЛЬТАТ</button></>}
        {modal==='phone'&&<><span className="eyebrow">ЕЩЁ 3 ЖИЗНИ</span><h2>ОСТАВЬТЕ<br/>НОМЕР ТЕЛЕФОНА</h2><p>Дилер свяжется с вами<br/>и расскажет о SOLLERS ST9.</p>{config.phoneReady?<form onSubmit={e=>{e.preventDefault();void sendLead();}}><label className="field-label" htmlFor="lead-phone">Телефон</label><input id="lead-phone" className="phone-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={phone} onChange={e=>setPhone(e.target.value)} required/><label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Согласен на обработку персональных данных и звонок дилера. <a href={config.privacyUrl!} target="_blank" rel="noreferrer">Условия обработки</a></span></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button orange" type="submit" disabled={!consent||busy}>{busy?'ОТПРАВЛЯЕМ…':'ОТПРАВИТЬ И ПРОДОЛЖИТЬ'}</button></form>:<><p className="muted">Форма появится после подключения дилера. Пока можно продолжить демоигру без номера.</p><button className="button green" onClick={continueRace}>ПРОДОЛЖИТЬ ДЕМО</button></>}<button className="text-button" onClick={finish}>СОХРАНИТЬ РЕЗУЛЬТАТ</button></>}
        {modal==='result'&&<><span className="eyebrow">{hud.score>=stored.bestScore&&hud.score>0?'ЛИЧНЫЙ РЕКОРД':'ХОРОШИЙ ЗАЕЗД'}</span><h2>ФИНИШ</h2><div className="result-score">{hud.score}<span>ОЧКОВ</span></div><p>{(hud.distance/1000).toFixed(1)} км · {hud.overtakes} обгонов · {hud.bonuses} бонусов</p>{saved?<><p className="success-message">✓ Результат в таблице лидеров</p><button className="button secondary" onClick={records}>ПОСМОТРЕТЬ ЛИДЕРОВ</button></>:<form onSubmit={e=>{e.preventDefault();void publishScore();}}><label className="field-label" htmlFor="player-name">Имя в таблице лидеров</label><input id="player-name" value={name} onChange={e=>setName(e.target.value)} className="name-input" placeholder="Ваш позывной" minLength={2} maxLength={20} required autoComplete="nickname"/>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button secondary" type="submit" disabled={busy||name.trim().length<2}>{busy?'СОХРАНЯЕМ…':'В ТАБЛИЦУ ЛИДЕРОВ'}</button></form>}<button className="button orange" onClick={start} disabled={busy}>ЕЩЁ ЗАЕЗД</button><button className="text-button" onClick={()=>{setModal('none');setScreen('menu');}}>В ГЛАВНОЕ МЕНЮ</button></>}
      </dialog>
    </section>
    {screen!=='garage'&&screen!=='color'&&<footer className="outside-help"><span><kbd>←</kbd><kbd>→</kbd> УПРАВЛЕНИЕ</span><span>УДЕРЖИВАЙ <kbd>ПРОБЕЛ</kbd> АЗОТ</span><span>3 ЖИЗНИ. ОДНА ТРАССА. ВАШ РЕКОРД.</span></footer>}
  </main>;
}

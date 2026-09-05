'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BOY_COLORS, GIRL_COLORS, assetUrl } from '@/src/config/game';
import type { HudState } from '@/src/game/scenes/TrafficScene';
import { DEFAULT_STATE, loadGameState, saveGameState, type Driver } from '@/src/state/store';
import { PhaserGame, type PhaserGameHandle } from '@/src/ui/PhaserGame';
import { DriverAvatar, GameLogo, Icon, VehiclePreview } from '@/src/ui/Visuals';

type Screen='menu'|'driver'|'color'|'game';
type Modal='none'|'settings'|'records'|'tasks'|'continue'|'phone'|'result';
type Config={socialUrl:string|null;socialLabel:string;phoneReady:boolean;privacyUrl:string|null;continueMode:string};
type Leader={name:string;score:number;distance:number};
const EMPTY:HudState={score:0,speed:100,boost:100,distance:0,biome:'ЛЕСНАЯ ТРАССА',ghost:false,combo:0,overtakes:0,bonuses:0,lives:3};
async function api<T=Record<string,unknown>>(path:string,body?:unknown):Promise<T>{
  const response=await fetch(assetUrl('/api/'+path),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const value=await response.json() as T & {error?:string};if(!response.ok)throw new Error(value.error||'Нет связи с сервером. Попробуйте ещё раз.');return value;
}
export function GameApp(){
  const game=useRef<PhaserGameHandle>(null);
  const [screen,setScreen]=useState<Screen>('menu'),[modal,setModal]=useState<Modal>('none');
  const [stored,setStored]=useState(DEFAULT_STATE),[hud,setHud]=useState(EMPTY),[paused,setPaused]=useState(false);
  const [runId,setRunId]=useState(0),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [leaderboard,setLeaderboard]=useState<Leader[]>([]),[leaderLoading,setLeaderLoading]=useState(false);
  const [name,setName]=useState(''),[phone,setPhone]=useState(''),[consent,setConsent]=useState(false);
  const [continuations,setContinuations]=useState(0),[socialOpened,setSocialOpened]=useState(false),[saved,setSaved]=useState(false);
  const [config,setConfig]=useState<Config>({socialUrl:null,socialLabel:'Соцсети дилера',phoneReady:false,privacyUrl:null,continueMode:'alternate'});
  const session=useRef<{id:string;token:string}|null>(null),hudRef=useRef(EMPTY);
  const modalRef=useRef<HTMLDialogElement>(null);
  const palette=stored.driver==='boy'?BOY_COLORS:GIRL_COLORS;
  const [sound,setSound]=useState(false);
  const audio=useRef<{ctx:AudioContext;osc:OscillatorNode;gain:GainNode}|null>(null);
  const updateStored=useCallback((patch:Partial<typeof DEFAULT_STATE>)=>setStored(old=>{const next={...old,...patch};saveGameState(next);return next;}),[]);
  useEffect(()=>{
    const hydrate=window.setTimeout(()=>{setStored(loadGameState());setReady(true);},0);
    api<Config>('config').then(setConfig).catch(()=>{});
    if('serviceWorker' in navigator&&process.env.NODE_ENV==='production') navigator.serviceWorker.register(assetUrl('/sw.js')).catch(()=>{});
    return()=>{window.clearTimeout(hydrate);audio.current?.ctx.close();};
  },[]);
  useEffect(()=>{hudRef.current=hud;if(audio.current)audio.current.osc.frequency.setTargetAtTime(36+hud.speed*.35,audio.current.ctx.currentTime,.12);},[hud]);
  useEffect(()=>{if(audio.current)audio.current.gain.gain.setTargetAtTime(sound&&screen==='game'&&!paused&&modal==='none'?.018:0,audio.current.ctx.currentTime,.1);},[sound,screen,paused,modal]);
  useEffect(()=>{
    const d=modalRef.current;if(!d)return;
    if(modal!=='none'&&!d.open)d.showModal();else if(modal==='none'&&d.open)d.close();
    setError('');
  },[modal]);
  const onHud=useCallback((value:HudState)=>setHud(value),[]);
  const onExhausted=useCallback(()=>{setPaused(true);setModal('continue');setSocialOpened(false);},[]);
  const pause=useCallback(()=>{
    if(screen!=='game'||modal!=='none')return;
    setPaused(p=>{game.current?.setPaused(!p);return !p;});
  },[screen,modal]);
  const boost=useCallback(()=>{game.current?.boost();},[]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(screen!=='game'||modal!=='none'||(event.target as HTMLElement).matches('input,textarea,select,[contenteditable="true"]'))return;
      if(['ArrowLeft','ArrowRight',' ','a','d','A','D','Escape','p','P'].includes(event.key))event.preventDefault();
      if(event.repeat)return;
      if(event.key==='ArrowLeft'||event.key.toLowerCase()==='a')game.current?.move(-1);
      if(event.key==='ArrowRight'||event.key.toLowerCase()==='d')game.current?.move(1);
      if(event.key===' ')boost();
      if(event.key==='Escape'||event.key.toLowerCase()==='p')pause();
    };
    const hidden=()=>{if(document.hidden&&screen==='game'){game.current?.setPaused(true);setPaused(true);}};
    window.addEventListener('keydown',key);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hidden);};
  },[screen,modal,pause,boost]);
  const initAudio=()=>{
    if(!audio.current)try{const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sawtooth';gain.gain.value=0;osc.connect(gain).connect(ctx.destination);osc.start();audio.current={ctx,osc,gain};}catch{}
    audio.current?.ctx.resume().catch(()=>{});
  };
  const start=async()=>{
    initAudio();setBusy(true);setError('');session.current=null;
    try{session.current=await api<{id:string;token:string}>('runs',{});}catch{ /* Offline driving stays available; score publication is explicit. */ }
    setBusy(false);setHud(EMPTY);setPaused(false);setModal('none');setContinuations(0);setSaved(false);
    setRunId(n=>n+1);setScreen('game');
  };
  const chooseDriver=(driver:Driver)=>updateStored({driver,carColor:(driver==='boy'?BOY_COLORS:GIRL_COLORS)[0].value});
  const finish=()=>{
    game.current?.setPaused(true);setPaused(true);
    updateStored({bestScore:Math.max(stored.bestScore,hudRef.current.score),demoRuns:stored.demoRuns+1});
    setModal('result');
  };
  const closeModal=()=>{if(modal==='continue'||modal==='phone'){finish();return;}setModal('none');if(modal==='result'){setScreen('menu');setPaused(false);}};
  const records=async()=>{
    setModal('records');setLeaderLoading(true);setLeaderboard([]);
    try{const data=await api<{rows:Leader[]}>('leaderboard');setLeaderboard(data.rows);}catch(e){setError((e as Error).message);}finally{setLeaderLoading(false);}
  };
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
        <div className="menu-actions"><button className="button orange play-button" disabled={!ready} onClick={()=>setScreen('driver')}>ИГРАТЬ</button><button className="button secondary" onClick={()=>setScreen('color')}>ГАРАЖ</button></div>
        <div className="vehicle-card"><div><strong>ST9</strong><span>ПИКАП</span></div><div className="stat-bars">{[['СКОРОСТЬ',45],['УПРАВЛЕНИЕ',65],['УСКОРЕНИЕ',50]].map(([label,width])=><span key={label}><em>{label}</em><i><b style={{width:width+'%'}}/></i></span>)}</div><div className="drive-type"><span>ПОЛНЫЙ<br/>ПРИВОД</span><strong>4×4</strong></div></div>
        <nav className="bottom-nav"><button onClick={()=>setModal('tasks')}><Icon name="tasks"/><span>ЗАДАНИЯ</span></button><button onClick={()=>setScreen('color')}><Icon name="garage"/><span>ГАРАЖ</span></button><button onClick={records}><Icon name="trophy"/><span>ЛИДЕРЫ</span></button></nav>
      </div>}
      {(screen==='driver'||screen==='color')&&<div className={`screen setup-screen ${screen}`}>
        <div className="screen-header"><button className="icon-button" aria-label="Назад" onClick={()=>setScreen(screen==='driver'?'menu':'driver')}><Icon name="back"/></button><h1>{screen==='driver'?'ВЫБЕРИ ВОДИТЕЛЯ':'ВЫБЕРИ ЦВЕТ МАШИНЫ'}</h1></div>
        {screen==='driver'?<>
          <div className="driver-grid">{(['boy','girl'] as const).map(driver=><button key={driver} className={`driver-card ${stored.driver===driver?'selected':''}`} onClick={()=>chooseDriver(driver)} aria-label={driver==='boy'?'Выбрать парня':'Выбрать девушку'} aria-pressed={stored.driver===driver}><DriverAvatar driver={driver}/><b>{driver==='boy'?'♂':'♀'}</b></button>)}</div>
          <button className="button green setup-next" onClick={()=>setScreen('color')}>ДАЛЕЕ</button>
        </>:<>
          <div className="garage-preview"><VehiclePreview color={stored.carColor}/></div>
          <div className={`swatches ${stored.driver==='girl'?'eight':''}`} aria-label="Цвет кузова">{palette.map(color=><button key={color.value} aria-label={color.name} title={color.name} aria-pressed={stored.carColor===color.value} className={stored.carColor===color.value?'selected':''} style={{'--paint':color.value} as CSSProperties} onClick={()=>updateStored({carColor:color.value})}/>)}</div>
          <p className="paint-name">{palette.find(c=>c.value===stored.carColor)?.name}</p>
          <button className="button green setup-next" onClick={start} disabled={busy}>{busy?'ВЫЕЗЖАЕМ…':'ПОЕХАЛИ'}</button>
        </>}
        <div className="setup-steps"><i className="active"/><i className={screen==='color'?'active':''}/><span>{screen==='driver'?'01 / ВОДИТЕЛЬ':'02 / ВАШ ST9'}</span></div>
      </div>}
      {screen==='game'&&<div className="screen game-screen">
        <PhaserGame key={runId} ref={game} carColor={stored.carColor} onHud={onHud} onExhausted={onExhausted}/>
        <div className="race-hud"><div><span>СЧЁТ</span><strong>{String(hud.score).padStart(4,'0')}</strong></div><div><span>СКОРОСТЬ</span><strong className="orange-text">{hud.speed}<small> КМ/Ч</small></strong></div><div><span>РЕКОРД</span><strong>{String(Math.max(stored.bestScore,hud.score)).padStart(4,'0')}</strong></div><button className="pause-button" aria-label="Пауза" onClick={pause}><Icon name="pause"/></button></div>
        <div className="race-status"><span className="lives" aria-label={`Осталось жизней: ${hud.lives}`}>{[1,2,3].map(n=><b key={n} className={n<=hud.lives?'':'lost'}>♥</b>)}</span><span>{hud.biome}</span><span>{(hud.distance/1000).toFixed(1)} КМ</span></div>
        {hud.ghost&&hud.lives>0&&<div className="ghost-badge">ЗАЩИТА ПОСЛЕ УДАРА</div>}
        <div className="race-controls"><button className={`boost-button ${hud.boost===100?'ready':''}`} style={{'--boost':hud.boost+'%'} as CSSProperties} onClick={boost} aria-label="Активировать ускорение" disabled={hud.boost<100||paused}><strong>4H</strong><span>BOOST</span>{hud.boost<100&&<small>{hud.boost}%</small>}</button><div className="steering"><button aria-label="Перестроиться влево" onClick={()=>game.current?.move(-1)}>‹</button><button aria-label="Перестроиться вправо" onClick={()=>game.current?.move(1)}>›</button></div></div>
        {paused&&modal==='none'&&<div className="pause-overlay"><span className="eyebrow">ПЕРЕВЕДИТЕ ДУХ</span><h2>ПАУЗА</h2><button className="button green" onClick={pause}>ПРОДОЛЖИТЬ</button><button className="text-button" onClick={finish}>ЗАВЕРШИТЬ ЗАЕЗД</button></div>}
      </div>}
      <dialog ref={modalRef} className="modal-card" onCancel={event=>{event.preventDefault();closeModal();}}>
        <button className="modal-close icon-button" aria-label="Закрыть" onClick={closeModal}><Icon name="close"/></button>
        {modal==='settings'&&<><span className="eyebrow">SOLLERS TRAFFIC RUSH</span><h2>НАСТРОЙКИ</h2><button className="setting-row" onClick={()=>{initAudio();setSound(!sound);}}><Icon name={sound?'sound':'mute'}/><span>Звук двигателя</span><b>{sound?'ВКЛ':'ВЫКЛ'}</b></button><div className="instructions"><p><kbd>←</kbd> <kbd>→</kbd> или <kbd>A</kbd> <kbd>D</kbd> — сменить полосу</p><p><kbd>Пробел</kbd> — 4H Boost</p><p><kbd>Esc</kbd> — пауза</p><p>На телефоне — свайпы, касания трассы или стрелки.</p><p>У вас 3 жизни. После удара ST9 на 3 секунды становится прозрачным.</p></div><a className="dealer-link" href="https://sollers-avilon.ru/models/st9/" target="_blank" rel="noreferrer">ОБ АВТОМОБИЛЕ ST9 ↗</a></>}
        {modal==='tasks'&&<><span className="eyebrow">КАЖДЫЙ ЗАЕЗД — НОВЫЙ ВЫЗОВ</span><h2>ЗАДАНИЯ</h2>{[['Обгони 20 машин',hud.overtakes,20],['Собери 5 бонусов',hud.bonuses,5],['Проедь 3 километра',hud.distance,3000]].map(([label,value,target])=><div className="mission" key={label}><div><span>{label}</span><b>{Number(value)>=Number(target)?'✓':`${value} / ${target}`}</b></div><progress value={Number(value)} max={Number(target)}/></div>)}<p className="muted">Собирайте ящики +10 и обгоняйте без столкновений — серия обгонов даёт больше очков.</p><button className="button green" onClick={()=>{setModal('none');setScreen('driver');}}>НА ТРАССУ</button></>}
        {modal==='records'&&<><span className="eyebrow">ОБЩИЙ ЗАЧЁТ</span><h2>ТАБЛИЦА ЛИДЕРОВ</h2><div className="personal-best"><span>ВАШ РЕКОРД НА УСТРОЙСТВЕ</span><strong>{stored.bestScore}</strong></div>{leaderLoading?<p role="status">Загружаем результаты…</p>:leaderboard.length?<ol className="leaderboard">{leaderboard.map((row,i)=><li key={i}><b>{String(i+1).padStart(2,'0')}</b><span>{row.name}<small>{(row.distance/1000).toFixed(1)} км</small></span><strong>{row.score}</strong></li>)}</ol>:!error?<p className="muted">Пока нет результатов.<br/>Станьте первым на этой трассе.</p>:null}{error&&<p className="form-error" role="alert">{error}</p>}<button className="button green" onClick={()=>{setModal('none');setScreen('driver');}}>ПОБИТЬ РЕКОРД</button></>}
        {modal==='continue'&&<><span className="eyebrow">ТРИ ЖИЗНИ ПОТРАЧЕНЫ</span><h2>ЕЩЁ ОДИН<br/>ЗАЕЗД?</h2><div className="continue-score"><strong>{hud.score}</strong><span>ОЧКОВ · {(hud.distance/1000).toFixed(1)} КМ</span></div><p>Верните 3 жизни и продолжайте<br/>с того же места.</p>{phoneTurn?<><p className="muted">Оставьте телефон, чтобы получить ещё одну попытку.</p><button className="button orange" onClick={()=>setModal('phone')}>ОСТАВИТЬ ТЕЛЕФОН</button></>:<>{config.socialUrl?<><a className="button green" href={config.socialUrl} target="_blank" rel="noreferrer" onClick={()=>setSocialOpened(true)}>ПОДПИСАТЬСЯ · {config.socialLabel}</a>{socialOpened&&<><p className="muted">Подтвердите подписку. Автоматическая проверка пока не подключена.</p><button className="button orange" onClick={continueRace}>Я ПОДПИСАЛСЯ · ПРОДОЛЖИТЬ</button></>}</>:<><p className="muted">В демоверсии продолжение доступно без подписки.</p><button className="button green" onClick={continueRace}>ВЕРНУТЬ 3 ЖИЗНИ · ДЕМО</button></>}</>}{config.continueMode==='choice'&&<button className="text-button" onClick={()=>setModal('phone')}>ИЛИ ОСТАВИТЬ ТЕЛЕФОН</button>}<button className="text-button" onClick={finish}>ЗАВЕРШИТЬ И СОХРАНИТЬ РЕЗУЛЬТАТ</button></>}
        {modal==='phone'&&<><span className="eyebrow">ЕЩЁ 3 ЖИЗНИ</span><h2>ОСТАВЬТЕ<br/>НОМЕР ТЕЛЕФОНА</h2><p>Дилер свяжется с вами<br/>и расскажет о SOLLERS ST9.</p>{config.phoneReady?<form onSubmit={e=>{e.preventDefault();void sendLead();}}><label className="field-label" htmlFor="lead-phone">Телефон</label><input id="lead-phone" className="phone-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={phone} onChange={e=>setPhone(e.target.value)} required/><label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Согласен на обработку персональных данных и звонок дилера. <a href={config.privacyUrl!} target="_blank" rel="noreferrer">Условия обработки</a></span></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button orange" type="submit" disabled={!consent||busy}>{busy?'ОТПРАВЛЯЕМ…':'ОТПРАВИТЬ И ПРОДОЛЖИТЬ'}</button></form>:<><p className="muted">Форма появится после подключения дилера. Пока можно продолжить демоигру без номера.</p><button className="button green" onClick={continueRace}>ПРОДОЛЖИТЬ ДЕМО</button></>}<button className="text-button" onClick={finish}>СОХРАНИТЬ РЕЗУЛЬТАТ</button></>}
        {modal==='result'&&<><span className="eyebrow">{hud.score>=stored.bestScore&&hud.score>0?'ЛИЧНЫЙ РЕКОРД':'ХОРОШИЙ ЗАЕЗД'}</span><h2>ФИНИШ</h2><div className="result-score">{hud.score}<span>ОЧКОВ</span></div><p>{(hud.distance/1000).toFixed(1)} км · {hud.overtakes} обгонов · {hud.bonuses} бонусов</p>{saved?<p className="success-message">✓ Результат в таблице лидеров</p>:<form onSubmit={e=>{e.preventDefault();void publishScore();}}><label className="field-label" htmlFor="player-name">Имя в таблице лидеров</label><input id="player-name" value={name} onChange={e=>setName(e.target.value)} className="name-input" placeholder="Ваш позывной" minLength={2} maxLength={20} required autoComplete="nickname"/>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button secondary" type="submit" disabled={busy||name.trim().length<2}>{busy?'СОХРАНЯЕМ…':'В ТАБЛИЦУ ЛИДЕРОВ'}</button></form>}<button className="button orange" onClick={start} disabled={busy}>ЕЩЁ ЗАЕЗД</button><button className="text-button" onClick={()=>{setModal('none');setScreen('menu');}}>В ГЛАВНОЕ МЕНЮ</button></>}
      </dialog>
    </section>
    <footer className="outside-help"><span><kbd>←</kbd><kbd>→</kbd> УПРАВЛЕНИЕ</span><span><kbd>ПРОБЕЛ</kbd> BOOST</span><span>3 ЖИЗНИ. ОДНА ТРАССА. ВАШ РЕКОРД.</span></footer>
  </main>;
}

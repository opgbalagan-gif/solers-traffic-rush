'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOY_COLORS, GIRL_COLORS } from '@/src/config/game';
import type { HudState } from '@/src/game/scenes/TrafficScene';
import { leadService } from '@/src/services/leadService';
import { DEFAULT_STATE, loadGameState, saveGameState, type Driver, type StoredGameState } from '@/src/state/store';
import { PhaserGame, type PhaserGameHandle } from '@/src/ui/PhaserGame';
import { DriverAvatar, GameLogo, VehiclePreview } from '@/src/ui/Visuals';

type Screen = 'launcher' | 'menu' | 'setup' | 'game';
type Modal = 'none' | 'phone' | 'code' | 'install' | 'gameover';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INITIAL_HUD: HudState = { score: 0, speed: 82, boost: 100 };

function formatPhone(digits: string) {
  const rest = digits.slice(1);
  const a = (rest.slice(0, 3) + '___').slice(0, 3);
  const b = (rest.slice(3, 6) + '___').slice(0, 3);
  const c = (rest.slice(6, 8) + '__').slice(0, 2);
  const d = (rest.slice(8, 10) + '__').slice(0, 2);
  return `+7 (${a}) ${b}-${c}-${d}`;
}

export function GameApp() {
  const gameRef = useRef<PhaserGameHandle>(null);
  const installPromptRef = useRef<InstallPrompt | null>(null);
  const [screen, setScreen] = useState<Screen>('launcher');
  const [modal, setModal] = useState<Modal>('none');
  const [stored, setStored] = useState<StoredGameState>(DEFAULT_STATE);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [paused, setPaused] = useState(false);
  const [runId, setRunId] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [phoneDigits, setPhoneDigits] = useState('7');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const palette = stored.driver === 'boy' ? BOY_COLORS : GIRL_COLORS;

  useEffect(() => {
    const saved = loadGameState();
    setStored(saved);
    setPhoneDigits(saved.phone.replace(/\D/g, '') || '7');

    const register = () => {
      const basePath = window.location.pathname.startsWith('/solers-traffic-rush') ? '/solers-traffic-rush' : '';
      if ('serviceWorker' in navigator) void navigator.serviceWorker.register(`${basePath}/sw.js`);
    };
    window.addEventListener('load', register, { once: true });

    const captureInstall = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as InstallPrompt;
    };
    window.addEventListener('beforeinstallprompt', captureInstall);
    return () => window.removeEventListener('beforeinstallprompt', captureInstall);
  }, []);

  const commitState = useCallback((patch: Partial<StoredGameState>) => {
    setStored((current) => {
      const next = { ...current, ...patch };
      saveGameState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const startRace = useCallback(() => {
    setHud(INITIAL_HUD);
    setPaused(false);
    setModal('none');
    setRunId((value) => value + 1);
    setScreen('game');
  }, []);

  const onHud = useCallback((value: HudState) => setHud(value), []);

  const onCrash = useCallback((score: number) => {
    setFinalScore(score);
    setStored((current) => {
      const next = {
        ...current,
        bestScore: Math.max(current.bestScore, score),
        demoRuns: current.demoRuns + 1,
      };
      saveGameState(next);
      window.setTimeout(() => setModal(current.phoneVerified ? 'gameover' : 'phone'), 120);
      return next;
    });
  }, []);

  const chooseDriver = (driver: Driver) => {
    const colors = driver === 'boy' ? BOY_COLORS : GIRL_COLORS;
    commitState({ driver, carColor: colors[0].value });
  };

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    gameRef.current?.setPaused(next);
  };

  const addPhoneDigit = (digit: string) => {
    setError('');
    if (digit === 'back') {
      setPhoneDigits((value) => (value.length > 1 ? value.slice(0, -1) : '7'));
      return;
    }
    setPhoneDigits((value) => (value.length < 11 ? value + digit : value));
  };

  const sendCode = async () => {
    if (phoneDigits.length !== 11) {
      setError('Введите номер полностью');
      return;
    }
    setBusy(true);
    setError('');
    const phone = `+${phoneDigits}`;
    await leadService.requestCode(phone);
    commitState({ phone });
    setBusy(false);
    setModal('code');
  };

  const verifyCode = async () => {
    setBusy(true);
    const result = await leadService.verifyCode(`+${phoneDigits}`, code);
    setBusy(false);
    if (!result.ok) {
      setError('Неверный код. В dev-режиме используйте 1234');
      return;
    }
    commitState({ phone: `+${phoneDigits}`, phoneVerified: true });
    setToast('Телефон подтверждён — заезды разблокированы');
    setModal('gameover');
  };

  const installApp = async () => {
    commitState({ sawInstallScreen: true });
    if (installPromptRef.current) {
      await installPromptRef.current.prompt();
      await installPromptRef.current.userChoice;
      installPromptRef.current = null;
    } else {
      setToast('PWA готово: браузер покажет установку на поддерживаемом устройстве');
    }
  };

  const menuRecord = useMemo(() => String(stored.bestScore).padStart(4, '0'), [stored.bestScore]);

  return (
    <main className="experience-shell">
      <section className={`phone-frame screen-${screen}`}>
        {screen === 'launcher' && (
          <button type="button" className="launch-widget" onClick={() => setScreen('menu')}>
            <div className="launch-glow" />
            <GameLogo />
            <div className="launcher-road"><span /><span /><span /></div>
            <VehiclePreview color={stored.carColor} />
            <div className="launch-cta"><i>▶</i><span>НАЖМИ, ЧТОБЫ ИГРАТЬ</span></div>
          </button>
        )}

        {screen === 'menu' && (
          <div className="menu-screen app-screen">
            <button type="button" className="icon-button settings" onClick={() => setToast('Звук и вибрация включены')}>⚙</button>
            <GameLogo />
            <div className="menu-hero">
              <div className="city-lights" />
              <VehiclePreview color={stored.carColor} />
            </div>
            <div className="menu-actions">
              <button type="button" className="button orange" onClick={() => setScreen('setup')}>ИГРАТЬ</button>
              <button type="button" className="button secondary" onClick={() => setToast('Магазин появится в следующем обновлении')}>МАГАЗИН</button>
            </div>
            <div className="vehicle-card">
              <div><strong>ST9</strong><span>ПИКАП</span></div>
              <div className="stat-bars">
                <span>СКОРОСТЬ <i><b style={{ width: '68%' }} /></i></span>
                <span>УПРАВЛЕНИЕ <i><b style={{ width: '78%' }} /></i></span>
                <span>УСКОРЕНИЕ <i><b style={{ width: '62%' }} /></i></span>
              </div>
              <div className="drive-type"><b>ПОЛНЫЙ<br />ПРИВОД</b><strong>4×4</strong></div>
            </div>
            <nav className="bottom-nav" aria-label="Разделы игры">
              <button type="button" onClick={() => setToast('Задания: проедь 500 очков')}>▣<span>ЗАДАНИЯ</span></button>
              <button type="button" onClick={() => setScreen('setup')}>⌂<span>ГАРАЖ</span></button>
              <button type="button" onClick={() => setToast(`Ваш рекорд: ${stored.bestScore}`)}>♛<span>РЕКОРДЫ</span><em>{menuRecord}</em></button>
            </nav>
          </div>
        )}

        {screen === 'setup' && (
          <div className="setup-screen app-screen">
            <header className="screen-header">
              <button type="button" className="back-button" onClick={() => setScreen('menu')}>←</button>
              <div><span>ПОДГОТОВКА К ЗАЕЗДУ</span><strong>ВЫБЕРИ ВОДИТЕЛЯ И ЦВЕТ</strong></div>
            </header>

            <div className="driver-grid">
              {(['boy', 'girl'] as Driver[]).map((driver) => (
                <button
                  type="button"
                  key={driver}
                  className={`driver-card ${stored.driver === driver ? 'selected' : ''}`}
                  onClick={() => chooseDriver(driver)}
                >
                  <DriverAvatar driver={driver} />
                  <span>{driver === 'boy' ? 'МАКС' : 'АНЯ'}</span>
                  <b>{driver === 'boy' ? '♂' : '♀'}</b>
                </button>
              ))}
            </div>

            <div className="color-section">
              <div className="preview-plinth"><VehiclePreview color={stored.carColor} small /></div>
              <p><span>ST9</span><strong>{palette.find((color) => color.value === stored.carColor)?.name}</strong></p>
              <div className="swatches" aria-label="Цвет автомобиля">
                {palette.map((color) => (
                  <button
                    type="button"
                    key={color.value}
                    aria-label={color.name}
                    className={stored.carColor === color.value ? 'selected' : ''}
                    style={{ background: color.value }}
                    onClick={() => commitState({ carColor: color.value })}
                  />
                ))}
              </div>
            </div>
            <button type="button" className="button green setup-next" onClick={startRace}>ДАЛЕЕ <span>→</span></button>
          </div>
        )}

        {screen === 'game' && (
          <div className="game-screen app-screen">
            <PhaserGame key={runId} ref={gameRef} carColor={stored.carColor} onHud={onHud} onCrash={onCrash} />
            <div className="race-hud">
              <div><span>СЧЁТ</span><strong>{String(hud.score).padStart(4, '0')}</strong></div>
              <div><span>СКОРОСТЬ</span><strong className="orange-text">{hud.speed}<small> КМ/Ч</small></strong></div>
              <div><span>РЕКОРД</span><strong>{String(stored.bestScore).padStart(4, '0')}</strong></div>
              <button type="button" className="pause-button" onClick={togglePause}>{paused ? '▶' : 'Ⅱ'}</button>
            </div>
            <div className="race-controls">
              <button type="button" className="race-arrow left" onPointerDown={() => gameRef.current?.move(-1)}>←</button>
              <button
                type="button"
                className={`boost-button ${hud.boost >= 100 ? 'ready' : ''}`}
                onClick={() => gameRef.current?.boost()}
                style={{ '--boost': `${hud.boost * 3.6}deg` } as React.CSSProperties}
              ><strong>4H</strong><span>BOOST</span><small>{hud.boost}%</small></button>
              <button type="button" className="race-arrow right" onPointerDown={() => gameRef.current?.move(1)}>→</button>
            </div>
            {paused && <div className="pause-overlay"><GameLogo compact /><h2>ПАУЗА</h2><button type="button" className="button green" onClick={togglePause}>ПРОДОЛЖИТЬ</button><button type="button" className="text-button" onClick={() => { setScreen('menu'); setPaused(false); }}>В МЕНЮ</button></div>}
          </div>
        )}

        {modal !== 'none' && (
          <div className="modal-backdrop">
            {modal === 'phone' && (
              <div className="modal-card phone-modal">
                <button type="button" className="modal-close" onClick={() => setModal('install')}>×</button>
                <p className="modal-eyebrow">ДЕМО-ЗАЕЗД ЗАВЕРШЁН</p>
                <h2>ВВЕДИ НОМЕР ТЕЛЕФОНА</h2>
                <p>Мы отправим SMS с кодом<br />для продолжения игры</p>
                <div className="phone-display">{formatPhone(phoneDigits)}</div>
                {error && <div className="form-error">{error}</div>}
                <button type="button" className="button orange" disabled={busy} onClick={sendCode}>{busy ? 'ОТПРАВЛЯЕМ…' : 'ПОЛУЧИТЬ КОД'}</button>
                <div className="keypad">
                  {['1','2','3','4','5','6','7','8','9','+7','0','back'].map((key) => (
                    <button type="button" key={key} onClick={() => key === '+7' ? setPhoneDigits('7') : addPhoneDigit(key)}>{key === 'back' ? '⌫' : key}</button>
                  ))}
                </div>
              </div>
            )}

            {modal === 'code' && (
              <div className="modal-card code-modal">
                <button type="button" className="modal-close" onClick={() => setModal('install')}>×</button>
                <p className="modal-eyebrow">SMS ОТПРАВЛЕНО</p>
                <h2>ВВЕДИ КОД</h2>
                <p>Код отправлен на {formatPhone(phoneDigits)}</p>
                <input
                  value={code}
                  onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="code-input"
                  placeholder="••••"
                  aria-label="Код из SMS"
                />
                <small className="dev-code">DEV-КОД: 1234</small>
                {error && <div className="form-error">{error}</div>}
                <button type="button" className="button green" disabled={code.length !== 4 || busy} onClick={verifyCode}>{busy ? 'ПРОВЕРЯЕМ…' : 'ПОДТВЕРДИТЬ'}</button>
              </div>
            )}

            {modal === 'install' && (
              <div className="modal-card install-modal">
                <button type="button" className="modal-close" onClick={() => { commitState({ sawInstallScreen: true }); setModal('none'); setScreen('menu'); }}>×</button>
                <p className="modal-eyebrow">SOLLERS TRAFFIC RUSH</p>
                <h2>ХОЧЕШЬ<br />ПРОДОЛЖИТЬ?</h2>
                <p>Установи приложение<br />и играй без ограничений!</p>
                <div className="app-icon-preview"><GameLogo compact /><VehiclePreview color={stored.carColor} small /></div>
                <button type="button" className="button green" onClick={installApp}>УСТАНОВИТЬ ПРИЛОЖЕНИЕ</button>
                <button type="button" className="text-button" onClick={() => { commitState({ sawInstallScreen: true }); setModal('none'); setScreen('menu'); }}>ПРОДОЛЖИТЬ ПОЗЖЕ</button>
              </div>
            )}

            {modal === 'gameover' && (
              <div className="modal-card result-modal">
                <p className="modal-eyebrow">ЗАЕЗД ЗАВЕРШЁН</p>
                <h2>{String(finalScore).padStart(4, '0')}</h2>
                <p>Ваш результат · рекорд {stored.bestScore}</p>
                {stored.phoneVerified && <div className="verified-badge">✓ ТЕЛЕФОН ПОДТВЕРЖДЁН</div>}
                <button type="button" className="button orange" onClick={startRace}>ЕЩЁ РАЗ</button>
                <button type="button" className="text-button" onClick={() => { setModal('none'); setScreen('menu'); }}>В МЕНЮ</button>
              </div>
            )}
          </div>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </section>
    </main>
  );
}

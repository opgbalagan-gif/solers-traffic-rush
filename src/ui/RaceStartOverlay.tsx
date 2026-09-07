import { ControlIcon, DrivingGuide } from '@/src/ui/DrivingGuide';

export type RacePhase = 'loading' | 'rules' | 'race' | 'error';

export function RaceStartOverlay({ phase, countdown, paused, onBegin, onRetry }: {
  phase: RacePhase; countdown: number; paused: boolean; onBegin: () => void; onRetry: () => void;
}) {
  if (phase === 'loading') return <div className="game-loading" role="status">
    <span className="loader" aria-hidden="true" /><strong>ГОТОВИМ ВАШ ST9</strong><span>Загружаем трассу…</span>
  </div>;
  if (phase === 'error') return <div className="game-loading" role="alert">
    <strong>Не удалось загрузить трассу</strong><button className="button orange" onClick={onRetry}>ПОВТОРИТЬ ЗАГРУЗКУ</button>
  </div>;
  if (phase === 'rules') return <section className="race-rules" aria-labelledby="race-rules-title">
    <div className="race-rules-content">
      <span className="eyebrow">ПЕРЕД СТАРТОМ</span>
      <h2 id="race-rules-title">УПРАВЛЯЙ ОДНИМ ПАЛЬЦЕМ</h2>
      <DrivingGuide />
      <div className="tutorial-track-notes">
        <span><b aria-hidden="true">♥ ♥ ♥</b> Избегай столкновений</span>
        <span><b className="tutorial-bonus" aria-hidden="true">+10</b>Бери ящики и обгоняй без ударов</span>
        <span><ControlIcon name="pause" size={18} />Пауза — справа вверху</span>
      </div>
      <div className="tutorial-track-window" aria-hidden="true" />
      <div className="tutorial-footer">
        <p className="race-rules-keyboard">На компьютере: <kbd>←</kbd> <kbd>→</kbd> — полоса,<br/>удерживай <kbd>Пробел</kbd> — азот. <kbd>Esc</kbd> — пауза.</p>
        <button className="button orange" onClick={onBegin}>НАЧАТЬ ЗАЕЗД</button>
      </div>
    </div>
  </section>;
  if (countdown > 0 && !paused) return <div className="race-countdown" role="status" aria-label={`Старт через ${countdown}`}>
    <strong key={countdown}>{countdown}</strong>
  </div>;
  return null;
}

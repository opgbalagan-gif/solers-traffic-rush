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
      <h2 id="race-rules-title">КАК ИГРАТЬ</h2>
      <p className="race-rules-intro">Обгоняй трафик и набирай очки.</p>
      <ul className="race-rules-list">
        <li><span className="rule-symbol" aria-hidden="true">↔</span><div><strong>МЕНЯЙ ПОЛОСУ</strong><p>Свайп влево или вправо.</p></div></li>
        <li><span className="rule-symbol nitro-symbol" aria-hidden="true">↑</span><div><strong>УСКОРЯЙСЯ</strong><p>Удерживай палец — азот.<br/>Отпусти — заряд восстановится.</p></div></li>
        <li><span className="rule-symbol heart-symbol" aria-hidden="true">♥</span><div><strong>БЕРЕГИ 3 ЖИЗНИ</strong><p>Столкновение забирает сердечко.<br/>После удара — короткая защита.</p></div></li>
        <li><span className="rule-symbol score-symbol" aria-hidden="true">+10</span><div><strong>СОБИРАЙ ОЧКИ</strong><p>Бери ящики и обгоняй без ударов — серия даёт больше очков.</p></div></li>
      </ul>
      <p className="race-rules-keyboard">На компьютере: <kbd>←</kbd> <kbd>→</kbd> — полоса,<br/>удерживай <kbd>Пробел</kbd> — азот.</p>
      <button className="button orange" onClick={onBegin}>НАЧАТЬ ЗАЕЗД</button>
    </div>
  </section>;
  if (countdown > 0 && !paused) return <div className="race-countdown" role="status" aria-label={`Старт через ${countdown}`}>
    <strong key={countdown}>{countdown}</strong>
  </div>;
  return null;
}

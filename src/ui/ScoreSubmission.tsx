export type ScorePayload = { id: string; token: string; name: string; score: number; distance: number };
export type Submission = { payload: ScorePayload; status: 'sending' | 'saved' | 'error'; error?: string };

export function ScoreSubmission({ submission, onRetry }: { submission: Submission; onRetry: () => void }) {
  const { payload, status, error } = submission;
  return <section className={`score-submission ${status}`} aria-label="Ваш результат">
    <div className="submitted-score"><span>{payload.name}<small>{(payload.distance / 1000).toFixed(1)} км</small></span><strong>{payload.score}<small>ОЧКОВ</small></strong></div>
    <p className="submission-status" role="status">
      <i aria-hidden="true"/>{status === 'sending' ? 'Отправляется в общий рейтинг…' : status === 'saved' ? 'Сохранено в общем рейтинге' : 'Не удалось отправить'}
    </p>
    {status === 'error' && <><p className="submission-error">{error}</p><button className="button secondary" onClick={onRetry}>ПОВТОРИТЬ ОТПРАВКУ</button></>}
  </section>;
}

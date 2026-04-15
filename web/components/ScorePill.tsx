export function ScorePill({ score }: { score: number }) {
  const color =
    score >= 4.2
      ? 'text-[var(--green)] font-bold'
      : score >= 3.8
      ? 'text-[var(--yellow)]'
      : score >= 3.0
      ? 'text-[var(--text)]'
      : 'text-[var(--red)]';

  return (
    <span className={`tabular-nums ${color}`}>
      {score > 0 ? score.toFixed(1) : '—'}
    </span>
  );
}

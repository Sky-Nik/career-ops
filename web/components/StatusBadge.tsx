import { STATUS_LABELS } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[var(--mauve)] bg-[var(--mauve)]/10',
  interview: 'text-[var(--green)] bg-[var(--green)]/10',
  offer: 'text-[var(--green)] bg-[var(--green)]/10',
  responded: 'text-[var(--blue)] bg-[var(--blue)]/10',
  applied: 'text-[var(--sky)] bg-[var(--sky)]/10',
  evaluated: 'text-[var(--text)] bg-[var(--surface0)]',
  skip: 'text-[var(--red)] bg-[var(--red)]/10',
  rejected: 'text-[var(--subtext)] bg-[var(--surface0)]',
  discarded: 'text-[var(--subtext)] bg-[var(--surface0)]',
};

export function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? 'text-[var(--subtext)] bg-[var(--surface0)]';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

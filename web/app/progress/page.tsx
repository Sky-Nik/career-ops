'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getApplications, computeProgressMetrics } from '@/lib/data';
import type { Application } from '@/lib/types';

function Bar({
  count,
  max,
  color,
}: {
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div
      className="h-4 rounded-sm transition-all duration-500"
      style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, backgroundColor: color }}
    />
  );
}

function RateColor(rate: number) {
  if (rate >= 30) return 'var(--green)';
  if (rate >= 15) return 'var(--yellow)';
  if (rate >= 5) return 'var(--peach)';
  return 'var(--red)';
}

export default function ProgressPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApplications().then(setApps).finally(() => setLoading(false));
  }, []);

  const m = useMemo(() => computeProgressMetrics(apps), [apps]);

  const funnelColors = [
    'var(--blue)',
    'var(--sky)',
    'var(--green)',
    'var(--yellow)',
    'var(--peach)',
  ];

  const scoreColors = [
    'var(--green)',
    'var(--green)',
    'var(--yellow)',
    'var(--peach)',
    'var(--red)',
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--base)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ backgroundColor: 'var(--mantle)', borderColor: 'var(--surface0)' }}
      >
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold" style={{ color: 'var(--mauve)' }}>
            SEARCH PROGRESS
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="transition-colors hover:text-[var(--blue)]"
              style={{ color: 'var(--subtext)' }}
            >
              Pipeline
            </Link>
            <span className="font-medium" style={{ color: 'var(--blue)' }}>Progress</span>
          </nav>
        </div>
        <div className="text-sm" style={{ color: 'var(--subtext)' }}>
          {apps.length} evaluated · avg {m.avgScore.toFixed(1)}/5
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--subtext)' }}>
          Loading…
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
          {/* Funnel */}
          <section>
            <h2 className="text-sm font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--sky)' }}>
              Pipeline Funnel
            </h2>
            <div className="space-y-2">
              {m.funnelStages.map((stage, i) => {
                const maxCount = m.funnelStages[0]?.count ?? 1;
                return (
                  <div key={stage.label} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-right" style={{ color: 'var(--text)' }}>
                      {stage.label}
                    </div>
                    <div className="flex-1">
                      <Bar count={stage.count} max={maxCount} color={funnelColors[i] ?? 'var(--text)'} />
                    </div>
                    <div className="w-20 text-xs" style={{ color: 'var(--subtext)' }}>
                      {stage.count}
                      {i > 0 && (
                        <span className="ml-1">({stage.pct.toFixed(0)}%)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Conversion Rates */}
          <section>
            <h2 className="text-sm font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--sky)' }}>
              Conversion Rates
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Response Rate', value: m.responseRate },
                { label: 'Interview Rate', value: m.interviewRate },
                { label: 'Offer Rate', value: m.offerRate },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="p-4 rounded-lg border text-center"
                  style={{ backgroundColor: 'var(--mantle)', borderColor: 'var(--surface0)' }}
                >
                  <div
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: RateColor(value) }}
                  >
                    {value.toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--subtext)' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs" style={{ color: 'var(--subtext)' }}>
              {m.activeApps} active · {m.totalOffers} offers · top score {m.topScore.toFixed(1)}/5
            </div>
          </section>

          {/* Score Distribution */}
          <section>
            <h2 className="text-sm font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--sky)' }}>
              Score Distribution
            </h2>
            <div className="space-y-2">
              {m.scoreBuckets.map((bucket, i) => {
                const maxCount = Math.max(...m.scoreBuckets.map(b => b.count), 1);
                return (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-right tabular-nums" style={{ color: 'var(--text)' }}>
                      {bucket.label}
                    </div>
                    <div className="flex-1">
                      <Bar count={bucket.count} max={maxCount} color={scoreColors[i] ?? 'var(--text)'} />
                    </div>
                    <div className="w-8 text-xs" style={{ color: 'var(--subtext)' }}>
                      {bucket.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Weekly Activity */}
          <section>
            <h2 className="text-sm font-bold mb-4 uppercase tracking-wider" style={{ color: 'var(--sky)' }}>
              Weekly Activity
            </h2>
            {m.weeklyActivity.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--subtext)' }}>No data</p>
            ) : (
              <div className="space-y-2">
                {m.weeklyActivity.map(week => {
                  const maxCount = Math.max(...m.weeklyActivity.map(w => w.count), 1);
                  const shortWeek = week.week.includes('-') ? week.week.split('-').pop()! : week.week;
                  return (
                    <div key={week.week} className="flex items-center gap-3">
                      <div className="w-12 text-xs text-right" style={{ color: 'var(--subtext)' }}>
                        {shortWeek}
                      </div>
                      <div className="flex-1">
                        <Bar count={week.count} max={maxCount} color="var(--blue)" />
                      </div>
                      <div className="w-8 text-xs" style={{ color: 'var(--subtext)' }}>
                        {week.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

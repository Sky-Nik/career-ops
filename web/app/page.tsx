'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getApplications, computeMetrics } from '@/lib/data';
import type { Application } from '@/lib/types';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ScorePill } from '@/components/ScorePill';

const TABS = [
  { label: 'ALL', filter: 'all' },
  { label: 'PENDING', filter: 'pending' },
  { label: 'EVALUATED', filter: 'evaluated' },
  { label: 'APPLIED', filter: 'applied' },
  { label: 'INTERVIEW', filter: 'interview' },
  { label: 'TOP ≥4', filter: 'top' },
  { label: 'SKIP', filter: 'skip' },
];

const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'date', label: 'Date' },
  { value: 'company', label: 'Company' },
  { value: 'status', label: 'Status' },
];

function statusPriority(s: string) {
  const order = ['interview', 'offer', 'responded', 'applied', 'evaluated', 'pending', 'skip', 'rejected', 'discarded'];
  const i = order.indexOf(s);
  return i === -1 ? 99 : i;
}

export default function PipelinePage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [sortMode, setSortMode] = useState('score');
  const [search, setSearch] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    getApplications()
      .then(data => {
        setApps(data);
        if (data.length > 0) {
          const latest = data.reduce((a, b) =>
            new Date(a.synced_at) > new Date(b.synced_at) ? a : b
          );
          setLastSync(latest.synced_at);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => computeMetrics(apps), [apps]);

  const filtered = useMemo(() => {
    let result = apps.filter(app => {
      if (activeTab === 'all') return true;
      if (activeTab === 'top') return app.score >= 4.0 && app.status !== 'skip';
      return app.status === activeTab;
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        a =>
          a.company.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          (a.notes ?? '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortMode === 'score') return b.score - a.score;
      if (sortMode === 'date') return (b.date ?? '').localeCompare(a.date ?? '');
      if (sortMode === 'company') return a.company.localeCompare(b.company);
      if (sortMode === 'status') return statusPriority(a.status) - statusPriority(b.status);
      return 0;
    });

    return result;
  }, [apps, activeTab, sortMode, search]);

  function countForTab(filter: string) {
    if (filter === 'all') return apps.length;
    if (filter === 'top') return apps.filter(a => a.score >= 4.0 && a.status !== 'skip').length;
    return apps.filter(a => a.status === filter).length;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--base)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ backgroundColor: 'var(--mantle)', borderColor: 'var(--surface0)' }}
      >
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold" style={{ color: 'var(--blue)' }}>
            CAREER PIPELINE
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <span className="font-medium" style={{ color: 'var(--blue)' }}>Pipeline</span>
            <Link
              href="/progress"
              className="transition-colors hover:text-[var(--blue)]"
              style={{ color: 'var(--subtext)' }}
            >
              Progress
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--subtext)' }}>
          {lastSync && (
            <span>synced {new Date(lastSync).toLocaleDateString()}</span>
          )}
          <span>{metrics.total} offers · avg {metrics.avgScore.toFixed(1)}/5</span>
        </div>
      </div>

      {/* Metrics bar */}
      <div
        className="flex gap-4 px-6 py-2 text-sm border-b flex-wrap"
        style={{ backgroundColor: 'var(--mantle)', borderColor: 'var(--surface0)' }}
      >
        {STATUS_ORDER.map(s => {
          const count = metrics.byStatus[s] ?? 0;
          if (count === 0) return null;
          return (
            <span key={s} className="flex items-center gap-1">
              <StatusBadge status={s} />
              <span style={{ color: 'var(--subtext)' }}>{count}</span>
            </span>
          );
        })}
        {metrics.withPDF > 0 && (
          <span style={{ color: 'var(--subtext)' }}>· {metrics.withPDF} PDFs</span>
        )}
      </div>

      {/* Tabs + controls */}
      <div
        className="flex items-center justify-between px-6 pt-3 pb-0 border-b gap-4 flex-wrap"
        style={{ borderColor: 'var(--surface0)' }}
      >
        <div className="flex items-end gap-1">
          {TABS.map(tab => (
            <button
              key={tab.filter}
              onClick={() => setActiveTab(tab.filter)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.filter
                  ? 'border-[var(--blue)] text-[var(--blue)]'
                  : 'border-transparent text-[var(--subtext)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label} ({countForTab(tab.filter)})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-1.5 rounded text-sm outline-none w-48"
            style={{
              backgroundColor: 'var(--surface0)',
              color: 'var(--text)',
              border: '1px solid var(--surface1)',
            }}
          />
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value)}
            className="px-3 py-1.5 rounded text-sm outline-none"
            style={{
              backgroundColor: 'var(--surface0)',
              color: 'var(--text)',
              border: '1px solid var(--surface1)',
            }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>Sort: {o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--subtext)' }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--subtext)' }}>
            No results
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-xs uppercase tracking-wider border-b"
                style={{ color: 'var(--overlay0)', borderColor: 'var(--surface0)' }}
              >
                <th className="px-6 py-2 text-left w-16">Score</th>
                <th className="px-3 py-2 text-left w-28">Date</th>
                <th className="px-3 py-2 text-left w-44">Company</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left w-28">Status</th>
                <th className="px-3 py-2 text-left w-36">Comp</th>
                <th className="px-6 py-2 text-left w-20">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app, i) => (
                <ApplicationRow key={app.id} app={app} index={i} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ApplicationRow({ app, index }: { app: Application; index: number }) {
  const rowBg = index % 2 === 0 ? 'var(--base)' : 'var(--mantle)';

  return (
    <tr
      className="border-b hover:bg-[var(--surface0)] transition-colors group"
      style={{ backgroundColor: rowBg, borderColor: 'var(--surface0)' }}
    >
      <td className="px-6 py-3">
        <ScorePill score={app.score} />
      </td>
      <td className="px-3 py-3" style={{ color: 'var(--subtext)' }}>
        {app.date || '—'}
      </td>
      <td className="px-3 py-3 font-medium max-w-[11rem] truncate" style={{ color: 'var(--text)' }}>
        {app.job_url ? (
          <a
            href={app.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--blue)] transition-colors"
            title={app.company}
          >
            {app.company}
          </a>
        ) : (
          app.company
        )}
      </td>
      <td className="px-3 py-3 max-w-xs truncate" style={{ color: 'var(--subtext)' }} title={app.role}>
        {app.report_number ? (
          <Link
            href={`/report/${app.report_number}`}
            className="hover:text-[var(--blue)] transition-colors"
          >
            {app.role}
          </Link>
        ) : app.job_url ? (
          <a
            href={app.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--mauve)] transition-colors"
          >
            {app.role} ↗
          </a>
        ) : (
          app.role
        )}
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={app.status} />
      </td>
      <td className="px-3 py-3 text-xs max-w-[9rem] truncate" style={{ color: 'var(--yellow)' }}>
        {/* comp is loaded from reports; shown when available */}
      </td>
      <td className="px-6 py-3 text-center">
        {app.has_pdf ? '✅' : <span style={{ color: 'var(--overlay0)' }}>—</span>}
      </td>
    </tr>
  );
}

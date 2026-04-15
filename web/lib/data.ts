import { supabase } from './supabase';
import type { Application, Report } from './types';

export async function getApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('score', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getReport(reportNumber: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('report_number', reportNumber)
    .single();
  if (error) return null;
  return data;
}

export function computeMetrics(apps: Application[]) {
  const byStatus: Record<string, number> = {};
  let totalScore = 0;
  let scored = 0;
  let topScore = 0;
  let withPDF = 0;
  let actionable = 0;

  for (const app of apps) {
    byStatus[app.status] = (byStatus[app.status] ?? 0) + 1;
    if (app.score > 0) {
      totalScore += app.score;
      scored++;
      if (app.score > topScore) topScore = app.score;
    }
    if (app.has_pdf) withPDF++;
    if (!['skip', 'rejected', 'discarded'].includes(app.status)) actionable++;
  }

  return {
    total: apps.length,
    byStatus,
    avgScore: scored > 0 ? totalScore / scored : 0,
    topScore,
    withPDF,
    actionable,
  };
}

export function computeProgressMetrics(apps: Application[]) {
  const statusCounts: Record<string, number> = {};
  let totalScore = 0;
  let scored = 0;
  let topScore = 0;
  let totalOffers = 0;
  let activeApps = 0;

  for (const app of apps) {
    statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1;
    if (app.score > 0) {
      totalScore += app.score;
      scored++;
      if (app.score > topScore) topScore = app.score;
    }
    if (app.status === 'offer') totalOffers++;
    if (!['skip', 'rejected', 'discarded'].includes(app.status)) activeApps++;
  }

  const total = apps.length;
  const applied =
    (statusCounts['applied'] ?? 0) +
    (statusCounts['responded'] ?? 0) +
    (statusCounts['interview'] ?? 0) +
    (statusCounts['offer'] ?? 0) +
    (statusCounts['rejected'] ?? 0);
  const responded =
    (statusCounts['responded'] ?? 0) +
    (statusCounts['interview'] ?? 0) +
    (statusCounts['offer'] ?? 0);
  const interview = (statusCounts['interview'] ?? 0) + (statusCounts['offer'] ?? 0);
  const offer = statusCounts['offer'] ?? 0;

  const safePct = (p: number, w: number) => (w > 0 ? (p / w) * 100 : 0);

  const funnelStages = [
    { label: 'Evaluated', count: total, pct: 100 },
    { label: 'Applied', count: applied, pct: safePct(applied, total) },
    { label: 'Responded', count: responded, pct: safePct(responded, applied) },
    { label: 'Interview', count: interview, pct: safePct(interview, applied) },
    { label: 'Offer', count: offer, pct: safePct(offer, applied) },
  ];

  const buckets = [0, 0, 0, 0, 0];
  for (const app of apps) {
    if (app.score <= 0) continue;
    if (app.score >= 4.5) buckets[0]++;
    else if (app.score >= 4.0) buckets[1]++;
    else if (app.score >= 3.5) buckets[2]++;
    else if (app.score >= 3.0) buckets[3]++;
    else buckets[4]++;
  }
  const scoreBuckets = [
    { label: '4.5–5.0', count: buckets[0] },
    { label: '4.0–4.4', count: buckets[1] },
    { label: '3.5–3.9', count: buckets[2] },
    { label: '3.0–3.4', count: buckets[3] },
    { label: '< 3.0', count: buckets[4] },
  ];

  const weekCounts: Record<string, number> = {};
  for (const app of apps) {
    if (!app.date) continue;
    const d = new Date(app.date);
    if (isNaN(d.getTime())) continue;
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    weekCounts[key] = (weekCounts[key] ?? 0) + 1;
  }
  const sortedWeeks = Object.keys(weekCounts).sort();
  const weeklyActivity = sortedWeeks.slice(-8).map(w => ({ week: w, count: weekCounts[w] }));

  return {
    funnelStages,
    scoreBuckets,
    weeklyActivity,
    responseRate: safePct(responded, applied),
    interviewRate: safePct(interview, applied),
    offerRate: safePct(offer, applied),
    avgScore: scored > 0 ? totalScore / scored : 0,
    topScore,
    totalOffers,
    activeApps,
  };
}

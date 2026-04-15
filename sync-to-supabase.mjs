#!/usr/bin/env node
/**
 * sync-to-supabase.mjs
 * Pushes local career-ops data (applications + reports) to Supabase.
 * Run this any time you want to refresh the live dashboard.
 *
 * Usage:
 *   node sync-to-supabase.mjs
 *
 * Requires env vars (or .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Load env ---
function loadEnv() {
  const envFile = path.join(__dirname, '.env.local');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Create a .env.local file with those values. See README for instructions.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Parsers (ported from Go dashboard/internal/data/career.go) ---

function normalizeStatus(raw) {
  let s = raw.replace(/\*\*/g, '').trim().toLowerCase();
  if (s.includes(' 202')) s = s.slice(0, s.indexOf(' 202')).trim();

  if (s.includes('no aplicar') || s.includes('no_aplicar') || s === 'skip' || s.includes('geo blocker')) return 'skip';
  if (s.includes('interview') || s.includes('entrevista')) return 'interview';
  if (s === 'offer' || s.includes('oferta')) return 'offer';
  if (s.includes('responded') || s.includes('respondido')) return 'responded';
  if (s.includes('applied') || s.includes('aplicado') || s === 'enviada' || s === 'aplicada' || s === 'sent') return 'applied';
  if (s.includes('rejected') || s.includes('rechazado') || s === 'rechazada') return 'rejected';
  if (s.includes('discarded') || s.includes('descartado') || s === 'descartada' || s === 'cerrada' || s === 'cancelada' || s.startsWith('duplicado') || s.startsWith('dup')) return 'discarded';
  if (s.includes('evaluated') || s.includes('evaluada') || s === 'condicional' || s === 'hold' || s === 'monitor' || s === 'evaluar' || s === 'verificar') return 'evaluated';
  return s;
}

function parseApplications(careerOpsPath) {
  let filePath = path.join(careerOpsPath, 'applications.md');
  if (!fs.existsSync(filePath)) {
    filePath = path.join(careerOpsPath, 'data', 'applications.md');
  }
  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const apps = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('# ') || line.startsWith('|---') || line.startsWith('| #')) continue;
    if (!line.startsWith('|')) continue;

    let fields;
    if (line.includes('\t')) {
      const stripped = line.replace(/^\|/, '').trim();
      fields = stripped.split('\t').map(f => f.trim().replace(/^\||\|$/g, '').trim());
    } else {
      fields = line.replace(/^\||\|$/g, '').split('|').map(f => f.trim());
    }

    if (fields.length < 8) continue;

    const scoreRaw = fields[4] || '';
    const scoreMatch = scoreRaw.match(/(\d+\.?\d*)\/5/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

    const reportField = fields[7] || '';
    const reportMatch = reportField.match(/\[(\d+)\]\(([^)]+)\)/);

    apps.push({
      date: fields[1] || '',
      company: fields[2] || '',
      role: fields[3] || '',
      score,
      score_raw: scoreRaw,
      status: normalizeStatus(fields[5] || ''),
      has_pdf: (fields[6] || '').includes('✅'),
      report_number: reportMatch ? reportMatch[1] : null,
      report_path: reportMatch ? reportMatch[2] : null,
      notes: fields[8] || '',
      job_url: null,
    });
  }

  return apps;
}

function cleanTableCell(s) {
  return s.trim().replace(/\|+$/, '').trim();
}

function loadReportSummary(content) {
  const archetypeMatch = content.match(/\*\*Arquetipo(?:\s+detectado)?\*\*\s*\|\s*(.+)/i)
    || content.match(/\*\*Arquetipo:\*\*\s*(.+)/i);
  const tldrMatch = content.match(/\*\*TL;DR\*\*\s*\|\s*(.+)/i)
    || content.match(/\*\*TL;DR:\*\*\s*(.+)/i);
  const remoteMatch = content.match(/\*\*Remote\*\*\s*\|\s*(.+)/i);
  const compMatch = content.match(/\*\*Comp\*\*\s*\|\s*(.+)/i);
  const urlMatch = content.match(/^\*\*URL:\*\*\s*(https?:\/\/\S+)/m);

  return {
    archetype: archetypeMatch ? cleanTableCell(archetypeMatch[1]) : null,
    tldr: tldrMatch ? cleanTableCell(tldrMatch[1]).slice(0, 200) : null,
    remote: remoteMatch ? cleanTableCell(remoteMatch[1]) : null,
    comp: compMatch ? cleanTableCell(compMatch[1]) : null,
    job_url: urlMatch ? urlMatch[1].trim() : null,
  };
}

// --- Sync ---

async function syncApplications(careerOpsPath) {
  const apps = parseApplications(careerOpsPath);
  if (apps.length === 0) {
    console.log('  No applications found.');
    return 0;
  }

  // Enrich job_url from reports
  for (const app of apps) {
    if (app.report_path) {
      const fullPath = path.join(careerOpsPath, app.report_path);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8').slice(0, 1000);
        const summary = loadReportSummary(content);
        if (summary.job_url) app.job_url = summary.job_url;
      }
    }
  }

  const rows = apps.map((app, i) => ({ ...app, number: i + 1, synced_at: new Date().toISOString() }));

  const { error } = await supabase
    .from('applications')
    .upsert(rows, { onConflict: 'company,role' });

  if (error) throw error;
  return rows.length;
}

async function syncReports(careerOpsPath) {
  const reportsDir = path.join(careerOpsPath, 'reports');
  if (!fs.existsSync(reportsDir)) {
    console.log('  No reports directory found.');
    return 0;
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
  if (files.length === 0) {
    console.log('  No reports found.');
    return 0;
  }

  const rows = [];
  for (const file of files) {
    const numMatch = file.match(/^(\d+)-/);
    if (!numMatch) continue;

    const reportNumber = numMatch[1];
    const reportPath = `reports/${file}`;
    const content = fs.readFileSync(path.join(reportsDir, file), 'utf8');
    const summary = loadReportSummary(content);

    rows.push({
      report_number: reportNumber,
      report_path: reportPath,
      content,
      archetype: summary.archetype,
      tldr: summary.tldr,
      remote: summary.remote,
      comp: summary.comp,
      synced_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from('reports')
    .upsert(rows, { onConflict: 'report_number' });

  if (error) throw error;
  return rows.length;
}

function parsePipeline(careerOpsPath) {
  const filePath = path.join(careerOpsPath, 'data', 'pipeline.md');
  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const pending = [];

  for (const line of lines) {
    const m = line.match(/^- \[ \] (.+?) \| (.+?) \| (.+)$/);
    if (!m) continue;
    pending.push({
      date: new Date().toISOString().slice(0, 10),
      company: m[2].trim(),
      role: m[3].trim(),
      status: 'pending',
      score: 0,
      score_raw: '',
      has_pdf: false,
      report_path: null,
      report_number: null,
      notes: '',
      job_url: m[1].trim(),
    });
  }

  return pending;
}

async function syncPending(careerOpsPath) {
  const pending = parsePipeline(careerOpsPath);
  if (pending.length === 0) {
    console.log('  No pending jobs found.');
    return 0;
  }

  // Only insert pending jobs that don't already exist as evaluated applications
  const { data: existing } = await supabase
    .from('applications')
    .select('company, role');

  const existingKeys = new Set((existing ?? []).map(a => `${a.company}|${a.role}`));
  const newPending = pending.filter(p => !existingKeys.has(`${p.company}|${p.role}`));

  if (newPending.length === 0) return 0;

  const rows = newPending.map((p, i) => ({
    ...p,
    number: 9000 + i, // high number so they sort below evaluated
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('applications')
    .upsert(rows, { onConflict: 'company,role' });

  if (error) throw error;
  return rows.length;
}

async function main() {
  const careerOpsPath = __dirname;
  console.log('career-ops → Supabase sync\n');

  try {
    process.stdout.write('Syncing applications...');
    const appCount = await syncApplications(careerOpsPath);
    console.log(` ${appCount} upserted`);

    process.stdout.write('Syncing pending pipeline...');
    const pendingCount = await syncPending(careerOpsPath);
    console.log(` ${pendingCount} upserted`);

    process.stdout.write('Syncing reports...');
    const reportCount = await syncReports(careerOpsPath);
    console.log(` ${reportCount} upserted`);

    console.log('\nDone. Your live dashboard will reflect these changes.');
  } catch (err) {
    console.error('\nSync failed:', err.message);
    process.exit(1);
  }
}

main();

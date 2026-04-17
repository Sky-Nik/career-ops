#!/usr/bin/env node
/**
 * watch-queue.mjs
 * Background watcher: automatically evaluates jobs when you click "Evaluate" in the dashboard.
 *
 * Usage:
 *   node watch-queue.mjs
 *
 * Keep it running in a terminal while you browse the dashboard.
 * When you click "Evaluate" on a job, this script picks it up within 30s and:
 *   1. Adds the job URL to data/pipeline.md
 *   2. Runs: claude -p "/career-ops pipeline"  (evaluates + generates report + PDF)
 *   3. Runs: node sync-to-supabase.mjs         (pushes results to dashboard)
 *
 * Stop with Ctrl+C.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { execSync, spawn } from 'child_process';

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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PIPELINE_FILE = path.join(__dirname, 'data', 'pipeline.md');
const POLL_INTERVAL_MS = 30_000; // check every 30 seconds

let isRunning = false; // prevent overlapping runs

// ─── Pipeline file helpers ────────────────────────────────────────────────────

function readPipeline() {
  if (!fs.existsSync(PIPELINE_FILE)) {
    fs.mkdirSync(path.dirname(PIPELINE_FILE), { recursive: true });
    fs.writeFileSync(PIPELINE_FILE, '# Job Pipeline\n\n## Pendientes\n\n## Procesadas\n');
  }
  return fs.readFileSync(PIPELINE_FILE, 'utf8');
}

function addToPipeline(jobs) {
  let content = readPipeline();
  let added = 0;

  for (const job of jobs) {
    if (!job.job_url) {
      log(`  ⚠  Skipping ${job.company} — ${job.role} (no URL stored, will evaluate from company/role)`);
      // Still add a placeholder so pipeline mode can try a web search
      const entry = `- [ ] ${job.company} | ${job.role}`;
      if (!content.includes(entry)) {
        content = content.replace('## Pendientes\n', `## Pendientes\n${entry}\n`);
        added++;
      }
      continue;
    }

    if (content.includes(job.job_url)) {
      log(`  ↻  Already in pipeline: ${job.company} — ${job.role}`);
      continue;
    }

    const entry = `- [ ] ${job.job_url} | ${job.company} | ${job.role}`;
    // Insert into Pendientes section
    if (content.includes('## Pendientes\n')) {
      content = content.replace('## Pendientes\n', `## Pendientes\n${entry}\n`);
    } else {
      content += `\n${entry}\n`;
    }
    added++;
    log(`  +  Queued: ${job.company} — ${job.role}`);
  }

  if (added > 0) {
    fs.writeFileSync(PIPELINE_FILE, content);
  }

  return added;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchQueued() {
  const { data, error } = await supabase
    .from('applications')
    .select('company, role, job_url')
    .eq('status', 'queued');
  if (error) throw error;
  return data ?? [];
}

async function markProcessing(jobs) {
  for (const j of jobs) {
    await supabase
      .from('applications')
      .update({ status: 'processing', synced_at: new Date().toISOString() })
      .eq('company', j.company)
      .eq('role', j.role)
      .eq('status', 'queued');
  }
}

// ─── Shell helpers ────────────────────────────────────────────────────────────

function runCommand(cmd, label) {
  log(`\n▶ ${label}`);
  log(`  $ ${cmd}`);
  try {
    execSync(cmd, {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env },
    });
    return true;
  } catch (err) {
    log(`  ✗ ${label} failed (exit ${err.status})`);
    return false;
  }
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`[${ts}] ${msg}`);
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function processQueued() {
  if (isRunning) return;
  isRunning = true;

  try {
    const queued = await fetchQueued();
    if (queued.length === 0) return;

    log(`\n🔔 ${queued.length} job(s) queued for evaluation`);

    const added = addToPipeline(queued);
    await markProcessing(queued);

    if (added === 0 && queued.every(j => !j.job_url)) {
      log('  ⚠  No URLs available — cannot evaluate without job URLs');
      log('  Tip: URLs are added when you run /career-ops scan');
      return;
    }

    // Step 1: Run career-ops pipeline (Claude evaluates each URL)
    const pipelineOk = runCommand(
      'claude -p "/career-ops pipeline" --allowedTools "WebFetch,WebSearch,Write,Edit,Bash,Read,Glob,Grep"',
      'career-ops pipeline (evaluating jobs…)'
    );

    if (!pipelineOk) {
      log('  Pipeline run failed. Check the output above for errors.');
      log('  You can retry manually: claude -p "/career-ops pipeline"');
    }

    // Step 2: Sync results back to Supabase regardless
    runCommand('node sync-to-supabase.mjs', 'sync-to-supabase (updating dashboard…)');

    log('\n✓ Done. Dashboard will reflect results on next refresh.\n');

  } catch (err) {
    log(`Error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

async function main() {
  console.log('');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│  career-ops queue watcher               │');
  console.log('│  Polling every 30s for queued jobs      │');
  console.log('│  Press Ctrl+C to stop                   │');
  console.log('└─────────────────────────────────────────┘');
  console.log('');
  log('Watcher started. Go click "Evaluate" buttons in the dashboard.');
  console.log('');

  // Initial check immediately
  await processQueued();

  // Then poll on interval
  setInterval(processQueued, POLL_INTERVAL_MS);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nWatcher stopped.');
  process.exit(0);
});

main();

#!/usr/bin/env node
/**
 * process-queue.mjs
 * Reads jobs queued for evaluation from Supabase and adds them to data/pipeline.md.
 * Run this after clicking "Evaluate" buttons in the dashboard.
 *
 * Usage:
 *   node process-queue.mjs
 *
 * What it does:
 *   1. Fetches all rows with status='queued' from Supabase
 *   2. Adds their job URLs to data/pipeline.md (if not already present)
 *   3. Marks them as status='processing' in Supabase
 *   4. Tells you to run: /career-ops pipeline
 *   5. After evaluation, run: node sync-to-supabase.mjs
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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PIPELINE_FILE = path.join(__dirname, 'data', 'pipeline.md');

function readPipeline() {
  if (!fs.existsSync(PIPELINE_FILE)) {
    fs.mkdirSync(path.dirname(PIPELINE_FILE), { recursive: true });
    fs.writeFileSync(PIPELINE_FILE, '# Job Pipeline\n\n');
  }
  return fs.readFileSync(PIPELINE_FILE, 'utf8');
}

function addToPipeline(jobs) {
  const content = readPipeline();
  const lines = content.split('\n');

  let added = 0;
  for (const job of jobs) {
    if (!job.job_url) {
      console.log(`  ⚠  Skipping ${job.company} — ${job.role} (no URL)`);
      continue;
    }

    // Dedup: skip if URL already in pipeline
    if (content.includes(job.job_url)) {
      console.log(`  ↻  Already in pipeline: ${job.company} — ${job.role}`);
      continue;
    }

    const entry = `- [ ] ${job.job_url} | ${job.company} | ${job.role}`;
    lines.push(entry);
    added++;
    console.log(`  +  ${job.company} — ${job.role}`);
  }

  if (added > 0) {
    fs.writeFileSync(PIPELINE_FILE, lines.join('\n'));
  }

  return added;
}

async function main() {
  console.log('process-queue: fetching queued jobs...\n');

  const { data: queued, error } = await supabase
    .from('applications')
    .select('company, role, job_url, status')
    .eq('status', 'queued');

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  if (!queued || queued.length === 0) {
    console.log('No queued jobs found. Click "Evaluate" buttons in the dashboard first.');
    process.exit(0);
  }

  console.log(`Found ${queued.length} queued job(s):\n`);

  const added = addToPipeline(queued);

  if (added > 0) {
    // Mark as processing in Supabase
    const keys = queued
      .filter(j => j.job_url)
      .map(j => ({ company: j.company, role: j.role }));

    for (const k of keys) {
      await supabase
        .from('applications')
        .update({ status: 'processing', synced_at: new Date().toISOString() })
        .eq('company', k.company)
        .eq('role', k.role)
        .eq('status', 'queued');
    }

    console.log(`\n${added} job(s) added to data/pipeline.md`);
    console.log('\n─────────────────────────────────────────');
    console.log('Next steps:');
    console.log('  1. Run:  /career-ops pipeline');
    console.log('     (This evaluates each URL and generates reports)');
    console.log('  2. Then: node sync-to-supabase.mjs');
    console.log('     (This pushes results back to the dashboard)');
    console.log('─────────────────────────────────────────\n');
  } else {
    console.log('\nNo new jobs added (all already in pipeline or missing URLs).');
    console.log('Run: /career-ops pipeline  to evaluate existing pipeline entries.');
  }
}

main();

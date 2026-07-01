// FILE: src/scripts/migrate-requirements.js
// One-time, resumable batch extraction of parsedRequirements over existing jobs.
// Resumable because the query only picks docs still missing the field (R5): a
// re-run after a crash continues where it left off. Parallel workers = 2 per live
// key, capped at 6 (R6). CLI: node src/scripts/migrate-requirements.js [--dry-run] [--limit N]
// console.log is intentional here — this is a progress-reporting CLI tool (C5).

import { connectToDb, closeDb, col } from '../Db/connection.js';
import { GEMMA_API_KEYS } from '../env.js';
import {
  initGemma, getGemmaClient, getKeyManager,
  extractRequirementsFromJD, extractAndStoreRequirements,
} from '../gemma/index.js';

function parseArgs(argv) {
  const args = { dryRun: false, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--limit') { args.limit = parseInt(argv[i + 1], 10) || null; i += 1; }
  }
  return args;
}

let stopRequested = false;

async function findPending(limit, dryRun) {
  const jobs = await col('jobs');
  const query = {
    parsedRequirements: { $exists: false },
    $or: [{ Status: 'active' }, { source: 'native' }],
  };
  const cursor = jobs.find(query).sort({ createdAt: 1 });
  const cap = dryRun ? 6 : limit;
  if (cap) cursor.limit(cap);
  return cursor.toArray();
}

function logProgress(done, total, startMs) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const avg = done ? (Date.now() - startMs) / done / 1000 : 0;
  const eta = Math.round((avg * (total - done)));
  console.log(`[migrate] ${done}/${total} (${pct}%) — ${avg.toFixed(1)}s/job — ETA ${eta}s`);
}

async function runWorker(queue, state, dryRun) {
  const client = getGemmaClient();
  while (!stopRequested) {
    const job = queue.pop();
    if (!job) return;
    try {
      if (dryRun) {
        const result = await extractRequirementsFromJD(
          { title: job.title || job.JobTitle, company: job.company || job.Company, description: job.description || job.Description },
          client,
        );
        console.log(`[dry-run] ${job._id}: ${JSON.stringify(result)}`);
      } else {
        await extractAndStoreRequirements(job, client);
      }
      state.success += 1;
    } catch (err) {
      state.fail += 1;
      console.log(`[migrate] FAILED ${job._id}: ${err.message}`);
    }
    state.done += 1;
    if (state.done % 10 === 0) logProgress(state.done, state.total, state.startMs);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!GEMMA_API_KEYS) {
    console.log('[migrate] No GEMMA_API_KEYS configured — nothing to do.');
    return;
  }

  await connectToDb();
  initGemma();
  const keyManager = getKeyManager();
  if (!keyManager || !keyManager.hasLiveKeys()) {
    console.log('[migrate] No live Gemma keys — aborting.');
    return;
  }

  const pending = await findPending(args.limit, args.dryRun);
  const total = pending.length;
  console.log(`[migrate] ${total} job(s) pending${args.dryRun ? ' (dry-run)' : ''}.`);
  if (total === 0) return;

  const workerCount = Math.min(keyManager.liveKeyCount() * 2, 6);
  const queue = pending.slice().reverse(); // pop() takes oldest first
  const state = { done: 0, success: 0, fail: 0, total, startMs: Date.now() };
  console.log(`[migrate] Spawning ${workerCount} worker(s) over ${keyManager.liveKeyCount()} key(s).`);

  await Promise.all(Array.from({ length: workerCount }, () => runWorker(queue, state, args.dryRun)));

  const skipped = total - state.done;
  const seconds = Math.round((Date.now() - state.startMs) / 1000);
  console.log(`[migrate] Done. success=${state.success} fail=${state.fail} skipped=${skipped} in ${seconds}s.`);
}

process.on('SIGINT', () => {
  console.log('\n[migrate] SIGINT received — finishing in-flight jobs, then exiting…');
  stopRequested = true;
});

main()
  .catch((err) => { console.log(`[migrate] Fatal: ${err.message}`); process.exitCode = 1; })
  .finally(async () => { await closeDb(); });

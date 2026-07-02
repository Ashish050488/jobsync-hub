// FILE: src/tasks/scraper-extraction-hook.js
// After a scrape pass finds genuinely new jobs (R5, $setOnInsert never overwrites
// existing docs), auto-extract structured JD requirements for each. Sequential —
// NOT parallel — to stay within Gemma rate limits (D6). One slow/failed job never
// breaks the loop or the scraper. Dependencies are injectable for tests.

import { extractAndStoreRequirements as defaultExtract } from '../gemma/background-extractor.js';
import { getGemmaClient as defaultGetGemmaClient } from '../gemma/gemma-runtime.js';

/** Extract requirements for each new job when Gemma is configured. No-op otherwise. */
export async function runExtractionForNewJobs(siteName, newJobs, deps = {}) {
  const {
    getGemmaClient = defaultGetGemmaClient,
    extractAndStoreRequirements = defaultExtract,
  } = deps;

  if (!Array.isArray(newJobs) || newJobs.length === 0) return;
  if (!getGemmaClient()) return;

  console.log(`[${siteName}] extracting requirements for ${newJobs.length} new jobs`);
  for (const job of newJobs) {
    try {
      await extractAndStoreRequirements(job);
    } catch (err) {
      console.warn(`[gemma] extraction failed for ${job.JobID}: ${err.message}`);
    }
  }
}

export default runExtractionForNewJobs;

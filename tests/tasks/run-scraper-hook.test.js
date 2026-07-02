// FILE: tests/tasks/run-scraper-hook.test.js
// Verifies the scraper's post-scrape extraction loop (D6/R5) via injected deps:
// extraction fires once per new job when Gemma is configured, is skipped entirely
// when Gemma is off, and one failing job never breaks the loop.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runExtractionForNewJobs } from '../../src/tasks/scraper-extraction-hook.js';

const NEW_JOBS = [{ JobID: 'j1' }, { JobID: 'j2' }, { JobID: 'j3' }];
const gemmaOn = () => ({});
const gemmaOff = () => null;

test('new jobs with Gemma configured → extraction called for each', async () => {
  const extracted = [];
  await runExtractionForNewJobs('acme', NEW_JOBS, {
    getGemmaClient: gemmaOn,
    extractAndStoreRequirements: async (job) => { extracted.push(job.JobID); },
  });
  assert.deepEqual(extracted, ['j1', 'j2', 'j3']);
});

test('new jobs without Gemma → no extraction calls', async () => {
  let callCount = 0;
  await runExtractionForNewJobs('acme', NEW_JOBS, {
    getGemmaClient: gemmaOff,
    extractAndStoreRequirements: async () => { callCount += 1; },
  });
  assert.equal(callCount, 0);
});

test('empty new-jobs list → no extraction calls', async () => {
  let callCount = 0;
  await runExtractionForNewJobs('acme', [], {
    getGemmaClient: gemmaOn,
    extractAndStoreRequirements: async () => { callCount += 1; },
  });
  assert.equal(callCount, 0);
});

test('one extraction failure is logged and does not break the loop', async () => {
  const extracted = [];
  await runExtractionForNewJobs('acme', NEW_JOBS, {
    getGemmaClient: gemmaOn,
    extractAndStoreRequirements: async (job) => {
      if (job.JobID === 'j2') throw new Error('boom');
      extracted.push(job.JobID);
    },
  });
  assert.deepEqual(extracted, ['j1', 'j3']); // j2 failed, loop continued
});

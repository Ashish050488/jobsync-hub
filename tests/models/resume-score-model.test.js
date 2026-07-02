import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureResumeScoreIndexes, upsertResumeScore, getResumeScoreForApplication,
  listResumeScoresForJob, tierFromScore, toPublicResumeScore,
} from '../../src/models/public/resume-score-model.js';

const COMPANY_A = new ObjectId();
const COMPANY_B = new ObjectId();
const JOB_ID = new ObjectId();
const APP_1 = new ObjectId();
const APP_2 = new ObjectId();

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('resume_scores');
  await ensureResumeScoreIndexes();
}

test('upsert creates a score; second upsert overwrites (idempotent per application)', async () => {
  await upsertResumeScore(APP_1, COMPANY_A, { score: 70, matchedSkills: ['React'] });
  await upsertResumeScore(APP_1, COMPANY_A, { score: 90, matchedSkills: ['React', 'AWS'] });
  const stored = await getResumeScoreForApplication(APP_1);
  assert.equal(stored.score, 90);
  assert.equal(stored.tier, 'strong');
  assert.deepEqual(stored.matchedSkills, ['React', 'AWS']);
  const all = await listResumeScoresForJob(COMPANY_A, JOB_ID, [APP_1]);
  assert.equal(all.length, 1); // overwrite, not a second document
});

test('getResumeScoreForApplication returns the stored score', async () => {
  await upsertResumeScore(APP_1, COMPANY_A, { score: 55 });
  const stored = await getResumeScoreForApplication(APP_1);
  assert.equal(stored.score, 55);
  assert.equal(stored.tier, 'partial');
});

test('listResumeScoresForJob returns only this job\'s applications, sorted by score desc', async () => {
  await upsertResumeScore(APP_1, COMPANY_A, { score: 40 });
  await upsertResumeScore(APP_2, COMPANY_A, { score: 88 });
  const list = await listResumeScoresForJob(COMPANY_A, JOB_ID, [APP_1, APP_2]);
  assert.equal(list.length, 2);
  assert.equal(list[0].score, 88); // highest first
  const scopedToOne = await listResumeScoresForJob(COMPANY_A, JOB_ID, [APP_1]);
  assert.equal(scopedToOne.length, 1);
});

test('cross-tenant listResumeScoresForJob returns []', async () => {
  await upsertResumeScore(APP_1, COMPANY_A, { score: 80 });
  const list = await listResumeScoresForJob(COMPANY_B, JOB_ID, [APP_1]);
  assert.deepEqual(list, []);
});

test('tier is computed from score ranges', () => {
  assert.equal(tierFromScore(95), 'strong');
  assert.equal(tierFromScore(70), 'good');
  assert.equal(tierFromScore(55), 'partial');
  assert.equal(tierFromScore(35), 'weak');
  assert.equal(tierFromScore(10), 'poor');
});

test('score clamps to 0-100 and explanation truncates to 500 chars', async () => {
  await upsertResumeScore(APP_1, COMPANY_A, { score: 250, explanation: 'x'.repeat(900) });
  const stored = await getResumeScoreForApplication(APP_1);
  assert.equal(stored.score, 100);
  assert.equal(stored.explanation.length, 500);
});

test('processingError stores null score and tier', async () => {
  await upsertResumeScore(APP_1, COMPANY_A, { processingError: 'GEMMA_UNAVAILABLE' });
  const stored = await getResumeScoreForApplication(APP_1);
  assert.equal(stored.score, null);
  assert.equal(stored.tier, null);
  assert.equal(stored.processingError, 'GEMMA_UNAVAILABLE');
  assert.equal(toPublicResumeScore(stored).processingError, 'GEMMA_UNAVAILABLE');
});

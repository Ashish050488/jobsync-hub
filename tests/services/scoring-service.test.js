import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { ensureResumeScoreIndexes, getResumeScoreForApplication } from '../../src/models/public/resume-score-model.js';
import { scoreApplication } from '../../src/services/public/scoring-service.js';

const COMPANY_ID = new ObjectId();
const JOB_ID = new ObjectId();
const APP_ID = new ObjectId();

const LONG_RESUME = 'React engineer with AWS experience. '.repeat(20);
const PARSED_REQUIREMENTS = { required_skills: ['React', 'AWS'], min_experience_years: 3 };
const GEMMA_JSON = JSON.stringify({
  score: 82, matched_skills: ['React', 'AWS'], missing_skills: ['GraphQL'],
  bonus_skills: ['Docker'], experience_fit: 'good', location_fit: 'exact',
  notice_period_fit: 'within_30', explanation: 'Strong React and AWS match.',
});

function baseDeps(overrides = {}) {
  return {
    getResumeFileForApplication: async () => ({ storagePath: 'data/resumes/x.pdf' }),
    getResumeBuffer: async () => Buffer.from('%PDF'),
    extractTextFromPDF: async () => ({ text: LONG_RESUME }),
    getGemmaClient: () => ({ generateContent: async () => GEMMA_JSON }),
    ...overrides,
  };
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('resume_scores', 'applications', 'jobs');
  await ensureResumeScoreIndexes();
  await (await col('applications')).insertOne({ _id: APP_ID, companyId: COMPANY_ID, jobId: JOB_ID });
  await (await col('jobs')).insertOne({ _id: JOB_ID, companyId: COMPANY_ID, parsedRequirements: PARSED_REQUIREMENTS });
}

test('happy path stores the full score', async () => {
  await scoreApplication(APP_ID, baseDeps());
  const stored = await getResumeScoreForApplication(APP_ID);
  assert.equal(stored.score, 82);
  assert.equal(stored.tier, 'good');
  assert.deepEqual(stored.matchedSkills, ['React', 'AWS']);
  assert.deepEqual(stored.missingSkills, ['GraphQL']);
  assert.equal(stored.experienceFit, 'good');
  assert.equal(stored.processingError, null);
  assert.equal(stored.resumeTextLength, LONG_RESUME.length);
});

test('no resume file → processingError stored, no throw', async () => {
  await scoreApplication(APP_ID, baseDeps({ getResumeFileForApplication: async () => null }));
  const stored = await getResumeScoreForApplication(APP_ID);
  assert.equal(stored.processingError, 'NO_RESUME_FILE');
  assert.equal(stored.score, null);
});

test('unreadable/short PDF → PDF_UNREADABLE', async () => {
  await scoreApplication(APP_ID, baseDeps({ extractTextFromPDF: async () => ({ text: 'too short' }) }));
  assert.equal((await getResumeScoreForApplication(APP_ID)).processingError, 'PDF_UNREADABLE');
});

test('extractTextFromPDF throwing → PDF_UNREADABLE', async () => {
  await scoreApplication(APP_ID, baseDeps({ extractTextFromPDF: async () => { throw new Error('scanned'); } }));
  assert.equal((await getResumeScoreForApplication(APP_ID)).processingError, 'PDF_UNREADABLE');
});

test('no parsedRequirements on posting → NO_JD_REQUIREMENTS', async () => {
  await (await col('jobs')).updateOne({ _id: JOB_ID }, { $unset: { parsedRequirements: '' } });
  await scoreApplication(APP_ID, baseDeps());
  assert.equal((await getResumeScoreForApplication(APP_ID)).processingError, 'NO_JD_REQUIREMENTS');
});

test('Gemma unavailable → GEMMA_UNAVAILABLE', async () => {
  await scoreApplication(APP_ID, baseDeps({ getGemmaClient: () => null }));
  assert.equal((await getResumeScoreForApplication(APP_ID)).processingError, 'GEMMA_UNAVAILABLE');
});

test('Gemma returns bad JSON → processingError stored', async () => {
  await scoreApplication(APP_ID, baseDeps({ getGemmaClient: () => ({ generateContent: async () => 'not json at all' }) }));
  const stored = await getResumeScoreForApplication(APP_ID);
  assert.ok(stored.processingError);
  assert.equal(stored.score, null);
});

test('score clamped to 0-100 and explanation truncated to 500', async () => {
  const raw = JSON.stringify({ score: 999, explanation: 'y'.repeat(900) });
  await scoreApplication(APP_ID, baseDeps({ getGemmaClient: () => ({ generateContent: async () => raw }) }));
  const stored = await getResumeScoreForApplication(APP_ID);
  assert.equal(stored.score, 100);
  assert.equal(stored.explanation.length, 500);
});

test('missing application → throws (programming error, not a scoring failure)', async () => {
  await assert.rejects(() => scoreApplication(new ObjectId(), baseDeps()));
});

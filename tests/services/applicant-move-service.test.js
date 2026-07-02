import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { moveApplicantToStage } from '../../src/services/employer/applicant-move-service.js';

const COMPANY_ID = new ObjectId();
const OTHER_COMPANY = new ObjectId();
const APPLIED_STAGE = new ObjectId();
const SHORTLIST_STAGE = new ObjectId();
const OTHER_STAGE = new ObjectId();
const APP_ID = new ObjectId();

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset(archived = null) {
  await dropCollections('applications', 'stages', 'stage_changes');
  await (await col('stages')).insertMany([
    { _id: APPLIED_STAGE, companyId: COMPANY_ID, text: 'Applied', order: 1 },
    { _id: SHORTLIST_STAGE, companyId: COMPANY_ID, text: 'Shortlisted', order: 2 },
    { _id: OTHER_STAGE, companyId: OTHER_COMPANY, text: 'Applied', order: 1 },
  ]);
  await (await col('applications')).insertOne({
    _id: APP_ID, companyId: COMPANY_ID, stageId: APPLIED_STAGE, contactId: new ObjectId(),
    jobId: new ObjectId(), archived, lastStageMovedAt: new Date('2026-06-01'),
  });
}

test('move creates a stage_change and updates the application', async () => {
  const result = await moveApplicantToStage(COMPANY_ID, APP_ID, { stageId: SHORTLIST_STAGE, note: 'Nice fit' });
  assert.equal(result.application.stageId, SHORTLIST_STAGE.toString());
  assert.equal(result.stageChange.toStageId, SHORTLIST_STAGE.toString());
  assert.equal(result.stageChange.fromStageId, APPLIED_STAGE.toString());
  const stored = await (await col('applications')).findOne({ _id: APP_ID });
  assert.equal(stored.stageId.toString(), SHORTLIST_STAGE.toString());
  assert.ok(stored.lastStageMovedAt > new Date('2026-06-01'));
  assert.equal(await (await col('stage_changes')).countDocuments({}), 1);
});

test('move to the current stage is a no-op (no stage_change written)', async () => {
  const result = await moveApplicantToStage(COMPANY_ID, APP_ID, { stageId: APPLIED_STAGE });
  assert.equal(result.stageChange, null);
  assert.equal(await (await col('stage_changes')).countDocuments({}), 0);
});

test('cross-company stageId → STAGE_NOT_FOUND', async () => {
  await assert.rejects(
    () => moveApplicantToStage(COMPANY_ID, APP_ID, { stageId: OTHER_STAGE }),
    (err) => { assert.equal(err.status, 400); assert.equal(err.code, 'STAGE_NOT_FOUND'); return true; },
  );
});

test('archived application → CANNOT_MOVE_ARCHIVED', async () => {
  await reset({ at: new Date(), reasonId: new ObjectId() });
  await assert.rejects(
    () => moveApplicantToStage(COMPANY_ID, APP_ID, { stageId: SHORTLIST_STAGE }),
    (err) => { assert.equal(err.status, 409); assert.equal(err.code, 'CANNOT_MOVE_ARCHIVED'); return true; },
  );
});

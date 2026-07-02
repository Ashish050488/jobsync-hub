import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { archiveApplicant, unarchiveApplicant } from '../../src/services/employer/applicant-archive-service.js';

const COMPANY_ID = new ObjectId();
const OTHER_COMPANY = new ObjectId();
const STAGE_ID = new ObjectId();
const REASON_ID = new ObjectId();
const OTHER_REASON = new ObjectId();
const APP_ID = new ObjectId();

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset(archived = null) {
  await dropCollections('applications', 'archive_reasons', 'stage_changes');
  await (await col('archive_reasons')).insertMany([
    { _id: REASON_ID, companyId: COMPANY_ID, text: 'Underqualified', type: 'non-hired' },
    { _id: OTHER_REASON, companyId: OTHER_COMPANY, text: 'Underqualified', type: 'non-hired' },
  ]);
  await (await col('applications')).insertOne({
    _id: APP_ID, companyId: COMPANY_ID, stageId: STAGE_ID, contactId: new ObjectId(), jobId: new ObjectId(), archived,
  });
}

test('archive sets application.archived and appends a stage_change', async () => {
  const result = await archiveApplicant(COMPANY_ID, APP_ID, { reasonId: REASON_ID, note: 'too junior' });
  assert.equal(result.application.archived.reasonId, REASON_ID.toString());
  assert.equal(result.application.archived.note, 'too junior');
  assert.ok(result.application.archived.at);
  const change = await (await col('stage_changes')).findOne({});
  assert.equal(change.note, 'Archived: Underqualified');
});

test('already archived → ALREADY_ARCHIVED', async () => {
  await reset({ at: new Date(), reasonId: REASON_ID });
  await assert.rejects(
    () => archiveApplicant(COMPANY_ID, APP_ID, { reasonId: REASON_ID }),
    (err) => { assert.equal(err.status, 409); assert.equal(err.code, 'ALREADY_ARCHIVED'); return true; },
  );
});

test('cross-company reasonId → REASON_NOT_FOUND', async () => {
  await assert.rejects(
    () => archiveApplicant(COMPANY_ID, APP_ID, { reasonId: OTHER_REASON }),
    (err) => { assert.equal(err.status, 400); assert.equal(err.code, 'REASON_NOT_FOUND'); return true; },
  );
});

test('unarchive clears the flag and appends a stage_change', async () => {
  await reset({ at: new Date(), reasonId: REASON_ID });
  const result = await unarchiveApplicant(COMPANY_ID, APP_ID);
  assert.equal(result.application.archived, null);
  const change = await (await col('stage_changes')).findOne({ note: 'Unarchived' });
  assert.ok(change);
});

test('unarchive when never archived → NOT_ARCHIVED', async () => {
  await assert.rejects(
    () => unarchiveApplicant(COMPANY_ID, APP_ID),
    (err) => { assert.equal(err.status, 409); assert.equal(err.code, 'NOT_ARCHIVED'); return true; },
  );
});

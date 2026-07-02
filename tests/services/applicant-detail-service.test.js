import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { getApplicantDetailForCompany } from '../../src/services/employer/applicant-detail-service.js';

const COMPANY_ID = new ObjectId();
const OTHER_COMPANY = new ObjectId();
const STAGE_ID = new ObjectId();
const CONTACT_ID = new ObjectId();
const APP_ID = new ObjectId();

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('applications', 'contacts', 'resume_scores', 'stage_changes', 'resume_files');
  await (await col('contacts')).insertOne({ _id: CONTACT_ID, companyId: COMPANY_ID, email: 'asha@x.com', fullName: 'Asha' });
  await (await col('applications')).insertOne({
    _id: APP_ID, companyId: COMPANY_ID, contactId: CONTACT_ID, stageId: STAGE_ID,
    jobId: new ObjectId(), archived: null, appliedAt: new Date('2026-06-01'), source: 'apply_page',
  });
  await (await col('stage_changes')).insertOne({ applicationId: APP_ID, fromStageId: null, toStageId: STAGE_ID, movedAt: new Date() });
}

test('happy path returns all sections', async () => {
  await (await col('resume_scores')).insertOne({ applicationId: APP_ID, companyId: COMPANY_ID, score: 80, tier: 'good' });
  await (await col('resume_files')).insertOne({ applicationId: APP_ID, storagePath: 'data/resumes/x.pdf', originalFilename: 'cv.pdf' });
  const detail = await getApplicantDetailForCompany(COMPANY_ID, APP_ID);
  assert.equal(detail.application.id, APP_ID.toString());
  assert.equal(detail.contact.email, 'asha@x.com');
  assert.equal(detail.score.score, 80);
  assert.equal(detail.stageChanges.length, 1);
  assert.equal(detail.resumeMeta.originalFilename, 'cv.pdf');
  assert.match(detail.resumeDownloadUrl, /^\/api\/public\/resume-download\?token=/);
});

test('no score → score: null', async () => {
  const detail = await getApplicantDetailForCompany(COMPANY_ID, APP_ID);
  assert.equal(detail.score, null);
});

test('no resume → resumeMeta null, url null', async () => {
  const detail = await getApplicantDetailForCompany(COMPANY_ID, APP_ID);
  assert.equal(detail.resumeMeta, null);
  assert.equal(detail.resumeDownloadUrl, null);
});

test('cross-tenant → 404 APPLICATION_NOT_FOUND', async () => {
  await assert.rejects(
    () => getApplicantDetailForCompany(OTHER_COMPANY, APP_ID),
    (err) => { assert.equal(err.status, 404); assert.equal(err.code, 'APPLICATION_NOT_FOUND'); return true; },
  );
});

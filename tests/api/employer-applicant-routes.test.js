// FILE: tests/api/employer-applicant-routes.test.js
// End-to-end auth + happy paths for /api/employer/applicants. Seeds a company via
// the real onboarding helpers (for a valid cookie), then inserts an application +
// stage + reason directly to exercise detail/move/archive/unarchive/resume-url.
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { EMPLOYER_JWT_SECRET } from '../../src/env.js';
import { errorHandler } from '../../src/middleware/error-handler-middleware.js';
import { requireEmployer } from '../../src/middleware/require-employer-middleware.js';
import { requireEmployerCompany } from '../../src/middleware/require-employer-company-middleware.js';
import employerApplicantRouter from '../../src/api/employer/employer-applicant-routes.js';
import {
  ensureCompanyIndexes, ensureEmployerUserIndexes,
  findOrCreateEmployerGoogleUser, createCompany, linkCompanyToEmployerUser,
} from '../../src/models/employer/index.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/employer/applicants', requireEmployer, requireEmployerCompany, employerApplicantRouter);
  app.use(errorHandler);
  return app;
}

async function onboardedCookie(tag) {
  const user = await findOrCreateEmployerGoogleUser({ googleId: `g-${tag}`, email: `o${tag}@acme.com`, name: 'Owner', picture: null });
  const company = await createCompany({ name: `Acme ${tag}` }, user._id);
  await linkCompanyToEmployerUser(user._id, company._id);
  const token = jwt.sign({ employerUserId: user._id.toString(), email: user.email }, EMPLOYER_JWT_SECRET);
  return { cookie: `jm_employer_token=${token}`, company };
}

async function seedApplicant(companyId, { stageId, archived = null }) {
  const contact = await (await col('contacts')).insertOne({ companyId, email: 'asha@x.com', fullName: 'Asha' });
  const application = await (await col('applications')).insertOne({
    companyId, contactId: contact.insertedId, jobId: new ObjectId(), stageId, archived, appliedAt: new Date(),
  });
  return application.insertedId;
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('companies', 'employer_users', 'applications', 'contacts', 'stages', 'archive_reasons', 'stage_changes', 'resume_scores', 'resume_files');
  await ensureCompanyIndexes(); await ensureEmployerUserIndexes();
}

test('GET detail requires auth (401 without cookie)', async () => {
  const res = await request(buildApp()).get(`/api/employer/applicants/${new ObjectId()}`);
  assert.equal(res.status, 401);
});

test('GET detail returns the applicant sections', async () => {
  const { cookie, company } = await onboardedCookie('a');
  const stageId = new ObjectId();
  const appId = await seedApplicant(company._id, { stageId });
  const res = await request(buildApp()).get(`/api/employer/applicants/${appId}`).set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.applicant.contact.email, 'asha@x.com');
  assert.equal(res.body.applicant.resumeMeta, null);
});

test('POST move → 200 and updates stage', async () => {
  const { cookie, company } = await onboardedCookie('b');
  const fromStage = new ObjectId();
  const toStage = (await (await col('stages')).insertOne({ companyId: company._id, text: 'Shortlisted', order: 2 })).insertedId;
  const appId = await seedApplicant(company._id, { stageId: fromStage });
  const res = await request(buildApp()).post(`/api/employer/applicants/${appId}/move`).set('Cookie', cookie).send({ stageId: toStage.toString(), note: 'good' });
  assert.equal(res.status, 200);
  assert.equal(res.body.application.stageId, toStage.toString());
});

test('POST archive then unarchive → 200 each', async () => {
  const { cookie, company } = await onboardedCookie('c');
  const reasonId = (await (await col('archive_reasons')).insertOne({ companyId: company._id, text: 'Underqualified', type: 'non-hired' })).insertedId;
  const appId = await seedApplicant(company._id, { stageId: new ObjectId() });
  const archived = await request(buildApp()).post(`/api/employer/applicants/${appId}/archive`).set('Cookie', cookie).send({ reasonId: reasonId.toString() });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.application.archived.reasonId, reasonId.toString());
  const unarchived = await request(buildApp()).post(`/api/employer/applicants/${appId}/unarchive`).set('Cookie', cookie);
  assert.equal(unarchived.status, 200);
  assert.equal(unarchived.body.application.archived, null);
});

test('GET resume-url returns a signed URL with a 15-min expiry', async () => {
  const { cookie, company } = await onboardedCookie('d');
  const appId = await seedApplicant(company._id, { stageId: new ObjectId() });
  const res = await request(buildApp()).get(`/api/employer/applicants/${appId}/resume-url`).set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.match(res.body.url, /\/api\/public\/resume-download\?token=/);
  const millisecondsAway = new Date(res.body.expiresAt).getTime() - Date.now();
  assert.ok(millisecondsAway > 14 * 60 * 1000 && millisecondsAway <= 15 * 60 * 1000);
});

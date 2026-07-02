import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { requireEmployerApplicant } from '../../src/middleware/require-employer-applicant-middleware.js';

const COMPANY_ID = new ObjectId();
const OTHER_COMPANY = new ObjectId();
const APP_ID = new ObjectId();

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('applications');
  await (await col('applications')).insertOne({ _id: APP_ID, companyId: COMPANY_ID, contactId: new ObjectId() });
}

/** Run the middleware and resolve with { req, error }. */
function run(employerCompanyId, applicationId) {
  return new Promise((resolve) => {
    const req = { params: { applicationId }, employerCompanyId };
    requireEmployerApplicant(req, {}, (error) => resolve({ req, error }));
  });
}

test('malformed id → 400 INVALID_APPLICATION_ID', async () => {
  const { error } = await run(COMPANY_ID, 'not-an-object-id');
  assert.equal(error.status, 400);
  assert.equal(error.code, 'INVALID_APPLICATION_ID');
});

test('cross-tenant id → 404 APPLICATION_NOT_FOUND', async () => {
  const { error } = await run(OTHER_COMPANY, APP_ID.toString());
  assert.equal(error.status, 404);
  assert.equal(error.code, 'APPLICATION_NOT_FOUND');
});

test('valid → next() with req.application attached', async () => {
  const { req, error } = await run(COMPANY_ID, APP_ID.toString());
  assert.equal(error, undefined);
  assert.equal(req.application._id.toString(), APP_ID.toString());
});

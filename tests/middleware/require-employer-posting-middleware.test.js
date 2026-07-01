// FILE: tests/middleware/require-employer-posting-middleware.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { ensurePostingIndexes, createPostingForCompany } from '../../src/models/employer/posting-model.js';
import { requireEmployerPosting } from '../../src/middleware/require-employer-posting-middleware.js';

function run(req) {
  return new Promise((resolve) => requireEmployerPosting(req, {}, (err) => resolve({ req, err })));
}

function input() {
  return {
    title: 'React Developer', description: 'x'.repeat(60), location: 'Bangalore',
    workplaceType: 'remote', employmentType: 'full-time',
  };
}

before(async () => { await dropCollections('jobs'); await ensurePostingIndexes(); });
beforeEach(async () => { await dropCollections('jobs'); await ensurePostingIndexes(); });
after(async () => { await closeTestDb(); });

test('malformed posting id → 400 INVALID_POSTING_ID', async () => {
  const { err } = await run({ params: { postingId: 'not-an-id' }, employerCompanyId: new ObjectId() });
  assert.equal(err.status, 400);
  assert.equal(err.code, 'INVALID_POSTING_ID');
});

test('cross-tenant posting id → 404 POSTING_NOT_FOUND', async () => {
  const companyId = new ObjectId();
  const posting = await createPostingForCompany(companyId, input(), new ObjectId());
  const { err } = await run({
    params: { postingId: posting._id.toString() }, employerCompanyId: new ObjectId(),
  });
  assert.equal(err.status, 404);
  assert.equal(err.code, 'POSTING_NOT_FOUND');
});

test('valid posting → next() and req.posting attached', async () => {
  const companyId = new ObjectId();
  const posting = await createPostingForCompany(companyId, input(), new ObjectId());
  const { req, err } = await run({
    params: { postingId: posting._id.toString() }, employerCompanyId: companyId,
  });
  assert.equal(err, undefined);
  assert.equal(req.posting.slug, 'react-developer');
});

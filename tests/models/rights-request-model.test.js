import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureRightsRequestIndexes, insertRightsRequest, listRightsRequestsForUser,
} from '../../src/models/dpdp/rights-request-model.js';

const USER = new ObjectId();
const OTHER = new ObjectId();
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('rights_requests');
  await ensureRightsRequestIndexes();
}

test('insert + list scoped to userId', async () => {
  const submittedAt = new Date();
  await insertRightsRequest({
    userId: USER, requestType: 'access', contactEmail: 'a@b.com', description: 'x',
    status: 'submitted', submittedAt, dueBy: new Date(submittedAt.getTime() + NINETY_DAYS_MS),
  });
  assert.equal((await listRightsRequestsForUser(USER)).length, 1);
  assert.deepEqual(await listRightsRequestsForUser(OTHER), []);
});

test('dueBy is submittedAt + 90 days', async () => {
  const submittedAt = new Date();
  const dueBy = new Date(submittedAt.getTime() + NINETY_DAYS_MS);
  await insertRightsRequest({
    userId: USER, requestType: 'erasure', contactEmail: 'a@b.com', description: '',
    status: 'submitted', submittedAt, dueBy,
  });
  const [row] = await listRightsRequestsForUser(USER);
  assert.ok(Math.abs(row.dueBy.getTime() - (row.submittedAt.getTime() + NINETY_DAYS_MS)) < 1000);
});

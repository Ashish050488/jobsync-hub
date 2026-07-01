// FILE: tests/models/archive-reason-model.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureArchiveReasonIndexes, seedDefaultArchiveReasonsForCompany,
  listArchiveReasonsForCompany, getArchiveReasonForCompany,
} from '../../src/models/employer/archive-reason-model.js';

before(async () => { await dropCollections('archive_reasons'); await ensureArchiveReasonIndexes(); });
beforeEach(async () => { await dropCollections('archive_reasons'); await ensureArchiveReasonIndexes(); });
after(async () => { await closeTestDb(); });

test('seedDefaultArchiveReasonsForCompany inserts 7 reasons', async () => {
  const companyId = new ObjectId();
  const seeded = await seedDefaultArchiveReasonsForCompany(companyId);
  assert.equal(seeded.length, 7);
  const hired = seeded.find((reason) => reason.text === 'Hired');
  assert.equal(hired.type, 'hired');
  assert.ok(seeded.every((reason) => reason.status === 'active'));
});

test('listArchiveReasonsForCompany scopes by companyId', async () => {
  const companyA = new ObjectId();
  const companyB = new ObjectId();
  await seedDefaultArchiveReasonsForCompany(companyA);
  assert.equal((await listArchiveReasonsForCompany(companyA)).length, 7);
  assert.equal((await listArchiveReasonsForCompany(companyB)).length, 0);
});

test('getArchiveReasonForCompany rejects a cross-tenant lookup', async () => {
  const companyA = new ObjectId();
  const companyB = new ObjectId();
  const [firstReason] = await seedDefaultArchiveReasonsForCompany(companyA);
  assert.ok(await getArchiveReasonForCompany(companyA, firstReason._id));
  assert.equal(await getArchiveReasonForCompany(companyB, firstReason._id), null);
});

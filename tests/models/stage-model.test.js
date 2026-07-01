// FILE: tests/models/stage-model.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureStageIndexes, seedDefaultStagesForCompany, listStagesForCompany, getStageForCompany,
} from '../../src/models/employer/stage-model.js';

before(async () => { await dropCollections('stages'); await ensureStageIndexes(); });
beforeEach(async () => { await dropCollections('stages'); await ensureStageIndexes(); });
after(async () => { await closeTestDb(); });

test('ensureStageIndexes is idempotent', async () => {
  await ensureStageIndexes();
  await ensureStageIndexes();
});

test('seedDefaultStagesForCompany inserts 5 stages in order', async () => {
  const companyId = new ObjectId();
  const seeded = await seedDefaultStagesForCompany(companyId);
  assert.equal(seeded.length, 5);
  assert.deepEqual(seeded.map((stage) => stage.text), ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired']);
  const applied = seeded.find((stage) => stage.text === 'Applied');
  assert.equal(applied.isDefault, true);
  const hired = seeded.find((stage) => stage.text === 'Hired');
  assert.equal(hired.isTerminal, true);
  assert.equal(hired.terminalType, 'hired');
});

test('listStagesForCompany returns stages sorted by order', async () => {
  const companyId = new ObjectId();
  await seedDefaultStagesForCompany(companyId);
  const stages = await listStagesForCompany(companyId);
  assert.deepEqual(stages.map((stage) => stage.order), [1, 2, 3, 4, 5]);
});

test('getStageForCompany rejects a cross-tenant lookup', async () => {
  const companyA = new ObjectId();
  const companyB = new ObjectId();
  const [firstStage] = await seedDefaultStagesForCompany(companyA);
  assert.ok(await getStageForCompany(companyA, firstStage._id));
  assert.equal(await getStageForCompany(companyB, firstStage._id), null);
});

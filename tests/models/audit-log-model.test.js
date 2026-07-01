import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import * as auditModel from '../../src/models/dpdp/audit-log-model.js';

const ACTOR = new ObjectId();

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('audit_log');
  await auditModel.ensureAuditLogIndexes();
}

test('append then listForActor returns it', async () => {
  await auditModel.appendAuditLog({ event: 'consent_granted', actorType: 'seeker', actorId: ACTOR });
  const rows = await auditModel.listAuditForActor(ACTOR);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event, 'consent_granted');
});

test('listByEvent filters by event type', async () => {
  await auditModel.appendAuditLog({ event: 'consent_granted', actorType: 'seeker', actorId: ACTOR });
  await auditModel.appendAuditLog({ event: 'consent_withdrawn', actorType: 'seeker', actorId: ACTOR });
  const granted = await auditModel.listAuditByEvent('consent_granted');
  assert.equal(granted.length, 1);
  assert.equal(granted[0].event, 'consent_granted');
});

test('appendAuditLog is the only exported writer — no update/delete exports (C7)', () => {
  const exported = Object.keys(auditModel);
  const writers = exported.filter((n) => /update|delete|remove|drop/i.test(n));
  assert.deepEqual(writers, []);
  assert.ok(exported.includes('appendAuditLog'));
});

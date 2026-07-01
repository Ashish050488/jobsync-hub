import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { ensureRightsRequestIndexes } from '../../src/models/dpdp/rights-request-model.js';
import { submitRightsRequest } from '../../src/services/dpdp/rights-request-service.js';
import { listAuditByEvent } from '../../src/models/dpdp/audit-log-model.js';

const USER = new ObjectId().toString();

function payload(overrides = {}) {
  return {
    userId: USER, contactEmail: 'a@b.com', requestType: 'access', description: 'please',
    ipAddress: '1.2.3.4', userAgent: 'jest', ...overrides,
  };
}

async function expectError(fn, code) {
  await assert.rejects(fn, (err) => { assert.equal(err.code, code); return true; });
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('rights_requests', 'audit_log');
  await ensureRightsRequestIndexes();
}

test('submitRightsRequest happy path sets dueBy and appends an audit entry', async () => {
  const request = await submitRightsRequest(payload());
  assert.equal(request.status, 'submitted');
  assert.ok(request.dueBy.getTime() > request.submittedAt.getTime());
  const audits = await listAuditByEvent('rights_request_submitted');
  assert.equal(audits.length, 1);
});

test('invalid requestType → INVALID_REQUEST_TYPE', async () => {
  await expectError(() => submitRightsRequest(payload({ requestType: 'nope' })), 'INVALID_REQUEST_TYPE');
});

test('description over 4000 chars → INVALID_RIGHTS_REQUEST', async () => {
  await expectError(() => submitRightsRequest(payload({ description: 'x'.repeat(4001) })), 'INVALID_RIGHTS_REQUEST');
});

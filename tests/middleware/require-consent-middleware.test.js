import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { ensureConsentIndexes } from '../../src/models/dpdp/consent-model.js';
import { recordConsent } from '../../src/services/dpdp/consent-service.js';
import { requireConsentForPurpose } from '../../src/middleware/require-consent-middleware.js';

const USER = new ObjectId().toString();

/** Minimal res double capturing status + json body. */
function mockRes() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function grant() {
  await recordConsent({
    userId: USER, contactEmail: 'a@b.com', purpose: 'resume_parsing', dataItems: ['resume'],
    noticeVersion: 'v1.0-2026-07', ipAddress: '1.2.3.4', userAgent: 'jest', method: 'checkbox',
  });
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('consents', 'audit_log');
  await ensureConsentIndexes();
}

test('user with active consent → next() with no error', async () => {
  await grant();
  const mw = requireConsentForPurpose('resume_parsing');
  let called = false;
  await mw({ user: { userId: USER } }, mockRes(), (err) => { called = !err; });
  assert.equal(called, true);
});

test('user without consent → 403 CONSENT_REQUIRED with purpose in body', async () => {
  const mw = requireConsentForPurpose('resume_parsing');
  const res = mockRes();
  await mw({ user: { userId: USER } }, res, () => {});
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'CONSENT_REQUIRED');
  assert.equal(res.body.purpose, 'resume_parsing');
});

test('no seeker session → 401 via next(error)', async () => {
  const mw = requireConsentForPurpose('resume_parsing');
  let status = null;
  await mw({}, mockRes(), (err) => { status = err?.status; });
  assert.equal(status, 401);
});

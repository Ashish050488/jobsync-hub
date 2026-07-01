import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { ensureConsentIndexes } from '../../src/models/dpdp/consent-model.js';
import {
  recordConsent, withdrawConsent, hasActiveConsentForPurpose,
} from '../../src/services/dpdp/consent-service.js';

const USER = new ObjectId().toString();
const OTHER = new ObjectId().toString();

function payload(overrides = {}) {
  return {
    userId: USER, contactEmail: 'a@b.com', purpose: 'profile_storage', dataItems: ['name'],
    noticeVersion: 'v1.0-2026-07', ipAddress: '1.2.3.4', userAgent: 'jest',
    method: 'checkbox', crossBorderTransfer: false, ...overrides,
  };
}

async function expectError(fn, code) {
  await assert.rejects(fn, (err) => { assert.equal(err.code, code); return true; });
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('consents', 'audit_log');
  await ensureConsentIndexes();
}

test('recordConsent happy path returns public shape without IP/UA', async () => {
  const consent = await recordConsent(payload());
  assert.equal(consent.purpose, 'profile_storage');
  assert.equal(consent.ipAddress, undefined);
  assert.equal(consent.userAgent, undefined);
});

test('missing noticeVersion → INVALID_CONSENT_PAYLOAD', async () => {
  await expectError(() => recordConsent(payload({ noticeVersion: undefined })), 'INVALID_CONSENT_PAYLOAD');
});

test('wrong noticeVersion → INVALID_NOTICE_VERSION', async () => {
  await expectError(() => recordConsent(payload({ noticeVersion: 'v9.9-old' })), 'INVALID_NOTICE_VERSION');
});

test('empty dataItems → INVALID_CONSENT_PAYLOAD', async () => {
  await expectError(() => recordConsent(payload({ dataItems: [] })), 'INVALID_CONSENT_PAYLOAD');
});

test('withdrawConsent happy path', async () => {
  const consent = await recordConsent(payload());
  const updated = await withdrawConsent({ consentId: consent.id, userId: USER, ipAddress: '1.1.1.1', userAgent: 'jest' });
  assert.ok(updated.withdrawnAt);
});

test('withdrawing another user\'s consent → CONSENT_NOT_FOUND', async () => {
  const consent = await recordConsent(payload());
  await expectError(
    () => withdrawConsent({ consentId: consent.id, userId: OTHER, ipAddress: '1.1.1.1', userAgent: 'jest' }),
    'CONSENT_NOT_FOUND',
  );
});

test('withdrawing an already-withdrawn consent → ALREADY_WITHDRAWN', async () => {
  const consent = await recordConsent(payload());
  await withdrawConsent({ consentId: consent.id, userId: USER, ipAddress: '1.1.1.1', userAgent: 'jest' });
  await expectError(
    () => withdrawConsent({ consentId: consent.id, userId: USER, ipAddress: '1.1.1.1', userAgent: 'jest' }),
    'ALREADY_WITHDRAWN',
  );
});

test('hasActiveConsentForPurpose reflects grant + withdrawal', async () => {
  assert.equal(await hasActiveConsentForPurpose(USER, 'profile_storage'), false);
  const consent = await recordConsent(payload());
  assert.equal(await hasActiveConsentForPurpose(USER, 'profile_storage'), true);
  await withdrawConsent({ consentId: consent.id, userId: USER, ipAddress: '1.1.1.1', userAgent: 'jest' });
  assert.equal(await hasActiveConsentForPurpose(USER, 'profile_storage'), false);
});

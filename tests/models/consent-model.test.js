import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureConsentIndexes, insertConsent, findActiveConsentForUser,
  listConsentsForUser, markConsentWithdrawn, toPublicConsent,
} from '../../src/models/dpdp/consent-model.js';

const USER = new ObjectId();
const OTHER = new ObjectId();

function baseDoc(userId = USER, overrides = {}) {
  return {
    userId, contactEmail: 'a@b.com', purpose: 'profile_storage', dataItems: ['name', 'email'],
    noticeVersion: 'v1.0-2026-07', ipAddress: '1.2.3.4', userAgent: 'jest',
    method: 'checkbox', crossBorderTransfer: false, ...overrides,
  };
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('consents');
  await ensureConsentIndexes();
}

test('ensureConsentIndexes is idempotent', async () => {
  await ensureConsentIndexes();
  await ensureConsentIndexes();
});

test('insertConsent → findActiveConsentForUser returns it', async () => {
  await insertConsent(baseDoc());
  const found = await findActiveConsentForUser(USER, 'profile_storage');
  assert.ok(found);
  assert.equal(found.purpose, 'profile_storage');
});

test('markConsentWithdrawn removes it from the active list', async () => {
  const c = await insertConsent(baseDoc());
  await markConsentWithdrawn(c._id, USER);
  assert.equal(await findActiveConsentForUser(USER, 'profile_storage'), null);
});

test('listConsentsForUser hides withdrawn by default; includeWithdrawn shows them', async () => {
  const c = await insertConsent(baseDoc());
  await markConsentWithdrawn(c._id, USER);
  assert.equal((await listConsentsForUser(USER)).length, 0);
  assert.equal((await listConsentsForUser(USER, { includeWithdrawn: true })).length, 1);
});

test('cross-user query returns []', async () => {
  await insertConsent(baseDoc(USER));
  assert.deepEqual(await listConsentsForUser(OTHER), []);
});

test('toPublicConsent strips ipAddress + userAgent', async () => {
  const c = await insertConsent(baseDoc());
  const pub = toPublicConsent(c);
  assert.equal(pub.ipAddress, undefined);
  assert.equal(pub.userAgent, undefined);
  assert.equal(typeof pub.id, 'string');
});

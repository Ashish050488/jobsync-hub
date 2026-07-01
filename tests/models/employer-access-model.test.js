// FILE: tests/models/employer-access-model.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureEmployerAccessIndexes,
  getEmployerAccessConfig,
  setEmployerSignupOpen,
  listEmployerAccessWhitelist,
  addEmployerAccessWhitelistEntry,
  removeEmployerAccessWhitelistEntry,
  isEmployerSignupAllowed,
} from '../../src/models/employer/employer-access-model.js';

before(async () => {
  await dropCollections('employer_access');
  await ensureEmployerAccessIndexes();
});

beforeEach(async () => {
  await dropCollections('employer_access');
});

after(async () => {
  await closeTestDb();
});

test('ensureEmployerAccessIndexes creates a partial collated unique index', async () => {
  await ensureEmployerAccessIndexes();
  const { col } = await import('../../src/Db/connection.js');
  const indexes = await (await col('employer_access')).indexes();
  const target = indexes.find((index) => index.name === 'employer_access_kind_email');
  assert.ok(target, 'index employer_access_kind_email should exist');
  assert.equal(target.unique, true);
  assert.deepEqual(target.partialFilterExpression, { kind: 'whitelist' });
  assert.equal(target.collation.strength, 2);
});

test('closed gate with empty whitelist denies', async () => {
  assert.equal(await isEmployerSignupAllowed('nobody@x.com'), false);
});

test('config doc absent is treated as closed (default-deny)', async () => {
  const config = await getEmployerAccessConfig();
  assert.equal(config.isEmployerSignupOpen, false);
  assert.equal(config.updatedAt, null);
});

test('closed gate allows an exact whitelisted email', async () => {
  await addEmployerAccessWhitelistEntry('founder@acme.com', 'early access', null);
  assert.equal(await isEmployerSignupAllowed('founder@acme.com'), true);
});

test('closed gate allows a whitelisted email regardless of case', async () => {
  await addEmployerAccessWhitelistEntry('Founder@Acme.com', null, null);
  assert.equal(await isEmployerSignupAllowed('FOUNDER@ACME.COM'), true);
  assert.equal(await isEmployerSignupAllowed('founder@acme.com'), true);
});

test('open gate allows any email', async () => {
  await setEmployerSignupOpen(true, null);
  assert.equal(await isEmployerSignupAllowed('anyone@anywhere.com'), true);
  const config = await getEmployerAccessConfig();
  assert.equal(config.isEmployerSignupOpen, true);
  assert.ok(config.updatedAt instanceof Date);
});

test('addEmployerAccessWhitelistEntry is idempotent across casing', async () => {
  const first = await addEmployerAccessWhitelistEntry('dup@x.com', 'one', null);
  const second = await addEmployerAccessWhitelistEntry('DUP@X.com', 'two', null);
  assert.equal(String(first._id), String(second._id));
  const all = await listEmployerAccessWhitelist();
  assert.equal(all.length, 1);
  assert.equal(all[0].note, 'one');
});

test('note longer than 200 chars is truncated, not rejected', async () => {
  const longNote = 'a'.repeat(500);
  const entry = await addEmployerAccessWhitelistEntry('long@x.com', longNote, null);
  assert.equal(entry.note.length, 200);
});

test('removeEmployerAccessWhitelistEntry is idempotent on a missing entry', async () => {
  const result = await removeEmployerAccessWhitelistEntry('ghost@x.com');
  assert.deepEqual(result, { deleted: true });
});

test('removeEmployerAccessWhitelistEntry actually removes (case-insensitive)', async () => {
  await addEmployerAccessWhitelistEntry('bye@x.com', null, null);
  await removeEmployerAccessWhitelistEntry('BYE@X.com');
  assert.equal(await isEmployerSignupAllowed('bye@x.com'), false);
});

test('empty / null / undefined email denies without throwing', async () => {
  assert.equal(await isEmployerSignupAllowed(''), false);
  assert.equal(await isEmployerSignupAllowed(null), false);
  assert.equal(await isEmployerSignupAllowed(undefined), false);
});

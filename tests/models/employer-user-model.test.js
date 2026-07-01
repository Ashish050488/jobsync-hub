// FILE: tests/models/employer-user-model.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureEmployerUserIndexes,
  getEmployerUserById,
  findOrCreateEmployerGoogleUser,
} from '../../src/models/employer/employer-user-model.js';

before(async () => {
  await dropCollections('employer_users');
  await ensureEmployerUserIndexes();
});

beforeEach(async () => {
  await dropCollections('employer_users');
  await ensureEmployerUserIndexes();
});

after(async () => {
  await closeTestDb();
});

test('creates a user with email lowercased and companyId null', async () => {
  const user = await findOrCreateEmployerGoogleUser({
    googleId: 'g-1', email: 'Founder@Acme.com', name: 'Founder', picture: null,
  });
  assert.equal(user.email, 'founder@acme.com');
  assert.equal(user.companyId, null);
  assert.ok(user.createdAt instanceof Date);
  assert.ok(user.lastLoginAt instanceof Date);
});

test('second call with same googleId returns existing and bumps lastLoginAt', async () => {
  const first = await findOrCreateEmployerGoogleUser({
    googleId: 'g-2', email: 'a@x.com', name: 'A', picture: null,
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await findOrCreateEmployerGoogleUser({
    googleId: 'g-2', email: 'a@x.com', name: 'A', picture: null,
  });
  assert.equal(String(first._id), String(second._id));
  assert.ok(second.lastLoginAt.getTime() >= first.lastLoginAt.getTime());
});

test('same email + new googleId links googleId onto the existing record', async () => {
  const first = await findOrCreateEmployerGoogleUser({
    googleId: 'g-old', email: 'link@x.com', name: 'Link', picture: null,
  });
  const linked = await findOrCreateEmployerGoogleUser({
    googleId: 'g-new', email: 'LINK@x.com', name: 'Link', picture: null,
  });
  assert.equal(String(first._id), String(linked._id));
  assert.equal(linked.googleId, 'g-new');
});

test('getEmployerUserById returns the doc; invalid id returns null', async () => {
  const created = await findOrCreateEmployerGoogleUser({
    googleId: 'g-3', email: 'byid@x.com', name: 'ById', picture: null,
  });
  const fetched = await getEmployerUserById(created._id.toString());
  assert.equal(fetched.email, 'byid@x.com');
  assert.equal(await getEmployerUserById('not-a-valid-id'), null);
  assert.equal(await getEmployerUserById(null), null);
});

test('duplicate email with different case is rejected at the index level', async () => {
  const { col } = await import('../../src/Db/connection.js');
  const collection = await col('employer_users');
  await collection.insertOne({
    googleId: 'g-a', email: 'same@x.com', name: 'A', picture: null,
    companyId: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: new Date(),
  });
  await assert.rejects(
    () => collection.insertOne({
      googleId: 'g-b', email: 'SAME@X.com', name: 'B', picture: null,
      companyId: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: new Date(),
    }),
    (err) => err.code === 11000,
  );
});

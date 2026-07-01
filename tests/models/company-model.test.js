// FILE: tests/models/company-model.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureCompanyIndexes, slugify, generateUniqueCompanySlug, createCompany,
  getCompanyById, getCompanyBySlug, updateCompanyForOwner,
} from '../../src/models/employer/company-model.js';

before(async () => { await dropCollections('companies'); await ensureCompanyIndexes(); });
beforeEach(async () => { await dropCollections('companies'); await ensureCompanyIndexes(); });
after(async () => { await closeTestDb(); });

test('slugify lowercases, hyphenates, strips diacritics, caps length, falls back', () => {
  assert.equal(slugify('Acme Agency'), 'acme-agency');
  assert.equal(slugify('Café Münchën!!!'), 'cafe-munchen');
  assert.equal(slugify('   ---   '), 'company');
  assert.ok(slugify('a'.repeat(80)).length <= 60);
});

test('generateUniqueCompanySlug walks base → base-2 → base-3', async () => {
  const owner = new ObjectId();
  assert.equal(await generateUniqueCompanySlug('Acme'), 'acme');
  await createCompany({ slug: 'acme', name: 'Acme' }, owner);
  assert.equal(await generateUniqueCompanySlug('Acme'), 'acme-2');
  await createCompany({ slug: 'acme-2', name: 'Acme' }, owner);
  assert.equal(await generateUniqueCompanySlug('Acme'), 'acme-3');
});

test('createCompany retries onto an incremented slug when the base is taken', async () => {
  const owner = new ObjectId();
  await createCompany({ slug: 'acme', name: 'Acme' }, owner);
  const second = await createCompany({ name: 'Acme' }, owner);
  assert.equal(second.slug, 'acme-2');
  assert.equal(second.plan, 'free');
  assert.equal(second.claimed, true);
  assert.equal(second.retentionDays, 365);
});

test('getCompanyById / getCompanyBySlug hit and miss', async () => {
  const owner = new ObjectId();
  const company = await createCompany({ name: 'Bolt' }, owner);
  assert.equal((await getCompanyById(company._id.toString())).slug, 'bolt');
  assert.equal((await getCompanyBySlug('bolt'))._id.toString(), company._id.toString());
  assert.equal(await getCompanyById(new ObjectId().toString()), null);
  assert.equal(await getCompanyBySlug('nope'), null);
  assert.equal(await getCompanyById('not-an-id'), null);
});

test('updateCompanyForOwner only updates when the owner matches', async () => {
  const owner = new ObjectId();
  const stranger = new ObjectId();
  const company = await createCompany({ name: 'Acme' }, owner);

  const rejected = await updateCompanyForOwner(company._id, stranger, { name: 'Hacked' });
  assert.equal(rejected, null);

  const updated = await updateCompanyForOwner(company._id, owner, { name: 'Acme Two' });
  assert.equal(updated.name, 'Acme Two');
});

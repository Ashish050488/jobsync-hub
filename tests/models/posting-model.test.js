// FILE: tests/models/posting-model.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensurePostingIndexes, generateUniquePostingSlugForCompany, createPostingForCompany,
  listPostingsForCompany, getPostingForCompany, updatePostingForCompany,
  closePostingForCompany, reopenPostingForCompany,
} from '../../src/models/employer/posting-model.js';

function input(overrides = {}) {
  return {
    title: 'React Developer', description: 'x'.repeat(60), location: 'Bangalore',
    workplaceType: 'remote', employmentType: 'full-time', ...overrides,
  };
}

before(async () => { await dropCollections('jobs'); await ensurePostingIndexes(); });
beforeEach(async () => { await dropCollections('jobs'); await ensurePostingIndexes(); });
after(async () => { await closeTestDb(); });

test('ensurePostingIndexes is idempotent', async () => {
  await ensurePostingIndexes();
  await ensurePostingIndexes();
});

test('createPostingForCompany sets source=native and postedAt only when active', async () => {
  const companyId = new ObjectId();
  const active = await createPostingForCompany(companyId, input(), new ObjectId());
  assert.equal(active.source, 'native');
  assert.equal(active.status, 'active');
  assert.ok(active.postedAt instanceof Date);
  assert.equal(active.salaryCurrency, 'INR');
  const draft = await createPostingForCompany(companyId, input({ status: 'draft' }), new ObjectId());
  assert.equal(draft.postedAt, null);
});

test('slug is unique within a company but reusable across companies', async () => {
  const companyA = new ObjectId();
  const companyB = new ObjectId();
  const first = await createPostingForCompany(companyA, input(), new ObjectId());
  const second = await createPostingForCompany(companyA, input(), new ObjectId());
  assert.equal(first.slug, 'react-developer');
  assert.equal(second.slug, 'react-developer-2');
  const otherCompany = await createPostingForCompany(companyB, input(), new ObjectId());
  assert.equal(otherCompany.slug, 'react-developer'); // same slug, different tenant
});

test('generateUniquePostingSlugForCompany walks base → base-2', async () => {
  const companyId = new ObjectId();
  assert.equal(await generateUniquePostingSlugForCompany(companyId, 'React Developer'), 'react-developer');
  await createPostingForCompany(companyId, input(), new ObjectId());
  assert.equal(await generateUniquePostingSlugForCompany(companyId, 'React Developer'), 'react-developer-2');
});

test('concurrent creates with the same title resolve to distinct slugs (E11000 retry)', async () => {
  const companyId = new ObjectId();
  const [a, b] = await Promise.all([
    createPostingForCompany(companyId, input(), new ObjectId()),
    createPostingForCompany(companyId, input(), new ObjectId()),
  ]);
  assert.notEqual(a.slug, b.slug);
  assert.deepEqual([a.slug, b.slug].sort(), ['react-developer', 'react-developer-2']);
});

test('getPostingForCompany returns null across tenants and for bad ids', async () => {
  const companyId = new ObjectId();
  const posting = await createPostingForCompany(companyId, input(), new ObjectId());
  assert.equal((await getPostingForCompany(companyId, posting._id)).slug, 'react-developer');
  assert.equal(await getPostingForCompany(new ObjectId(), posting._id), null);
  assert.equal(await getPostingForCompany(companyId, new ObjectId()), null);
  assert.equal(await getPostingForCompany(companyId, 'not-an-id'), null);
});

test('updatePostingForCompany stamps postedAt exactly once on the first activation', async () => {
  const companyId = new ObjectId();
  const draft = await createPostingForCompany(companyId, input({ status: 'draft' }), new ObjectId());
  const activated = await updatePostingForCompany(companyId, draft._id, { status: 'active' });
  assert.ok(activated.postedAt instanceof Date);
  const firstPostedAt = activated.postedAt.getTime();
  await updatePostingForCompany(companyId, draft._id, { status: 'closed' });
  const reactivated = await updatePostingForCompany(companyId, draft._id, { status: 'active' });
  assert.equal(reactivated.postedAt.getTime(), firstPostedAt);
});

test('close and reopen flip status; updates only the targeted tenant', async () => {
  const companyId = new ObjectId();
  const posting = await createPostingForCompany(companyId, input(), new ObjectId());
  assert.equal((await closePostingForCompany(companyId, posting._id)).status, 'closed');
  assert.equal((await reopenPostingForCompany(companyId, posting._id)).status, 'active');
  assert.equal(await closePostingForCompany(new ObjectId(), posting._id), null);
});

test('listPostingsForCompany filters by status and tenant, newest first', async () => {
  const companyId = new ObjectId();
  const other = new ObjectId();
  await createPostingForCompany(companyId, input({ title: 'Backend Engineer' }), new ObjectId());
  await createPostingForCompany(companyId, input({ title: 'Designer', status: 'draft' }), new ObjectId());
  await createPostingForCompany(other, input(), new ObjectId());
  const all = await listPostingsForCompany(companyId);
  assert.equal(all.length, 2);
  const drafts = await listPostingsForCompany(companyId, { status: 'draft' });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].title, 'Designer');
});

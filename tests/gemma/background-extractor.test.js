import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { extractAndStoreRequirements } from '../../src/gemma/background-extractor.js';

const RAW = JSON.stringify({ required_skills: ['Node.js'] });

/** Mock client capturing the user message; counts calls. */
function mockClient(capture) {
  return {
    calls: 0,
    generateContent(system, user) {
      this.calls += 1;
      if (capture) capture.user = user;
      return Promise.resolve(RAW);
    },
  };
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() { await dropCollections('jobs'); }

test('scraped job (PascalCase) → extracts with JobTitle/Company/Description', async () => {
  const jobs = await col('jobs');
  const doc = { _id: new ObjectId(), JobTitle: 'React Dev', Company: 'Acme', Description: 'Build UIs', Status: 'active' };
  await jobs.insertOne(doc);
  const capture = {};
  await extractAndStoreRequirements(doc, mockClient(capture));
  assert.ok(capture.user.includes('React Dev'));
  assert.ok(capture.user.includes('Acme'));
  const stored = await jobs.findOne({ _id: doc._id });
  assert.deepEqual(stored.parsedRequirements.required_skills, ['Node.js']);
});

test('native posting (camelCase) → extracts with title/description', async () => {
  const jobs = await col('jobs');
  const doc = { _id: new ObjectId(), source: 'native', title: 'Backend Engineer', description: 'Build APIs' };
  await jobs.insertOne(doc);
  const capture = {};
  await extractAndStoreRequirements(doc, mockClient(capture));
  assert.ok(capture.user.includes('Backend Engineer'));
  assert.ok(capture.user.includes('Build APIs'));
});

test('already has parsedRequirements → skips (no API call)', async () => {
  const client = mockClient();
  const doc = { _id: new ObjectId(), source: 'native', title: 't', description: 'd', parsedRequirements: { required_skills: [] } };
  await extractAndStoreRequirements(doc, client);
  assert.equal(client.calls, 0);
});

test('$set writes parsedRequirements without replacing the doc', async () => {
  const jobs = await col('jobs');
  const doc = { _id: new ObjectId(), source: 'native', title: 't', description: 'd', extraField: 'keep-me' };
  await jobs.insertOne(doc);
  await extractAndStoreRequirements(doc, mockClient());
  const stored = await jobs.findOne({ _id: doc._id });
  assert.equal(stored.extraField, 'keep-me'); // untouched by $set
  assert.ok(stored.parsedRequirements);
});

test('extraction failure rejects so the fire-and-forget caller can catch it', async () => {
  const failingClient = { generateContent: () => Promise.reject(new Error('boom')) };
  const doc = { _id: new ObjectId(), source: 'native', title: 't', description: 'd' };
  // Per D6 the caller owns the .catch — assert the promise rejects (does not silently pass).
  await assert.rejects(() => extractAndStoreRequirements(doc, failingClient));
  // And the fire-and-forget usage pattern itself never throws:
  await assert.doesNotReject(async () => { await extractAndStoreRequirements(doc, failingClient).catch(() => {}); });
});

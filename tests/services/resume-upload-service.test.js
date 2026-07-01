import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { initGemma } from '../../src/gemma/index.js';
import { processResumeUpload } from '../../src/services/seeker/resume-upload-service.js';

const USER = new ObjectId();
const originalFetch = globalThis.fetch;
let parseCalls = 0;

function makePdf(body) {
  const lines = body.match(/.{1,60}/g) || [body];
  const content = `BT /F1 12 Tf 40 750 Td ${lines.map((l) => `(${l}) Tj 0 -16 Td`).join(' ')} ET`;
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n'
    + `4 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj\n`
    + '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n'
    + 'xref\n0 6\n0000000000 65535 f \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n0\n%%EOF',
    'latin1',
  );
}
const LONG = 'Senior backend engineer with many years of experience across fintech and ecommerce '
  + 'building distributed systems in Node.js MongoDB and Kubernetes throughout India and beyond. '
  + 'Led platform teams, owned reliability, and mentored engineers across multiple product lines here.';

function stubGemma() {
  parseCalls = 0;
  globalThis.fetch = async () => {
    parseCalls += 1;
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"fullName":"Asha"}' }] } }] }), text: async () => '' };
  };
  initGemma('fake-key-1');
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); stubGemma(); });
after(async () => { globalThis.fetch = originalFetch; initGemma(''); await closeTestDb(); });
async function reset() {
  await dropCollections('users');
  const users = await col('users');
  await users.insertOne({ _id: USER, name: 'A', appliedJobs: [] });
}

test('new upload extracts, parses, stores and returns isUnchanged=false', async () => {
  const result = await processResumeUpload(USER.toString(), makePdf(LONG));
  assert.equal(result.isUnchanged, false);
  assert.equal(result.parsedProfile.fullName, 'Asha');
  assert.equal(parseCalls, 1);
});

test('same hash skips parse and returns isUnchanged=true', async () => {
  const pdf = makePdf(LONG);
  await processResumeUpload(USER.toString(), pdf);
  const second = await processResumeUpload(USER.toString(), pdf);
  assert.equal(second.isUnchanged, true);
  assert.equal(parseCalls, 1); // not called again for identical bytes
});

test('different hash re-parses and overwrites the profile', async () => {
  await processResumeUpload(USER.toString(), makePdf(LONG));
  const second = await processResumeUpload(USER.toString(), makePdf(`${LONG} Additional distinct content here to change the file hash entirely.`));
  assert.equal(second.isUnchanged, false);
  assert.equal(parseCalls, 2);
});

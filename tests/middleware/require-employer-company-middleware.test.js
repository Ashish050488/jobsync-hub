// FILE: tests/middleware/require-employer-company-middleware.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import {
  ensureEmployerUserIndexes, findOrCreateEmployerGoogleUser, linkCompanyToEmployerUser,
} from '../../src/models/employer/index.js';
import { requireEmployerCompany } from '../../src/middleware/require-employer-company-middleware.js';

function run(req) {
  return new Promise((resolve) => requireEmployerCompany(req, {}, (err) => resolve({ req, err })));
}

let counter = 0;
async function freshUser() {
  counter += 1;
  return findOrCreateEmployerGoogleUser({ googleId: `g-${counter}`, email: `o${counter}@x.com`, name: 'O', picture: null });
}

before(async () => { await dropCollections('employer_users'); await ensureEmployerUserIndexes(); });
beforeEach(async () => { await dropCollections('employer_users'); await ensureEmployerUserIndexes(); });
after(async () => { await closeTestDb(); });

test('no employerUser on the request → 401', async () => {
  const { err } = await run({});
  assert.equal(err.status, 401);
});

test('user with null companyId → 403 NO_COMPANY', async () => {
  const user = await freshUser();
  const { err } = await run({ employerUser: { employerUserId: user._id.toString() } });
  assert.equal(err.status, 403);
  assert.equal(err.code, 'NO_COMPANY');
});

test('user with companyId set → next() and req.employerCompanyId attached', async () => {
  const user = await freshUser();
  const companyId = new ObjectId();
  await linkCompanyToEmployerUser(user._id, companyId);
  const { req, err } = await run({ employerUser: { employerUserId: user._id.toString() } });
  assert.equal(err, undefined);
  assert.equal(req.employerCompanyId.toString(), companyId.toString());
});

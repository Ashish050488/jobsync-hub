// FILE: tests/middleware/require-employer-middleware.test.js
import './../_helpers/test-db.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireEmployer } from '../../src/middleware/require-employer-middleware.js';
import {
  EMPLOYER_JWT_SECRET,
  EMPLOYER_COOKIE_NAME,
  JWT_SECRET,
} from '../../src/env.js';

function runMiddleware(cookies) {
  return new Promise((resolve) => {
    const req = { cookies };
    requireEmployer(req, {}, (err) => resolve({ req, err }));
  });
}

test('no cookie → 401', async () => {
  const { err } = await runMiddleware({});
  assert.equal(err.status, 401);
});

test('cookie signed with the seeker secret → 401', async () => {
  const forged = jwt.sign({ employerUserId: 'abc', email: 'x@x.com' }, JWT_SECRET);
  const { err } = await runMiddleware({ [EMPLOYER_COOKIE_NAME]: forged });
  assert.equal(err.status, 401);
});

test('seeker cookie name (tj_token) is ignored → 401', async () => {
  const seekerToken = jwt.sign({ userId: 'abc', email: 'x@x.com' }, JWT_SECRET);
  const { err } = await runMiddleware({ tj_token: seekerToken });
  assert.equal(err.status, 401);
});

test('valid jm_employer_token → req.employerUser populated, next() with no error', async () => {
  const token = jwt.sign({ employerUserId: 'emp-1', email: 'owner@acme.com' }, EMPLOYER_JWT_SECRET);
  const { req, err } = await runMiddleware({ [EMPLOYER_COOKIE_NAME]: token });
  assert.equal(err, undefined);
  assert.deepEqual(req.employerUser, { employerUserId: 'emp-1', email: 'owner@acme.com' });
});

test('token lacking employerUserId → 401', async () => {
  const token = jwt.sign({ email: 'owner@acme.com' }, EMPLOYER_JWT_SECRET);
  const { err } = await runMiddleware({ [EMPLOYER_COOKIE_NAME]: token });
  assert.equal(err.status, 401);
});

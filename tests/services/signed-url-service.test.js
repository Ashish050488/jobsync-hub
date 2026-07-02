import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

import { signResumeToken, verifyResumeToken, RESUME_URL_TTL_MS } from '../../src/services/employer/signed-url-service.js';

const SECRET = 'test-resume-secret';
const APP_ID = new ObjectId().toString();

function expectInvalid(fn) {
  assert.throws(fn, (err) => { assert.equal(err.status, 401); assert.equal(err.code, 'INVALID_TOKEN'); return true; });
}

test('sign then verify round-trips the applicationId', () => {
  const token = signResumeToken(APP_ID, RESUME_URL_TTL_MS, SECRET);
  assert.equal(verifyResumeToken(token, SECRET).applicationId, APP_ID);
});

test('wrong secret → INVALID_TOKEN', () => {
  const token = signResumeToken(APP_ID, RESUME_URL_TTL_MS, SECRET);
  expectInvalid(() => verifyResumeToken(token, 'a-different-secret'));
});

test('tampered payload → INVALID_TOKEN', () => {
  const token = signResumeToken(APP_ID, RESUME_URL_TTL_MS, SECRET);
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const [, expiresAt, signature] = decoded.split('.');
  const forged = Buffer.from(`${new ObjectId().toString()}.${expiresAt}.${signature}`).toString('base64url');
  expectInvalid(() => verifyResumeToken(forged, SECRET));
});

test('expired token → INVALID_TOKEN', () => {
  const token = signResumeToken(APP_ID, -1000, SECRET); // already expired
  expectInvalid(() => verifyResumeToken(token, SECRET));
});

test('malformed token → INVALID_TOKEN', () => {
  expectInvalid(() => verifyResumeToken('not-a-real-token', SECRET));
  expectInvalid(() => verifyResumeToken('', SECRET));
  expectInvalid(() => verifyResumeToken(Buffer.from('only.two').toString('base64url'), SECRET));
});

test('signature comparison is length-checked before timingSafeEqual (no throw on length mismatch)', () => {
  // A shorter signature must be rejected as INVALID_TOKEN, not crash timingSafeEqual.
  const decoded = `${APP_ID}.${Date.now() + 10000}.short`;
  const token = Buffer.from(decoded).toString('base64url');
  expectInvalid(() => verifyResumeToken(token, SECRET));
});

test('genuine signature equals a fresh HMAC of the same payload', () => {
  const token = signResumeToken(APP_ID, RESUME_URL_TTL_MS, SECRET);
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const [id, expiresAt, signature] = decoded.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(`${id}.${expiresAt}`).digest('base64url');
  assert.equal(signature, expected);
});

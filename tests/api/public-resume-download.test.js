// FILE: tests/api/public-resume-download.test.js
// Exercises the unauthenticated signed-token PDF download: valid stream, expired
// and forged tokens, missing param, file-missing-on-disk, and a path-traversal
// storagePath. Writes a real temp PDF via the storage service for the stream test.
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import { errorHandler } from '../../src/middleware/error-handler-middleware.js';
import resumeDownloadRouter from '../../src/api/public/resume-download-route.js';
import { signResumeToken } from '../../src/services/employer/signed-url-service.js';
import { storeResumeFile, deleteResumeFile } from '../../src/services/public/resume-storage-service.js';

const PDF_BYTES = Buffer.from('%PDF-1.4\n stream body '.repeat(20));
const writtenPaths = [];

function buildApp() {
  const app = express();
  app.use('/api/public/resume-download', resumeDownloadRouter);
  app.use(errorHandler);
  return app;
}

async function seedResume(applicationId, storagePath, originalFilename = 'cv.pdf') {
  await (await col('resume_files')).insertOne({ applicationId, storagePath, originalFilename });
}

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => {
  for (const storagePath of writtenPaths) deleteResumeFile(storagePath);
  await closeTestDb();
});
async function reset() { await dropCollections('resume_files'); }

test('valid token streams the PDF with the right headers', async () => {
  const appId = new ObjectId();
  const { storagePath } = storeResumeFile(PDF_BYTES);
  writtenPaths.push(storagePath);
  await seedResume(appId, storagePath);
  const res = await request(buildApp(), signResumeToken(appId));
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'application/pdf');
  assert.equal(res.headers['content-length'], String(PDF_BYTES.length));
  assert.match(res.headers['content-disposition'], /inline; filename="cv.pdf"/);
  assert.equal(res.headers['cache-control'], 'private, no-store');
});

test('expired token → 401 INVALID_TOKEN', async () => {
  const res = await request(buildApp(), signResumeToken(new ObjectId(), -1000));
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'INVALID_TOKEN');
});

test('forged token → 401 INVALID_TOKEN', async () => {
  const res = await request(buildApp(), 'totally.forged.token');
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'INVALID_TOKEN');
});

test('missing token param → 400 MISSING_TOKEN', async () => {
  const res = await request(buildApp(), null);
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'MISSING_TOKEN');
});

test('metadata present but file missing on disk → 404 RESUME_FILE_MISSING', async () => {
  const appId = new ObjectId();
  await seedResume(appId, 'data/resumes/does-not-exist.pdf');
  const res = await request(buildApp(), signResumeToken(appId));
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'RESUME_FILE_MISSING');
});

test('storagePath escaping data/resumes/ → 403 FORBIDDEN_PATH', async () => {
  const appId = new ObjectId();
  await seedResume(appId, '../../../etc/passwd');
  const res = await request(buildApp(), signResumeToken(appId));
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'FORBIDDEN_PATH');
});

/** GET the download route with the given token (null = omit the param). */
async function request(app, token) {
  const supertest = (await import('supertest')).default;
  const path = token === null ? '/api/public/resume-download' : `/api/public/resume-download?token=${encodeURIComponent(token)}`;
  return supertest(app).get(path);
}

import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { JWT_SECRET } from '../../src/env.js';
import { errorHandler } from '../../src/middleware/error-handler-middleware.js';
import dpdpRouter from '../../src/api/dpdp/dpdp-routes.js';
import { ensureConsentIndexes } from '../../src/models/dpdp/consent-model.js';
import { ensureRightsRequestIndexes } from '../../src/models/dpdp/rights-request-model.js';
import { listAuditByEvent } from '../../src/models/dpdp/audit-log-model.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/dpdp', dpdpRouter);
  app.use(errorHandler);
  return app;
}

function cookieFor(userId, email = 'seeker@jobmesh.in') {
  const token = jwt.sign({ userId, email }, JWT_SECRET);
  return `tj_token=${token}`;
}

const CONSENT_BODY = {
  purpose: 'profile_storage', dataItems: ['name', 'email'],
  noticeVersion: 'v1.0-2026-07', method: 'checkbox', crossBorderTransfer: false,
};

before(async () => { await reset(); });
beforeEach(async () => { await reset(); });
after(async () => { await closeTestDb(); });
async function reset() {
  await dropCollections('consents', 'audit_log', 'rights_requests');
  await ensureConsentIndexes();
  await ensureRightsRequestIndexes();
}

test('GET /notice-version is public → 200 with version + grievance email', async () => {
  const res = await request(buildApp()).get('/api/dpdp/notice-version');
  assert.equal(res.status, 200);
  assert.equal(res.body.version, 'v1.0-2026-07');
  assert.ok(res.body.grievanceEmail);
});

test('POST /consents happy → 201; ipAddress/userAgent captured but not leaked', async () => {
  const userId = new ObjectId().toString();
  const res = await request(buildApp()).post('/api/dpdp/consents')
    .set('Cookie', cookieFor(userId)).set('User-Agent', 'supertest').send(CONSENT_BODY);
  assert.equal(res.status, 201);
  assert.equal(res.body.consent.purpose, 'profile_storage');
  assert.equal(res.body.consent.ipAddress, undefined);
});

test('POST /consents without a seeker session → 401', async () => {
  const res = await request(buildApp()).post('/api/dpdp/consents').send(CONSENT_BODY);
  assert.equal(res.status, 401);
});

test('POST /consents/:id/withdraw own consent → 200; someone else\'s → 404', async () => {
  const owner = new ObjectId().toString();
  const other = new ObjectId().toString();
  const app = buildApp();
  const created = await request(app).post('/api/dpdp/consents').set('Cookie', cookieFor(owner)).send(CONSENT_BODY);
  const id = created.body.consent.id;

  const stranger = await request(app).post(`/api/dpdp/consents/${id}/withdraw`).set('Cookie', cookieFor(other));
  assert.equal(stranger.status, 404);

  const mine = await request(app).post(`/api/dpdp/consents/${id}/withdraw`).set('Cookie', cookieFor(owner));
  assert.equal(mine.status, 200);
  assert.ok(mine.body.consent.withdrawnAt);
});

test('GET /consents returns only mine', async () => {
  const me = new ObjectId().toString();
  const them = new ObjectId().toString();
  const app = buildApp();
  await request(app).post('/api/dpdp/consents').set('Cookie', cookieFor(me)).send(CONSENT_BODY);
  await request(app).post('/api/dpdp/consents').set('Cookie', cookieFor(them)).send(CONSENT_BODY);
  const res = await request(app).get('/api/dpdp/consents').set('Cookie', cookieFor(me));
  assert.equal(res.status, 200);
  assert.equal(res.body.consents.length, 1);
});

test('POST /rights-requests logs an audit entry; GET returns only mine', async () => {
  const me = new ObjectId().toString();
  const them = new ObjectId().toString();
  const app = buildApp();
  const created = await request(app).post('/api/dpdp/rights-requests')
    .set('Cookie', cookieFor(me)).send({ requestType: 'access', description: 'export my data' });
  assert.equal(created.status, 201);
  assert.equal((await listAuditByEvent('rights_request_submitted')).length, 1);

  await request(app).post('/api/dpdp/rights-requests')
    .set('Cookie', cookieFor(them)).send({ requestType: 'erasure', description: 'delete me' });
  const mine = await request(app).get('/api/dpdp/rights-requests').set('Cookie', cookieFor(me));
  assert.equal(mine.body.requests.length, 1);
});

// FILE: tests/services/onboarding-service.test.js
import './../_helpers/test-db.js';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { dropCollections, closeTestDb } from '../_helpers/test-db.js';
import { col } from '../../src/Db/connection.js';
import {
  ensureCompanyIndexes, ensureEmployerUserIndexes,
  findOrCreateEmployerGoogleUser, getEmployerUserById,
  listStagesForCompany, listArchiveReasonsForCompany,
} from '../../src/models/employer/index.js';
import { onboardEmployerCompany } from '../../src/services/employer/onboarding-service.js';

let userCounter = 0;
async function freshUser() {
  userCounter += 1;
  return findOrCreateEmployerGoogleUser({
    googleId: `g-${userCounter}`, email: `owner${userCounter}@acme.com`, name: 'Owner', picture: null,
  });
}

before(async () => {
  await dropCollections('companies', 'stages', 'archive_reasons', 'employer_users');
  await ensureCompanyIndexes(); await ensureEmployerUserIndexes();
});
beforeEach(async () => {
  await dropCollections('companies', 'stages', 'archive_reasons', 'employer_users');
  await ensureCompanyIndexes(); await ensureEmployerUserIndexes();
});
after(async () => { await closeTestDb(); });

test('happy path creates company, seeds 5 stages + 7 reasons, links the user', async () => {
  const user = await freshUser();
  const { company } = await onboardEmployerCompany({
    employerUserId: user._id.toString(), name: 'Acme Agency', website: 'https://acme.com', retentionDays: 180,
  });
  assert.equal(company.slug, 'acme-agency');
  assert.equal(company.retentionDays, 180);
  assert.equal((await listStagesForCompany(company.id)).length, 5);
  assert.equal((await listArchiveReasonsForCompany(company.id)).length, 7);
  const reloaded = await getEmployerUserById(user._id.toString());
  assert.equal(reloaded.companyId.toString(), company.id);
});

test('validation failures throw 400 with stable codes', async () => {
  const user = await freshUser();
  const id = user._id.toString();
  await assert.rejects(() => onboardEmployerCompany({ employerUserId: id, name: 'A' }),
    (err) => err.status === 400 && err.code === 'INVALID_NAME');
  await assert.rejects(() => onboardEmployerCompany({ employerUserId: id, name: 'Acme', website: 'ftp://x.com' }),
    (err) => err.status === 400 && err.code === 'INVALID_WEBSITE');
  await assert.rejects(() => onboardEmployerCompany({ employerUserId: id, name: 'Acme', retentionDays: 10 }),
    (err) => err.status === 400 && err.code === 'INVALID_RETENTION_DAYS');
});

test('a second onboarding for the same user is 409 ALREADY_ONBOARDED', async () => {
  const user = await freshUser();
  await onboardEmployerCompany({ employerUserId: user._id.toString(), name: 'Acme' });
  await assert.rejects(() => onboardEmployerCompany({ employerUserId: user._id.toString(), name: 'Acme' }),
    (err) => err.status === 409 && err.code === 'ALREADY_ONBOARDED');
});

test('a failure after the company insert cleans up and leaves the user un-onboarded', async () => {
  const user = await freshUser();
  const throwingSeedStages = () => { throw new Error('boom'); };
  await assert.rejects(
    () => onboardEmployerCompany({ employerUserId: user._id.toString(), name: 'Acme' }, { seedStages: throwingSeedStages }),
    (err) => err.message === 'boom',
  );
  assert.equal(await (await col('companies')).countDocuments({}), 0);
  assert.equal(await (await col('stages')).countDocuments({}), 0);
  assert.equal(await (await col('archive_reasons')).countDocuments({}), 0);
  const reloaded = await getEmployerUserById(user._id.toString());
  assert.equal(reloaded.companyId, null);
});

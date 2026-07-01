import { test, before, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { initGemma } from '../../src/gemma/index.js';
import { parseResumeText } from '../../src/services/seeker/resume-parser-service.js';

const originalFetch = globalThis.fetch;

/** Stub global fetch to return a canned Gemma response, then (re)init the client. */
function withGemma(raw) {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: raw }] } }] }),
    text: async () => '',
  });
  initGemma('fake-key-1');
}

afterEach(() => { globalThis.fetch = originalFetch; });
after(() => { initGemma(''); });

test('valid text returns the normalized profile shape', async () => {
  withGemma(JSON.stringify({
    fullName: 'Asha Rao', email: 'asha@example.com', phone: '+91 90000 00000',
    currentLocation: { city: 'Bengaluru', state: 'Karnataka' },
    experience: [{ company: 'Acme', title: 'SDE II', isCurrent: true, responsibilities: ['Built APIs'], technologies: ['Node.js'] }],
    education: [{ institution: 'IIT Bombay', degree: 'B.Tech', field: 'CSE', cgpa: 8.7, collegeTier: 'Tier-1' }],
    skills: [{ name: 'Node.js', category: 'Language', proficiency: 'Expert' }],
    totalExperienceYears: 5, seniorityLevel: 'Senior', domain: 'Fintech',
    currentCTC: { amount: 24, currency: 'INR' }, noticePeriod: '30 days',
    languages: [{ language: 'Hindi', proficiency: 'Native' }],
  }));
  const profile = await parseResumeText('a'.repeat(300));
  assert.equal(profile.fullName, 'Asha Rao');
  assert.equal(profile.education[0].collegeTier, 'Tier-1');
  assert.deepEqual(profile.currentCTC, { amount: 24, currency: 'INR' });
  assert.equal(profile.seniorityLevel, 'Senior');
  assert.ok(typeof profile.parsedAt === 'string');
});

test('extra fields from Gemma are ignored; bad enums default to null', async () => {
  withGemma(JSON.stringify({ fullName: 'X', seniorityLevel: 'Wizard', hallucinated: 'nope', skills: [{ name: '' }] }));
  const profile = await parseResumeText('b'.repeat(300));
  assert.equal(profile.hallucinated, undefined);
  assert.equal(profile.seniorityLevel, null);
  assert.deepEqual(profile.skills, []); // empty-name skill dropped
});

test('Gemma not initialized throws GEMMA_UNAVAILABLE', async () => {
  initGemma(''); // no keys → null client
  await assert.rejects(
    () => parseResumeText('c'.repeat(300)),
    (err) => { assert.equal(err.code, 'GEMMA_UNAVAILABLE'); assert.equal(err.status, 503); return true; },
  );
});

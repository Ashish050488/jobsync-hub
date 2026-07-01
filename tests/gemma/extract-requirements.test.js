import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRequirementsFromJD } from '../../src/gemma/extract-requirements.js';

/** A mock Gemma client whose generateContent returns a preset raw string. */
function mockClient(raw, capture) {
  return {
    generateContent: async (system, user) => {
      if (capture) { capture.system = system; capture.user = user; }
      return raw;
    },
  };
}

test('valid JD returns the normalized parsedRequirements shape', async () => {
  const raw = JSON.stringify({
    required_skills: ['Node.js', 'MongoDB'], preferred_skills: ['GraphQL'],
    min_experience_years: 3, max_experience_years: 5, required_education: 'B.Tech in CS',
    experience_level: 'Senior', employment_type: 'Full-time',
    key_responsibilities: ['Build APIs', 'Mentor juniors'],
    salary_range_inferred: { min: 15, max: 25 },
    notice_period_preference: 'Immediate', college_tier_preference: 'IIT/NIT only',
  });
  const out = await extractRequirementsFromJD({ title: 'Senior Engineer', company: 'Acme', description: 'x' }, mockClient(raw));
  assert.deepEqual(out.required_skills, ['Node.js', 'MongoDB']);
  assert.equal(out.experience_level, 'Senior');
  assert.deepEqual(out.salary_range_inferred, { min: 15, max: 25, currency: 'INR', unit: 'LPA' });
  assert.ok(typeof out.extractedAt === 'string');
});

test('extra/unknown fields from Gemma are ignored', async () => {
  const raw = JSON.stringify({ required_skills: ['Go'], hallucinated_field: 'nope' });
  const out = await extractRequirementsFromJD({ title: 't', company: 'c', description: 'd' }, mockClient(raw));
  assert.equal(out.hallucinated_field, undefined);
  assert.deepEqual(out.required_skills, ['Go']);
});

test('broken JSON falls back to regex extraction of the first {...} block', async () => {
  const raw = 'Here is the result:\n```json\n{"required_skills":["Java"]}\n```\nHope that helps!';
  const out = await extractRequirementsFromJD({ title: 't', company: 'c', description: 'd' }, mockClient(raw));
  assert.deepEqual(out.required_skills, ['Java']);
});

test('empty/null fields get defaults applied', async () => {
  const raw = JSON.stringify({ experience_level: 'NotAValidLevel', min_experience_years: 'three' });
  const out = await extractRequirementsFromJD({ title: 't', company: 'c', description: 'd' }, mockClient(raw));
  assert.deepEqual(out.required_skills, []);
  assert.equal(out.experience_level, null); // invalid enum → null
  assert.equal(out.min_experience_years, null); // non-number → null
  assert.equal(out.salary_range_inferred, null);
});

test('HTML in the description is stripped before sending to Gemma', async () => {
  const capture = {};
  const raw = JSON.stringify({ required_skills: [] });
  await extractRequirementsFromJD(
    { title: 'Dev', company: 'Acme', description: '<p>Build <b>APIs</b></p><script>x</script>' },
    mockClient(raw, capture),
  );
  assert.ok(!capture.user.includes('<p>'));
  assert.ok(!capture.user.includes('<script>'));
  assert.ok(capture.user.includes('Build APIs'));
});

test('key_responsibilities are capped at 7 items and 80 chars each', async () => {
  const raw = JSON.stringify({
    key_responsibilities: Array.from({ length: 10 }, (_, i) => `${'r'.repeat(100)}${i}`),
  });
  const out = await extractRequirementsFromJD({ title: 't', company: 'c', description: 'd' }, mockClient(raw));
  assert.equal(out.key_responsibilities.length, 7);
  assert.ok(out.key_responsibilities.every((r) => r.length <= 80));
});

test('throws when no client is provided', async () => {
  await assert.rejects(() => extractRequirementsFromJD({ title: 't', company: 'c', description: 'd' }, null));
});

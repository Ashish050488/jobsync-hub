// FILE: tests/services/posting-validators.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePostingTitle, validatePostingDescription, validatePostingLocation,
  validateWorkplaceType, validateEmploymentType, validateSalary, validatePostingStatus,
} from '../../src/services/employer/posting-validators.js';

/** Assert that fn() throws an HttpError with the given status + code. */
function rejects(fn, code) {
  assert.throws(fn, (err) => err.status === 400 && err.code === code);
}

test('validatePostingTitle: range + script rejection, trims on success', () => {
  assert.equal(validatePostingTitle('  React Developer  '), 'React Developer');
  rejects(() => validatePostingTitle('a'), 'INVALID_TITLE');
  rejects(() => validatePostingTitle('a'.repeat(201)), 'INVALID_TITLE');
  rejects(() => validatePostingTitle('Dev <script>x</script>'), 'INVALID_TITLE');
  rejects(() => validatePostingTitle(42), 'INVALID_TITLE');
});

test('validatePostingDescription: strips control chars, enforces length, rejects script', () => {
  const cleaned = validatePostingDescription(`Great\x07 role.\tTab\nNewline kept. ${'x'.repeat(60)}`);
  assert.equal(cleaned.includes('\x07'), false); // control char stripped
  assert.equal(cleaned.includes('\n'), true);    // newline preserved
  assert.equal(cleaned.includes('\t'), true);    // tab preserved
  assert.ok(cleaned.length >= 50);
  rejects(() => validatePostingDescription('too short'), 'INVALID_DESCRIPTION');
  rejects(() => validatePostingDescription(`${'x'.repeat(60)}<SCRIPT>`), 'INVALID_DESCRIPTION');
  rejects(() => validatePostingDescription(null), 'INVALID_DESCRIPTION');
});

test('validatePostingLocation: range', () => {
  assert.equal(validatePostingLocation(' Bangalore '), 'Bangalore');
  rejects(() => validatePostingLocation(''), 'INVALID_LOCATION');
  rejects(() => validatePostingLocation('a'.repeat(201)), 'INVALID_LOCATION');
});

test('enum validators reject unknown values with the right code', () => {
  assert.equal(validateWorkplaceType('remote'), 'remote');
  rejects(() => validateWorkplaceType('moon'), 'INVALID_WORKPLACE_TYPE');
  assert.equal(validateEmploymentType('contract'), 'contract');
  rejects(() => validateEmploymentType('seasonal'), 'INVALID_EMPLOYMENT_TYPE');
  assert.equal(validatePostingStatus('active'), 'active');
  rejects(() => validatePostingStatus('paused'), 'INVALID_STATUS');
});

test('validateSalary: optional, integer range, min <= max', () => {
  assert.deepEqual(validateSalary(undefined, undefined), { salaryMin: null, salaryMax: null });
  assert.deepEqual(validateSalary(100000, 200000), { salaryMin: 100000, salaryMax: 200000 });
  rejects(() => validateSalary(200000, 100000), 'INVALID_SALARY');
  rejects(() => validateSalary(-1, undefined), 'INVALID_SALARY');
  rejects(() => validateSalary(1.5, undefined), 'INVALID_SALARY');
  rejects(() => validateSalary(2_000_000_000, undefined), 'INVALID_SALARY');
});

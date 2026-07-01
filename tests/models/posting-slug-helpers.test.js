// FILE: tests/models/posting-slug-helpers.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugifyPostingTitle, buildPostingSlugCandidate, randomPostingSlugSuffix,
} from '../../src/models/employer/posting-slug-helpers.js';

test('slugifyPostingTitle lowercases, hyphenates, strips diacritics, caps, falls back', () => {
  assert.equal(slugifyPostingTitle('React Developer'), 'react-developer');
  assert.equal(slugifyPostingTitle('Señior Engineer (Bengalūru)!!!'), 'senior-engineer-bengaluru');
  assert.equal(slugifyPostingTitle('   ---   '), 'posting');
  assert.equal(slugifyPostingTitle(''), 'posting');
  assert.ok(slugifyPostingTitle('a'.repeat(80)).length <= 60);
  assert.equal(slugifyPostingTitle('a'.repeat(80)).endsWith('-'), false);
});

test('buildPostingSlugCandidate appends a suffix within the 60-char cap', () => {
  assert.equal(buildPostingSlugCandidate('react-developer', '2'), 'react-developer-2');
  const long = buildPostingSlugCandidate('a'.repeat(80), '2');
  assert.ok(long.length <= 60);
  assert.equal(long.endsWith('-2'), true);
});

test('randomPostingSlugSuffix returns a 6-char token', () => {
  assert.equal(randomPostingSlugSuffix().length, 6);
});

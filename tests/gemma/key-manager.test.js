import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyManager } from '../../src/gemma/key-manager.js';

test('round-robin rotates through keys', () => {
  const km = new KeyManager('a,b,c');
  assert.equal(km.getNextKey(), 'a');
  assert.equal(km.getNextKey(), 'b');
  assert.equal(km.getNextKey(), 'c');
  assert.equal(km.getNextKey(), 'a');
});

test('blacklistKey skips the dead key on the next call', () => {
  const km = new KeyManager('a,b');
  km.blacklistKey('a');
  assert.equal(km.getNextKey(), 'b');
  assert.equal(km.getNextKey(), 'b');
});

test('all keys dead → hasLiveKeys() false and getNextKey null', () => {
  const km = new KeyManager('a,b');
  km.blacklistKey('a');
  km.blacklistKey('b');
  assert.equal(km.hasLiveKeys(), false);
  assert.equal(km.getNextKey(), null);
});

test('single key → getNextKey always returns it', () => {
  const km = new KeyManager('solo');
  assert.equal(km.getNextKey(), 'solo');
  assert.equal(km.getNextKey(), 'solo');
});

test('blacklist + rotate uses the surviving key', () => {
  const km = new KeyManager('a,b,c');
  km.blacklistKey('b');
  assert.equal(km.liveKeyCount(), 2);
  assert.equal(km.totalKeyCount(), 3);
  const seen = new Set([km.getNextKey(), km.getNextKey(), km.getNextKey()]);
  assert.ok(!seen.has('b'));
});

test('empty keys string → no live keys', () => {
  const km = new KeyManager('');
  assert.equal(km.totalKeyCount(), 0);
  assert.equal(km.hasLiveKeys(), false);
});

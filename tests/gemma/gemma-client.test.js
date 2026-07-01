import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GemmaClient, GemmaApiError } from '../../src/gemma/gemma-client.js';
import { KeyManager } from '../../src/gemma/key-manager.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}
function textResponse(status, text) {
  return { ok: false, status, json: async () => ({}), text: async () => text };
}

function candidates(parts) {
  return { candidates: [{ content: { parts } }] };
}

function clientWith(keys, fetchFn) {
  return new GemmaClient({ keyManager: new KeyManager(keys), model: 'm', baseUrl: 'http://x', fetchFn });
}

test('success path parses candidates and filters thought parts', async () => {
  const fetchFn = async () => jsonResponse(200, candidates([
    { thought: true, text: 'chain of thought' },
    { text: '{"required_skills":["node"]}' },
  ]));
  const out = await clientWith('a', fetchFn).generateContent('sys', 'user');
  assert.equal(out, '{"required_skills":["node"]}');
});

test('429 retries with backoff and rotates the key', async () => {
  const usedKeys = [];
  let call = 0;
  const fetchFn = async (url) => {
    usedKeys.push(new URL(url).searchParams.get('key'));
    call += 1;
    return call === 1 ? textResponse(429, 'rate limited') : jsonResponse(200, candidates([{ text: 'ok' }]));
  };
  const out = await clientWith('a,b', fetchFn).generateContent('s', 'u');
  assert.equal(out, 'ok');
  assert.deepEqual(usedKeys, ['a', 'b']);
});

test('400 "API key not valid" blacklists the key and retries with the next', async () => {
  const km = new KeyManager('a,b');
  let call = 0;
  const fetchFn = async () => {
    call += 1;
    return call === 1 ? textResponse(400, 'API key not valid. Please pass a valid API key.') : jsonResponse(200, candidates([{ text: 'ok' }]));
  };
  const client = new GemmaClient({ keyManager: km, model: 'm', baseUrl: 'http://x', fetchFn });
  const out = await client.generateContent('s', 'u');
  assert.equal(out, 'ok');
  assert.equal(km.liveKeyCount(), 1);
});

test('400 other throws GemmaApiError immediately', async () => {
  const fetchFn = async () => textResponse(400, 'bad prompt');
  await assert.rejects(
    () => clientWith('a', fetchFn).generateContent('s', 'u'),
    (err) => { assert.ok(err instanceof GemmaApiError); assert.equal(err.status, 400); return true; },
  );
});

test('500 retries once then succeeds', async () => {
  let call = 0;
  const fetchFn = async () => {
    call += 1;
    return call === 1 ? textResponse(500, 'server error') : jsonResponse(200, candidates([{ text: 'ok' }]));
  };
  const out = await clientWith('a', fetchFn).generateContent('s', 'u');
  assert.equal(out, 'ok');
  assert.equal(call, 2);
});

test('exhausted retries throw', async () => {
  const fetchFn = async () => textResponse(429, 'rate limited');
  await assert.rejects(
    () => clientWith('a,b', fetchFn).generateContent('s', 'u', { maxRetries: 1 }),
    (err) => { assert.ok(err instanceof GemmaApiError); return true; },
  );
});

test('no live keys throws', async () => {
  const km = new KeyManager('a');
  km.blacklistKey('a');
  const client = new GemmaClient({ keyManager: km, model: 'm', baseUrl: 'http://x', fetchFn: async () => jsonResponse(200, {}) });
  await assert.rejects(() => client.generateContent('s', 'u'));
});

// FILE: src/gemma/gemma-runtime.js
// Process-wide singletons for the Gemma stack. initGemma() is called once on boot
// (server.js). When no keys are configured the client stays null and extraction
// is silently disabled — getGemmaClient() returns null and callers skip.

import { GEMMA_API_KEYS, GEMMA_MODEL, GEMMA_BASE_URL } from '../env.js';
import { KeyManager } from './key-manager.js';
import { GemmaClient } from './gemma-client.js';

let keyManager = null;
let client = null;

/** Build the singleton client from env. Returns the live key count. */
export function initGemma(keysString = GEMMA_API_KEYS) {
  keyManager = new KeyManager(keysString);
  client = keyManager.hasLiveKeys()
    ? new GemmaClient({ keyManager, model: GEMMA_MODEL, baseUrl: GEMMA_BASE_URL })
    : null;
  return keyManager.liveKeyCount();
}

export function getGemmaClient() {
  return client;
}

export function getKeyManager() {
  return keyManager;
}

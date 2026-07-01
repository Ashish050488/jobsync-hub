// FILE: src/gemma/key-manager.js
// Round-robin manager over a comma-separated set of Gemma API keys. Keys should
// come from DIFFERENT GCP projects for real parallelism (separate quota buckets,
// R2). Blacklisting is permanent for the process lifetime — a key that returns
// "API key not valid" is never handed out again. Pure in-memory; no DB.

export class KeyManager {
  constructor(keysString = '') {
    this.keys = String(keysString)
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    this.dead = new Set();
    this.cursor = 0;
  }

  totalKeyCount() {
    return this.keys.length;
  }

  liveKeyCount() {
    return this.keys.filter((k) => !this.dead.has(k)).length;
  }

  hasLiveKeys() {
    return this.liveKeyCount() > 0;
  }

  blacklistKey(key) {
    if (this.keys.includes(key)) this.dead.add(key);
  }

  /** Next live key in round-robin order, or null when all keys are dead. */
  getNextKey() {
    if (!this.hasLiveKeys()) return null;
    for (let i = 0; i < this.keys.length; i += 1) {
      const key = this.keys[this.cursor % this.keys.length];
      this.cursor = (this.cursor + 1) % this.keys.length;
      if (!this.dead.has(key)) return key;
    }
    return null;
  }
}

export default KeyManager;

// FILE: src/services/employer/signed-url-service.js
// HMAC-signed, database-free resume-download tokens (C9, R2). The token carries
// everything the download endpoint needs — applicationId + expiry — so validation
// needs no DB lookup. Signature is HMAC-SHA256 of `{applicationId}.{expiresAt}`
// with RESUME_URL_SECRET; the whole `{applicationId}.{expiresAt}.{signature}`
// string is base64url-encoded into an opaque token. Compare is constant-time (R3).
// Pure module: no I/O. `secret` is injectable so tests can exercise wrong-secret.

import crypto from 'crypto';
import { RESUME_URL_SECRET } from '../../env.js';
import { HttpError } from '../../middleware/error-handler-middleware.js';

export const RESUME_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes (R1)

function computeSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Build an opaque, URL-safe token that grants read access to one resume. */
export function signResumeToken(applicationId, ttlMs = RESUME_URL_TTL_MS, secret = RESUME_URL_SECRET) {
  const id = String(applicationId);
  const expiresAt = Date.now() + ttlMs;
  const payload = `${id}.${expiresAt}`;
  const signature = computeSignature(payload, secret);
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

/**
 * Decode + validate a token. Throws HttpError(401, INVALID_TOKEN) on ANY failure
 * (malformed, tampered, wrong secret, expired) without revealing which check
 * failed (C9). Returns { applicationId } on success.
 */
export function verifyResumeToken(token, secret = RESUME_URL_SECRET) {
  try {
    const decoded = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) throw new Error('malformed');
    const [applicationId, expiresAtRaw, signature] = parts;

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) throw new Error('expired');

    const expected = computeSignature(`${applicationId}.${expiresAtRaw}`, secret);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length
      || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new Error('bad signature');
    }
    return { applicationId };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  }
}

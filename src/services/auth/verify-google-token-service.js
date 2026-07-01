// FILE: src/services/auth/verify-google-token-service.js
// Verifies a Google ID token for the employer auth flow. google-auth-library
// checks signature/aud/exp; we add defense-in-depth checks (R1, R6): explicit
// audience match, trusted issuer, verified email, and required claims.

import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from '../../env.js';
import { HttpError } from '../../middleware/error-handler-middleware.js';

const TRUSTED_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and return the normalized profile.
 * Throws HttpError with a stable code on any validation failure.
 */
export async function verifyEmployerGoogleIdToken(credential) {
  if (!credential || typeof credential !== 'string') {
    throw new HttpError(400, 'Missing credential', 'MISSING_CREDENTIAL');
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
  } catch {
    throw new HttpError(401, 'Invalid Google token', 'INVALID_GOOGLE_TOKEN');
  }

  const payload = ticket.getPayload();
  if (!payload) throw new HttpError(401, 'Invalid Google token', 'INVALID_GOOGLE_TOKEN');

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new HttpError(401, 'Token audience mismatch', 'INVALID_GOOGLE_TOKEN');
  }
  if (!TRUSTED_ISSUERS.includes(payload.iss)) {
    throw new HttpError(401, 'Token issuer invalid', 'INVALID_GOOGLE_TOKEN');
  }
  if (payload.email_verified !== true) {
    throw new HttpError(401, 'Email not verified by Google', 'EMAIL_NOT_VERIFIED');
  }
  if (!payload.sub || !payload.email || !payload.name) {
    throw new HttpError(401, 'Incomplete Google profile', 'INVALID_GOOGLE_TOKEN');
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name,
    picture: payload.picture || null,
  };
}

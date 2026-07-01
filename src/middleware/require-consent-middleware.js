// FILE: src/middleware/require-consent-middleware.js
// Route guard factory: requireConsentForPurpose(purpose) blocks a request unless
// the authenticated seeker holds an active consent for that purpose. Runs AFTER
// requireSeeker (reads req.user.userId). On failure responds 403 CONSENT_REQUIRED
// with the purpose so the frontend can pop the exact consent modal it needs.
// Not wired to any route in this step — Steps 4.7 and 5 apply it.

import { HttpError } from './error-handler-middleware.js';
import { hasActiveConsentForPurpose } from '../services/dpdp/consent-service.js';

export function requireConsentForPurpose(purpose) {
  return async function requireConsent(req, res, next) {
    try {
      const userId = req.user?.userId;
      if (!userId) return next(new HttpError(401, 'Unauthorized'));
      const allowed = await hasActiveConsentForPurpose(userId, purpose);
      if (!allowed) {
        // Respond directly so the body can carry `purpose` (the frontend uses it
        // to open the exact consent modal); HttpError only carries error + code.
        return res.status(403).json({ error: 'Consent required', code: 'CONSENT_REQUIRED', purpose });
      }
      req.consentPurpose = purpose; // downstream can read which purpose was gated
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default requireConsentForPurpose;

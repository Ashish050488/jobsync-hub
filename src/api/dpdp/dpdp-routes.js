// FILE: src/api/dpdp/dpdp-routes.js
// DPDP endpoints mounted at /api/dpdp. Guards are per-route (not blanket) because
// /notice-version is public. User identity always comes from req.user (set by
// requireSeeker) — never from the request body (§6.5 / C8).

import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler-middleware.js';
import { requireSeeker } from '../../middleware/require-seeker-middleware.js';
import {
  DPDP_NOTICE_VERSION, DPDP_POLICY_URL, DPDP_GRIEVANCE_OFFICER_EMAIL, DPDP_CROSS_BORDER_ENABLED,
} from '../../env.js';
import {
  recordConsent, withdrawConsent, listConsents,
} from '../../services/dpdp/consent-service.js';
import {
  submitRightsRequest, listRightsRequests,
} from '../../services/dpdp/rights-request-service.js';

const router = Router();

/** Evidence fields captured server-side — never trusted from the client. */
function evidence(req) {
  return { ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown', userAgent: req.get('user-agent') || 'unknown' };
}

// GET /notice-version — PUBLIC.
router.get('/notice-version', (_req, res) => {
  res.json({
    version: DPDP_NOTICE_VERSION,
    policyUrl: DPDP_POLICY_URL,
    grievanceEmail: DPDP_GRIEVANCE_OFFICER_EMAIL,
    crossBorderEnabled: DPDP_CROSS_BORDER_ENABLED,
  });
});

// GET /consents — the caller's own consents.
router.get('/consents', requireSeeker, asyncHandler(async (req, res) => {
  const includeWithdrawn = req.query.includeWithdrawn === 'true';
  const consents = await listConsents(req.user.userId, { includeWithdrawn });
  res.json({ consents });
}));

// POST /consents — grant a consent.
router.post('/consents', requireSeeker, asyncHandler(async (req, res) => {
  const { purpose, dataItems, noticeVersion, method, crossBorderTransfer } = req.body || {};
  const consent = await recordConsent({
    userId: req.user.userId, contactEmail: req.user.email,
    purpose, dataItems, noticeVersion, method, crossBorderTransfer,
    ...evidence(req),
  });
  res.status(201).json({ consent });
}));

// POST /consents/:id/withdraw — withdraw own consent.
router.post('/consents/:id/withdraw', requireSeeker, asyncHandler(async (req, res) => {
  const consent = await withdrawConsent({
    consentId: req.params.id, userId: req.user.userId, ...evidence(req),
  });
  res.json({ consent });
}));

// GET /rights-requests — the caller's own requests.
router.get('/rights-requests', requireSeeker, asyncHandler(async (req, res) => {
  const requests = await listRightsRequests(req.user.userId);
  res.json({ requests });
}));

// POST /rights-requests — submit a rights request.
router.post('/rights-requests', requireSeeker, asyncHandler(async (req, res) => {
  const { requestType, description } = req.body || {};
  const request = await submitRightsRequest({
    userId: req.user.userId, contactEmail: req.user.email,
    requestType, description, ...evidence(req),
  });
  res.status(201).json({ request });
}));

export default router;

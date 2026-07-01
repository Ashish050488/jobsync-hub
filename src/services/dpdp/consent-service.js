// FILE: src/services/dpdp/consent-service.js
// Consent business rules (DPDP Rule 3). recordConsent rejects payloads missing
// any required evidence field (C10) and stale notice versions (R8). Every grant
// and withdrawal writes an immutable audit entry.

import { HttpError } from '../../middleware/error-handler-middleware.js';
import { DPDP_NOTICE_VERSION } from '../../env.js';
import {
  CONSENT_PURPOSES, CONSENT_METHODS, AUDIT_EVENTS, isEnumValue,
} from '../../models/dpdp/dpdp-constants.js';
import {
  insertConsent, findConsentById, findActiveConsentForUser,
  listConsentsForUser, markConsentWithdrawn, toPublicConsent,
} from '../../models/dpdp/consent-model.js';
import { appendAudit } from './audit-log-service.js';

const MAX_DATA_ITEM_LENGTH = 100;

function validateDataItems(dataItems) {
  if (!Array.isArray(dataItems) || dataItems.length === 0) return false;
  return dataItems.every((item) => typeof item === 'string' && item.length > 0 && item.length <= MAX_DATA_ITEM_LENGTH);
}

export async function recordConsent(input) {
  const {
    userId, contactEmail, purpose, dataItems, noticeVersion,
    ipAddress, userAgent, method, crossBorderTransfer = false,
  } = input;

  if (!userId || !purpose || !method || !noticeVersion || !ipAddress || !userAgent || !validateDataItems(dataItems)) {
    throw new HttpError(400, 'Consent payload is incomplete', 'INVALID_CONSENT_PAYLOAD');
  }
  if (!isEnumValue(CONSENT_PURPOSES, purpose)) {
    throw new HttpError(400, 'Unknown consent purpose', 'INVALID_CONSENT_PAYLOAD');
  }
  if (!isEnumValue(CONSENT_METHODS, method)) {
    throw new HttpError(400, 'Unknown consent method', 'INVALID_CONSENT_PAYLOAD');
  }
  if (noticeVersion !== DPDP_NOTICE_VERSION) {
    throw new HttpError(400, 'Stale or unknown notice version', 'INVALID_NOTICE_VERSION');
  }

  const consent = await insertConsent({
    userId, contactEmail: contactEmail ?? null, purpose, dataItems, noticeVersion,
    ipAddress, userAgent, method, crossBorderTransfer: Boolean(crossBorderTransfer),
  });

  await appendAudit({
    event: AUDIT_EVENTS.CONSENT_GRANTED, actorType: 'seeker', actorId: userId,
    targetType: 'consent', targetId: consent._id, purpose,
    metadata: { method, crossBorderTransfer: Boolean(crossBorderTransfer) }, ipAddress, userAgent,
  });

  return toPublicConsent(consent);
}

export async function withdrawConsent({ consentId, userId, ipAddress, userAgent }) {
  const consent = await findConsentById(consentId);
  // Do not leak existence of consents owned by other users.
  if (!consent || consent.userId?.toString() !== userId?.toString()) {
    throw new HttpError(404, 'Consent not found', 'CONSENT_NOT_FOUND');
  }
  if (consent.withdrawnAt) {
    throw new HttpError(409, 'Consent already withdrawn', 'ALREADY_WITHDRAWN');
  }

  const updated = await markConsentWithdrawn(consentId, userId);

  await appendAudit({
    event: AUDIT_EVENTS.CONSENT_WITHDRAWN, actorType: 'seeker', actorId: userId,
    targetType: 'consent', targetId: updated._id, purpose: updated.purpose,
    metadata: {}, ipAddress, userAgent,
  });

  return toPublicConsent(updated);
}

export async function listConsents(userId, opts = {}) {
  const consents = await listConsentsForUser(userId, opts);
  return consents.map(toPublicConsent);
}

export async function hasActiveConsentForPurpose(userId, purpose) {
  const consent = await findActiveConsentForUser(userId, purpose);
  return Boolean(consent);
}

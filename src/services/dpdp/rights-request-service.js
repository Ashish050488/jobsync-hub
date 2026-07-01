// FILE: src/services/dpdp/rights-request-service.js
// Rights-request intake (DPDP Rule 14). Logs the request, stamps a 90-day dueBy
// SLA (R4), and writes an audit entry. The grievance officer is notified via a
// single console.warn stand-in until transactional email lands in a later step
// (this is the ONE intentional console per C5 / R5).

import { HttpError } from '../../middleware/error-handler-middleware.js';
import { DPDP_GRIEVANCE_OFFICER_EMAIL } from '../../env.js';
import {
  RIGHTS_REQUEST_TYPES, RIGHTS_REQUEST_STATUSES, AUDIT_EVENTS, isEnumValue,
} from '../../models/dpdp/dpdp-constants.js';
import {
  insertRightsRequest, listRightsRequestsForUser, toPublicRightsRequest,
} from '../../models/dpdp/rights-request-model.js';
import { appendAudit } from './audit-log-service.js';

const MAX_DESCRIPTION_LENGTH = 4000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function submitRightsRequest(input) {
  const { userId, contactEmail, requestType, description = '', ipAddress, userAgent } = input;

  if (!isEnumValue(RIGHTS_REQUEST_TYPES, requestType)) {
    throw new HttpError(400, 'Unknown request type', 'INVALID_REQUEST_TYPE');
  }
  if (!contactEmail || typeof contactEmail !== 'string') {
    throw new HttpError(400, 'A contact email is required', 'INVALID_RIGHTS_REQUEST');
  }
  if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(400, 'Description is too long', 'INVALID_RIGHTS_REQUEST');
  }

  const submittedAt = new Date();
  const dueBy = new Date(submittedAt.getTime() + NINETY_DAYS_MS);

  const requestDoc = await insertRightsRequest({
    userId, contactEmail, requestType, description,
    status: RIGHTS_REQUEST_STATUSES.SUBMITTED, submittedAt, dueBy,
  });

  await appendAudit({
    event: AUDIT_EVENTS.RIGHTS_REQUEST_SUBMITTED, actorType: 'seeker', actorId: userId,
    targetType: 'rights_request', targetId: requestDoc._id,
    metadata: { requestType, dueBy }, ipAddress, userAgent,
  });

  // Intentional stand-in for the grievance-officer email (C5 / R5).
  console.warn(`[dpdp] New rights request ${requestType} from ${contactEmail} — notify ${DPDP_GRIEVANCE_OFFICER_EMAIL}`);

  return toPublicRightsRequest(requestDoc);
}

export async function listRightsRequests(userId) {
  const requests = await listRightsRequestsForUser(userId);
  return requests.map(toPublicRightsRequest);
}

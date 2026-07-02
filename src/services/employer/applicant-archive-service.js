// FILE: src/services/employer/applicant-archive-service.js
// Archive / unarchive an application (D4, R7). Archiving sets
// application.archived = { at, reasonId, note } (SPEC §5.2) — the record is never
// deleted, it's audit history. Both operations append a stage_change so the
// timeline is complete. The archive reason MUST belong to the company (§6.5/C7).

import { HttpError } from '../../middleware/error-handler-middleware.js';
import { getApplicationForCompany } from '../../models/public/application-model.js';
import { createStageChange } from '../../models/public/stage-change-model.js';
import { getArchiveReasonForCompany } from '../../models/employer/archive-reason-model.js';
import { toEmployerApplication } from './applicant-mappers.js';
import { setApplicationFieldsForCompany } from './application-writer.js';

/** Archive an application under a company-owned reason. Refuses if already archived. */
export async function archiveApplicant(companyId, applicationId, { reasonId, note } = {}, movedByUserId = null) {
  const reason = await getArchiveReasonForCompany(companyId, reasonId);
  if (!reason) throw new HttpError(400, 'Archive reason not found', 'REASON_NOT_FOUND');

  const application = await getApplicationForCompany(companyId, applicationId);
  if (!application) throw new HttpError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  if (application.archived) throw new HttpError(409, 'Application is already archived', 'ALREADY_ARCHIVED');

  const updated = await setApplicationFieldsForCompany(companyId, application._id, {
    archived: { at: new Date(), reasonId: reason._id, note: note ?? null },
  });
  await createStageChange({
    applicationId: application._id,
    fromStageId: application.stageId,
    toStageId: application.stageId,
    movedByUserId,
    note: `Archived: ${reason.text}`,
  });

  return { application: toEmployerApplication(updated) };
}

/** Clear the archived flag. Refuses if the application was never archived. */
export async function unarchiveApplicant(companyId, applicationId, movedByUserId = null) {
  const application = await getApplicationForCompany(companyId, applicationId);
  if (!application) throw new HttpError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  if (!application.archived) throw new HttpError(409, 'Application is not archived', 'NOT_ARCHIVED');

  const updated = await setApplicationFieldsForCompany(companyId, application._id, { archived: null });
  await createStageChange({
    applicationId: application._id,
    fromStageId: application.stageId,
    toStageId: application.stageId,
    movedByUserId,
    note: 'Unarchived',
  });

  return { application: toEmployerApplication(updated) };
}

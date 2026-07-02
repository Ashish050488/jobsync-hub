// FILE: src/services/employer/applicant-move-service.js
// Moves an application between pipeline stages (D3), writing an append-only
// stage_change audit row and updating stageId + lastStageMovedAt. The target stage
// MUST belong to the same company (R6) — a cross-tenant stageId is rejected, never
// silently applied. Archived applications are frozen: move is refused with 409.

import { HttpError } from '../../middleware/error-handler-middleware.js';
import { getApplicationForCompany } from '../../models/public/application-model.js';
import { createStageChange } from '../../models/public/stage-change-model.js';
import { getStageForCompany } from '../../models/employer/stage-model.js';
import { toEmployerApplication, toEmployerStageChange } from './applicant-mappers.js';
import { setApplicationFieldsForCompany } from './application-writer.js';

/** Move one application to a stage within the same company. No-op if already there. */
export async function moveApplicantToStage(companyId, applicationId, { stageId, note } = {}, movedByUserId = null) {
  const stage = await getStageForCompany(companyId, stageId);
  if (!stage) throw new HttpError(400, 'Stage not found', 'STAGE_NOT_FOUND');

  const application = await getApplicationForCompany(companyId, applicationId);
  if (!application) throw new HttpError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  if (application.archived) {
    throw new HttpError(409, 'Cannot move an archived application', 'CANNOT_MOVE_ARCHIVED');
  }

  if (application.stageId?.toString() === stage._id.toString()) {
    return { application: toEmployerApplication(application), stageChange: null };
  }

  const stageChange = await createStageChange({
    applicationId: application._id,
    fromStageId: application.stageId,
    toStageId: stage._id,
    movedByUserId,
    note: note ?? null,
  });
  const updated = await setApplicationFieldsForCompany(companyId, application._id, {
    stageId: stage._id,
    lastStageMovedAt: new Date(),
  });

  return {
    application: toEmployerApplication(updated),
    stageChange: toEmployerStageChange(stageChange),
  };
}

export default moveApplicantToStage;

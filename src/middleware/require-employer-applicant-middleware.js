// FILE: src/middleware/require-employer-applicant-middleware.js
// Loads the :applicationId application scoped to the caller's company and attaches
// it as req.application. Runs AFTER requireEmployer + requireEmployerCompany, so
// req.employerCompanyId is set. A cross-tenant id resolves to null and is reported
// as 404 — never leaking that another company's application exists (§6.5/C7).

import { ObjectId } from 'mongodb';
import { HttpError } from './error-handler-middleware.js';
import { getApplicationForCompany } from '../models/public/application-model.js';

export async function requireEmployerApplicant(req, _res, next) {
  try {
    const { applicationId } = req.params;
    if (!ObjectId.isValid(applicationId)) {
      return next(new HttpError(400, 'Invalid application id', 'INVALID_APPLICATION_ID'));
    }
    const application = await getApplicationForCompany(req.employerCompanyId, applicationId);
    if (!application) return next(new HttpError(404, 'Application not found', 'APPLICATION_NOT_FOUND'));
    req.application = application;
    next();
  } catch (err) {
    next(err);
  }
}

export default requireEmployerApplicant;

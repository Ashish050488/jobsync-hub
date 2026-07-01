// FILE: src/middleware/require-employer-company-middleware.js
// Gate for routes that need an onboarded company (postings, applications, …).
// Runs AFTER requireEmployer. Loads the EmployerUser, requires companyId to be
// set, and attaches req.employerCompanyId so downstream handlers don't re-fetch.

import { getEmployerUserById } from '../models/employer/employer-user-model.js';
import { HttpError } from './error-handler-middleware.js';

export async function requireEmployerCompany(req, _res, next) {
  try {
    if (!req.employerUser?.employerUserId) return next(new HttpError(401, 'Unauthorized'));
    const user = await getEmployerUserById(req.employerUser.employerUserId);
    if (!user?.companyId) return next(new HttpError(403, 'No company', 'NO_COMPANY'));
    req.employerCompanyId = user.companyId;
    next();
  } catch (err) {
    next(err);
  }
}

export default requireEmployerCompany;

// FILE: src/middleware/require-employer-posting-middleware.js
// Loads the :postingId posting scoped to the caller's company and attaches it as
// req.posting. Runs AFTER requireEmployer + requireEmployerCompany, so
// req.employerCompanyId is already set. A cross-tenant id resolves to null and
// is reported as 404 (never leaking another company's posting existence).

import { ObjectId } from 'mongodb';
import { HttpError } from './error-handler-middleware.js';
import { getPostingForCompany } from '../models/employer/posting-model.js';

export async function requireEmployerPosting(req, _res, next) {
  try {
    const { postingId } = req.params;
    if (!ObjectId.isValid(postingId)) {
      return next(new HttpError(400, 'Invalid posting id', 'INVALID_POSTING_ID'));
    }
    const posting = await getPostingForCompany(req.employerCompanyId, postingId);
    if (!posting) return next(new HttpError(404, 'Posting not found', 'POSTING_NOT_FOUND'));
    req.posting = posting;
    next();
  } catch (err) {
    next(err);
  }
}

export default requireEmployerPosting;

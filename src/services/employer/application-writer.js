// FILE: src/services/employer/application-writer.js
// Thin, company-scoped write shim for the applications collection. Step 7A adds
// stage moves + archive without modifying the existing application-model (C6), so
// the field-level $set lives here. EVERY update filters by companyId (§6.5/C7) so
// a move/archive can never touch another tenant's application.

import { ObjectId } from 'mongodb';
import { col } from '../../Db/connection.js';

function toOid(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

/** $set the given fields on one application, scoped to the company. Returns the updated doc or null. */
export async function setApplicationFieldsForCompany(companyId, applicationId, patch) {
  const companyOid = toOid(companyId);
  const applicationOid = toOid(applicationId);
  if (!companyOid || !applicationOid) return null;
  const collection = await col('applications');
  return collection.findOneAndUpdate(
    { _id: applicationOid, companyId: companyOid },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export default setApplicationFieldsForCompany;

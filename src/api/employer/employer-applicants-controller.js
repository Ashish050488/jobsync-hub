// FILE: src/api/employer/employer-applicants-controller.js
// GET /api/employer/jobs/:postingId/applicants — the employer applicant list for
// one posting (D5, R6). Runs behind requireEmployerPosting, so the company and
// posting are already tenant-verified on the request. Joins are explicit lookup
// chains (no $lookup): list applications → batch-fetch contacts + scores, merge.
// Every read is companyId-scoped (§6.5). Default sort: highest score first.

import { listApplicationsForJob, toPublicApplication } from '../../models/public/application-model.js';
import { getContactForCompany, toPublicContact } from '../../models/public/contact-model.js';
import { listResumeScoresForJob, toPublicResumeScore } from '../../models/public/resume-score-model.js';

/** Sort merged applicant rows by score desc (default) or appliedAt desc. */
function sortApplicants(applicants, sort) {
  const sorted = [...applicants];
  if (sort === 'date') {
    sorted.sort((first, second) => new Date(second.application.appliedAt) - new Date(first.application.appliedAt));
  } else {
    sorted.sort((first, second) => (second.score?.score ?? -1) - (first.score?.score ?? -1));
  }
  return sorted;
}

export async function listApplicantsForPosting(req, res) {
  const companyId = req.employerCompanyId;
  const jobId = req.posting._id;

  const filters = {};
  if (req.query.stageId) filters.stageId = req.query.stageId;
  if (req.query.archived === 'false') filters.archived = false;
  const applications = await listApplicationsForJob(companyId, jobId, filters);

  const applicationIds = applications.map((application) => application._id);
  const contactIds = [...new Set(
    applications.map((application) => application.contactId?.toString()).filter(Boolean),
  )];
  const contacts = await Promise.all(contactIds.map((contactId) => getContactForCompany(companyId, contactId)));
  const contactById = new Map(contacts.filter(Boolean).map((contact) => [contact._id.toString(), contact]));

  const scores = await listResumeScoresForJob(companyId, jobId, applicationIds);
  const scoreByApplicationId = new Map(scores.map((score) => [score.applicationId.toString(), score]));

  const merged = applications.map((application) => {
    const contact = contactById.get(application.contactId?.toString()) ?? null;
    const score = scoreByApplicationId.get(application._id.toString()) ?? null;
    return {
      application: toPublicApplication(application),
      contact: contact ? toPublicContact(contact) : null,
      score: score ? toPublicResumeScore(score) : null,
    };
  });

  const sort = req.query.sort === 'date' ? 'date' : 'score';
  res.json({ applicants: sortApplicants(merged, sort) });
}

export default listApplicantsForPosting;

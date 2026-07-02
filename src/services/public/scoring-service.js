// FILE: src/services/public/scoring-service.js
// AI scoring pipeline (D2, C8/C9). Fired fire-and-forget after apply: extract the
// resume's text, send it plus the posting's parsedRequirements to Gemma in ONE
// call, store a structured score. Scoring is OPTIONAL — every failure path stores
// a processingError instead of throwing, so a missing resume/JD/Gemma never blocks
// an application. Dependencies are injectable so tests never touch disk or HTTP.

import { ObjectId } from 'mongodb';
import { col } from '../../Db/connection.js';
import { getResumeFileForApplication as defaultGetResumeFile } from '../../models/public/resume-file-model.js';
import { upsertResumeScore } from '../../models/public/resume-score-model.js';
import { getResumeBuffer as defaultGetResumeBuffer } from './resume-storage-service.js';
import { extractTextFromPDF as defaultExtractText } from '../seeker/resume-text-extractor.js';
import { getGemmaClient as defaultGetGemmaClient } from '../../gemma/gemma-runtime.js';
import { buildScoringSystemPrompt, parseScoreResponse } from './scoring-prompt.js';

const MINIMUM_RESUME_TEXT_LENGTH = 200;

function toOid(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

async function loadApplication(applicationId) {
  const oid = toOid(applicationId);
  if (!oid) return null;
  return (await col('applications')).findOne({ _id: oid });
}

async function loadPosting(jobId) {
  const oid = toOid(jobId);
  if (!oid) return null;
  return (await col('jobs')).findOne({ _id: oid });
}

function storeError(application, code) {
  return upsertResumeScore(application._id, application.companyId, { processingError: code });
}

/**
 * Score one application against its posting. Never throws for scoring reasons —
 * only for a genuinely missing application (a programming error). The apply hook
 * calls this fire-and-forget with a .catch (D4).
 */
export async function scoreApplication(applicationId, deps = {}) {
  const {
    getResumeFileForApplication = defaultGetResumeFile,
    getResumeBuffer = defaultGetResumeBuffer,
    extractTextFromPDF = defaultExtractText,
    getGemmaClient = defaultGetGemmaClient,
  } = deps;

  const application = await loadApplication(applicationId);
  if (!application) throw new Error(`scoreApplication: application ${applicationId} not found`);

  try {
    const resumeFile = await getResumeFileForApplication(application._id);
    if (!resumeFile) return await storeError(application, 'NO_RESUME_FILE');

    let resumeText = '';
    try {
      const buffer = await getResumeBuffer(resumeFile.storagePath);
      const extracted = await extractTextFromPDF(buffer);
      resumeText = String(extracted?.text || '');
    } catch {
      return await storeError(application, 'PDF_UNREADABLE');
    }
    if (resumeText.length < MINIMUM_RESUME_TEXT_LENGTH) {
      return await storeError(application, 'PDF_UNREADABLE');
    }

    const posting = await loadPosting(application.jobId);
    const parsedRequirements = posting?.parsedRequirements;
    if (!parsedRequirements) return await storeError(application, 'NO_JD_REQUIREMENTS');

    const client = getGemmaClient();
    if (!client) return await storeError(application, 'GEMMA_UNAVAILABLE');

    const systemPrompt = buildScoringSystemPrompt(parsedRequirements, resumeText);
    const raw = await client.generateContent(systemPrompt, 'Score this candidate. Return only the JSON object.');
    const scoreData = parseScoreResponse(raw);

    return await upsertResumeScore(application._id, application.companyId, {
      ...scoreData,
      resumeTextLength: resumeText.length,
      processingError: null,
    });
  } catch (err) {
    return upsertResumeScore(application._id, application.companyId, {
      processingError: err.message || 'SCORING_FAILED',
    }).catch(() => {});
  }
}

export default scoreApplication;

// FILE: src/models/public/resume-score-model.js
// resume_scores collection — one AI score per application (SPEC §5.2, simplified).
// Every query is companyId-scoped (§6.5): score reads join back through the
// application's companyId, never the request. tier is derived from score in one
// place (tierFromScore) so it can never drift from the number it describes (R2).

import { ObjectId } from 'mongodb';
import { col } from '../../Db/connection.js';

const resumeScoresCol = () => col('resume_scores');

function toOid(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

const strArray = (value) => (Array.isArray(value)
  ? value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
  : []);
const strOrNull = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Clamp any input to an integer 0-100; non-numbers become 0. */
export function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

const TIER_THRESHOLDS = [
  [85, 'strong'], [65, 'good'], [50, 'partial'], [30, 'weak'], [0, 'poor'],
];

/** Map a 0-100 score to its tier band (R2). */
export function tierFromScore(value) {
  const clamped = clampScore(value);
  for (const [floor, tier] of TIER_THRESHOLDS) {
    if (clamped >= floor) return tier;
  }
  return 'poor';
}

/** Idempotent index setup. Called on boot. */
export async function ensureResumeScoreIndexes() {
  const collection = await resumeScoresCol();
  await collection.createIndex({ applicationId: 1 }, { unique: true, name: 'resume_scores_applicationId' });
  await collection.createIndex({ companyId: 1, score: -1 }, { name: 'resume_scores_companyId_score' });
}

/**
 * Insert or overwrite the score for one application (idempotent per applicationId).
 * When data.processingError is set, score/tier are null — scoring failed but the
 * application still exists (C8). Otherwise score is clamped and tier derived.
 */
export async function upsertResumeScore(applicationId, companyId, data = {}) {
  const appOid = toOid(applicationId);
  const companyOid = toOid(companyId);
  if (!appOid || !companyOid) throw new Error('upsertResumeScore: invalid ids');
  const hasError = Boolean(data.processingError);
  const score = hasError ? null : clampScore(data.score);
  const doc = {
    applicationId: appOid,
    companyId: companyOid,
    score,
    tier: hasError ? null : tierFromScore(score),
    matchedSkills: strArray(data.matchedSkills),
    missingSkills: strArray(data.missingSkills),
    bonusSkills: strArray(data.bonusSkills),
    experienceFit: strOrNull(data.experienceFit),
    locationFit: strOrNull(data.locationFit),
    noticePeriodFit: strOrNull(data.noticePeriodFit),
    explanation: strOrNull(data.explanation)?.slice(0, 500) ?? null,
    resumeTextLength: Number.isFinite(data.resumeTextLength) ? data.resumeTextLength : 0,
    processedAt: new Date(),
    processingError: hasError ? String(data.processingError) : null,
  };
  const collection = await resumeScoresCol();
  await collection.updateOne({ applicationId: appOid }, { $set: doc }, { upsert: true });
  return collection.findOne({ applicationId: appOid });
}

/** Fetch the score for one application, or null. */
export async function getResumeScoreForApplication(applicationId) {
  const oid = toOid(applicationId);
  if (!oid) return null;
  const collection = await resumeScoresCol();
  return collection.findOne({ applicationId: oid });
}

/**
 * Batch-fetch scores for a job's applications, tenant-scoped by companyId and
 * bounded to the given applicationIds (§6.5). Sorted by score desc.
 */
export async function listResumeScoresForJob(companyId, jobId, applicationIds = []) {
  const companyOid = toOid(companyId);
  if (!companyOid) return [];
  const appOids = applicationIds.map(toOid).filter(Boolean);
  if (appOids.length === 0) return [];
  const collection = await resumeScoresCol();
  return collection
    .find({ companyId: companyOid, applicationId: { $in: appOids } })
    .sort({ score: -1 })
    .toArray();
}

/** Client-safe projection — ids as strings, internals dropped. */
export function toPublicResumeScore(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    applicationId: doc.applicationId?.toString() ?? null,
    score: doc.score ?? null,
    tier: doc.tier ?? null,
    matchedSkills: doc.matchedSkills ?? [],
    missingSkills: doc.missingSkills ?? [],
    bonusSkills: doc.bonusSkills ?? [],
    experienceFit: doc.experienceFit ?? null,
    locationFit: doc.locationFit ?? null,
    noticePeriodFit: doc.noticePeriodFit ?? null,
    explanation: doc.explanation ?? null,
    processedAt: doc.processedAt ?? null,
    processingError: doc.processingError ?? null,
  };
}

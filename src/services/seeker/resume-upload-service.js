// FILE: src/services/seeker/resume-upload-service.js
// Orchestrates a resume upload: SHA-256 dedup (R3) → text extract → Gemma parse →
// store profile + hash. The PDF buffer is only read here; it is never written to
// disk or DB and is dropped once text extraction returns (C9).

import crypto from 'crypto';
import { extractTextFromPDF } from './resume-text-extractor.js';
import { parseResumeText } from './resume-parser-service.js';
import {
  getProfileForUser, upsertProfileForUser, getResumeHashForUser,
} from '../../models/seeker/seeker-profile-helpers.js';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Parse + store a resume from a PDF buffer. Skips work when the hash is unchanged. */
export async function processResumeUpload(userId, buffer) {
  const hash = sha256(buffer);
  const previousHash = await getResumeHashForUser(userId);
  if (previousHash && previousHash === hash) {
    return { parsedProfile: await getProfileForUser(userId), isUnchanged: true };
  }

  const { text } = await extractTextFromPDF(buffer);
  const parsedProfile = await parseResumeText(text);
  await upsertProfileForUser(userId, parsedProfile, hash);
  return { parsedProfile, isUnchanged: false };
}

/** Parse + store a resume from pasted text (PDF-less fallback, D7). */
export async function processResumeText(userId, text) {
  const hash = sha256(Buffer.from(text, 'utf8'));
  const previousHash = await getResumeHashForUser(userId);
  if (previousHash && previousHash === hash) {
    return { parsedProfile: await getProfileForUser(userId), isUnchanged: true };
  }

  const parsedProfile = await parseResumeText(text);
  await upsertProfileForUser(userId, parsedProfile, hash);
  return { parsedProfile, isUnchanged: false };
}

export default processResumeUpload;

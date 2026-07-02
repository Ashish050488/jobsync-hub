// FILE: src/api/public/resume-download-route.js
// Unauthenticated resume PDF download (D8). Access is granted solely by a valid
// short-lived HMAC token (C9) — no cookie. The token carries the applicationId;
// we still hit the DB to confirm the application's resume record exists (defense
// in depth, R2/C7). The file is STREAMED, never fully buffered (C10/R4), and the
// resolved path is confirmed to live under data/resumes/ before opening (R5).

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler-middleware.js';
import { HttpError } from '../../middleware/error-handler-middleware.js';
import { verifyResumeToken } from '../../services/employer/signed-url-service.js';
import { getResumeFileForApplication } from '../../models/public/resume-file-model.js';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RESUME_DIR = path.resolve(BACKEND_ROOT, 'data', 'resumes');

const router = Router();

/** Strip anything that could break the Content-Disposition header. */
function sanitizeFilename(name) {
  return String(name || 'resume.pdf').replace(/[^\w.\- ]/g, '_').slice(0, 128) || 'resume.pdf';
}

/** True only when the resolved absolute path stays inside data/resumes/ (R5). */
function isInsideResumeDir(absolutePath) {
  return absolutePath === RESUME_DIR || absolutePath.startsWith(RESUME_DIR + path.sep);
}

// GET /api/public/resume-download?token=…
router.get('/', asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) throw new HttpError(400, 'Missing token', 'MISSING_TOKEN');

  let applicationId;
  try {
    ({ applicationId } = verifyResumeToken(String(token)));
  } catch (err) {
    console.warn('[resume-download] token validation failed:', err.code || err.message);
    throw err; // HttpError(401, INVALID_TOKEN)
  }

  const resumeFile = await getResumeFileForApplication(applicationId);
  if (!resumeFile) throw new HttpError(404, 'Resume file missing', 'RESUME_FILE_MISSING');

  const absolutePath = path.resolve(BACKEND_ROOT, resumeFile.storagePath || '');
  if (!isInsideResumeDir(absolutePath)) throw new HttpError(403, 'Forbidden', 'FORBIDDEN_PATH');

  let stat;
  try {
    stat = await fs.promises.stat(absolutePath);
  } catch {
    throw new HttpError(404, 'Resume file missing', 'RESUME_FILE_MISSING');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(resumeFile.originalFilename)}"`);
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    await pipeline(fs.createReadStream(absolutePath), res);
  } catch {
    if (!res.headersSent) throw new HttpError(404, 'Resume file missing', 'RESUME_FILE_MISSING');
  }
}));

export default router;

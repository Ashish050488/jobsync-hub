// FILE: src/services/seeker/resume-text-extractor.js
// Wraps pdf-parse (v2) to pull plain text out of a resume PDF Buffer. The buffer
// lives only in memory and is never written anywhere (DPDP data minimization, C9).
// A very short text result almost always means a scanned/image PDF — we surface a
// clear error so the caller can ask the user to paste text instead (R1).

import { PDFParse } from 'pdf-parse';
import { HttpError } from '../../middleware/error-handler-middleware.js';

const MIN_TEXT_LENGTH = 200;

/** Extract text + page count from a PDF buffer. Throws on scanned/empty PDFs. */
export async function extractTextFromPDF(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = String(result?.text || '').trim();
    if (text.length < MIN_TEXT_LENGTH) {
      throw new HttpError(
        400,
        'Could not extract text from this PDF. It may be scanned or image-based. Please paste your resume text instead.',
        'PDF_TEXT_EXTRACTION_FAILED',
      );
    }
    return { text, pageCount: result?.total ?? result?.pages?.length ?? 1 };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      400,
      'Could not read this PDF. Please paste your resume text instead.',
      'PDF_TEXT_EXTRACTION_FAILED',
    );
  } finally {
    if (parser) await parser.destroy().catch(() => {});
  }
}

export default extractTextFromPDF;

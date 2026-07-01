import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTextFromPDF } from '../../src/services/seeker/resume-text-extractor.js';

/** Build a minimal single-page PDF whose visible text is `body`. */
function makePdf(body) {
  // Split on word boundaries (~50 chars/line) so no word breaks across lines and
  // the extracted text reconstructs cleanly after whitespace normalization.
  const words = body.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((`${line} ${w}`).trim().length > 50) { lines.push(line.trim()); line = w; } else line += ` ${w}`;
  }
  if (line.trim()) lines.push(line.trim());
  const content = `BT /F1 12 Tf 40 750 Td ${lines.map((l) => `(${l}) Tj 0 -16 Td`).join(' ')} ET`;
  return Buffer.from(
    '%PDF-1.4\n'
    + '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n'
    + `4 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj\n`
    + '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n'
    + 'xref\n0 6\n0000000000 65535 f \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n0\n%%EOF',
    'latin1',
  );
}

test('extracts text from a valid PDF buffer', async () => {
  const body = 'Experienced backend engineer with eight years building distributed systems in India. '
    + 'Skilled in Node.js, MongoDB, and Kubernetes across fintech and e-commerce domains. '
    + 'Led platform teams, owned reliability, and mentored engineers across many product lines here.';
  const result = await extractTextFromPDF(makePdf(body));
  assert.ok(result.text.replace(/\s+/g, ' ').includes('backend engineer'));
  assert.equal(result.pageCount, 1);
});

test('short text (<200 chars) throws PDF_TEXT_EXTRACTION_FAILED', async () => {
  await assert.rejects(
    () => extractTextFromPDF(makePdf('Hi there')),
    (err) => { assert.equal(err.code, 'PDF_TEXT_EXTRACTION_FAILED'); assert.equal(err.status, 400); return true; },
  );
});

test('non-PDF buffer throws PDF_TEXT_EXTRACTION_FAILED', async () => {
  await assert.rejects(
    () => extractTextFromPDF(Buffer.from('this is definitely not a pdf file at all')),
    (err) => { assert.equal(err.code, 'PDF_TEXT_EXTRACTION_FAILED'); return true; },
  );
});

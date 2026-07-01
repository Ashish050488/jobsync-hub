// FILE: src/models/employer/company-slug-helpers.js
// Pure (no DB) slug helpers for companies. ASCII-only, hyphen-joined, length
// capped. Kept separate so the slugify logic is unit-testable in isolation.

const SLUG_MAX_LENGTH = 60;
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Turn an arbitrary company name into a URL-safe slug:
 * NFKD-strip diacritics → lowercase → non-alphanumeric to hyphen → collapse
 * and trim hyphens → cap at 60 chars. Falls back to 'company' when empty (R3).
 */
export function slugify(name) {
  const base = String(name ?? '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')      // strip combining diacritic marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // any run of non-alphanumerics → hyphen
    .replace(/-+/g, '-')               // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens
  const capped = base.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, '');
  return capped || 'company';
}

/**
 * Append a suffix to a base slug, trimming the base so the whole candidate
 * stays within the 60-char cap and never has a double or trailing hyphen.
 */
export function buildSlugCandidate(base, suffix) {
  const room = SLUG_MAX_LENGTH - suffix.length - 1;
  const trimmedBase = base.slice(0, Math.max(1, room)).replace(/-+$/g, '') || 'company';
  return `${trimmedBase}-${suffix}`;
}

/** 6-char alphanumeric suffix for the last-resort unique slug fallback (R1). */
export function randomSlugSuffix() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

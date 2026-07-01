// FILE: src/models/employer/posting-slug-helpers.js
// Pure (no DB) slug helpers for native postings. Same rules as the company
// slug helpers, scoped per posting title. Kept separate so the slugify logic is
// unit-testable in isolation (§4.1).

const SLUG_MAX_LENGTH = 60;
const COMBINING_MARKS = /[̀-ͯ]/g; // combining diacritical marks

/**
 * Turn a posting title into a URL-safe slug:
 * NFKD-strip diacritics → lowercase → non-alphanumeric runs to hyphen → collapse
 * and trim hyphens → cap at 60 chars. Falls back to 'posting' when empty.
 */
export function slugifyPostingTitle(title) {
  const base = String(title ?? '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')      // strip combining diacritic marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // any run of non-alphanumerics → hyphen
    .replace(/-+/g, '-')               // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens
  const capped = base.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, '');
  return capped || 'posting';
}

/**
 * Append a suffix to a base slug, trimming the base so the whole candidate stays
 * within the 60-char cap and never has a double or trailing hyphen.
 */
export function buildPostingSlugCandidate(base, suffix) {
  const room = SLUG_MAX_LENGTH - suffix.length - 1;
  const trimmedBase = base.slice(0, Math.max(1, room)).replace(/-+$/g, '') || 'posting';
  return `${trimmedBase}-${suffix}`;
}

/** 6-char alphanumeric suffix for the last-resort unique slug fallback. */
export function randomPostingSlugSuffix() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/**
 * Entry-Level / Fresher tagger.
 * Analyses JobTitle, Department, and Description (HTML-stripped)
 * to determine whether a job is suitable for freshers.
 *
 * Returns `true` (entry-level) or `false`.
 */

// ─── Strip HTML to plain text ────────────────────────────────────
function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// helper: test a regex against multiple text fields
function anyMatch(regex, ...texts) {
    return texts.some(t => regex.test(t));
}

// ─── NEGATIVE signals (override everything) ─────────────────────
const NEGATIVE_TITLE = [
    /\bsenior\b/i,
    /\bsr\b\.?/i,
    /\bstaff\b/i,
    /\bprincipal\b/i,
    /\blead\b/i,
    /\bhead\s+of\b/i,
    /\bdirector\b/i,
    /\bvp\b/i,
    /\bvice\s+president\b/i,
    /\bmanager\b/i,
    /\barchitect\b/i,
    /\bsde[\s-]?(?:2|3|ii|iii)\b/i,
];

const NEGATIVE_DESC = [
    /\b(?:5|6|7|8|9|10|12|15)\+?\s*(?:years?|yrs?)\b/i,
    /\bextensive\s+experience\b/i,
    /\bproven\s+track\s+record\b/i,
];

// ─── STRONG signals (any one = entry-level) ─────────────────────
const STRONG = [
    /\bfreshers?\b/i,
    /\b0\s*[-–]\s*[12]\s*(?:years?|yrs?)\b/i,
    /\bentry[\s-]?level\b/i,
    /\bnew\s+grad(?:uate)?\b/i,
    /\brecent\s+grad(?:uate)?\b/i,
    /\bcampus\s+hir(?:e|ing)\b/i,
    /\bgraduate\s+engineer\s+trainee\b/i,
    /\bintern(?:ship)?\s+to\s+full\b/i,
];

// ─── MODERATE signals (need 2+ to qualify) ──────────────────────
// Each returns true/false for a given (title, desc, dept) triple
const MODERATE = [
    // "junior" in title
    (_t, title) => /\bjunior\b/i.test(title),
    // "associate" in title but NOT "senior associate"
    (_t, title) => /\bassociate\b/i.test(title) && !/\bsenior\s+associate\b/i.test(title),
    // 1-2 or 1-3 years in description
    (desc) => /\b1\s*[-–]\s*[23]\s*(?:years?|yrs?)\b/i.test(desc),
    // "analyst" in title without senior/lead
    (_t, title) => /\banalyst\b/i.test(title) && !/\bsenior\b/i.test(title) && !/\blead\b/i.test(title),
    // "trainee" in title
    (_t, title) => /\btrainee\b/i.test(title),
];

/**
 * @param {object} job  — must have JobTitle, Description, Department (optional)
 * @returns {boolean}
 */
export function tagEntryLevel(job) {
    const title = (job.JobTitle ?? '').toLowerCase();
    const desc  = stripHtml(job.Description ?? '');
    const dept  = (job.Department ?? '').toLowerCase();

    // 1. Negative title signals → not entry-level
    if (NEGATIVE_TITLE.some(rx => rx.test(title))) return false;

    // 2. Negative description signals → not entry-level
    if (NEGATIVE_DESC.some(rx => rx.test(desc))) return false;

    // 3. Any strong signal → entry-level
    if (STRONG.some(rx => anyMatch(rx, title, desc, dept))) return true;

    // 4. Count moderate signals
    let moderateHits = 0;
    for (const fn of MODERATE) {
        if (fn(desc, title, dept)) moderateHits++;
        if (moderateHits >= 2) return true;
    }

    return false;
}

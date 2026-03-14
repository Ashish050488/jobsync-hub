import he from 'he';

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function StripHtml(html) {
    if (!html) return "";
    const decodedHtml = he.decode(html);
    return decodedHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Banned Roles (Noise Filter) - Keep this strict
export const BANNED_ROLES = [
    "working student", "student assistant",
    "apprentice", "apprenticeship",
    "store manager", "shop manager",
    "sales assistant", "cashier",
    "phd thesis", "master thesis", "bachelor thesis"
];

// ── Entry-level title keywords (used for tagging; isEntryLevel uses blacklist-only) ──
export const ENTRY_LEVEL_KEYWORDS = [
    // SDE / Software
    'sde-1', 'sde 1', 'sde-i', 'sde i',
    'junior', 'jr.', 'jr ',
    'associate',
    'entry level', 'entry-level',
    'intern',
    'fresher', 'freshers',
    'trainee', 'graduate',
    // Generic tech/business roles (senior variants blocked by SENIOR_REJECT_KEYWORDS)
    'engineer', 'developer', 'analyst',
    'generalist', 'administrator',
    // Common Indian entry-level job titles
    'executive', 'technician', 'coordinator', 'representative',
    'planner', 'specialist', 'designer', 'tester',
    'biologist', 'officer', 'supervisor', 'therapist',
    'consultant', 'editor', 'writer', 'operator', 'counsellor',
];

// ── Senior-level title keywords (reject if any match) ────────────
export const SENIOR_REJECT_KEYWORDS = [
    'senior', 'sr.', 'sr ',
    'staff', 'principal', 'distinguished',
    'lead', 'head of', 'head,',
    'director', 'vp ', 'vice president',
    'chief', 'cto', 'cfo', 'coo', 'ceo',
    'manager',
    'architect',
    'sde-2', 'sde 2', 'sde-ii', 'sde ii',
    'sde-3', 'sde 3', 'sde-iii', 'sde iii',
    'level 3', 'level 4', 'level 5',
    'l3', 'l4', 'l5', 'l6', 'l7',
    'iii', 'iv', ' ii ', 'level ii',
];

// ✅ UPDATED: Broader keywords to ensure Engineers/Managers reach the AI layer
export const COMMON_KEYWORDS = [
    // Tech
    "software", "developer", "engineer", "data", "it", "tech", "cloud",
    "backend", "frontend", "fullstack", "devops", "security", "network",
    "system", "analyst", "architect", "admin", "product owner", "scrum",

    // Business / Management
    "manager", "lead", "head of", "director", "vp", "chief", "officer",
    "consultant", "strategist", "specialist", "coordinator",
    "marketing", "sales", "finance", "account", "business", "hr", "people",
    "operations", "project", "program", "product"
];
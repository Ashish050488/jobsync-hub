import he from 'he';

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function StripHtml(html) {
    if (!html) return "";
    const decodedHtml = he.decode(html);
    return decodedHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Banned Roles (Noise Filter) - Keep this strict
export const BANNED_ROLES = [
    "intern", "internship",
    "working student", "student assistant",
    "apprentice", "apprenticeship",
    "store manager", "shop manager",
    "sales assistant", "cashier",
    "phd thesis", "master thesis", "bachelor thesis"
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
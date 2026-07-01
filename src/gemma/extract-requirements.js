// FILE: src/gemma/extract-requirements.js
// Turns raw JD text into a structured, normalized parsedRequirements object via
// Gemma. Indian-market-tuned system prompt (D5). Robust to reasoning-model quirks:
// if the returned text isn't clean JSON, we regex out the first {...} block before
// giving up. All fields are validated/defaulted so downstream code sees a stable
// shape regardless of what the model emits.

const SCHEMA = '{"required_skills":[],"preferred_skills":[],"min_experience_years":null,'
  + '"max_experience_years":null,"required_education":null,"experience_level":null,'
  + '"employment_type":null,"key_responsibilities":[],"salary_range_inferred":null,'
  + '"notice_period_preference":null,"college_tier_preference":null}';

const SYSTEM_PROMPT = `You are a job description parser for the Indian job market.
Extract structured requirements from the job description text.
Return ONLY valid JSON matching this schema exactly: ${SCHEMA}.
Rules:
- required_skills: only technical/professional skills explicitly marked as required. Exclude soft skills.
- preferred_skills: skills marked as 'plus', 'nice to have', 'preferred', 'bonus'.
- min/max_experience_years: from patterns like '3+ years', '3-5 years'. null if not mentioned.
- required_education: exact text, e.g. 'B.Tech in CS'. null if not stated.
- experience_level: infer from title + years. Junior/Associate -> Entry, no prefix -> Mid, Senior/Staff -> Senior, Lead/Principal/Head -> Lead, Director/VP/C-level -> Executive.
- employment_type: null if not stated.
- key_responsibilities: top 3-5 duties, <=80 chars each.
- salary_range_inferred: if JD mentions salary (LPA, CTC, per annum), extract it. null if not disclosed.
- notice_period_preference: if JD says 'immediate joiners preferred' or specifies a notice period. null if silent.
- college_tier_preference: if JD mentions IIT/NIT/IIIT/Tier-1 or 'premier institute'. null if silent.
Do NOT invent data. If a field is not in the JD, return null or [].`;

const EXPERIENCE_LEVELS = ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

function stripHtml(text) {
  return String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemma returned unparseable JSON');
  }
}

const strArray = (value) => (Array.isArray(value)
  ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())
  : []);
const numOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const strOrNull = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const enumOrNull = (value, allowed) => (allowed.includes(value) ? value : null);

function normalizeSalary(value) {
  if (!value || typeof value !== 'object') return null;
  const min = numOrNull(value.min);
  const max = numOrNull(value.max);
  if (min === null && max === null) return null;
  return { min, max, currency: 'INR', unit: 'LPA' };
}

function normalize(parsed) {
  return {
    required_skills: strArray(parsed.required_skills),
    preferred_skills: strArray(parsed.preferred_skills),
    min_experience_years: numOrNull(parsed.min_experience_years),
    max_experience_years: numOrNull(parsed.max_experience_years),
    required_education: strOrNull(parsed.required_education),
    experience_level: enumOrNull(parsed.experience_level, EXPERIENCE_LEVELS),
    employment_type: enumOrNull(parsed.employment_type, EMPLOYMENT_TYPES),
    key_responsibilities: strArray(parsed.key_responsibilities).slice(0, 7).map((r) => r.slice(0, 80)),
    salary_range_inferred: normalizeSalary(parsed.salary_range_inferred),
    notice_period_preference: strOrNull(parsed.notice_period_preference),
    college_tier_preference: strOrNull(parsed.college_tier_preference),
    extractedAt: new Date().toISOString(),
  };
}

/** Extract + normalize requirements for one JD. `client` is a GemmaClient. */
export async function extractRequirementsFromJD({ title, company, description }, client) {
  if (!client) throw new Error('extractRequirementsFromJD: no Gemma client provided');
  const stripped = stripHtml(description).slice(0, 8000);
  const userMessage = `Job Title: ${title || ''}\nCompany: ${company || ''}\n\n${stripped}`;
  const raw = await client.generateContent(SYSTEM_PROMPT, userMessage);
  return normalize(parseJson(raw));
}

export default extractRequirementsFromJD;

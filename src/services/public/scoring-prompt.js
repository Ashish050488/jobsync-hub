// FILE: src/services/public/scoring-prompt.js
// Builds the single Gemma scoring prompt (D3, R1) — full resume text + the job's
// structured parsedRequirements, one call, no embeddings (C9). The rubric is
// strict and Indian-market-aware (R2) and tells Gemma to recognize skill
// equivalences (R3). parseScoreResponse maps the snake_case JSON Gemma returns
// into the camelCase shape the model stores; normalization happens in the model.

const MAXIMUM_RESUME_CHARACTERS = 10000;

const RUBRIC = `Score 0-100 using this rubric:
85-100 = Strong: core skills align, experience fits, location OK
65-84  = Good: most skills match, minor gaps
50-64  = Partial: some overlap, significant gaps
30-49  = Weak: few matches, wrong level
0-29   = Poor: different domain
Overqualification is negative (a 15-year VP applying to a junior role scores 30-40, not 90).

Recognize skill equivalences: React=React.js=ReactJS, AWS=Amazon Web Services, Frontend≈React+CSS+JS.`;

const RESPONSE_SHAPE = `Return ONLY valid JSON:
{
  "score": <int 0-100>,
  "matched_skills": ["skills from resume matching requirements"],
  "missing_skills": ["required skills NOT in resume"],
  "bonus_skills": ["resume skills not required but valuable"],
  "experience_fit": "<strong|good|weak|overqualified>",
  "location_fit": "<exact|same_state|remote_compatible|relocation>",
  "notice_period_fit": "<immediate|within_30|within_60|long_notice|unknown>",
  "explanation": "<2-3 sentences, max 500 chars, specific>"
}`;

/** Assemble the system instruction for one candidate scoring call. */
export function buildScoringSystemPrompt(parsedRequirements, resumeText) {
  const requirementsJson = JSON.stringify(parsedRequirements, null, 2);
  const truncatedResume = String(resumeText || '').slice(0, MAXIMUM_RESUME_CHARACTERS);
  return `You are an experienced Indian technical recruiter scoring a candidate's resume against a job description. Be strict but fair.

JOB REQUIREMENTS (structured):
${requirementsJson}

CANDIDATE RESUME TEXT:
${truncatedResume}

${RUBRIC}

${RESPONSE_SHAPE}`;
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemma returned unparseable scoring JSON');
  }
}

/** Map Gemma's snake_case response into the camelCase score data shape. */
export function parseScoreResponse(raw) {
  const parsed = parseJson(raw);
  return {
    score: parsed.score,
    matchedSkills: parsed.matched_skills,
    missingSkills: parsed.missing_skills,
    bonusSkills: parsed.bonus_skills,
    experienceFit: parsed.experience_fit,
    locationFit: parsed.location_fit,
    noticePeriodFit: parsed.notice_period_fit,
    explanation: parsed.explanation,
  };
}

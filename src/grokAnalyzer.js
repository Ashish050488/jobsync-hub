import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './utils.js';

const groq = new Groq({ apiKey: GROQ_API_KEY });

const MODEL_NAME = "llama-3.1-8b-instant"; 
const MAX_RETRIES = 5;

/**
 * IMPROVED VERSION - Analyzes job description using Groq for German language requirements
 * 
 * KEY IMPROVEMENTS:
 * - Recognizes "Fluency in German" as requirement (not just "nice to have")
 * - Catches "German native speaker" patterns
 * - Detects "professional fluency in German"
 * - Finds "(required)" in parentheses
 * - Detects "(mandatory)" in parentheses
 */
export async function analyzeJobWithGroq(jobTitle, description) {
    if (!description || description.length < 50) return null;

    const descriptionSnippet = description.substring(0, 4000);

    const prompt = `
You are a strict evidence-only classifier for German language requirements.
You MUST NOT infer anything that is not explicitly stated in the provided text.

JOB TITLE: "${jobTitle}"
DESCRIPTION: "${descriptionSnippet}..."

--- 🚨 ABSOLUTE RULES (CRITICAL) ---

1) Do NOT use the language of the description (English/German) as evidence for german_required.
2) Only mark a field TRUE if there is EXPLICIT proof in the text.
3) If explicit proof is missing, mark the field FALSE.
4) Evidence MUST contain EXACT QUOTES from DESCRIPTION with "double quotes"
5) If you cannot find a quote, write: "No explicit statement found in DESCRIPTION."

--- GERMAN REQUIRED (german_required boolean) ---

Set german_required = TRUE if you find ANY of these patterns:

🔴 **PATTERN GROUP 1: EXPLICIT REQUIREMENT KEYWORDS**

A) English Keywords:
   - "German required"
   - "German skills required"  
   - "German language skills (required)" ← Notice (required) in parentheses!
   - "German (required)"
   - "must speak German"
   - "must have German"
   - "German is mandatory"
   - "German is essential"
   - "German is necessary"
   - "German (mandatory)" ← Notice (mandatory) in parentheses!

B) German Keywords:
   - "Deutschkenntnisse erforderlich"
   - "Deutsch erforderlich"
   - "Deutsch notwendig"
   - "Fließend Deutsch vorausgesetzt"
   - "Deutsch zwingend"
   - "Deutsche Sprache ist Pflicht"

🔴 **PATTERN GROUP 2: FLUENCY = REQUIREMENT**

🚨 CRITICAL: "Fluency" indicates REQUIREMENT, not optional skill!

When job descriptions list skills in requirements section, "Fluency" means it's required.

Mark TRUE if you find:
   - "Fluency in German" (in requirements section)
   - "Fluent in German" (in requirements section)
   - "Fluent German" (in requirements section)
   - "German fluency"
   - "Fluent German language skills"
   - "Fließend Deutsch"
   - "Fließende Deutschkenntnisse"

🚨 CONTEXT MATTERS:
   ✅ "Requirements: Fluency in German" → TRUE (in requirements list)
   ✅ "You have: Fluency in German" → TRUE (in qualifications list)
   ✅ "Minimum requirements: Fluent German" → TRUE (in requirements)
   ❌ "Fluency in German would be nice" → FALSE (explicitly optional)
   ❌ "Fluency in German is a plus" → FALSE (explicitly optional)

🔴 **PATTERN GROUP 3: PROFESSIONAL FLUENCY**

Mark TRUE if you find:
   - "Professional fluency in German"
   - "High professional fluency in German"
   - "Business fluency in German"
   - "Business-level German"
   - "Professionelles Deutsch"

🔴 **PATTERN GROUP 4: NATIVE SPEAKER**

Mark TRUE if you find:
   - "German native speaker"
   - "Native German speaker"
   - "Native-level German"
   - "German (native)"
   - "Muttersprachler Deutsch"
   - "Deutsch Muttersprachler"

🔴 **PATTERN GROUP 5: LANGUAGE LEVELS (CEFR)**

Mark TRUE if you find specific levels:
   - "German B1", "German B2", "German C1", "German C2"
   - "Deutsch B1/B2/C1/C2"
   - "German (B2)", "German (C1)"
   - "Mindestens B2 Deutsch"
   - "At least B2 German"
   - "Minimum B2 German"

🔴 **PATTERN GROUP 6: WORKING LANGUAGE**

Mark TRUE if you find:
   - "German is the working language"
   - "Deutsch als Arbeitssprache"
   - "German is the business language"
   - "Arbeitssprache Deutsch"
   - "German-speaking environment"

🔴 **PATTERN GROUP 7: BILINGUAL REQUIREMENTS**

Mark TRUE if you find:
   - "Bilingual: Fluent in both English and German"
   - "Bilingual (German/English)"
   - "German and English required"
   - "German/English bilingual"

---

Set german_required = FALSE ONLY if:

❌ Optional keywords present:
   - "von Vorteil" (advantageous)
   - "wünschenswert" (desirable)
   - "nice to have"
   - "a plus"
   - "beneficial"
   - "would be nice"
   - "is a plus"

❌ Polite/soft phrasing (not explicit requirement):
   - "runden dein Profil ab" (rounds out your profile)
   - "abrunden" (round out)
   - "ergänzen" (complement)

❌ No mention:
   - German is not mentioned anywhere

🚨 **CRITICAL DECISION TREE:**

1. Does text contain "(mandatory)" or "(required)" after German?
   → YES = TRUE

2. Does text say "Fluency in German" or "Fluent in German" in a requirements/qualifications list?
   → YES = TRUE (unless explicitly marked "nice to have" or "plus")

3. Does text say "German native speaker" or "Native German"?
   → YES = TRUE

4. Does text say "professional fluency" or "business fluency" in German?
   → YES = TRUE

5. Does text specify CEFR level (B1, B2, C1, C2)?
   → YES = TRUE

6. Does text say "bilingual" with German and English?
   → YES = TRUE

7. Does text say "German" with any of: mandatory, required, essential, necessary, must?
   → YES = TRUE

8. Does text say German is "a plus", "nice to have", "wünschenswert"?
   → NO = FALSE

9. Is German not mentioned at all?
   → NO = FALSE

---

🚨 **REAL EXAMPLES FROM YOUR DATA:**

✅ MARK TRUE:
- "Fluency in English & German (mandatory)" → TRUE (has (mandatory))
- "German native speaker with fluent business English" → TRUE (has "native speaker")
- "High professional fluency in German and English" → TRUE (has "professional fluency")
- "Fluent German language skills (required)" → TRUE (has (required))
- "Fluency in German" (in requirements section) → TRUE (fluency = requirement)
- "Bilingual: Fluent in both English and German" → TRUE (bilingual requirement)
- "German (B2)" → TRUE (has level specification)

❌ MARK FALSE:
- "Sehr gute Deutschkenntnisse runden dein Profil ab" → FALSE (only "runden ab")
- "German is a plus" → FALSE (explicitly optional)
- "Deutschkenntnisse wünschenswert" → FALSE (optional keyword)
- No mention of German → FALSE

--- DOMAIN & SUB-DOMAIN ---

Domain:
- "Technical": Software, Data, AI, DevOps, Engineering, IT
- "Non-Technical": Product, Marketing, Sales, HR, Finance
- "Unclear": If ambiguous

Sub-domain: Specific (e.g., "Sales", "Marketing", "Backend", "DevOps")

--- CONFIDENCE SCORE (0.0 - 1.0) ---

High confidence (0.90-0.95):
- Clear evidence with explicit keyword

Medium confidence (0.70-0.85):
- Context suggests requirement but keyword not perfect

Low confidence (0.50-0.65):
- Unclear or ambiguous

--- EVIDENCE FORMAT ---

For german_reason, provide:
1. WHERE (DESCRIPTION)
2. EXACT QUOTE in "double quotes"
3. Brief explanation

Examples:

✅ Good evidence (required):
"DESCRIPTION contains: 'Fluency in English & German (mandatory)'. The word '(mandatory)' explicitly indicates German is required."

"DESCRIPTION contains: 'German native speaker'. This explicitly requires native-level German proficiency."

"DESCRIPTION contains: 'High professional fluency in German and English'. Professional fluency indicates required skill level."

"DESCRIPTION contains: 'Fluency in German' listed in minimum requirements section. Fluency in a requirements list indicates it is required."

❌ Bad evidence (don't do this):
"German is working language" ← Not exact quote!
"Job prefers German" ← Assumption!

--- OUTPUT FORMAT ---

Return ONLY valid JSON:
{
  "german_required": true | false,
  "domain": "String",
  "sub_domain": "String",
  "confidence": Number,
  "evidence": {
    "german_reason": "2-3 sentences with EXACT quotes"
  }
}
`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a JSON-only API. Return pure JSON." },
                    { role: "user", content: prompt }
                ],
                model: MODEL_NAME,
                temperature: 0.1, 
                response_format: { type: "json_object" } 
            });

            const content = chatCompletion.choices[0]?.message?.content;
            if (!content) throw new Error("Empty response from Groq");

            const data = JSON.parse(content);
            
            const normalizedData = {
                german_required: data.german_required === true || data.german_required === "true",
                domain: data.domain,
                sub_domain: data.sub_domain,
                confidence: Number(data.confidence) || 0,
                evidence: data.evidence || {
                    german_reason: "No reason provided"
                }
            };
            
            console.log(`[AI] ${jobTitle.substring(0, 20)}... | Ger: ${normalizedData.german_required}`);
            return normalizedData;

        } catch (err) {
            if (err.status === 429 || err.message.includes('429')) {
                let waitTime = 60000;

                if (err.headers && err.headers['retry-after']) {
                    const retryHeader = parseInt(err.headers['retry-after'], 10);
                    if (!isNaN(retryHeader)) {
                        waitTime = (retryHeader * 1000) + 1000;
                    }
                } else {
                    const match = err.message.match(/try again in ([\d.]+)s/);
                    if (match && match[1]) {
                        waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
                    }
                }

                console.warn(`[AI] Groq Rate Limit. Waiting ${waitTime/1000}s...`);
                await sleep(waitTime);
            } else {
                console.warn(`[AI] Error: ${err.message}`);
                if (attempt === MAX_RETRIES) return null;
                await sleep(2000);
            }
        }
    }
    return null;
}

export async function isGermanRequired(description, jobTitle) {
    const result = await analyzeJobWithGroq(jobTitle, description);
    return result ? result.german_required : true; 
}
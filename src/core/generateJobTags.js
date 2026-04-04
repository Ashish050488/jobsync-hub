import he from 'he';

const EMPTY_AUTO_TAGS = {
    techStack: [],
    roleCategory: 'Other',
    experienceBand: null,
    isEntryLevel: false,
    domain: [],
    urgency: null,
    education: null,
};

const LEADERSHIP_CONTEXT = /(leadership|manager(?:ial|ment)?|people management|managed teams?|team lead|mentoring|mentor(?:ing)?|stakeholder management|cross-functional leadership)/i;

const EXPERIENCE_RANGE_REGEX = /\b(\d{1,2})\s*(?:\+)?\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)\b/gi;
const EXPERIENCE_SINGLE_REGEX = /\b(?:minimum\s+|minimum\s+of\s+|at\s+least\s+|around\s+)?(\d{1,2})\s*(\+)?\s*(?:years?|yrs?)\b(?:\s+of\s+experience)?/gi;

const STRONG_ENTRY_REGEXES = [
    /\bfreshers?\b/i,
    /\b0\s*(?:-|–|to)\s*[12]\s*(?:years?|yrs?)\b/i,
    /\bentry[\s-]?level\b/i,
    /\bnew\s+grad(?:uate)?\b/i,
    /\brecent\s+grad(?:uate)?\b/i,
    /\bcampus\s+(?:hire|hiring|recruitment|placement)\b/i,
    /\bgraduate\s+engineer\s+trainee\b/i,
    /\bGET\b/i,
    /\bno\s+(?:prior\s+)?experience\s+required\b/i,
    /\bstarting\s+your\s+career\b/i,
    /\bstart\s+your\s+career\b/i,
    /\bbegin\s+your\s+career\b/i,
    /\blaunch\s+your\s+career\b/i,
    /\b202[4-6]\s+batch\b/i,
    /\bfreshers?\s+(?:welcome|encouraged|can\s+apply)\b/i,
    /\bintern(?:ship)?\s+to\s+full(?:\s*time)?\b/i,
    /\bintern\s+to\s+full\b/i,
];

const MODERATE_ENTRY_CHECKS = [
    ({ title }) => /\bjunior\b/i.test(title),
    ({ title }) => /\banalyst\b/i.test(title) && !/\b(?:senior|lead|principal)\b/i.test(title),
    ({ title }) => /\bassociate\s+(?:engineer|developer)\b/i.test(title) && !/\bsenior\b/i.test(title),
    ({ text }) => /\b1\s*(?:-|–|to)\s*[23]\s*(?:years?|yrs?)\b/i.test(text),
    ({ text }) => /\bearly\s+(?:career|in\s+career)\b/i.test(text),
    ({ text }) => /\blearning\s+opportunity\b/i.test(text) || /\bmentorship\b/i.test(text) || /\bwe(?:\s+will|'ll)\s+teach\s+you\b/i.test(text) || /\btraining\s+provided\b/i.test(text),
    ({ text }) => /\b(?:B\.?Tech|B\.?E|BE)\b/i.test(text),
    ({ text }) => /\b(?:CGPA|percentage)\b/i.test(text),
];

const STRONG_NEGATIVE_TITLE = /\b(?:senior|sr\.?|staff|principal|lead|director|head\s+of|vp|vice\s+president|manager|architect)\b/i;
const STRONG_NEGATIVE_TEXT = /\b(?:extensive\s+experience|proven\s+track\s+record|deep\s+expertise)\b/i;

const DOMAIN_RULES = [
    { label: 'Fintech', regex: /\b(?:fintech|banking|lending|insurance|financial\s+services|neobank|trading|investment)\b/gi },
    { label: 'Payments', regex: /\b(?:payment|payments|wallet|UPI|BNPL)\b/gi },
    { label: 'Blockchain/Crypto', regex: /\b(?:blockchain|crypto|web3)\b/gi },
    { label: 'SaaS', regex: /\b(?:saas|cloud\s+software|software\s+platform)\b/gi },
    { label: 'B2B', regex: /\b(?:b2b|enterprise\s+software|enterprise\s+platform)\b/gi },
    { label: 'E-commerce', regex: /\b(?:e-commerce|ecommerce|marketplace|retail|D2C|shopping)\b/gi },
    { label: 'Healthtech', regex: /\b(?:healthtech|healthcare|medical|pharma|clinical|telemedicine|health)\b/gi },
    { label: 'Edtech', regex: /\b(?:edtech|ed-tech|education|learning|e-learning)\b/gi },
    { label: 'Gaming', regex: /\b(?:gaming|esports|game(?:s|ing)?)\b/gi },
    { label: 'Logistics', regex: /\b(?:logistics|supply\s+chain|delivery|fleet|warehouse|shipping)\b/gi },
    { label: 'AI/ML', regex: /\b(?:artificial\s+intelligence|machine\s+learning|AI-first|AI\s+company|GenAI|generative\s+AI)\b/gi },
];

const URGENCY_RULES = [
    { label: 'Immediate Joiner', regex: /\b(?:immediate\s+joiner|immediate\s+joining|early\s+joiner\s+preferred)\b/i },
    { label: 'Urgent', regex: /\b(?:urgent|urgently\s+hiring|immediate\s+requirement)\b/i },
];

const EDUCATION_RULES = [
    { label: 'PhD', regex: /\b(?:Ph\.?D|doctorate)\b/i, rank: 4 },
    { label: 'MBA', regex: /\bMBA\b/i, rank: 3 },
    { label: 'MTech/MS', regex: /\b(?:M\.?Tech|MS|Master(?:'s)?)\b/i, rank: 2 },
    { label: 'BTech/BE', regex: /\b(?:B\.?Tech|B\.?E|BE|Bachelor(?:'s)?)\b/i, rank: 1 },
];

const ROLE_CATEGORY_RULES = [
    {
        label: 'ML/AI',
        title: [/\b(?:machine\s+learning|ml\s+engineer|ai\s+engineer|deep\s+learning|nlp|computer\s+vision|llm|genai|generative\s+ai)\b/i],
        desc: [/\b(?:machine\s+learning|llm|pytorch|tensorflow|nlp|computer\s+vision|hugging\s+face|langchain|genai)\b/gi],
    },
    {
        label: 'Data',
        title: [/\b(?:data\s+engineer|data\s+analyst|data\s+scientist|analytics|business\s+intelligence|bi\s+developer|etl)\b/i],
        desc: [/\b(?:data\s+pipeline|etl|warehouse|analytics|tableau|power\s+bi|sql|spark|airflow|dbt|snowflake|bigquery|redshift)\b/gi],
    },
    {
        label: 'Security',
        title: [/\b(?:security|cybersecurity|infosec|penetration|soc\s+analyst)\b/i],
        desc: [/\b(?:security|cybersecurity|infosec|siem|soc|vulnerability|penetration\s+testing|threat)\b/gi],
    },
    {
        label: 'Mobile',
        title: [/\b(?:mobile|ios|android|react\s+native|flutter)\b/i],
        desc: [/\b(?:ios|android|react\s+native|flutter|swiftui|jetpack\s+compose|android\s+sdk|ios\s+sdk)\b/gi],
    },
    {
        label: 'Design',
        title: [/\b(?:designer|ux|ui\/ux|product\s+designer|design\s+engineer)\b/i],
        desc: [/\b(?:ux|ui|figma|prototype|design\s+system|interaction\s+design|visual\s+design)\b/gi],
    },
    {
        label: 'Product',
        title: [/\b(?:product\s+manager|product\s+owner|apm|technical\s+program\s+manager|tpm)\b/i],
        desc: [/\b(?:roadmap|prd|stakeholder|product\s+metrics|go-to-market|feature\s+prioritization)\b/gi],
    },
    {
        label: 'QA',
        title: [/\b(?:qa|quality\s+assurance|test\s+engineer|sdet|automation\s+engineer|test\s+lead)\b/i],
        desc: [/\b(?:qa|quality\s+assurance|automation\s+testing|selenium|playwright|cypress|test\s+cases|sdet)\b/gi],
    },
    {
        label: 'Full Stack',
        title: [/\b(?:full\s*stack|full-stack|fullstack)\b/i],
        desc: [/\b(?:full\s*stack|frontend\s+and\s+backend|end-to-end\s+web)\b/gi],
    },
    {
        label: 'Frontend',
        title: [/\b(?:frontend|front-end|front\s+end|ui\s+engineer|ui\s+developer|react\s+developer|angular\s+developer|vue\s+developer)\b/i],
        desc: [/\b(?:react|next\.js|vue|angular|typescript|html|css|tailwind|webpack|vite|storybook)\b/gi],
    },
    {
        label: 'Backend',
        title: [/\b(?:backend|back-end|back\s+end|server-side|api\s+developer)\b/i],
        desc: [/\b(?:backend|server-side|api|microservices|node\.js|java|spring|django|fastapi|postgresql|mongodb)\b/gi],
    },
    {
        label: 'DevOps/SRE',
        title: [/\b(?:devops|sre|site\s+reliability|infrastructure|cloud\s+engineer)\b/i, /\bplatform\s+engineer\b/i],
        desc: [/\b(?:devops|sre|kubernetes|docker|terraform|ci\/cd|github\s+actions|jenkins|observability|prometheus|grafana|linux|infrastructure|cloud)\b/gi],
    },
];

const TECH_STACK_DEFINITIONS = [
    { canonical: 'JavaScript', patterns: ['javascript'] },
    { canonical: 'TypeScript', patterns: ['typescript'] },
    { canonical: 'Python', patterns: ['python'] },
    { canonical: 'Java', patterns: ['java'] },
    { canonical: 'Kotlin', patterns: ['kotlin'] },
    { canonical: 'Rust', patterns: ['rust'] },
    { canonical: 'C++', patterns: ['c\\+\\+'] },
    { canonical: 'C#', patterns: ['c#'] },
    { canonical: 'Ruby', patterns: ['ruby'] },
    { canonical: 'PHP', patterns: ['php'] },
    { canonical: 'Swift', patterns: ['swift'] },
    { canonical: 'Scala', patterns: ['scala'] },
    { canonical: 'Dart', patterns: ['dart'] },
    { canonical: 'Elixir', patterns: ['elixir'] },
    { canonical: 'Clojure', patterns: ['clojure'] },
    { canonical: 'Perl', patterns: ['perl'] },
    { canonical: 'Shell', patterns: ['shell'] },
    { canonical: 'Bash', patterns: ['bash'] },
    { canonical: 'SQL', patterns: ['sql'] },
    { canonical: 'HTML', patterns: ['html'] },
    { canonical: 'CSS', patterns: ['css'] },
    { canonical: 'React', patterns: ['react(?:\\.js)?', 'reactjs'] },
    { canonical: 'Next.js', patterns: ['next\\.js', 'nextjs'] },
    { canonical: 'Vue', patterns: ['vue(?:\\.js)?', 'vuejs'] },
    { canonical: 'Nuxt', patterns: ['nuxt'] },
    { canonical: 'Angular', patterns: ['angular'] },
    { canonical: 'Svelte', patterns: ['svelte'] },
    { canonical: 'Remix', patterns: ['remix'] },
    { canonical: 'Gatsby', patterns: ['gatsby'] },
    { canonical: 'jQuery', patterns: ['jquery'] },
    { canonical: 'Redux', patterns: ['redux'] },
    { canonical: 'Zustand', patterns: ['zustand'] },
    { canonical: 'MobX', patterns: ['mobx'] },
    { canonical: 'Tailwind', patterns: ['tailwind'] },
    { canonical: 'Bootstrap', patterns: ['bootstrap'] },
    { canonical: 'SASS', patterns: ['sass'] },
    { canonical: 'SCSS', patterns: ['scss'] },
    { canonical: 'Webpack', patterns: ['webpack'] },
    { canonical: 'Vite', patterns: ['vite'] },
    { canonical: 'Storybook', patterns: ['storybook'] },
    { canonical: 'Node.js', patterns: ['node(?:\\.js)?', 'nodejs'] },
    { canonical: 'Express', patterns: ['express'] },
    { canonical: 'NestJS', patterns: ['nest\\.?js', 'nestjs'] },
    { canonical: 'Django', patterns: ['django'] },
    { canonical: 'Flask', patterns: ['flask'] },
    { canonical: 'FastAPI', patterns: ['fastapi'] },
    { canonical: 'Spring Boot', patterns: ['spring\\s+boot'] },
    { canonical: 'Spring', patterns: ['spring'] },
    { canonical: 'Rails', patterns: ['ruby\s+on\s+rails', 'rails'] },
    { canonical: 'Laravel', patterns: ['laravel'] },
    { canonical: 'ASP.NET', patterns: ['asp\\.?net'] },
    { canonical: 'Gin', patterns: ['gin(?:\\s+framework)?'] },
    { canonical: 'Fiber', patterns: ['fiber'] },
    { canonical: 'Actix', patterns: ['actix'] },
    { canonical: 'Phoenix', patterns: ['phoenix'] },
    { canonical: 'Hono', patterns: ['hono'] },
    { canonical: 'Fastify', patterns: ['fastify'] },
    { canonical: 'GraphQL', patterns: ['graphql'] },
    { canonical: 'REST', patterns: ['rest(?:ful)?'] },
    { canonical: 'gRPC', patterns: ['grpc'] },
    { canonical: 'PostgreSQL', patterns: ['postgresql', 'postgres'] },
    { canonical: 'MySQL', patterns: ['mysql'] },
    { canonical: 'MongoDB', patterns: ['mongodb'] },
    { canonical: 'Redis', patterns: ['redis'] },
    { canonical: 'Elasticsearch', patterns: ['elasticsearch'] },
    { canonical: 'Cassandra', patterns: ['cassandra'] },
    { canonical: 'DynamoDB', patterns: ['dynamodb'] },
    { canonical: 'Firebase', patterns: ['firebase'] },
    { canonical: 'Firestore', patterns: ['firestore'] },
    { canonical: 'Supabase', patterns: ['supabase'] },
    { canonical: 'CockroachDB', patterns: ['cockroachdb'] },
    { canonical: 'SQLite', patterns: ['sqlite'] },
    { canonical: 'MariaDB', patterns: ['mariadb'] },
    { canonical: 'Oracle', patterns: ['oracle'] },
    { canonical: 'SQL Server', patterns: ['sql\\s+server'] },
    { canonical: 'Neo4j', patterns: ['neo4j'] },
    { canonical: 'AWS', patterns: ['aws'] },
    { canonical: 'GCP', patterns: ['gcp', 'google\s+cloud'] },
    { canonical: 'Azure', patterns: ['azure'] },
    { canonical: 'Docker', patterns: ['docker'] },
    { canonical: 'Kubernetes', patterns: ['kubernetes', 'k8s'] },
    { canonical: 'Terraform', patterns: ['terraform'] },
    { canonical: 'Ansible', patterns: ['ansible'] },
    { canonical: 'Jenkins', patterns: ['jenkins'] },
    { canonical: 'CircleCI', patterns: ['circleci'] },
    { canonical: 'GitHub Actions', patterns: ['github\s+actions'] },
    { canonical: 'GitLab CI', patterns: ['gitlab\s+ci'] },
    { canonical: 'Vercel', patterns: ['vercel'] },
    { canonical: 'Netlify', patterns: ['netlify'] },
    { canonical: 'Heroku', patterns: ['heroku'] },
    { canonical: 'DigitalOcean', patterns: ['digitalocean'] },
    { canonical: 'Cloudflare', patterns: ['cloudflare'] },
    { canonical: 'Nginx', patterns: ['nginx'] },
    { canonical: 'Apache', patterns: ['apache'] },
    { canonical: 'Linux', patterns: ['linux'] },
    { canonical: 'Pandas', patterns: ['pandas'] },
    { canonical: 'NumPy', patterns: ['numpy'] },
    { canonical: 'TensorFlow', patterns: ['tensorflow'] },
    { canonical: 'PyTorch', patterns: ['pytorch'] },
    { canonical: 'Scikit-learn', patterns: ['scikit-learn', 'sklearn'] },
    { canonical: 'Spark', patterns: ['spark'] },
    { canonical: 'Hadoop', patterns: ['hadoop'] },
    { canonical: 'Kafka', patterns: ['kafka'] },
    { canonical: 'Airflow', patterns: ['airflow'] },
    { canonical: 'dbt', patterns: ['dbt'] },
    { canonical: 'Snowflake', patterns: ['snowflake'] },
    { canonical: 'BigQuery', patterns: ['bigquery'] },
    { canonical: 'Redshift', patterns: ['redshift'] },
    { canonical: 'Databricks', patterns: ['databricks'] },
    { canonical: 'Tableau', patterns: ['tableau'] },
    { canonical: 'Power BI', patterns: ['power\s+bi'] },
    { canonical: 'Looker', patterns: ['looker'] },
    { canonical: 'Jupyter', patterns: ['jupyter'] },
    { canonical: 'MLflow', patterns: ['mlflow'] },
    { canonical: 'Hugging Face', patterns: ['hugging\s+face'] },
    { canonical: 'LangChain', patterns: ['langchain'] },
    { canonical: 'OpenAI', patterns: ['openai'] },
    { canonical: 'LLM', patterns: ['llm', 'large\s+language\s+models?'] },
    { canonical: 'React Native', patterns: ['react\s+native'] },
    { canonical: 'Flutter', patterns: ['flutter'] },
    { canonical: 'SwiftUI', patterns: ['swiftui'] },
    { canonical: 'Jetpack Compose', patterns: ['jetpack\s+compose'] },
    { canonical: 'Expo', patterns: ['expo'] },
    { canonical: 'Ionic', patterns: ['ionic'] },
    { canonical: 'Xamarin', patterns: ['xamarin'] },
    { canonical: 'Android SDK', patterns: ['android\s+sdk'] },
    { canonical: 'iOS SDK', patterns: ['ios\s+sdk'] },
    { canonical: 'Git', patterns: ['git'] },
    { canonical: 'GitHub', patterns: ['github'] },
    { canonical: 'GitLab', patterns: ['gitlab'] },
    { canonical: 'Bitbucket', patterns: ['bitbucket'] },
    { canonical: 'Jira', patterns: ['jira'] },
    { canonical: 'Confluence', patterns: ['confluence'] },
    { canonical: 'Figma', patterns: ['figma'] },
    { canonical: 'Sketch', patterns: ['sketch'] },
    { canonical: 'Postman', patterns: ['postman'] },
    { canonical: 'Swagger', patterns: ['swagger'] },
    { canonical: 'Sentry', patterns: ['sentry'] },
    { canonical: 'Datadog', patterns: ['datadog'] },
    { canonical: 'Grafana', patterns: ['grafana'] },
    { canonical: 'Prometheus', patterns: ['prometheus'] },
    { canonical: 'New Relic', patterns: ['new\s+relic'] },
    { canonical: 'PagerDuty', patterns: ['pagerduty'] },
    { canonical: 'Slack API', patterns: ['slack\s+api'] },
    { canonical: 'Stripe API', patterns: ['stripe\s+api'] },
];

function buildTokenRegex(patterns) {
    const joined = patterns.join('|');
    return new RegExp(`(^|[^a-z0-9+#])(?:${joined})(?=$|[^a-z0-9+#])`, 'gi');
}

const TECH_STACK_MATCHERS = TECH_STACK_DEFINITIONS.map(definition => ({
    ...definition,
    regex: buildTokenRegex(definition.patterns),
}));

function stripHtmlAndDecode(html = '') {
    return he.decode(String(html))
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getPlainDescription(job = {}) {
    return stripHtmlAndDecode(job.DescriptionPlain || job.DescriptionCleaned || job.Description || '');
}

function countMatches(regex, text) {
    const matches = [];
    regex.lastIndex = 0;
    let result = regex.exec(text);
    while (result) {
        matches.push(result[0]);
        result = regex.exec(text);
    }
    regex.lastIndex = 0;
    return matches.length;
}

function hasStandaloneGoTerm(text) {
    return /(^|[^a-z0-9])go(?=$|[\s,/.:-])/i.test(text);
}

function scoreGo(title, text) {
    const context = /\b(?:golang|goroutine|gorilla|gin\s+framework|go\s+developer|go\s+engineer|func\s+[a-z_][a-z0-9_]*)\b/i;
    const titleHint = /\b(?:go\s+developer|go\s+engineer|golang)\b/i.test(title);
    const textHint = context.test(text);
    if (!titleHint && !(textHint && hasStandaloneGoTerm(text))) {
        return null;
    }
    return {
        canonical: 'Go',
        titleHits: titleHint ? 1 : 0,
        descHits: countMatches(/\b(?:golang|goroutine|gorilla|gin\s+framework)\b/gi, text) + (hasStandaloneGoTerm(text) ? 1 : 0),
    };
}

function scoreRLanguage(title, text) {
    const titleHint = /\br\s+developer\b/i.test(title);
    const textRegex = /\b(?:r\s+programming|r\s+language|rstudio|cran|tidyverse)\b/gi;
    const descHits = countMatches(textRegex, text);
    if (!titleHint && descHits === 0) {
        return null;
    }
    return {
        canonical: 'R',
        titleHits: titleHint ? 1 : 0,
        descHits,
    };
}

function inferTechStack(job) {
    const title = `${job.JobTitle ?? ''}`;
    const text = getPlainDescription(job);
    const scored = [];

    for (const matcher of TECH_STACK_MATCHERS) {
        const titleHits = countMatches(matcher.regex, title);
        const descHits = countMatches(matcher.regex, text);
        if (titleHits === 0 && descHits === 0) continue;
        scored.push({ canonical: matcher.canonical, titleHits, descHits });
    }

    const goScore = scoreGo(title, text);
    if (goScore) scored.push(goScore);

    const rScore = scoreRLanguage(title, text);
    if (rScore) scored.push(rScore);

    const deduped = new Map();
    for (const item of scored) {
        const existing = deduped.get(item.canonical);
        if (existing) {
            existing.titleHits += item.titleHits;
            existing.descHits += item.descHits;
        } else {
            deduped.set(item.canonical, { ...item });
        }
    }

    return [...deduped.values()]
        .sort((a, b) => {
            if (b.titleHits !== a.titleHits) return b.titleHits - a.titleHits;
            if (b.descHits !== a.descHits) return b.descHits - a.descHits;
            return a.canonical.localeCompare(b.canonical);
        })
        .slice(0, 12)
        .map(item => item.canonical);
}

function inferRoleCategory(job) {
    const title = `${job.JobTitle ?? ''}`;
    const text = getPlainDescription(job);

    for (const rule of ROLE_CATEGORY_RULES) {
        if (rule.title.some(regex => regex.test(title))) {
            if (rule.label === 'Backend' && /\bplatform\s+engineer\b/i.test(title) && /\b(?:infra|infrastructure|cloud|sre|devops)\b/i.test(text)) {
                return 'DevOps/SRE';
            }
            if (rule.label === 'DevOps/SRE' && /\bplatform\s+engineer\b/i.test(title) && /\b(?:api|backend|services)\b/i.test(text) && !/\b(?:infra|infrastructure|cloud|devops|sre)\b/i.test(text)) {
                return 'Backend';
            }
            return rule.label;
        }
    }

    let best = { label: 'Other', score: 0 };
    for (const rule of ROLE_CATEGORY_RULES) {
        const score = rule.desc.reduce((sum, regex) => sum + countMatches(regex, text), 0);
        if (score > best.score) {
            best = { label: rule.label, score };
        }
    }

    return best.score >= 2 ? best.label : 'Other';
}

function extractExperienceMentions(text) {
    const mentions = [];

    for (const match of text.matchAll(EXPERIENCE_RANGE_REGEX)) {
        const min = Number(match[1]);
        const max = Number(match[2]);
        const index = match.index ?? 0;
        const context = text.slice(Math.max(0, index - 40), Math.min(text.length, index + match[0].length + 40));
        if (LEADERSHIP_CONTEXT.test(context)) continue;
        mentions.push({ min, max, raw: match[0], index, hasPlus: false, kind: 'range' });
    }

    for (const match of text.matchAll(EXPERIENCE_SINGLE_REGEX)) {
        const min = Number(match[1]);
        const hasPlus = match[2] === '+';
        const index = match.index ?? 0;
        const context = text.slice(Math.max(0, index - 40), Math.min(text.length, index + match[0].length + 40));
        if (LEADERSHIP_CONTEXT.test(context)) continue;
        mentions.push({ min, max: min, raw: match[0], index, hasPlus, kind: 'single' });
    }

    return mentions;
}

function bandFromExperienceMention(mention) {
    if (!mention) return null;

    if (mention.kind === 'range') {
        const { min, max } = mention;
        if (min === 0 && max <= 1) return 'Fresher (0-1y)';
        if (min <= 1 && max <= 3) return 'Junior (1-3y)';
        if (min >= 8) return 'Staff+ (8y+)';
        if (min >= 5) return 'Senior (5-8y)';
        if (min >= 3) return 'Mid (3-5y)';
        if (max <= 1) return 'Fresher (0-1y)';
        if (max <= 3) return 'Junior (1-3y)';
        if (max <= 5) return 'Mid (3-5y)';
        if (max <= 8) return 'Senior (5-8y)';
        return 'Staff+ (8y+)';
    }

    const { min, hasPlus } = mention;
    if (hasPlus) {
        if (min >= 8) return 'Staff+ (8y+)';
        if (min >= 5) return 'Senior (5-8y)';
        if (min >= 3) return 'Mid (3-5y)';
        if (min >= 1) return 'Junior (1-3y)';
        return 'Fresher (0-1y)';
    }

    if (min <= 1) return 'Fresher (0-1y)';
    if (min <= 3) return 'Junior (1-3y)';
    if (min <= 5) return 'Mid (3-5y)';
    if (min <= 8) return 'Senior (5-8y)';
    return 'Staff+ (8y+)';
}

function inferExperienceBand(job) {
    const title = `${job.JobTitle ?? ''}`;
    const text = getPlainDescription(job);
    const mentions = extractExperienceMentions(text).sort((a, b) => {
        if (b.min !== a.min) return b.min - a.min;
        if ((b.hasPlus ? 1 : 0) !== (a.hasPlus ? 1 : 0)) return (b.hasPlus ? 1 : 0) - (a.hasPlus ? 1 : 0);
        if (b.max !== a.max) return b.max - a.max;
        return a.index - b.index;
    });

    if (mentions.length > 0) {
        return bandFromExperienceMention(mentions[0]);
    }

    if (/\b(?:principal|staff)\b/i.test(title)) return 'Staff+ (8y+)';
    if (/\bsenior\b/i.test(title)) return 'Senior (5-8y)';
    if (/\b(?:mid|intermediate)\b/i.test(title)) return 'Mid (3-5y)';
    if (/\b(?:junior|associate)\b/i.test(title)) return 'Junior (1-3y)';
    if (/\b(?:intern|trainee|fresher|new\s+grad|graduate\s+engineer\s+trainee)\b/i.test(title)) return 'Fresher (0-1y)';

    return null;
}

function inferEntryLevel(job, experienceBand) {
    const title = `${job.JobTitle ?? ''}`;
    const text = `${title} ${getPlainDescription(job)}`;

    const strongNegativeYears = extractExperienceMentions(getPlainDescription(job)).some(item => item.min >= 2 || item.max >= 2);
    const strongNegative = STRONG_NEGATIVE_TITLE.test(title) || strongNegativeYears || STRONG_NEGATIVE_TEXT.test(text);
    if (strongNegative) return false;

    if (/\b(?:associate\s+engineer|associate\s+developer|trainee)\b/i.test(title) && !/\bsenior\b/i.test(title)) {
        return true;
    }

    if (experienceBand === 'Fresher (0-1y)') return true;
    if (STRONG_ENTRY_REGEXES.some(regex => regex.test(text))) return true;

    let moderateHits = 0;
    for (const check of MODERATE_ENTRY_CHECKS) {
        if (check({ title, text })) {
            moderateHits += 1;
            if (moderateHits >= 2) return true;
        }
    }

    return false;
}

function inferDomain(job) {
    const haystack = `${job.Company ?? ''} ${getPlainDescription(job)}`;
    return DOMAIN_RULES
        .map(rule => ({ label: rule.label, hits: countMatches(rule.regex, haystack) }))
        .filter(item => item.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label))
        .slice(0, 2)
        .map(item => item.label);
}

function inferUrgency(job) {
    const text = getPlainDescription(job);
    for (const rule of URGENCY_RULES) {
        if (rule.regex.test(text)) return rule.label;
    }
    return null;
}

function inferEducation(job) {
    const text = getPlainDescription(job);
    let selected = null;
    for (const rule of EDUCATION_RULES) {
        if (rule.regex.test(text) && (!selected || rule.rank > selected.rank)) {
            selected = rule;
        }
    }
    return selected?.label ?? null;
}

export function generateJobTags(job = {}) {
    const roleCategory = inferRoleCategory(job);
    const experienceBand = inferExperienceBand(job);
    const isEntryLevel = inferEntryLevel(job, experienceBand);

    return {
        ...EMPTY_AUTO_TAGS,
        techStack: inferTechStack(job),
        roleCategory,
        experienceBand,
        isEntryLevel,
        domain: inferDomain(job),
        urgency: inferUrgency(job),
        education: inferEducation(job),
    };
}

export function getPlainTextForTagging(job = {}) {
    return getPlainDescription(job);
}

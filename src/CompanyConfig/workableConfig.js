import fetch from 'node-fetch';

/**
 * How to find the correct slug:
 *   Visit apply.workable.com/{slug} in a browser — the slug in that URL is what goes here.
 *   e.g.  apply.workable.com/innovaccer  →  slug is 'innovaccer'
 *
 * Requests are routed through a Cloudflare Worker (WORKABLE_PROXY_URL in .env) to bypass
 * datacenter IP blocks. Falls back to direct fetch if the env var is not set (local dev).
 */
const companySlugs = [
  // Only the requested companies (display name -> slug)
  'evidence-action',          // Evidence Action
  'sago-group',               // Sago
  'waterorg',                 // Water.org
  'petra-brands',             // Petra Brands
  'control-risks-6',          // Control Risks
  'apna',                     // Apna
  'innovaccer',               // Innovaccer Analytics
  'lakshya-digital',          // Lakshya Digital
  'teleport',                 // Teleport
  'rentokil-initial',         // Rentokil Initial
  'lytegen',                  // Lytegen
  'exponent-energy',          // Exponent Energy
  '2070health',               // 2070Health
  'mullers-solutions',        // Muller's Solutions
  'intellectsoft',            // Intellectsoft
  'enfinity-global-2',        // Enfinity Global
  'toloka',                   // Toloka Annotators
  'unison-consulting-pte-ltd', // Unison Group
  'amplifi-capital',          // Amplifi Capital
  'vizrt',                    // Vizrt
  'cimmyt',                   // CIMMYT
  'intertek',                 // Intertek
  'egon-zehnder',             // Egon Zehnder
  'azeus-convene',            // Azeus Convene
  'cynet',                    // Cynet Corp
  'keywords-studios',         // Keywords Studios
  'gunnebo',                  // Gunnebo Entrance Control
  'eriez',                    // Eriez
  'elevation-capital',        // Elevation Capital
  'covergo',                  // CoverGo
  'acloud',                   // aCloud
  '1kosmos',                  // 1Kosmos
  'genesisortho',             // Genesis Orthopedics & Sports Medicine
  'nutrition-international',  // Nutrition International
  'brightrays',               // BrightRays
  'infystrat',                // InfyStrat
  'mira-construction-l-dot-l-c-1', // MIRA CONSTRUCTION L.L.C
  'visit',                    // Visit.org,
];

const indianCities = [
  'bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi',
  'hyderabad', 'pune', 'chennai', 'noida', 'gurgaon', 'gurugram',
  'kolkata', 'ahmedabad', 'jaipur', 'lucknow', 'chandigarh',
  'indore', 'nagpur', 'coimbatore', 'kochi', 'cochin',
  'thiruvananthapuram', 'trivandrum', 'visakhapatnam', 'vizag',
  'bhubaneswar', 'mangalore', 'mysore', 'mysuru', 'vadodara',
  'surat', 'patna', 'ranchi', 'guwahati', 'bhopal',
];

const REQUEST_TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  return 3000 + Math.floor(Math.random() * 4000); // 3–7s between companies
}

async function fetchWorkableCompany(slug) {
  const targetUrl = `https://www.workable.com/api/accounts/${slug}?details=true`;
  return fetchJsonWithTimeout(targetUrl, 'public API');
}

function buildProxyUrl(targetUrl) {
  const proxyBase = process.env.WORKABLE_PROXY_URL;
  if (!proxyBase) return null;
  const separator = proxyBase.includes('?') ? '&' : '?';
  return `${proxyBase}${separator}url=${encodeURIComponent(targetUrl)}`;
}

async function fetchJsonFromUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResult(response, sourceLabel) {
  if (response.status === 404) {
    return { kind: 'not-found' };
  }

  if (!response.ok) {
    return { kind: 'failed', error: `${sourceLabel}: HTTP ${response.status}` };
  }

  try {
    const data = await response.json();
    return { kind: 'ok', data };
  } catch {
    return { kind: 'failed', error: `${sourceLabel}: Invalid JSON response` };
  }
}

async function fetchJsonWithTimeout(targetUrl, sourceLabel) {
  const proxyUrl = buildProxyUrl(targetUrl);

  if (proxyUrl) {
    try {
      const proxiedResponse = await fetchJsonFromUrl(proxyUrl);
      if (proxiedResponse.status === 403) {
        const directResponse = await fetchJsonFromUrl(targetUrl);
        return parseJsonResult(directResponse, `${sourceLabel} (direct fallback)`);
      }
      return parseJsonResult(proxiedResponse, `${sourceLabel} (proxy)`);
    } catch (error) {
      return { kind: 'failed', error: `${sourceLabel} (proxy): ${error.message}` };
    }
  }

  try {
    const directResponse = await fetchJsonFromUrl(targetUrl);
    return parseJsonResult(directResponse, `${sourceLabel} (direct)`);
  } catch (error) {
    return { kind: 'failed', error: `${sourceLabel} (direct): ${error.message}` };
  }
}

async function fetchWorkableWidget(slug) {
  const targetUrl = `https://apply.workable.com/api/v1/widget/accounts/${slug}`;
  return fetchJsonWithTimeout(targetUrl, 'widget API');
}

function normalizeWidgetResponse(slug, widgetData) {
  const companyName = typeof widgetData?.name === 'string' && widgetData.name.trim()
    ? widgetData.name.trim()
    : slug;

  const companyDescription = typeof widgetData?.description === 'string' && widgetData.description.trim()
    ? widgetData.description.trim()
    : '';

  const rawJobs = Array.isArray(widgetData?.jobs) ? widgetData.jobs : [];

  const jobs = rawJobs.map(rawJob => {
    const firstLocation = Array.isArray(rawJob.locations) && rawJob.locations.length > 0
      ? rawJob.locations[0]
      : {};

    const title = rawJob.title || 'Untitled Role';
    const fallbackDescription = companyDescription
      ? `<div>${companyDescription}</div>`
      : `<p>${title}</p>`;

    return {
      ...rawJob,
      title,
      shortcode: rawJob.shortcode || rawJob.code || '',
      country: rawJob.country || firstLocation.country || '',
      city: rawJob.city || firstLocation.city || '',
      state: rawJob.state || firstLocation.region || '',
      department: rawJob.department || rawJob.function || '',
      telecommuting: Boolean(rawJob.telecommuting),
      workplace_type: rawJob.workplace_type || (rawJob.telecommuting ? 'remote' : null),
      employment_type: rawJob.employment_type || null,
      published_on: rawJob.published_on || rawJob.created_at || null,
      created_at: rawJob.created_at || rawJob.published_on || null,
      url: rawJob.url || rawJob.shortlink || rawJob.application_url || '',
      shortlink: rawJob.shortlink || rawJob.url || rawJob.application_url || '',
      application_url: rawJob.application_url
        || (rawJob.url ? `${rawJob.url.replace(/\/$/, '')}/apply` : '')
        || rawJob.shortlink
        || '',
      description: typeof rawJob.description === 'string' && rawJob.description.trim()
        ? rawJob.description
        : fallbackDescription,
      education: rawJob.education || null,
      experience: rawJob.experience || null,
    };
  });

  return {
    name: companyName,
    jobs,
  };
}

export const workableConfig = {
  siteName: 'Workable Jobs',

  _allJobsQueue: [],
  _initialized: false,

  async initialize() {
    if (this._initialized) return;

    const via = process.env.WORKABLE_PROXY_URL ? 'Cloudflare Worker' : 'direct';
    console.log(`[Workable] Fetching jobs from ${companySlugs.length} companies via ${via}...`);

    let successCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    let widgetFallbackCount = 0;

    for (const slug of companySlugs) {
      try {
        let result = await fetchWorkableCompany(slug);

        if (result.kind === 'ok') {
          const publicJobs = Array.isArray(result.data.jobs) ? result.data.jobs : [];
          if (publicJobs.length === 0) {
            console.log(`[Workable]    ${slug}: public API returned 0 jobs, trying widget API...`);
            const widgetResult = await fetchWorkableWidget(slug);

            if (widgetResult.kind === 'ok') {
              const normalized = normalizeWidgetResponse(slug, widgetResult.data);
              result = {
                kind: 'ok',
                data: normalized,
                source: 'widget',
              };
              widgetFallbackCount++;
            } else if (widgetResult.kind !== 'not-found') {
              console.warn(`[Workable] ⚠️  ${slug}: widget fallback failed (${widgetResult.error})`);
            }
          }
        }

        if (result.kind === 'not-found') {
          notFoundCount++;
          console.warn(`[Workable] ⚠️  ${slug}: 404 — skipping`);
          await sleep(randomDelay());
          continue;
        }

        if (result.kind !== 'ok') {
          errorCount++;
          console.error(`[Workable] ❌ ${slug}: ${result.error} — skipping`);
          await sleep(randomDelay());
          continue;
        }

        const data = result.data;
        const allJobs = Array.isArray(data.jobs) ? data.jobs : [];
        const companyName = data.name || slug;
        const sourceLabel = result.source === 'widget' ? 'widget' : 'public';

        const indiaJobs = allJobs
          .filter(job => this.hasIndiaLocation(job))
          .map(job => ({ ...job, _slug: slug, _companyName: companyName }));

        if (indiaJobs.length > 0) {
          console.log(`[Workable] ✅ ${slug} (${companyName}): ${indiaJobs.length} India jobs (${allJobs.length} total, ${sourceLabel})`);
          this._allJobsQueue.push(...indiaJobs);
          successCount++;
        } else {
          console.log(`[Workable]    ${slug} (${companyName}): ${allJobs.length} jobs, 0 in India (${sourceLabel})`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[Workable] ❌ ${slug}: ${error.message} — skipping`);
      }

      await sleep(randomDelay());
    }

    console.log(`[Workable] ✅ Summary: ${successCount} with India jobs | ${notFoundCount} not on Workable | ${errorCount} errors`);
    console.log(`[Workable] 🔁 Widget fallback used: ${widgetFallbackCount} companies`);
    console.log(`[Workable] 📊 Total India jobs queued: ${this._allJobsQueue.length}`);
    this._initialized = true;
  },

  hasIndiaLocation(job) {
    if (job.country) {
      if (job.country === 'India') return true;
      if (job.country.toLowerCase() !== 'india') return false;
    }

    if (job.city) {
      const cityLower = job.city.toLowerCase();
      if (indianCities.some(c => cityLower.includes(c))) return true;
    }

    return false;
  },

  async fetchPage(offset, limit) {
    if (!this._initialized) {
      await this.initialize();
    }
    const jobs = this._allJobsQueue.slice(offset, offset + limit);
    return { jobs, total: this._allJobsQueue.length };
  },

  getJobs(data) {
    return data.jobs || [];
  },

  getTotal(data) {
    return data.total || 0;
  },

  extractJobID(job) {
    return `workable_${job._slug}_${job.shortcode}`;
  },

  extractJobTitle(job) {
    return job.title;
  },

  extractCompany(job) {
    return job._companyName;
  },

  extractLocation(job) {
    return [job.city, job.state, job.country].filter(Boolean).join(', ');
  },

  extractDescription(job) {
    return job.description || '';
  },

  extractURL(job) {
    return job.application_url || job.shortlink || job.url;
  },

  extractPostedDate(job) {
    return job.published_on ? new Date(job.published_on) : null;
  },
};

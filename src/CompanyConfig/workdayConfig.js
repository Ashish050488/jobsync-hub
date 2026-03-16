import fetch from 'node-fetch';
import { StripHtml } from '../utils.js';

const companyBoards = [
    // ── HIGH VOLUME (100+ India jobs) ───────────────────────────────────────
    { company: 'amgen',           instance: 'wd1', site: 'Careers',          name: 'Amgen' },            // 836 India / 1436 total
    { company: 'cadence',         instance: 'wd1', site: 'External_Careers', name: 'Cadence' },          // 282 India / 595 total
    { company: 'fractal',         instance: 'wd1', site: 'Careers',          name: 'Fractal' },          // 205 India / 112 total
    { company: 'micron',          instance: 'wd1', site: 'External',         name: 'Micron' },           // 203 India / 2126 total
    { company: 'dell',            instance: 'wd1', site: 'External',         name: 'Dell' },             // 198 India / 585 total
    { company: 'qualys',          instance: 'wd5', site: 'Careers',          name: 'Qualys' },           // 162 India / 214 total
    { company: 'nxp',             instance: 'wd3', site: 'Careers',          name: 'NXP' },              // 136 India / 476 total
    { company: 'unisys',          instance: 'wd5', site: 'External',         name: 'Unisys' },           // 112 India / 369 total
    { company: 'thales',          instance: 'wd3', site: 'Careers',          name: 'Thales' },           // 106 India / 2000 total

    // ── MEDIUM VOLUME (40–99 India jobs) ────────────────────────────────────
    { company: 'analogdevices',   instance: 'wd1', site: 'External',         name: 'Analog Devices' },   // 84 India / 926 total
    { company: 'paypal',          instance: 'wd1', site: 'Jobs',             name: 'PayPal' },           // 77 India / 639 total
    { company: 'takeda',          instance: 'wd3', site: 'External',         name: 'Takeda' },           // 77 India / 1392 total
    { company: 'globalfoundries', instance: 'wd1', site: 'External',         name: 'GlobalFoundries' },  // 74 India / 570 total
    { company: 'astrazeneca',     instance: 'wd3', site: 'Careers',          name: 'AstraZeneca' },      // 72 India / 1585 total
    { company: 'kone',            instance: 'wd3', site: 'Careers',          name: 'KONE' },             // 68 India / 913 total
    { company: 'intel',           instance: 'wd1', site: 'External',         name: 'Intel' },            // 67 India / 579 total
    { company: 'labcorp',         instance: 'wd1', site: 'External',         name: 'Labcorp' },          // 63 India / 1330 total
    { company: 'browserstack',    instance: 'wd3', site: 'External',         name: 'BrowserStack' },     // 56 India / 62 total
    { company: 'equinix',         instance: 'wd1', site: 'External',         name: 'Equinix' },          // 47 India / 416 total
    { company: 'sprinklr',        instance: 'wd1', site: 'Careers',          name: 'Sprinklr' },         // 46 India / 90 total
    { company: 'chevron',         instance: 'wd5', site: 'Jobs',             name: 'Chevron' },          // 45 India / 166 total
    { company: 'broadridge',      instance: 'wd5', site: 'Careers',          name: 'Broadridge' },       // 45 India / 309 total
    { company: 'boeing',          instance: 'wd1', site: 'External_Careers', name: 'Boeing' },           // 43 India / 1172 total

    // ── LOWER VOLUME (1–39 India jobs) ──────────────────────────────────────
    { company: 'ntst',            instance: 'wd1', site: 'Careers',          name: 'Netsmart' },         // 20 India / 59 total
    { company: 'mars',            instance: 'wd3', site: 'External',         name: 'Mars' },             // 20 India / 678 total
    { company: 'dupont',          instance: 'wd5', site: 'Jobs',             name: 'DuPont' },           // 15 India / 161 total
    { company: 'leidos',          instance: 'wd5', site: 'External',         name: 'Leidos' },           // 9 India / 1881 total
    { company: 'trendmicro',      instance: 'wd3', site: 'External',         name: 'Trend Micro' },      // 8 India / 287 total
    { company: 'rackspace',       instance: 'wd1', site: 'External',         name: 'Rackspace' },        // 6 India / 60 total
    { company: 'mckesson',        instance: 'wd3', site: 'External_Careers', name: 'McKesson' },         // 6 India / 362 total
    { company: 'regeneron',       instance: 'wd1', site: 'Careers',          name: 'Regeneron' },        // 5 India / 448 total
    { company: 'unum',            instance: 'wd1', site: 'External',         name: 'Unum' },             // 1 India / 62 total
];

export const workdayConfig = {
    siteName: 'Workday Jobs',
    companyBoards,
    _allJobsQueue: [],
    _initialized: false,
    needsDescriptionScraping: true,

    async initialize() {
        if (this._initialized) return;
        console.log(`[Workday] Fetching jobs from ${this.companyBoards.length} companies...`);
        let indiaJobsTotal = 0;
        let successCount = 0;
        let failCount = 0;
        let emptyCount = 0;
        for (const board of this.companyBoards) {
            const { company, instance, site, name } = board;
            const baseUrl = `https://${company}.${instance}.myworkdayjobs.com`;
            const listUrl = `${baseUrl}/wday/cxs/${company}/${site}/jobs`;
            let jobs = [];
            let total = 0;
            let offset = 0;
            const limit = 20;
            let indiaJobs = [];
            try {
                // Initial fetch to get total
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30000);
                const res = await fetch(listUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: '' }),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (!res.ok) {
                    failCount++;
                    console.log(`[Workday] ❌ ${company} (${name}): ${res.status} — skipping`);
                    continue;
                }
                const data = await res.json();
                total = data.total || 0;
                if (!total) {
                    emptyCount++;
                    continue;
                }
                // Paginate
                let page = 0;
                while (offset < total) {
                    if (page > 0) await new Promise(r => setTimeout(r, 200));
                    const controllerPage = new AbortController();
                    const timeoutPage = setTimeout(() => controllerPage.abort(), 30000);
                    const resp = page === 0 ? res : await fetch(listUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: '' }),
                        signal: controllerPage.signal,
                    });
                    clearTimeout(timeoutPage);
                    if (!resp.ok) break;
                    const pageData = page === 0 ? data : await resp.json();
                    const pageJobs = (pageData.jobPostings || []).map(j => ({ ...j, _company: company, _instance: instance, _site: site, _companyName: name }));
                    jobs.push(...pageJobs);
                    offset += limit;
                    page++;
                }
                // Filter for India jobs
                const indianCities = [
                    'bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi',
                    'hyderabad', 'pune', 'chennai', 'noida', 'gurgaon', 'gurugram',
                    'kolkata', 'ahmedabad', 'jaipur', 'lucknow', 'chandigarh',
                    'indore', 'nagpur', 'coimbatore', 'kochi', 'cochin',
                    'thiruvananthapuram', 'trivandrum', 'visakhapatnam', 'vizag',
                    'bhubaneswar', 'mangalore', 'mysore', 'mysuru', 'vadodara',
                    'surat', 'patna', 'ranchi', 'guwahati', 'bhopal'
                ];
                indiaJobs = jobs.filter(j => {
                    const loc = (j.locationsText || '').toLowerCase();
                    return loc.includes('india') || indianCities.some(city => loc.includes(city));
                });
                if (indiaJobs.length > 0) {
                    console.log(`[Workday] ✅ ${company} (${name}): ${indiaJobs.length} India jobs (${total} total)`);
                    this._allJobsQueue.push(...indiaJobs);
                    indiaJobsTotal += indiaJobs.length;
                    successCount++;
                } else {
                    console.log(`[Workday]    ${company} (${name}): ${total} jobs, 0 in India`);
                    emptyCount++;
                }
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                failCount++;
                console.log(`[Workday] ❌ ${company} (${name}): ${err?.message || err}`);
            }
        }
        console.log(`[Workday] ✅ Summary: ${successCount} companies with India jobs, ${failCount} failed, ${emptyCount} empty`);
        console.log(`[Workday] 📊 Total India jobs queued: ${indiaJobsTotal}`);
        this._initialized = true;
    },

    async fetchPage(offset, limit) {
        if (!this._initialized) await this.initialize();
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
        // Prefix with workday_{companySlug}_
        return `workday_${job._company}_${job.bulletFields?.[0] || ''}`;
    },

    extractJobTitle(job) {
        return job.title;
    },

    extractCompany(job) {
        return job._companyName;
    },

    extractLocation(job) {
        return job.locationsText || '';
    },

    extractDescription(job) {
        // Always null, filled by getDetails
        return null;
    },

    extractURL(job) {
        // Will be filled by getDetails
        return null;
    },

    extractPostedDate(job) {
        // Not available in list, filled by getDetails
        return null;
    },

    async getDetails(rawJob, sessionHeaders) {
        const { _company, _instance, _site, externalPath, _companyName } = rawJob;
        if (!_company || !_instance || !_site || !externalPath) return null;
        const baseUrl = `https://${_company}.${_instance}.myworkdayjobs.com`;
        const detailUrl = `${baseUrl}/wday/cxs/${_company}/${_site}${externalPath}`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            const res = await fetch(detailUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json', ...(sessionHeaders || {}) },
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) return null;
            const data = await res.json();
            const info = data.jobPostingInfo || {};
            const hiringOrg = data.hiringOrganization || {};
            return {
                Description: info.jobDescription || null,
                DescriptionPlain: StripHtml(info.jobDescription || ''),
                ApplicationURL: info.externalUrl || null,
                DirectApplyURL: info.externalUrl || null,
                ContractType: info.timeType || null,
                PostedDate: info.startDate ? new Date(info.startDate) : null,
                Company: hiringOrg.name || _companyName,
            };
        } catch (err) {
            return null;
        }
    },
};

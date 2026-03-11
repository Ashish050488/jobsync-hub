import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { AbortController } from 'abort-controller';

import { createJobModel } from '../models/jobModel.js';
import { BANNED_ROLES, ENTRY_LEVEL_KEYWORDS, SENIOR_REJECT_KEYWORDS } from '../utils.js';

function isSpamOrIrrelevant(title) {
    const lowerTitle = title.toLowerCase();
    return BANNED_ROLES.some(role => lowerTitle.includes(role));
}

// ─── Entry-level gate: must match at least one entry keyword AND none of the senior keywords
function isEntryLevel(title) {
    const t = title.toLowerCase();
    const hasSenior = SENIOR_REJECT_KEYWORDS.some(kw => t.includes(kw));
    if (hasSenior) return false;
    const hasEntry = ENTRY_LEVEL_KEYWORDS.some(kw => t.includes(kw));
    return hasEntry;
}

// ─── Infer ExperienceLevel from title ────────────────────────────
function inferExperienceLevel(title) {
    const t = title.toLowerCase();
    if (/intern\b/.test(t)) return 'Intern';
    if (['sde-1', 'sde 1', 'sde-i', 'sde i'].some(k => t.includes(k))) return 'Entry Level';
    if (['junior', 'jr.', 'jr '].some(k => t.includes(k))) return 'Entry Level';
    if (t.includes('associate')) return 'Entry Level';
    if (t.includes('entry level') || t.includes('entry-level')) return 'Entry Level';
    if (t.includes('fresher') || t.includes('trainee') || t.includes('graduate')) return 'Entry Level';
    if (t.includes('analyst')) return 'Entry Level';
    return 'Entry Level'; // default since we already filtered for entry-level
}

// ─── Ashby employmentType normalization ──────────────────────────
function normalizeEmploymentType(raw) {
    const map = { FullTime: 'Full-time', PartTime: 'Part-time', Intern: 'Internship', Temporary: 'Temporary', Contract: 'Contract' };
    return map[raw] || raw || null;
}

// ─── Lever workplaceType normalization ───────────────────────────
function normalizeLeverWorkplace(wt) {
    if (!wt || wt === 'unspecified') return null;
    if (wt === 'onSite') return 'on-site';
    return wt; // 'remote' and 'hybrid' pass through
}

// ─── LEVER FIELD MAPPING ─────────────────────────────────────────
function mapLeverJob(raw, companyName, sourceSite) {
    const cats = raw.categories || {};
    const salary = raw.salaryRange || {};

    let postedDate = null;
    if (raw.createdAt) {
        postedDate = new Date(raw.createdAt); // createdAt is already ms
        if (isNaN(postedDate.getTime())) postedDate = null;
    }
    if (postedDate) {
        const yr = postedDate.getFullYear();
        if (yr < 2020 || yr > new Date().getFullYear() + 1) {
            console.warn('[processor] Suspicious PostedDate:', raw.createdAt, '→', postedDate);
            postedDate = null;
        }
    }

    return {
        JobID: raw.id || null,
        JobTitle: raw.text || null,
        Company: companyName,
        ApplicationURL: raw.hostedUrl || raw.applyUrl || null,
        DirectApplyURL: raw.applyUrl || null,
        Location: cats.location || null,
        AllLocations: Array.isArray(cats.allLocations) ? cats.allLocations : [],
        Department: cats.department || null,
        Team: cats.team || null,
        ContractType: cats.commitment || null,
        WorkplaceType: normalizeLeverWorkplace(raw.workplaceType),
        IsRemote: raw.workplaceType === 'remote' ? true : (raw.workplaceType && raw.workplaceType !== 'unspecified' ? false : null),
        Tags: Array.isArray(raw.tags) ? raw.tags : [],
        Description: raw.description || null,
        DescriptionPlain: raw.descriptionPlain || null,
        DescriptionLists: Array.isArray(raw.lists) ? raw.lists : [],
        AdditionalInfo: raw.additional || null,
        SalaryMin: salary.min ?? null,
        SalaryMax: salary.max ?? null,
        SalaryCurrency: salary.currency || null,
        SalaryInterval: salary.interval || null,
        SalaryInfo: null,
        PostedDate: postedDate,
        sourceSite: sourceSite,
        ATSPlatform: 'lever',
        Status: 'active',
        scrapedAt: new Date(),
    };
}

// ─── GREENHOUSE FIELD MAPPING ────────────────────────────────────
function mapGreenhouseJob(raw, companyName, sourceSite) {
    let postedDate = null;
    if (raw.updated_at) {
        postedDate = new Date(raw.updated_at);
        if (isNaN(postedDate.getTime())) postedDate = null;
    }

    let salaryInfo = null;
    if (Array.isArray(raw.metadata)) {
        const salaryMeta = raw.metadata.find(m =>
            (m.name && m.name.toLowerCase().includes('salary')) ||
            (m.name && m.name.toLowerCase().includes('compensation'))
        );
        if (salaryMeta && salaryMeta.value) salaryInfo = String(salaryMeta.value);
    }

    const depts = Array.isArray(raw.departments) ? raw.departments : [];
    const offices = Array.isArray(raw.offices) ? raw.offices : [];

    // Infer remote from location string
    const locName = (raw.location?.name || '').toLowerCase();
    const isRemote = locName.includes('remote') || null;
    const workplaceType = isRemote ? 'remote' : null;

    // Build AllLocations from offices
    const allLocs = offices.map(o => o.name).filter(Boolean);

    // Strip HTML for plain text
    const descPlain = raw.content ? raw.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : null;

    return {
        JobID: String(raw.id || ''),
        JobTitle: raw.title || null,
        Company: companyName,
        ApplicationURL: raw.absolute_url || null,
        DirectApplyURL: null,
        Location: raw.location?.name || null,
        AllLocations: allLocs,
        Department: depts[0]?.name || null,
        Team: null,
        Office: offices[0]?.name || null,
        ContractType: null,
        WorkplaceType: workplaceType,
        IsRemote: isRemote,
        Tags: [],
        Description: raw.content || null,
        DescriptionPlain: descPlain,
        DescriptionLists: [],
        AdditionalInfo: null,
        SalaryMin: null,
        SalaryMax: null,
        SalaryCurrency: null,
        SalaryInterval: null,
        SalaryInfo: salaryInfo,
        PostedDate: postedDate,
        sourceSite: sourceSite,
        ATSPlatform: 'greenhouse',
        Status: 'active',
        scrapedAt: new Date(),
    };
}

// ─── ASHBY FIELD MAPPING ─────────────────────────────────────────
function mapAshbyJob(raw, companyName, sourceSite) {
    let postedDate = null;
    if (raw.publishedDate) {
        postedDate = new Date(raw.publishedDate);
        if (isNaN(postedDate.getTime())) postedDate = null;
    }
    if (!postedDate && raw.createdAt) {
        postedDate = new Date(raw.createdAt);
        if (isNaN(postedDate.getTime())) postedDate = null;
    }

    // Build AllLocations from primary + secondary
    const allLocs = [];
    if (raw.location) allLocs.push(raw.location);
    if (Array.isArray(raw.secondaryLocations)) {
        for (const sec of raw.secondaryLocations) {
            if (sec.location && !allLocs.includes(sec.location)) allLocs.push(sec.location);
        }
    }

    return {
        JobID: raw.id || null,
        JobTitle: raw.title || null,
        Company: companyName,
        ApplicationURL: raw.jobUrl || null,
        DirectApplyURL: raw.applyUrl || null,
        Location: raw.location || null,
        AllLocations: allLocs,
        Department: raw.team?.name || null,
        Team: raw.team?.name || null,
        Office: null,
        ContractType: normalizeEmploymentType(raw.employmentType),
        WorkplaceType: raw.isRemote === true ? 'remote' : null,
        IsRemote: raw.isRemote ?? null,
        Tags: [],
        Description: raw.descriptionHtml || null,
        DescriptionPlain: raw.descriptionPlain || null,
        DescriptionLists: [],
        AdditionalInfo: null,
        SalaryMin: null,
        SalaryMax: null,
        SalaryCurrency: null,
        SalaryInterval: null,
        SalaryInfo: raw.compensation?.compensationTierSummary || null,
        PostedDate: postedDate,
        sourceSite: sourceSite,
        ATSPlatform: 'ashby',
        Status: 'active',
        scrapedAt: new Date(),
    };
}

async function scrapeJobDetailsFromPage(mappedJob, siteConfig) {
    console.log(`[${siteConfig.siteName}] Visiting job page: ${mappedJob.ApplicationURL}`);
    const pageController = new AbortController();
    const pageTimeoutId = setTimeout(() => pageController.abort(), 30000);
    try {
        const jobPageRes = await fetch(mappedJob.ApplicationURL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: pageController.signal
        });
        const html = await jobPageRes.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;
        if (siteConfig.descriptionSelector) {
            const descriptionElement = document.querySelector(siteConfig.descriptionSelector);
            if (descriptionElement) {
                mappedJob.Description = descriptionElement.textContent.replace(/\s+/g, ' ').trim();
            }
        }
    } catch (error) {
        console.error(`[Scrape Error] ${error.message}`);
    } finally {
        clearTimeout(pageTimeoutId);
    }
    return mappedJob;
}


export async function processJob(rawJob, siteConfig, existingIDs, sessionHeaders, allRawJobs) {
    // 1. Config Pre-Filter
    if (siteConfig.preFilter && !siteConfig.preFilter(rawJob)) return null;

    // Determine platform from siteName
    const siteName = siteConfig.siteName || '';
    const isLever = siteName.toLowerCase().includes('lever');
    const isGreenhouse = siteName.toLowerCase().includes('greenhouse');
    const isAshby = siteName.toLowerCase().includes('ashby');

    // Extract job data using rich mappers
    let mappedJob;
    if (isLever) {
        const companyName = siteConfig.extractCompany ? siteConfig.extractCompany(rawJob) : siteName;
        const jobID = siteConfig.extractJobID ? siteConfig.extractJobID(rawJob) : rawJob.id;
        mappedJob = mapLeverJob(rawJob, companyName, siteName);
        mappedJob.JobID = jobID;
    } else if (isGreenhouse) {
        const companyName = siteConfig.extractCompany ? siteConfig.extractCompany(rawJob) : siteName;
        const jobID = siteConfig.extractJobID ? siteConfig.extractJobID(rawJob) : String(rawJob.id);
        mappedJob = mapGreenhouseJob(rawJob, companyName, siteName);
        mappedJob.JobID = jobID;
    } else if (isAshby) {
        const companyName = siteConfig.extractCompany ? siteConfig.extractCompany(rawJob) : siteName;
        const jobID = siteConfig.extractJobID ? siteConfig.extractJobID(rawJob) : rawJob.id;
        mappedJob = mapAshbyJob(rawJob, companyName, siteName);
        mappedJob.JobID = jobID;
    } else if (siteConfig.extractJobID) {
        // Fallback for unknown platforms using legacy extractors
        mappedJob = {
            JobID: siteConfig.extractJobID(rawJob),
            JobTitle: siteConfig.extractJobTitle(rawJob),
            Company: siteConfig.extractCompany(rawJob),
            Location: siteConfig.extractLocation(rawJob),
            Description: siteConfig.extractDescription(rawJob),
            ApplicationURL: siteConfig.extractURL(rawJob),
            PostedDate: siteConfig.extractPostedDate ? siteConfig.extractPostedDate(rawJob) : null,
        };
    } else {
        mappedJob = siteConfig.mapper(rawJob);
    }

    // 2. Duplicate Check
    if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
        return null;
    }

    // 3. Title Filter
    if (isSpamOrIrrelevant(mappedJob.JobTitle)) {
        console.log(`[Pre-Filter] Rejected (spam): ${mappedJob.JobTitle}`);
        return null;
    }

    // 3b. Entry-level gate — reject non-entry roles
    if (!isEntryLevel(mappedJob.JobTitle)) {
        console.log(`[Pre-Filter] Rejected (non-entry): ${mappedJob.JobTitle}`);
        return null;
    }

    // 3c. Set ExperienceLevel
    mappedJob.ExperienceLevel = inferExperienceLevel(mappedJob.JobTitle);

    // 4. Keyword Match
    if (siteConfig.filterKeywords && siteConfig.filterKeywords.length > 0) {
        const titleLower = mappedJob.JobTitle.toLowerCase();
        if (!siteConfig.filterKeywords.some(kw => titleLower.includes(kw.toLowerCase()))) return null;
    }
    
    // 5. Get Description
    if ((siteConfig.needsDescriptionScraping && !mappedJob.Description)) {
        if (typeof siteConfig.getDetails === 'function') {
            try {
                const details = await siteConfig.getDetails(rawJob, sessionHeaders);
                
                if (details && details.skip) {
                    console.log(`[${siteConfig.siteName}] Job skipped by getDetails`);
                    return null;
                }
                
                if (details) {
                    Object.assign(mappedJob, details);
                }
            } catch (error) {
                console.error(`[${siteConfig.siteName}] getDetails error: ${error.message}`);
                return null;
            }
        } else {
            mappedJob = await scrapeJobDetailsFromPage(mappedJob, siteConfig);
        }
    }
    
    if (!mappedJob.Description) return null;

    // Job accepted — save as active
    mappedJob.Status = "active";

    // To fix existing stuck jobs in MongoDB, run manually:
    // db.jobs.updateMany({ Status: { $in: ["pending", "pending_review", "accepted", "review"] } }, { $set: { Status: "active" } })

    return createJobModel(mappedJob, siteConfig.siteName);
}
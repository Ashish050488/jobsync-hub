import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { AbortController } from 'abort-controller';

import { analyzeJobWithGroq } from "../grokAnalyzer.js"; 
import { createJobModel } from '../models/jobModel.js';
import { createJobTestLog } from '../models/Jobtestlogmodel.js';
import { saveJobTestLog } from '../Db/databaseManager.js';
import { Analytics } from '../models/analyticsModel.js';
import { BANNED_ROLES } from '../utils.js';

function isSpamOrIrrelevant(title) {
    const lowerTitle = title.toLowerCase();
    return BANNED_ROLES.some(role => lowerTitle.includes(role));
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

    // Extract job data
    let mappedJob;
    if (siteConfig.extractJobID) {
        mappedJob = {
            JobID: siteConfig.extractJobID(rawJob),
            JobTitle: siteConfig.extractJobTitle(rawJob),
            Company: siteConfig.extractCompany(rawJob),
            Location: siteConfig.extractLocation(rawJob),
            Description: siteConfig.extractDescription(rawJob),
            ApplicationURL: siteConfig.extractURL(rawJob),
            DatePosted: siteConfig.extractPostedDate ? siteConfig.extractPostedDate(rawJob) : new Date().toISOString(),
        };
    } else {
        mappedJob = siteConfig.mapper(rawJob);
    }

    // 2. Duplicate Check
    if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
        return null;
    }

    await Analytics.increment('jobsScraped');

    // 3. Title Filter
    if (isSpamOrIrrelevant(mappedJob.JobTitle)) {
        console.log(`[Pre-Filter] Rejected: ${mappedJob.JobTitle}`);
        return null;
    }

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

    await Analytics.increment('jobsSentToAI');

    // ✅ 6. AI CLASSIFICATION - GERMAN ONLY (NO LOCATION CHECK)
    const aiResult = await analyzeJobWithGroq(mappedJob.JobTitle, mappedJob.Description);

    if (!aiResult) {
        console.log(`[AI] Failed to analyze ${mappedJob.JobTitle}. Skipping.`);
        return null;
    }

    // ✅ 7. FILTERING LOGIC - ONLY CHECK GERMAN REQUIREMENT
    let finalDecision = "accepted";
    let rejectionReason = null;
    
    if (aiResult.german_required === true) {
        finalDecision = "rejected";
        rejectionReason = "German language required";
        console.log(`❌ [Rejected - German Required] ${mappedJob.JobTitle}`);
    } else {
        console.log(`✅ [Valid Job] ${mappedJob.JobTitle} (Confidence: ${aiResult.confidence})`);
    }
    
    // ✅ 8. SAVE TO TEST LOG
    const testLogData = {
        ...mappedJob,
        GermanRequired: aiResult.german_required,
        Domain: aiResult.domain,
        SubDomain: aiResult.sub_domain,
        ConfidenceScore: aiResult.confidence,
        Evidence: aiResult.evidence,  // ✅ Only contains german_reason
        FinalDecision: finalDecision,
        RejectionReason: rejectionReason,
        Status: finalDecision === "accepted" ? "pending_review" : "rejected"
    };
    
    const jobTestLog = createJobTestLog(testLogData, siteConfig.siteName);
    await saveJobTestLog(jobTestLog);
    console.log(`📝 [Test Log] Saved ${finalDecision} job: ${mappedJob.JobTitle}`);
    
    // ✅ 9. RETURN NULL IF REJECTED
    if (finalDecision === "rejected") {
        return null;
    }

    await Analytics.increment('jobsPendingReview');

    // 10. Create Model
    mappedJob.GermanRequired = aiResult.german_required;
    mappedJob.Domain = aiResult.domain;
    mappedJob.SubDomain = aiResult.sub_domain;
    mappedJob.ConfidenceScore = aiResult.confidence;
    mappedJob.Status = "pending_review";

    return createJobModel(mappedJob, siteConfig.siteName);
}
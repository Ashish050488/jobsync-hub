export async function deleteExpiredJobs(siteName, seenJobIds) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    // seenJobIds is a Set of all JobID strings found in the current scrape
    // Any job in DB for this site whose JobID is NOT in this set has been removed from the ATS
    const seenArray = Array.from(seenJobIds);

    const result = await jobsCollection.deleteMany({
        sourceSite: siteName,
        JobID: { $nin: seenArray }
    });

    if (result.deletedCount > 0) {
        console.log(`[${siteName}] Deleted ${result.deletedCount} expired jobs (no longer on ATS).`);
    }
}
import { createJobModel } from '../models/jobModel.js';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { MONGO_URI } from '../env.js';
import { SITES_CONFIG } from '../config.js';
import { cleanJobDescription } from '../core/cleanJobDescription.js';
import { generateJobTags, getPlainTextForTagging } from '../core/generateJobTags.js';

export const client = new MongoClient(MONGO_URI);
let db;

export async function connectToDb() {
    if (db) return db;

    await client.connect();

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
        console.log("🍃 Mongoose Connected");
    }

    db = client.db();
    console.log("🗄️  Successfully connected to MongoDB.");
    return db;
}

export async function loadAllExistingIDs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const existingIDsMap = new Map();
    for (const siteConfig of SITES_CONFIG) {
        const siteName = siteConfig.siteName;
        const idSet = new Set();
        const jobs = await jobsCollection.find({ sourceSite: siteName }, { projection: { JobID: 1 } }).toArray();
        jobs.forEach(job => idSet.add(job.JobID));
        existingIDsMap.set(siteName, idSet);
        console.log(`[${siteName}] Found ${idSet.size} existing jobs in the database.`);
    }
    return existingIDsMap;
}

export async function saveJobs(jobs) {
    if (jobs.length === 0) return;
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    const dedupedJobs = [];
    const seenJobIds = new Set();
    for (const job of jobs) {
        if (!job?.JobID || seenJobIds.has(job.JobID)) continue;
        seenJobIds.add(job.JobID);
        dedupedJobs.push(job);
    }

    const operations = dedupedJobs.map(inputJob => {
        const job = { ...inputJob };

        if (job.Description) {
            job.DescriptionCleaned = cleanJobDescription(job.Description, job.Company);
            job.DescriptionPlain = getPlainTextForTagging(job);
            const autoTags = generateJobTags(job);
            job.autoTags = autoTags;
            job.isEntryLevel = autoTags.isEntryLevel;
        }

        const { createdAt, updatedAt, ...pureJobData } = job;
        return {
            updateOne: {
                filter: { JobID: job.JobID },
                update: {
                    $setOnInsert: {
                        ...pureJobData,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        scrapedAt: new Date()
                    }
                },
                upsert: true,
            },
        };
    });

    if (operations.length === 0) return;
    await jobsCollection.bulkWrite(operations, { ordered: false });
}

export async function saveJobTestLog(jobTestLog) {
    if (!jobTestLog) return;
    const db = await connectToDb();
    const testLogsCollection = db.collection('jobTestLogs');

    const { createdAt, ...pureJobData } = jobTestLog;

    await testLogsCollection.updateOne(
        { JobID: jobTestLog.JobID, sourceSite: jobTestLog.sourceSite },
        {
            $set: {
                ...pureJobData,
                scrapedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
    );
}

export async function deleteOldJobs(siteName, scrapeStartTime) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await jobsCollection.deleteMany({
        sourceSite: siteName,
        updatedAt: { $lt: sevenDaysAgo }
    });

    if (result.deletedCount > 0) {
        console.log(`[${siteName}] Deleted ${result.deletedCount} jobs older than 7 days.`);
    }
}

export async function deleteJobById(jobId) {
    try {
        const db = await connectToDb();
        const jobsCollection = db.collection('jobs');
        await jobsCollection.deleteOne({ _id: jobId });
    } catch (error) {
        console.error(`Error deleting job ${jobId}:`, error);
    }
}



export async function addCuratedJob(jobData) {
    if (!jobData.JobTitle || !jobData.ApplicationURL || !jobData.Company) {
        throw new Error('Job Title, URL, and Company are required.');
    }
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const existingJob = await jobsCollection.findOne({ ApplicationURL: jobData.ApplicationURL });
    if (existingJob) {
        throw new Error('This Application URL already exists in the database.');
    }
    const jobID = `curated-${new Date().getTime()}`;

    const jobToSave = createJobModel({
        JobID: jobID,
        JobTitle: jobData.JobTitle,
        ApplicationURL: jobData.ApplicationURL,
        Company: jobData.Company,
        Location: jobData.Location,
        Department: jobData.Department,
        Description: jobData.Description || `Manually curated: ${jobData.JobTitle}`,
        PostedDate: jobData.PostedDate || new Date().toISOString(),
        ContractType: jobData.ContractType,
        ExperienceLevel: jobData.ExperienceLevel,
        isManual: true,
        Status: 'active'
    }, "Curated");

    await saveJobs([jobToSave]);
    return jobToSave;
}

export async function getAllJobs(page = 1, limit = 50) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;
    const totalJobs = await jobsCollection.countDocuments();
    const jobs = await jobsCollection.find({})
        .sort({ PostedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    return {
        jobs,
        totalJobs,
        totalPages: Math.ceil(totalJobs / limit),
        currentPage: page
    };
}

export async function getPublicBaitJobs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    const jobs = await jobsCollection.find({
        Status: 'active'
    })
        .sort({ PostedDate: -1, createdAt: -1 })
        .limit(9)
        .project({
            JobTitle: 1, Company: 1, Location: 1, Department: 1,
            PostedDate: 1, ApplicationURL: 1
        })
        .toArray();
    return jobs;
}



export async function getJobsPaginated(
    page = 1,
    limit = 50,
    companyFilter = null,
    platformFilter = null,
    remoteFilter = null,
    entryLevelFilter = null,
    roleCategoryFilter = null,
    experienceBandFilter = null,
    techStackFilter = [],
    dateFilter = null,
    searchFilter = null,
) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    // ── Base: only active jobs ──────────────────────────────────────────────
    const must = [{ Status: 'active' }];

    // ── Company ─────────────────────────────────────────────────────────────
    if (companyFilter && companyFilter.trim()) {
        must.push({ Company: { $regex: companyFilter.trim(), $options: 'i' } });
    }

    // ── ATS Platform ────────────────────────────────────────────────────────
    if (platformFilter && platformFilter.trim()) {
        must.push({ ATSPlatform: platformFilter.trim().toLowerCase() });
    }

    // ── Remote / Workplace ──────────────────────────────────────────────────
    // Matches on WorkplaceType field OR the word "remote" anywhere in Location/Title.
    // Uses $or so either signal is sufficient.
    if (remoteFilter) {
        must.push({
            $or: [
                { WorkplaceType: { $regex: 'remote', $options: 'i' } },
                { Location: { $regex: 'remote', $options: 'i' } },
                { JobTitle: { $regex: 'remote', $options: 'i' } },
                { IsRemote: true },
            ],
        });
    }

    // ── Role Category ────────────────────────────────────────────────────────
    if (roleCategoryFilter && roleCategoryFilter.trim()) {
        must.push({ 'autoTags.roleCategory': roleCategoryFilter.trim() });
    }

    // ── Experience Band ──────────────────────────────────────────────────────
    // For Fresher (0-1y) we also accept jobs tagged isEntryLevel=true (belt-and-suspenders).
    if (experienceBandFilter && experienceBandFilter.trim()) {
        const isFresher =
            experienceBandFilter === 'Fresher (0-1y)' ||
            experienceBandFilter === 'fresher' ||
            experienceBandFilter === 'Entry Level';

        if (isFresher) {
            must.push({
                $or: [
                    { 'autoTags.experienceBand': experienceBandFilter.trim() },
                    { isEntryLevel: true },
                ],
            });
        } else {
            must.push({ 'autoTags.experienceBand': experienceBandFilter.trim() });
        }
    } else if (entryLevelFilter) {
        // entryLevel checkbox without a specific band — match either signal
        must.push({
            $or: [
                { isEntryLevel: true },
                { 'autoTags.experienceBand': 'Fresher (0-1y)' },
            ],
        });
    }

    // ── Tech Stack ───────────────────────────────────────────────────────────
    if (Array.isArray(techStackFilter) && techStackFilter.length > 0) {
        const cleanedStack = techStackFilter.map(t => t.trim()).filter(Boolean);
        if (cleanedStack.length > 0) {
            must.push({ 'autoTags.techStack': { $all: cleanedStack } });
        }
    }

    // ── Date Filter ──────────────────────────────────────────────────────────
    if (dateFilter) {
        const daysMap = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 };
        const days = daysMap[dateFilter];
        if (days) {
            const since = new Date(Date.now() - days * 86400000);
            must.push({
                $or: [
                    { PostedDate: { $gte: since.toISOString() } },
                    { scrapedAt: { $gte: since } },
                ],
            });
        }
    }

    // ── Full-text search ─────────────────────────────────────────────────────
    // Searches title, company, location, techStack tags.
    if (searchFilter && searchFilter.trim().length >= 2) {
        const escaped = searchFilter.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = { $regex: escaped, $options: 'i' };
        must.push({
            $or: [
                { JobTitle: re },
                { Company: re },
                { Location: re },
                { 'autoTags.techStack': re },
                { Department: re },
            ],
        });
    }

    // ── Compose final query ──────────────────────────────────────────────────
    const query = must.length === 1 ? must[0] : { $and: must };

    const [totalJobs, jobs, companies] = await Promise.all([
        jobsCollection.countDocuments(query),
        jobsCollection.find(query)
            .sort({ PostedDate: -1, scrapedAt: -1 })
            .skip(skip)
            .limit(limit)
            .project({ __v: 0 })
            .toArray(),
        jobsCollection.distinct('Company', { Status: 'active' }),
    ]);

    return {
        jobs,
        totalJobs,
        totalPages: Math.ceil(totalJobs / limit),
        currentPage: page,
        companies,
    };
}

export async function getCompanyDirectoryStats() {
    try {
        const db = await connectToDb();

        const jobsCollection = db.collection('jobs');

        const pipeline = [
            {
                $match: {
                    Status: 'active'
                }
            },
            {
                $group: {
                    _id: "$Company",
                    openRoles: { $sum: 1 },
                    locations: { $addToSet: "$Location" },
                    sampleUrl: { $first: "$ApplicationURL" }
                }
            },
            { $sort: { openRoles: -1 } }
        ];
        const scrapedStats = await jobsCollection.aggregate(pipeline).toArray();

        const formattedScraped = scrapedStats.map(stat => ({
            _id: stat._id,
            companyName: stat._id || "Unknown",
            openRoles: stat.openRoles,
            cities: [...new Set((stat.locations || []).map(l => l.split(',')[0].trim()))].slice(0, 2),
            domain: stat._id.toLowerCase().replace(/[^a-z0-9-]/g, '') + ".com",
            source: 'scraped'
        }));

        const manualCollection = db.collection('manual_companies');
        const manualCompanies = await manualCollection.find({}).toArray();

        const formattedManual = manualCompanies.map(c => ({
            _id: c._id.toString(),
            companyName: c.name,
            openRoles: 0,
            cities: c.cities ? c.cities.split(',').map(s => s.trim()) : [],
            domain: c.domain,
            source: 'manual'
        }));

        const scrapedNames = new Set(formattedScraped.map(c => c.companyName.toLowerCase()));
        const uniqueManual = formattedManual.filter(c => !scrapedNames.has(c.companyName.toLowerCase()));

        return [...formattedScraped, ...uniqueManual];

    } catch (error) {
        console.error("Stats: Aggregation failed:", error);
        return [];
    }
}

export async function findJobById(id) {
    const db = await connectToDb();
    return await db.collection('jobs').findOne({ _id: new ObjectId(id) });
}

export async function deleteJobsByCompany(companyName) {
    const db = await connectToDb();
    console.log(`[Admin] Deleting all jobs for company: ${companyName}`);
    return await db.collection('jobs').deleteMany({
        Company: { $regex: new RegExp(`^${companyName}$`, 'i') }
    });
}

export async function addManualCompany(data) {
    const db = await connectToDb();
    const companiesCollection = db.collection('manual_companies');

    const exists = await companiesCollection.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, 'i') }
    });
    if (exists) throw new Error("Company already exists in manual list.");

    await companiesCollection.insertOne({
        ...data,
        createdAt: new Date()
    });
}

export async function deleteManualCompany(id) {
    const db = await connectToDb();
    const companiesCollection = db.collection('manual_companies');
    await companiesCollection.deleteOne({ _id: new ObjectId(id) });
}

// ─── Company Intel (1-hour in-memory cache) ────────────────────────
const companyIntelCache = new Map();

export async function getCompanyIntel(companyName) {
    // Guard: empty or non-string input
    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return {
            companyName: '', totalOpenRoles: 0, newRolesThisWeek: 0, newRolesLastWeek: 0,
            avgRoleAgeDays: 0, oldestRoleDays: 0, newestRoleDays: 0, hiringTrend: 'stable',
            peakPostingDay: null, busiestDays: [], postingDayDistribution: [0, 0, 0, 0, 0, 0, 0]
        };
    }
    const cacheKey = companyName.trim().toLowerCase();
    const cached = companyIntelCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 3600000) return cached.data;

    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 86400000);
    const fourteenDaysAgo = new Date(now - 14 * 86400000);

    const escapedName = companyName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const jobs = await jobsCollection.find(
        { Company: { $regex: new RegExp(`^${escapedName}$`, 'i') }, Status: 'active' },
        { projection: { PostedDate: 1, createdAt: 1, scrapedAt: 1 } }
    ).toArray();

    const totalOpenRoles = jobs.length;
    const newRolesThisWeek = jobs.filter(j => new Date(j.createdAt || j.scrapedAt) >= sevenDaysAgo).length;
    const newRolesLastWeek = jobs.filter(j => {
        const d = new Date(j.createdAt || j.scrapedAt);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;

    const ages = jobs.map(j => Math.floor((now - new Date(j.PostedDate || j.createdAt || j.scrapedAt)) / 86400000)).filter(a => Number.isFinite(a) && a >= 0);
    const avgRoleAgeDays = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const oldestRoleDays = ages.length > 0 ? Math.max(...ages) : 0;
    const newestRoleDays = ages.length > 0 ? Math.min(...ages) : 0;

    let hiringTrend = 'stable';
    if (newRolesThisWeek > newRolesLastWeek) hiringTrend = 'up';
    else if (newRolesThisWeek < newRolesLastWeek) hiringTrend = 'down';

    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const job of jobs) {
        const posted = new Date(job.PostedDate || job.createdAt || job.scrapedAt);
        if (!isNaN(posted.getTime())) dayCounts[posted.getDay()]++;
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayPairs = dayCounts.map((count, i) => ({ day: dayNames[i], count }));
    dayPairs.sort((a, b) => b.count - a.count);
    const busiestDays = dayPairs.filter(d => d.count > 0).slice(0, 3).map(d => d.day);

    const data = {
        companyName: companyName.trim(), totalOpenRoles, newRolesThisWeek, newRolesLastWeek,
        avgRoleAgeDays, oldestRoleDays, newestRoleDays, hiringTrend,
        peakPostingDay: busiestDays[0] || null, busiestDays,
        postingDayDistribution: dayCounts,
    };
    companyIntelCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

// ─── Similar Jobs ───────────────────────────────────────────────────
export async function getSimilarJobs(jobId) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    let oid;
    try { oid = new ObjectId(jobId); } catch { return []; }

    const job = await jobsCollection.findOne({ _id: oid }, { projection: { Company: 1, autoTags: 1 } });
    if (!job) return [];

    // Build query — always filter by different company; match tags when available
    const query = { _id: { $ne: oid }, Status: 'active', Company: { $ne: job.Company || '' } };
    if (job.autoTags?.roleCategory) query['autoTags.roleCategory'] = job.autoTags.roleCategory;
    if (job.autoTags?.experienceBand) query['autoTags.experienceBand'] = job.autoTags.experienceBand;

    const results = await jobsCollection.find(query)
        .sort({ createdAt: -1, PostedDate: -1 })
        .limit(8)
        .project({ JobTitle: 1, Company: 1, Location: 1, ApplicationURL: 1, PostedDate: 1, autoTags: 1, scrapedAt: 1 })
        .toArray();

    // Fallback: if no tagged matches exist, return recent active jobs from other companies
    if (results.length === 0) {
        return jobsCollection.find({ _id: { $ne: oid }, Status: 'active', Company: { $ne: job.Company || '' } })
            .sort({ createdAt: -1 })
            .limit(8)
            .project({ JobTitle: 1, Company: 1, Location: 1, ApplicationURL: 1, PostedDate: 1, autoTags: 1, scrapedAt: 1 })
            .toArray();
    }
    return results;
}

// ─── Market Pulse (6-hour in-memory cache) ──────────────────────────
let marketPulseCache = null;

export async function getMarketPulse() {
    if (marketPulseCache && (Date.now() - marketPulseCache.timestamp) < 21600000) return marketPulseCache.data;

    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 86400000);
    const fourteenDaysAgo = new Date(now - 14 * 86400000);

    let currentCounts, thisWeekCounts, lastWeekCounts;
    try {
        [currentCounts, thisWeekCounts, lastWeekCounts] = await Promise.all([
            jobsCollection.aggregate([
                { $match: { Status: 'active', 'autoTags.roleCategory': { $exists: true, $ne: null, $type: 'string' } } },
                { $group: { _id: '$autoTags.roleCategory', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).toArray(),
            jobsCollection.aggregate([
                { $match: { Status: 'active', createdAt: { $gte: sevenDaysAgo }, 'autoTags.roleCategory': { $exists: true, $type: 'string' } } },
                { $group: { _id: '$autoTags.roleCategory', count: { $sum: 1 } } }
            ]).toArray(),
            jobsCollection.aggregate([
                { $match: { Status: 'active', createdAt: { $gte: fourteenDaysAgo, $lte: sevenDaysAgo }, 'autoTags.roleCategory': { $exists: true, $type: 'string' } } },
                { $group: { _id: '$autoTags.roleCategory', count: { $sum: 1 } } }
            ]).toArray(),
        ]);
    } catch (err) {
        console.error('[getMarketPulse] aggregation failed:', err);
        // Return stale cache if available rather than crashing
        if (marketPulseCache) return marketPulseCache.data;
        return { categories: [], totalJobs: 0, updatedAt: now.toISOString() };
    }

    const thisWeekMap = new Map(thisWeekCounts.map(r => [r._id, r.count]));
    const lastWeekMap = new Map(lastWeekCounts.map(r => [r._id, r.count]));

    const categories = currentCounts
        .filter(cat => cat._id && typeof cat._id === 'string')
        .map(cat => {
            const tw = thisWeekMap.get(cat._id) || 0;
            const lw = lastWeekMap.get(cat._id) || 0;
            let trendPercent = lw > 0 ? Math.round(((tw - lw) / lw) * 100) : (tw > 0 ? 100 : 0);
            // Cap extreme values for display
            trendPercent = Math.max(-200, Math.min(200, trendPercent));
            const trend = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable';
            return { category: cat._id, totalRoles: cat.count, newThisWeek: tw, trendPercent, trend };
        });

    const totalJobs = categories.reduce((sum, c) => sum + c.totalRoles, 0);
    const data = { categories, totalJobs, updatedAt: now.toISOString() };
    marketPulseCache = { data, timestamp: Date.now() };
    return data;
}

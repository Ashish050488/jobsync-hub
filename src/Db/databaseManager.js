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
) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    const query = { Status: 'active' };

    if (companyFilter) {
        query.Company = { $regex: companyFilter, $options: 'i' };
    }
    if (platformFilter) {
        query.ATSPlatform = platformFilter;
    }
    if (remoteFilter) {
        query.IsRemote = true;
    }
    if (entryLevelFilter && experienceBandFilter === 'Fresher (0-1y)') {
        query.$or = [
            { isEntryLevel: true },
            { 'autoTags.experienceBand': 'Fresher (0-1y)' }
        ];
    } else {
        if (entryLevelFilter) {
            query.isEntryLevel = true;
        }
        if (roleCategoryFilter) {
            query['autoTags.roleCategory'] = roleCategoryFilter;
        }
        if (experienceBandFilter) {
            query['autoTags.experienceBand'] = experienceBandFilter;
        }
    }
    if (Array.isArray(techStackFilter) && techStackFilter.length > 0) {
        query['autoTags.techStack'] = { $all: techStackFilter };
    }

    const totalJobs = await jobsCollection.countDocuments(query);
    const jobs = await jobsCollection.find(query)
        .sort({ PostedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .project({ __v: 0 })
        .toArray();

    const companies = await jobsCollection.distinct('Company', { Status: 'active' });

    return { jobs, totalJobs, totalPages: Math.ceil(totalJobs / limit), currentPage: page, companies };
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


import { createJobModel } from '../models/jobModel.js';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { MONGO_URI } from '../env.js';
import { SITES_CONFIG } from '../config.js';
import { createUserModel } from '../models/userModel.js';
import bcrypt from 'bcryptjs';

export const client = new MongoClient(MONGO_URI);
let db;

export async function connectToDb() {
    if (db) return db;
    
    await client.connect();
    
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
        console.log("🍃 Mongoose Connected");
    }

    db = client.db("job-scraper");
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

    const operations = jobs.map(job => {
        const { createdAt, updatedAt, ...pureJobData } = job;
        return {
            updateOne: {
                filter: { JobID: job.JobID, sourceSite: job.sourceSite },
                update: {
                    $set: {
                        ...pureJobData,
                        updatedAt: new Date(),
                        scrapedAt: new Date()
                    },
                    $setOnInsert: { createdAt: new Date() }
                },
                upsert: true,
            },
        };
    });

    await jobsCollection.bulkWrite(operations);
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

export async function getSubscribedUsers() {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
   return await usersCollection.find({ 
        isSubscribed: true,
        isWaitlist: { $ne: true }
    }).toArray();
}

export async function findMatchingJobs(user) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    
    // ✅ REMOVED: LocationClassification check
    const query = {
        Status: 'active',
        GermanRequired: false,
        Department: { $in: user.desiredDomains },
        JobID: { $nin: user.sentJobIds },
    };
    
    if (user.desiredRoles && user.desiredRoles.length > 0) {
        query.$text = { $search: user.desiredRoles.join(' ') };
    }
    
    return await jobsCollection.find(query).sort({ scrapedAt: -1 }).limit(3).toArray();
}

export async function updateUserAfterEmail(userId, newSentJobIds) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
    await usersCollection.updateOne(
        { _id: userId },
        {
            $set: { lastEmailSent: new Date() },
            $push: { sentJobIds: { $each: newSentJobIds } }
        }
    );
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
    
    // ✅ REMOVED: LocationClassification
    const jobToSave = createJobModel({
        JobID: jobID,
        JobTitle: jobData.JobTitle,
        ApplicationURL: jobData.ApplicationURL,
        Company: jobData.Company,
        Location: jobData.Location,
        Department: jobData.Department,
        GermanRequired: jobData.GermanRequired ?? false,
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
    
    // ✅ REMOVED: LocationClassification check
    const jobs = await jobsCollection.find({
        Status: 'active',
        GermanRequired: false
    })
        .sort({ PostedDate: -1, createdAt: -1 })
        .limit(9)
        .project({
            JobTitle: 1, Company: 1, Location: 1, Department: 1,
            PostedDate: 1, ApplicationURL: 1, GermanRequired: 1
        })
        .toArray();
    return jobs;
}

export async function addSubscriber(data) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
    const newUser = createUserModel({
        email: data.email,
        desiredDomains: data.categories,
        emailFrequency: data.frequency,
        name: data.email.split('@')[0],
        createdAt: new Date()
    });
    await usersCollection.updateOne(
        { email: newUser.email },
        {
            $set: {
                desiredDomains: newUser.desiredDomains,
                emailFrequency: newUser.emailFrequency,
                isSubscribed: true,
                updatedAt: new Date()
            },
            $setOnInsert: {
                createdAt: new Date(),
                subscriptionTier: "free",
                sentJobIds: []
            }
        },
        { upsert: true }
    );
    return { success: true, email: newUser.email };
}

export async function getJobsPaginated(page = 1, limit = 50, companyFilter = null) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    // ✅ REMOVED: LocationClassification check
    const query = {
        Status: 'active',
        thumbStatus: { $ne: 'down' },
        GermanRequired: false
    };

    if (companyFilter) {
        query.Company = { $regex: companyFilter, $options: 'i' };
    }

    const totalJobs = await jobsCollection.countDocuments(query);
    const jobs = await jobsCollection.find(query)
        .sort({ PostedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

    const companies = await jobsCollection.distinct('Company', { Status: 'active' });

    return { jobs, totalJobs, companies };
}

export async function getRejectedJobs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    return await jobsCollection.find({ 
        $or: [{ Status: 'rejected' }, { thumbStatus: 'down' }] 
    })
        .sort({ updatedAt: -1 })
        .toArray();
}

export async function getJobsForReview(page = 1, limit = 50) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    const query = { Status: 'pending_review' };

    const totalJobs = await jobsCollection.countDocuments(query);
    const jobs = await jobsCollection.find(query)
        .sort({ ConfidenceScore: -1, scrapedAt: -1 })
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

export async function reviewJobDecision(jobId, decision) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    let newStatus = 'pending_review';
    if (decision === 'accept') newStatus = 'active';
    if (decision === 'reject') newStatus = 'rejected';

    await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
            $set: {
                Status: newStatus,
                reviewedAt: new Date()
            }
        }
    );
    return { success: true, status: newStatus };
}

export async function updateJobFeedback(jobId, status) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { $set: { thumbStatus: status, updatedAt: new Date() } }
    );
}

export async function getCompanyDirectoryStats() {
    try {
        const db = await connectToDb();

        const jobsCollection = db.collection('jobs');
        
        // ✅ REMOVED: LocationClassification check
        const pipeline = [
            { 
                $match: { 
                    Status: 'active', 
                    thumbStatus: { $ne: 'down' },
                    GermanRequired: false
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

export async function registerUser({ email, password, name, role = 'user', location, domain, isWaitlist }) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
        throw new Error("User already exists");
    }

    let hashedPassword = null;
    if (password) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
    }

    const newUser = createUserModel({
        email,
        password: hashedPassword,
        name,
        role,
        location,
        domain,
        isWaitlist,
        createdAt: new Date()
    });

    await usersCollection.insertOne(newUser);
    
    return { 
        id: newUser._id, 
        email: newUser.email, 
        role: newUser.role, 
        name: newUser.name 
    };
}

export async function loginUser(email, password) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });
    if (!user) {
        throw new Error("Invalid credentials");
    }

    if (!user.password) {
        throw new Error("Please register an account first.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    return { id: user._id, email: user.email, role: user.role, name: user.name };
}

export async function getUserProfile(userId) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
    return await usersCollection.findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } });
}
import fetch from 'node-fetch';
import { connectToDb, deleteJobById } from "../Db/databaseManager.js";
import { ObjectId } from 'mongodb';

let isValidating = false;

async function checkUrlStatus(url) {
    try {
        const response = await fetch(url, { 
            method: 'HEAD',
            timeout: 10000 
        });
        return response.status;
    } catch (error) {
        if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
            console.warn(`[Validator] Timeout checking URL: ${url}`);
            return 504;
        }
        console.error(`[Validator] Network error for ${url}:`, error.message);
        return 500;
    }
}

export async function runValidator() {
    if (isValidating) {
        console.log('Validator is already running. Skipping this scheduled run.');
        return;
    }
    isValidating = true;
    console.log("🏃‍♂️ Starting the Job Validator task...");
    
    try {
        const db = await connectToDb();
        const jobsCollection = db.collection('jobs');
        const allJobs = await jobsCollection.find({}, { 
            projection: { _id: 1, ApplicationURL: 1, JobTitle: 1 } 
        }).toArray();

        console.log(`[Validator] Checking ${allJobs.length} total jobs...`);
        let deletedCount = 0;

        for (const job of allJobs) {
            const status = await checkUrlStatus(job.ApplicationURL);
            if (status === 404 || status === 410) {
                console.log(`[Validator] ❌ Job is dead (404): "${job.JobTitle}". Deleting...`);
                await deleteJobById(job._id);
                deletedCount++;
            } else if (status >= 400) {
                console.warn(`[Validator] ⚠️ Warning: Got status ${status} for "${job.JobTitle}". Not deleting.`);
            }
        }
        console.log(`\n✅ Validator finished. Deleted ${deletedCount} dead jobs.`);
    } catch (error) {
        console.error("An error occurred during the validation task:", error);
    } finally {
        isValidating = false;
        console.log("Validation task finished.");
    }
}

export async function findJobByUrl(applicationUrl) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    return await jobsCollection.findOne({ ApplicationURL: applicationUrl });
}
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
    getJobsPaginated,
    addCuratedJob,
    deleteJobById,
    getPublicBaitJobs,
    updateJobFeedback,
    getRejectedJobs,
    getCompanyDirectoryStats,
    getJobsForReview,
    reviewJobDecision,
    findJobById,
    deleteJobsByCompany,
    addManualCompany,
    deleteManualCompany,
    connectToDb
} from '../Db/databaseManager.js';

import { analyzeJobWithGroq } from '../grokAnalyzer.js';
// ✅ FIXED: Import the correct middleware names
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

export const jobsApiRouter = Router();

// ---------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------

jobsApiRouter.get('/public-bait', async (req, res) => {
    try {
        const jobs = await getPublicBaitJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: "Failed to load bait jobs" });
    }
});

jobsApiRouter.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const company = req.query.company || null;
        const data = await getJobsPaginated(page, limit, company);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch jobs" });
    }
});

jobsApiRouter.get('/directory', async (req, res) => {
    try {
        const directory = await getCompanyDirectoryStats();
        res.status(200).json(directory);
    } catch (error) {
        res.status(500).json({ error: "Failed to load directory" });
    }
});

// ---------------------------------------------------------
// ADMIN ROUTES
// ---------------------------------------------------------

jobsApiRouter.get('/admin/review', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const data = await getJobsForReview(page, limit);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to load review queue" });
    }
});

jobsApiRouter.patch('/admin/decision/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { decision } = req.body;
        if (!['accept', 'reject'].includes(decision)) return res.status(400).json({ error: "Invalid decision" });
        await reviewJobDecision(id, decision);
        res.status(200).json({ message: `Job ${decision}ed successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.get('/rejected', async (req, res) => {
    try {
        const jobs = await getRejectedJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.patch('/:id/feedback', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await updateJobFeedback(id, status);
        res.status(200).json({ message: 'Feedback updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/:id/analyze', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await findJobById(id);
        if (!job) return res.status(404).json({ error: "Job not found" });

        const aiResult = await analyzeJobWithGroq(job.JobTitle, job.Description, job.Location);
        if (!aiResult) return res.status(500).json({ error: "AI Analysis failed" });

        let newStatus = "pending_review";
        let rejectionReason = null;

        if (aiResult.location_classification !== "Germany") {
            newStatus = "rejected";
            rejectionReason = "Location not Germany";
        } else if (aiResult.english_speaking !== true) {
            newStatus = "rejected";
            rejectionReason = "Not English-speaking";
        } else if (aiResult.german_required === true) {
            newStatus = "rejected";
            rejectionReason = "German Language Required";
        }

        const db = await connectToDb();
        
        await db.collection('jobs').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    EnglishSpeaking: aiResult.english_speaking,
                    GermanRequired: aiResult.german_required,
                    LocationClassification: aiResult.location_classification,
                    Domain: aiResult.domain,
                    SubDomain: aiResult.sub_domain,
                    ConfidenceScore: aiResult.confidence,
                    Status: newStatus,
                    RejectionReason: rejectionReason,
                    updatedAt: new Date()
                } 
            }
        );

        res.status(200).json({ 
            message: "Job re-analyzed", 
            newStatus, 
            english: aiResult.english_speaking,
            german: aiResult.german_required,
            location: aiResult.location_classification 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/companies', async (req, res) => {
    try {
        const { name, domain, cities } = req.body;
        if (!name) return res.status(400).json({ error: "Company Name is required" });
        await addManualCompany({ name, domain, cities });
        res.status(201).json({ message: "Company added." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.delete('/company', async (req, res) => {
    try {
        const { name } = req.query;
        if (name) {
            const result = await deleteJobsByCompany(name);
            return res.status(200).json({ message: `Deleted ${result.deletedCount} jobs for ${name}.` });
        }
        res.status(400).json({ error: "Name required" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.delete('/companies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteManualCompany(id);
        res.status(200).json({ message: "Manual company deleted." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/', async (req, res) => {
    try {
        const jobData = req.body;
        const newJob = await addCuratedJob(jobData); 
        res.status(201).json(newJob);
    } catch (error) {
        if (error.message.includes('duplicate URL')) return res.status(409).json({ error: error.message });
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
        await deleteJobById(new ObjectId(id));
        res.status(200).json({ message: 'Job deleted.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ TEST LOGS ROUTE - With correct auth middleware and collection name
jobsApiRouter.get('/test-logs', verifyToken, verifyAdmin, async (req, res) => {
    console.log('[API] test-logs route hit');
    try {
        const db = await connectToDb();
        console.log('[API] DB connected');
        
        // ✅ FIXED: Lowercase 'j' to match your databaseManager.js
        const logs = await db.collection('jobTestLogs')
            .find({})
            .sort({ scrapedAt: -1 })
            .limit(500)
            .toArray();
        
        console.log('[API] Found logs:', logs.length);
        res.status(200).json(logs);
    } catch (error) {
        console.error('[API] Error fetching test logs:', error);
        res.status(500).json({ error: 'Failed to fetch test logs', details: error.message });
    }
});
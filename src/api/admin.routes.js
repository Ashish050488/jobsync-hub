import { Router } from 'express';
import { connectToDb } from '../Db/databaseManager.js';
import { cleanJobDescription } from '../core/cleanJobDescription.js';

const adminRouter = Router();

adminRouter.post('/reclean-descriptions', async (_req, res) => {
    try {
        const db = await connectToDb();
        const jobsCollection = db.collection('jobs');

        const query = {
            Description: { $exists: true, $ne: null },
            $or: [
                { DescriptionCleaned: { $exists: false } },
                { DescriptionCleaned: null },
                { $expr: { $eq: ['$DescriptionCleaned', '$Description'] } },
                { DescriptionCleaned: { $regex: '&lt;', $options: 'i' } },
            ],
        };

        const total = await jobsCollection.countDocuments(query);
        const cursor = jobsCollection.find(query, { projection: { _id: 1, Description: 1 } });

        let updated = 0;
        let skipped = 0;
        let errored = 0;
        const errors = [];

        for await (const job of cursor) {
            try {
                if (!job.Description || typeof job.Description !== 'string') {
                    skipped += 1;
                    continue;
                }

                const cleaned = cleanJobDescription(job.Description);

                if (!cleaned || cleaned === job.Description) {
                    skipped += 1;
                    continue;
                }

                const result = await jobsCollection.updateOne(
                    { _id: job._id },
                    { $set: { DescriptionCleaned: cleaned, updatedAt: new Date() } },
                );

                if (result.modifiedCount > 0) updated += 1;
                else skipped += 1;
            } catch (err) {
                errored += 1;
                errors.push({ id: String(job._id), error: err?.message || 'Unknown error' });
            }
        }

        return res.json({
            success: true,
            total,
            updated,
            skipped,
            errored,
            errors,
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err?.message || 'Failed to re-clean descriptions' });
    }
});

export default adminRouter;

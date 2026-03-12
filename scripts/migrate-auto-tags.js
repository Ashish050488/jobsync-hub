import { connectToDb } from '../src/Db/databaseManager.js';
import { generateJobTags, getPlainTextForTagging } from '../src/core/generateJobTags.js';

const BATCH_SIZE = 200;

async function run() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const cursor = jobsCollection.find({}, { projection: { _id: 1, JobTitle: 1, Company: 1, Department: 1, Description: 1, DescriptionPlain: 1, DescriptionCleaned: 1 } });

    let processed = 0;
    let updated = 0;
    let failed = 0;
    let batch = [];

    while (await cursor.hasNext()) {
        const job = await cursor.next();
        if (!job) continue;
        processed += 1;

        try {
            const autoTags = generateJobTags(job);
            const descriptionPlain = getPlainTextForTagging(job);
            batch.push({
                updateOne: {
                    filter: { _id: job._id },
                    update: {
                        $set: {
                            autoTags,
                            isEntryLevel: autoTags.isEntryLevel,
                            DescriptionPlain: descriptionPlain || null,
                            updatedAt: new Date(),
                        },
                    },
                },
            });
        } catch (error) {
            failed += 1;
            console.error(`[auto-tags] Failed for ${job._id}:`, error.message);
        }

        if (batch.length >= BATCH_SIZE) {
            const result = await jobsCollection.bulkWrite(batch, { ordered: false });
            updated += result.modifiedCount + result.upsertedCount;
            console.log(`[auto-tags] Processed ${processed} jobs, updated ${updated}, failed ${failed}`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        const result = await jobsCollection.bulkWrite(batch, { ordered: false });
        updated += result.modifiedCount + result.upsertedCount;
    }

    console.log(`[auto-tags] Complete. Processed ${processed} jobs, updated ${updated}, failed ${failed}`);
    process.exit(0);
}

run().catch(error => {
    console.error('[auto-tags] Migration failed:', error);
    process.exit(1);
});

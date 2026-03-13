import { connectToDb } from '../src/Db/databaseManager.js';
import { cleanJobDescription } from '../src/core/cleanJobDescription.js';
import { generateJobTags, getPlainTextForTagging } from '../src/core/generateJobTags.js';

async function run() {
    console.log('[migrate-clean-descriptions] Connecting to database...');
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    const query = {
        Description: { $exists: true, $nin: [null, ''] }
    };

    const total = await jobsCollection.countDocuments(query);
    const cursor = jobsCollection.find(query, {
        projection: { _id: 1, Description: 1, Company: 1 }
    });

    let processed = 0;
    let errors = 0;

    while (await cursor.hasNext()) {
        const job = await cursor.next();
        if (!job) break;

        try {
            const cleaned = cleanJobDescription(job.Description, job.Company);
            const descriptionPlain = getPlainTextForTagging({
                Description: job.Description,
                DescriptionCleaned: cleaned,
            });
            const autoTags = generateJobTags({
                ...job,
                Description: job.Description,
                DescriptionCleaned: cleaned,
                DescriptionPlain: descriptionPlain,
            });

            await jobsCollection.updateOne(
                { _id: job._id },
                {
                    $set: {
                        DescriptionCleaned: cleaned,
                        DescriptionPlain: descriptionPlain || null,
                        autoTags,
                        isEntryLevel: autoTags.isEntryLevel,
                        updatedAt: new Date(),
                    },
                }
            );
        } catch (error) {
            errors += 1;
            console.error(`[migrate-clean-descriptions] Failed job ${job._id}: ${error.message}`);
        }

        processed += 1;
        if (processed % 50 === 0 || processed === total) {
            console.log(`Processed ${processed}/${total} jobs...`);
        }
    }

    console.log(`[migrate-clean-descriptions] Done. Processed=${processed}, Errors=${errors}`);
    process.exit(errors > 0 ? 1 : 0);
}

run().catch(error => {
    console.error('[migrate-clean-descriptions] Fatal error:', error);
    process.exit(1);
});
/**
 * migrateDescriptions.js
 *
 * One-time migration: runs cleanJobDescription() on every existing job
 * that has a Description but no DescriptionCleaned yet, and saves the result.
 *
 * Usage:
 *   node src/tasks/migrateDescriptions.js
 */

import { connectToDb } from '../Db/databaseManager.js';
import { cleanJobDescription } from '../core/cleanJobDescription.js';

async function run() {
    console.log('[migrate] Connecting to database...');
    const db = await connectToDb();
    const col = db.collection('jobs');

    // Only process jobs that have a Description but haven't been cleaned yet
    const cursor = col.find(
        { Description: { $exists: true, $ne: null, $ne: '' }, DescriptionCleaned: { $in: [null, undefined] } },
        { projection: { _id: 1, Description: 1 } }
    );

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    while (await cursor.hasNext()) {
        const job = await cursor.next();
        try {
            const cleaned = cleanJobDescription(job.Description);
            await col.updateOne(
                { _id: job._id },
                { $set: { DescriptionCleaned: cleaned } }
            );
            processed++;
            if (processed % 50 === 0) {
                console.log(`[migrate] Processed ${processed} jobs...`);
            }
        } catch (err) {
            console.error(`[migrate] Error on job ${job._id}:`, err.message);
            errors++;
        }
    }

    console.log(`[migrate] Done. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
    process.exit(0);
}

run().catch(err => {
    console.error('[migrate] Fatal error:', err);
    process.exit(1);
});

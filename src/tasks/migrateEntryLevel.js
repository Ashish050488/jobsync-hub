/**
 * One-time migration: tag all existing jobs with isEntryLevel.
 *
 * Usage:  node src/tasks/migrateEntryLevel.js
 */

import { connectToDb } from '../Db/databaseManager.js';
import { tagEntryLevel } from '../core/entryLevelTagger.js';

async function run() {
    const db = await connectToDb();
    const col = db.collection('jobs');

    const cursor = col.find({ Status: 'active' });
    let total = 0, tagged = 0;

    while (await cursor.hasNext()) {
        const job = await cursor.next();
        total++;
        const flag = tagEntryLevel(job);
        if (job.isEntryLevel !== flag) {
            await col.updateOne({ _id: job._id }, { $set: { isEntryLevel: flag } });
        }
        if (flag) tagged++;
        if (total % 200 === 0) console.log(`  processed ${total}...`);
    }

    console.log(`\nDone. ${total} jobs processed, ${tagged} tagged as entry-level.`);
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });

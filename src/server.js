import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { client, connectToDb } from './Db/databaseManager.js';
import { runScraper } from './tasks/runScraper.js';
import { jobsApiRouter } from './api/jobs.routes.js';
import usersRouter from './api/users.routes.js';
import { ensureUserIndexes } from './models/userModel.js';

// --- Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- API Routes ---
app.use('/api/jobs', jobsApiRouter);
app.use('/api/users', usersRouter);

// --- Health Check Endpoint ---
app.get('/', (req, res) => {
    res.send('Job Scraper Backend is running and healthy.');
});

// --- Start Server & Schedule Tasks ---
app.listen(PORT, async () => {
    try {
        await connectToDb();
        await ensureUserIndexes();
        console.log(`API Server is running on http://localhost:${PORT}`);

        // Run the scraper every day at 6:00 AM
        cron.schedule('0 6 * * *', () => {
            console.log('--- Cron Job: Running Scraper ---');
            runScraper();
        });

        console.log('Cron tasks are scheduled.');

        // Run the scraper once on start
        console.log('--- Running initial scrape on start... ---');
        runScraper();

    } catch (err) {
        console.error('Failed to start server or connect to DB', err);
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server and database connection...');
    await client.close();
    process.exit(0);
});

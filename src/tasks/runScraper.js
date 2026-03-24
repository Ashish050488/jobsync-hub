import { SITES_CONFIG } from '../config.js';
import { loadAllExistingIDs, deleteOldJobs, deleteExpiredJobs } from '../Db/databaseManager.js';
import { scrapeSite } from '../core/scraperEngine.js';

let isScraping = false; 

export const runScraper = async function () {
    if (isScraping) {
        console.log('Scraper is already running. Skipping this scheduled run.');
        return;
    }
    isScraping = true;
    console.log("🚀 Starting scheduled scrape task...");
    
    try {
        const existingIDsMap = await loadAllExistingIDs();

        for (const siteConfig of SITES_CONFIG) {
            if (!siteConfig || !siteConfig.siteName) continue;

            const scrapeStartTime = new Date();

            const { newJobs, seenJobIds, scrapedSuccessfully } = await scrapeSite(siteConfig, existingIDsMap);

            console.log(`[${siteConfig.siteName}] Found ${newJobs.length} new jobs.`);

            if (scrapedSuccessfully && seenJobIds.size > 0) {
                // Scrape completed cleanly — delete anything not seen in this run
                await deleteExpiredJobs(siteConfig.siteName, seenJobIds);
            } else {
                // Scrape errored or returned nothing — fall back to 7-day cleanup
                // to avoid wrongly deleting valid jobs from an incomplete scrape
                console.log(`[${siteConfig.siteName}] Scrape incomplete or errored — using 7-day fallback cleanup.`);
                await deleteOldJobs(siteConfig.siteName, scrapeStartTime);
            }
        }
        
        console.log("\n✅ All scraping complete.");
    } catch (error) {
        console.error("An error occurred during the scheduled scrape:", error);
    } finally {
        isScraping = false;
        console.log("Scrape task finished.");
    }
}
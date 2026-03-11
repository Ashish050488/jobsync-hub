import { SITES_CONFIG } from '../config.js';
import { loadAllExistingIDs, deleteOldJobs } from '../Db/databaseManager.js';
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
            
            // scrapeSite handles processing and saving internally
            const newJobs = await scrapeSite(siteConfig, existingIDsMap);
            
            console.log(`[${siteConfig.siteName}] Found ${newJobs.length} new jobs.`);
            await deleteOldJobs(siteConfig.siteName, scrapeStartTime);
        }
        
        console.log("\n✅ All scraping complete.");
    } catch (error) {
        console.error("An error occurred during the scheduled scrape:", error);
    } finally {
        isScraping = false;
        console.log("Scrape task finished.");
    }
}
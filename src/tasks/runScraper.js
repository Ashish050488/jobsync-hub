import { SITES_CONFIG } from '../config.js';
import { loadAllExistingIDs, deleteOldJobs } from '../Db/databaseManager.js';
import { scrapeSite } from '../core/scraperEngine.js';
import { Analytics } from '../models/analyticsModel.js'; // ✅ Import Analytics

let isScraping = false; 

export const runScraper = async function () {
    if (isScraping) {
        console.log('Scraper is already running. Skipping this scheduled run.');
        return;
    }
    isScraping = true;
    console.log("🚀 Starting scheduled scrape task...");
    
    try {
        // ✅ 1. Track "Connected Sources" metric immediately
        // We count how many valid configs exist in your SITES_CONFIG
        const totalSources = SITES_CONFIG.filter(s => s && s.siteName).length;
        await Analytics.setValue('connectedSources', totalSources);
        console.log(`📊 Analytics updated: ${totalSources} connected sources.`);

        const existingIDsMap = await loadAllExistingIDs();

        for (const siteConfig of SITES_CONFIG) {
            if (!siteConfig || !siteConfig.siteName) continue; 
            
            const scrapeStartTime = new Date();
            
            // Note: Inside scrapeSite is where you should call Analytics.increment('jobsScraped')
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
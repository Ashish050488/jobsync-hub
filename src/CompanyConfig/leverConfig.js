import fetch from 'node-fetch';

/**
 * LEVER CONFIGURATION - EXPANDED VERSION
 * 
 * This version includes more companies that are likely to have jobs.
 * These are verified to work with Lever's API.
 */

const LEVER_BASE_URL = 'https://api.lever.co/v0/postings';

/**
 * Verified working companies (tested and confirmed)
 * 
 * Start with these - they're known to use Lever and have active job postings
 */
const companySiteNames = [
  // Tech companies with frequent job postings
 'welocalize'
  

];

// German cities for filtering
const germanCities = [
  'berlin', 'munich', 'münchen', 'hamburg', 'cologne', 'köln', 
  'frankfurt', 'stuttgart', 'düsseldorf', 'dusseldorf', 'dortmund',
  'essen', 'leipzig', 'bremen', 'dresden', 'hanover', 'hannover',
  'nuremberg', 'nürnberg', 'duisburg', 'bochum', 'wuppertal',
  'bielefeld', 'bonn', 'münster', 'karlsruhe', 'mannheim',
  'augsburg', 'wiesbaden', 'mönchengladbach', 'gelsenkirchen',
  'aachen', 'braunschweig', 'kiel', 'chemnitz', 'halle',
  'magdeburg', 'freiburg', 'krefeld', 'mainz', 'lübeck',
];

const germanyKeywords = ['germany', 'deutschland', 'de', 'deu'];

/**
 * Check if job has Germany location
 */
/**
 * Check if job has Germany location
 * FIXED VERSION - More strict filtering
 */
function hasGermanyLocation(job) {
  try {
    // 1. CHECK COUNTRY CODE FIRST (MOST RELIABLE!)
    if (job.country) {
      const countryCode = job.country.toLowerCase().trim();
      // Only accept 'de' or 'deu'
      if (countryCode === 'de' || countryCode === 'deu') {
        return true;
      }
      // If country is set but NOT Germany, reject immediately
      if (countryCode !== 'de' && countryCode !== 'deu') {
        return false;
      }
    }

    // 2. Check primary location
    if (job.categories?.location) {
      const locationLower = job.categories.location.toLowerCase().trim();
      
      // Exact match for Germany keywords
      if (germanyKeywords.some(keyword => {
        return locationLower === keyword || 
               locationLower.includes(`, ${keyword}`) ||
               locationLower.includes(`${keyword},`) ||
               locationLower.startsWith(`${keyword} `) ||
               locationLower.endsWith(` ${keyword}`);
      })) {
        return true;
      }
      
      // Check for German cities
      if (germanCities.some(city => {
        return locationLower === city ||
               locationLower.includes(`, ${city}`) ||
               locationLower.startsWith(`${city},`);
      })) {
        return true;
      }
    }

    // 3. Check all locations array
    if (job.categories?.allLocations && Array.isArray(job.categories.allLocations)) {
      for (const location of job.categories.allLocations) {
        const locationLower = location.toLowerCase().trim();
        
        // Exact Germany match
        if (germanyKeywords.some(keyword => {
          return locationLower === keyword || 
                 locationLower.includes(`, ${keyword}`) ||
                 locationLower.includes(`${keyword},`);
        })) {
          return true;
        }
        
        // German cities
        if (germanCities.some(city => {
          return locationLower === city ||
                 locationLower.includes(`, ${city}`);
        })) {
          return true;
        }
      }
    }

    // 4. Remote jobs - ONLY if explicitly mentions Germany
    if (job.workplaceType === 'remote') {
      const descriptionLower = (job.descriptionPlain || '').toLowerCase();
      
      // Look for explicit "remote in germany" or "remote - germany"
      if (descriptionLower.includes('remote in germany') ||
          descriptionLower.includes('remote - germany') ||
          descriptionLower.includes('germany remote')) {
        return true;
      }
    }

    // DEFAULT: Not a Germany job
    return false;
    
  } catch (error) {
    console.error('Error checking Germany location:', error);
    return false;
  }
}

/**
 * Lever Configuration - Compatible with existing architecture
 */
const leverConfig = {
  siteName: 'Lever Jobs',
  
  // No session needed (public API)
  needsSession: false,
  
  // Use GET method
  method: 'GET',
  
  // Each "page" = one company
  limit: 1,
  
  // Base URL
  baseUrl: LEVER_BASE_URL,
  
  /**
   * Build URL for current company
   */
  buildPageUrl: (offset, limit) => {
    const companyIndex = offset;
    
    if (companyIndex >= companySiteNames.length) {
      console.log(`[Lever] ✅ Finished checking all ${companySiteNames.length} companies`);
      return null;
    }
    
    const siteName = companySiteNames[companyIndex];
    const url = `${LEVER_BASE_URL}/${siteName}?mode=json`;
    
    console.log(`\n[Lever] 🔍 Company ${companyIndex + 1}/${companySiteNames.length}: ${siteName}`);
    
    return url;
  },
  
  /**
   * Extract and filter jobs from API response
   * 
   * DEBUGGING ENABLED: Shows what we receive from API
   */
  getJobs: (data) => {
    // DEBUG: Log what we received
    if (!data) {
      console.log(`       ❌ No data received from API`);
      return [];
    }
    
    const allJobs = Array.isArray(data) ? data : [];
    
    // DEBUG: Log job count
    console.log(`       📊 Received ${allJobs.length} total jobs`);
    
    if (allJobs.length === 0) {
      console.log(`       ⊘  No jobs found for this company`);
      return [];
    }
    
    // DEBUG: Log first job structure (helps diagnose issues)
    if (allJobs.length > 0) {
      const firstJob = allJobs[0];
      console.log(`       🔍 Sample job fields:`, {
        id: firstJob.id ? '✓' : '✗',
        text: firstJob.text ? '✓' : '✗',
        country: firstJob.country || 'none',
        location: firstJob.categories?.location || 'none',
        allLocations: firstJob.categories?.allLocations?.length || 0
      });
    }
    
    // Filter for Germany
    const germanyJobs = allJobs.filter(hasGermanyLocation);
    
    if (germanyJobs.length > 0) {
      console.log(`       ✅ Found ${germanyJobs.length} Germany jobs!`);
    } else {
      console.log(`       ⊘  No Germany jobs (checked ${allJobs.length} jobs)`);
    }
    
    return germanyJobs;
  },
  
  /**
   * Extract unique job ID
   */
  extractJobID: (job) => {
    return `lever_${job.id}`;
  },

  /**
   * Extract job title
   */
  extractJobTitle: (job) => {
    return job.text || 'Untitled Position';
  },

  /**
   * Extract company name
   */
  extractCompany: (job) => {
    if (job.hostedUrl) {
      try {
        const url = new URL(job.hostedUrl);
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
      } catch (e) {
        // Fall through
      }
    }
    
    return 'Company via Lever';
  },

  /**
   * Extract location(s)
   */
  extractLocation: (job) => {
    const locations = [];
    
    if (job.categories && job.categories.location) {
      locations.push(job.categories.location);
    }
    
    if (job.categories && job.categories.allLocations && Array.isArray(job.categories.allLocations)) {
      for (const loc of job.categories.allLocations) {
        if (!locations.includes(loc)) {
          locations.push(loc);
        }
      }
    }
    
    if (job.workplaceType && job.workplaceType !== 'unspecified' && job.workplaceType !== 'on-site') {
      const workplaceLabel = job.workplaceType.charAt(0).toUpperCase() + job.workplaceType.slice(1);
      locations.push(workplaceLabel);
    }
    
    return locations.length > 0 ? locations.join(', ') : 'Location not specified';
  },

  /**
   * Extract description
   */
  extractDescription: (job) => {
    if (job.descriptionPlain) {
      return job.descriptionPlain;
    }
    
    if (job.description) {
      return job.description.replace(/<[^>]*>/g, '').trim();
    }
    
    return 'No description available';
  },

  /**
   * Extract URL
   */
  extractURL: (job) => {
    if (job.applyUrl) {
      return job.applyUrl;
    }
    
    if (job.hostedUrl) {
      return job.hostedUrl;
    }
    
    return null;
  },

  /**
   * Extract posting date
   */
  extractPostedDate: (job) => {
    return null;
  },
};

export { leverConfig };
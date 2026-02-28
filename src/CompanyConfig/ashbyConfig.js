import fetch from 'node-fetch';

export const ashbyConfig = {
    siteName: "Ashby Jobs",
    baseUrl: "https://api.ashbyhq.com/posting-api/job-board",
    
    // ✅ VERIFIED WORKING COMPANIES (with Germany jobs potential)
    companyBoardNames: [
        // Companies confirmed to have Germany jobs
        'Ashby',
        'Deel',
        'OpenAI',
        'Cohere',
        
        // Additional tech companies using Ashby (verify these)
        'Linear',
        'Notion',
        'Ramp',
        'Mercury',
        'Lattice',
        'Supabase',
        'Vercel',
        'Replit',
        'Cal',
        'Modal',
        'Sourcegraph',
        'Grammarly',
        'Scale',
        'Hugging-Face',
        'Weights-Biases',
        'dbt-labs',
        'Replicate',
        'Together',
        'Perplexity',
        'Cursor',
        'Anthropic',
        'Mistral',
        'Stability',
        'Adept',
        'Character',
        'Inflection',
        
        // European/German companies
        'Personio',
        'Contentful',
        'Celonis',
        'Taxfix',
        'Raisin',
        'N26',
        'Trade-Republic',
        'Sennder',
        'Adjust',
        'GetYourGuide',
        'Delivery-Hero',
        'Auto1',
        'Zalando',
        'HelloFresh',
        'Rocket-Internet',
    ],
    
    // Internal state
    _allJobsQueue: [],
    _initialized: false,
    
    // Fetch all jobs from all boards upfront
    async initialize() {
        if (this._initialized) return;
        
        console.log(`[Ashby] Fetching jobs from ${this.companyBoardNames.length} companies...`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const boardName of this.companyBoardNames) {
            try {
                const url = `${this.baseUrl}/${boardName}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    failCount++;
                    // Only log 404s if you want to see which ones failed
                    // console.log(`[Ashby] ❌ ${boardName}: ${response.status}`);
                    continue;
                }
                
                const data = await response.json();
                
                if (!data.jobs || data.jobs.length === 0) {
                    continue;
                }
                
                // Filter for Germany jobs
                const germanyJobs = data.jobs.filter(job => {
                    return this.hasGermanyLocation(job);
                }).map(job => ({
                    ...job,
                    _boardName: boardName
                }));
                
                if (germanyJobs.length > 0) {
                    console.log(`[Ashby] ✅ ${boardName}: ${germanyJobs.length} jobs in Germany (${data.jobs.length} total)`);
                    this._allJobsQueue.push(...germanyJobs);
                    successCount++;
                }
                
                // Rate limit: 300ms between companies
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                failCount++;
                console.error(`[Ashby] ❌ ${boardName}: ${error.message}`);
            }
        }
        
        console.log(`[Ashby] ✅ Summary: ${successCount} companies with Germany jobs, ${failCount} failed/empty`);
        console.log(`[Ashby] 📊 Total jobs found: ${this._allJobsQueue.length}`);
        this._initialized = true;
    },
    
    // Check if job has Germany location
    hasGermanyLocation(job) {
        const germanCities = [
            'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln',
            'stuttgart', 'düsseldorf', 'dortmund', 'essen', 'leipzig', 'bremen',
            'dresden', 'hanover', 'hannover', 'nuremberg', 'nürnberg', 'duisburg',
            'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'karlsruhe',
            'mannheim', 'augsburg', 'wiesbaden', 'gelsenkirchen', 'mönchengladbach',
            'braunschweig', 'chemnitz', 'kiel', 'aachen', 'halle', 'magdeburg',
            'freiburg', 'krefeld', 'lübeck', 'erfurt', 'mainz', 'rostock'
        ];
        
        // Check primary location
        if (job.location) {
            const locationLower = job.location.toLowerCase();
            if (locationLower.includes('germany') || 
                locationLower.includes('deutschland') ||
                germanCities.some(city => locationLower.includes(city))) {
                return true;
            }
        }
        
        // Check address
        if (job.address?.postalAddress?.addressCountry) {
            const country = job.address.postalAddress.addressCountry.toLowerCase();
            if (country.includes('germany') || country.includes('deutschland') || country === 'de' || country === 'deu') {
                return true;
            }
        }
        
        // Check secondary locations
        if (job.secondaryLocations && job.secondaryLocations.length > 0) {
            for (const secLoc of job.secondaryLocations) {
                if (secLoc.location) {
                    const locLower = secLoc.location.toLowerCase();
                    if (locLower.includes('germany') || 
                        locLower.includes('deutschland') ||
                        germanCities.some(city => locLower.includes(city))) {
                        return true;
                    }
                }
                if (secLoc.address?.addressCountry) {
                    const country = secLoc.address.addressCountry.toLowerCase();
                    if (country.includes('germany') || country.includes('deutschland') || country === 'de' || country === 'deu') {
                        return true;
                    }
                }
            }
        }
        
        // Check if remote is allowed AND location contains "Remote"
        if (job.isRemote && job.location) {
            const locationLower = job.location.toLowerCase();
            // Only consider as Germany if explicitly mentions Germany with Remote
            if ((locationLower.includes('germany') || locationLower.includes('deutschland')) && 
                locationLower.includes('remote')) {
                return true;
            }
        }
        
        return false;
    },
    
    // Fetch jobs page (required by scraperEngine)
    async fetchPage(offset, limit) {
        if (!this._initialized) {
            await this.initialize();
        }
        
        const jobs = this._allJobsQueue.slice(offset, offset + limit);
        return { jobs, total: this._allJobsQueue.length };
    },
    
    // Required by scraperEngine
    getJobs(data) {
        return data.jobs || [];
    },
    
    // Get total
    getTotal(data) {
        return data.total || 0;
    },
    
    // Extract job ID
    extractJobID(job) {
        // Use jobUrl as unique ID
        const urlParts = job.jobUrl.split('/');
        return `ashby_${job._boardName}_${urlParts[urlParts.length - 1]}`;
    },
    
    // Extract job title
    extractJobTitle(job) {
        return job.title;
    },
    
    // Extract company name
    extractCompany(job) {
        // Format board name to readable company name
        return job._boardName
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    },
    
    // Extract location
    extractLocation(job) {
        // Combine all Germany locations
        let locations = [];
        
        // Add primary location if it's Germany
        if (job.location && this.isGermanyString(job.location)) {
            locations.push(job.location);
        }
        
        // Add secondary Germany locations
        if (job.secondaryLocations && job.secondaryLocations.length > 0) {
            for (const secLoc of job.secondaryLocations) {
                if (secLoc.location && this.isGermanyString(secLoc.location)) {
                    locations.push(secLoc.location);
                }
            }
        }
        
        return locations.length > 0 ? locations.join(', ') : 'Germany';
    },
    
    // Helper to check if a location string is Germany-related
    isGermanyString(locationStr) {
        const germanCities = [
            'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln',
            'stuttgart', 'düsseldorf', 'dortmund', 'essen', 'leipzig', 'bremen',
            'dresden', 'hanover', 'hannover', 'nuremberg', 'nürnberg'
        ];
        
        const locLower = locationStr.toLowerCase();
        return locLower.includes('germany') || 
               locLower.includes('deutschland') ||
               germanCities.some(city => locLower.includes(city));
    },
    
    // Extract description
    extractDescription(job) {
        // Prefer plain text, fallback to HTML
        return job.descriptionPlain || job.descriptionHtml || '';
    },
    
    // Extract URL
    extractURL(job) {
        return job.applyUrl || job.jobUrl;
    },
    
    // Extract posted date
    extractPostedDate(job) {
        return job.publishedAt;
    }
};
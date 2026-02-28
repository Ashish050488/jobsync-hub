import fetch from 'node-fetch';

export const greenhouseConfig = {
    siteName: "Greenhouse Jobs",
    baseUrl: "https://boards-api.greenhouse.io/v1/boards",
    
    companyBoardTokens: [
        // ✅ WORKING TOKENS (verified)
        'airbnb',
        'stripe',
        'figma',
        'airtable',
        'gitlab',
        'reddit',
        'pinterest',
        'twitch',
        
        // ✅ ADDITIONAL WORKING TOKENS (tech companies with Germany jobs)
        'deliveryhero',
        'getaround',
        'wolt',
        'personio',
        'contentful',
        'celonis',
        'adjust',
        'signavio',
        'sennder',
        'n26',
        'gorillas',
        'flink',
        'trade-republic',
        'taxfix',
        'raisin',
        'heyjobs',
        'omio',
        'scalablecapital',
        'eyeo',
        'jimdo',
        
        // ✅ More tech companies (may or may not have Germany jobs)
        'shopify',          // Try alternative
        'datadog',
        'notion',           // Try alternative  
        'miro',
        'zapier',
        'asana',
        'dropbox',
        'docusign',
        'confluent',
        'databricks',
        'snowflake',
        'hashicorp',
        'cloudflare',
        'mongodb',
        'elastic',
        'okta',
        'zendesk',
        'hubspot',
        'intercom',
        'segment',
        'amplitude',
        'mixpanel',
        'launchdarkly',
        'pagerduty',
        'sumo-logic',
        'new-relic',
        'splunk',
        'dynatrace',
    ],
    
    // Internal state
    _currentBoardIndex: 0,
    _allJobsQueue: [],
    _initialized: false,
    
    // Fetch all jobs from all boards upfront
    async initialize() {
        if (this._initialized) return;
        
        console.log(`[Greenhouse] Fetching jobs from ${this.companyBoardTokens.length} companies...`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const boardToken of this.companyBoardTokens) {
            try {
                const url = `${this.baseUrl}/${boardToken}/jobs?content=true`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    failCount++;
                    // Only log if you want to see failures (comment out to reduce noise)
                    // console.log(`[Greenhouse] ❌ ${boardToken}: ${response.status}`);
                    continue;
                }
                
                const data = await response.json();
                
                if (!data.jobs || data.jobs.length === 0) {
                    continue;
                }
                
                // Filter for Germany and add board token
                const germanyJobs = data.jobs
                    .filter(job => {
                        const location = job.location?.name || '';
                        return this.isGermanyLocation(location);
                    })
                    .map(job => ({
                        ...job,
                        _boardToken: boardToken
                    }));
                
                if (germanyJobs.length > 0) {
                    console.log(`[Greenhouse] ✅ ${boardToken}: ${germanyJobs.length} jobs in Germany (${data.jobs.length} total)`);
                    this._allJobsQueue.push(...germanyJobs);
                    successCount++;
                }
                
                // Rate limit: wait 500ms between companies
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                failCount++;
                console.error(`[Greenhouse] ❌ ${boardToken}: ${error.message}`);
            }
        }
        
        console.log(`[Greenhouse] ✅ Summary: ${successCount} companies with Germany jobs, ${failCount} failed/empty`);
        console.log(`[Greenhouse] 📊 Total jobs found: ${this._allJobsQueue.length}`);
        this._initialized = true;
    },
    
    // Fetch jobs page (required by scraperEngine)
    async fetchPage(offset, limit) {
        // Initialize on first call
        if (!this._initialized) {
            await this.initialize();
        }
        
        // Return paginated chunk
        const jobs = this._allJobsQueue.slice(offset, offset + limit);
        return { jobs, total: this._allJobsQueue.length };
    },
    
    // Required by scraperEngine
    getJobs(data) {
        return data.jobs || [];
    },
    
    // Get total (for pagination)
    getTotal(data) {
        return data.total || 0;
    },
    
    // Extract job ID
    extractJobID(job) {
        return `greenhouse_${job._boardToken}_${job.id}`;
    },
    
    // Extract job title
    extractJobTitle(job) {
        return job.title;
    },
    
    // Extract company name
    extractCompany(job) {
        const boardToken = job._boardToken;
        
        // Try to get from metadata
        if (job.metadata && job.metadata.length > 0) {
            const companyField = job.metadata.find(m => m.name.toLowerCase().includes('company'));
            if (companyField) return companyField.value;
        }
        
        // Format board token to readable name
        return boardToken
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    },
    
    // Extract location
    extractLocation(job) {
        return job.location?.name || 'Germany';
    },
    
    // Extract description
    extractDescription(job) {
        return job.content || '';
    },
    
    // Extract URL
    extractURL(job) {
        return job.absolute_url;
    },
    
    // Extract posted date
    extractPostedDate(job) {
        return job.updated_at;
    },
    
    // Check if location is in Germany
    isGermanyLocation(location) {
        const germanCities = [
            'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln',
            'stuttgart', 'düsseldorf', 'dortmund', 'essen', 'leipzig', 'bremen',
            'dresden', 'hanover', 'hannover', 'nuremberg', 'nürnberg', 'duisburg',
            'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'karlsruhe',
            'mannheim', 'augsburg', 'wiesbaden', 'gelsenkirchen', 'mönchengladbach',
            'braunschweig', 'chemnitz', 'kiel', 'aachen', 'halle', 'magdeburg',
            'freiburg', 'krefeld', 'lübeck', 'erfurt', 'mainz', 'rostock'
        ];
        
        const locationLower = location.toLowerCase();
        
        // Check for Germany or DE
        if (locationLower.includes('germany') || 
            locationLower.includes('deutschland') || 
            locationLower.match(/\bde\b/)) {
            return true;
        }
        
        // Check for German cities
        return germanCities.some(city => locationLower.includes(city));
    }
};
/**
 * Universal Pre-Filter Utilities
 * Reusable location filters that can be applied to any company config
 */

// List of German cities for location matching
export const GERMAN_CITIES = [
    'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln',
    'stuttgart', 'düsseldorf', 'dusseldorf', 'dortmund', 'essen', 'leipzig',
    'dresden', 'hanover', 'hannover', 'nuremberg', 'nürnberg', 'duisburg',
    'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'munster',
    'karlsruhe', 'mannheim', 'augsburg', 'wiesbaden', 'mönchengladbach',
    'gelsenkirchen', 'braunschweig', 'chemnitz', 'kiel', 'aachen',
    'halle', 'magdeburg', 'freiburg', 'krefeld', 'lübeck', 'lubeck',
    'oberhausen', 'erfurt', 'mainz', 'rostock', 'kassel', 'hagen',
    'potsdam', 'saarbrücken', 'saarbrucken', 'hamm', 'ludwigshafen',
    'leverkusen', 'oldenburg', 'osnabrück', 'osnabruck', 'solingen',
    'heidelberg', 'darmstadt', 'regensburg', 'ingolstadt', 'würzburg',
    'wurzburg', 'wolfsburg', 'göttingen', 'gottingen', 'recklinghausen',
    'heilbronn', 'ulm', 'pforzheim', 'offenbach', 'bottrop', 'trier',
    'jena', 'cottbus', 'siegen', 'hildesheim', 'salzgitter', 'gütersloh',
    'gutersloh', 'iserlohn', 'schwerin', 'koblenz', 'zwickau', 'witten',
    'gera', 'hanau', 'esslingen', 'ludwigsburg', 'tubingen', 'tübingen',
    'flensburg', 'konstanz', 'worms', 'marburg', 'lüneburg', 'luneburg',
    'bayreuth', 'bamberg', 'plauen', 'neubrandenburg', 'wilhelmshaven',
    'dormagen', 'bomlitz', 'brunsbüttel', 'brunsbuttel', // Covestro locations
    'meppen', 'emden', 'cuxhaven', 'celle', 'paderborn', 'reutlingen', // ✅ Added more cities
    'germany', 'deutschland', 'german'
];

// List of non-German cities to explicitly reject
export const NON_GERMAN_CITIES = [
    'london', 'paris', 'amsterdam', 'vienna', 'wien', 'zurich', 'zürich',
    'madrid', 'rome', 'roma', 'barcelona', 'milan', 'milano', 'prague',
    'praha', 'warsaw', 'warszawa', 'brussels', 'bruxelles', 'copenhagen',
    'københavn', 'stockholm', 'oslo', 'helsinki', 'dublin', 'lisbon',
    'lisboa', 'athens', 'athina', 'budapest', 'bucharest', 'sofia',
    'belgrade', 'zagreb', 'luxembourg'
];

// Ambiguous location terms - but still risky, so REJECT in strict mode
export const AMBIGUOUS_LOCATIONS = [
    'remote', 'home office', 'hybrid', 'flexible',
    'various', 'multiple', 'tbd', 'to be determined',
    'europe', 'eu', 'emea', 'dach', 'global',
    'headquarter', 'headquarters', 'hq', 'office' // ✅ REJECT these for production
];

/**
 * Universal location pre-filter
 * Returns true if job should be processed, false if it should be rejected
 */
export function universalLocationPreFilter(job, options = {}) {
    const locationFields = options.locationFields || ['location', 'Location', 'city', 'office'];
    let locationText = '';
    
    for (const field of locationFields) {
        if (job[field]) {
            locationText = String(job[field]).toLowerCase();
            break;
        }
        if (field.includes('.')) {
            const parts = field.split('.');
            let value = job;
            for (const part of parts) {
                value = value?.[part];
                if (!value) break;
            }
            if (value) {
                locationText = String(value).toLowerCase();
                break;
            }
        }
    }
    
    if (!locationText || locationText.trim() === '') {
        console.log(`[Pre-Filter] ❌ Rejected - No location specified`);
        return false; // ✅ STRICT: Reject if no location
    }
    
    // ✅ STRICT MODE FOR PRODUCTION: Reject ambiguous locations
    // We only want jobs with explicit German city names
    const isAmbiguous = AMBIGUOUS_LOCATIONS.some(term => locationText.includes(term));
    if (isAmbiguous) {
        console.log(`[Pre-Filter] ❌ Rejected - Ambiguous location: ${locationText}`);
        return false; // ✅ Reject "headquarter", "remote", "office" etc.
    }
    
    // Accept if contains ANY German city
    const hasGermanCity = GERMAN_CITIES.some(city => locationText.includes(city));
    if (hasGermanCity) {
        console.log(`[Pre-Filter] ✅ Accepted - German location found: ${locationText}`);
        return true;
    }
    
    // Reject if contains non-German cities
    const hasNonGermanCity = NON_GERMAN_CITIES.some(city => locationText.includes(city));
    if (hasNonGermanCity && !hasGermanCity) {
        console.log(`[Pre-Filter] ❌ Rejected - No German location: ${locationText}`);
        return false;
    }
    
    // If location exists but unclear, reject to be safe
    console.log(`[Pre-Filter] ❌ Rejected - Unclear location: ${locationText}`);
    return false; // ✅ STRICT: When in doubt, reject
}

export function createLocationPreFilter(options = {}) {
    return (job) => universalLocationPreFilter(job, options);
}
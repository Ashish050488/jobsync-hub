/**
 * Location Pre-Filter for India-based job matching
 */

const INDIA_LOCATIONS = [
    'bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi',
    'hyderabad', 'pune', 'chennai', 'noida', 'gurgaon', 'gurugram',
    'kolkata', 'ahmedabad', 'india', 'remote', 'work from home',
    'wfh', 'pan india', 'anywhere in india'
];

/**
 * Returns true if job should be kept, false if rejected.
 * null / undefined / empty string location ? PASS (keep the job)
 */
export function universalLocationPreFilter(job, options = {}) {
    const locationFields = options.locationFields || ['location', 'Location', 'city', 'office'];
    let locationText = null;

    for (const field of locationFields) {
        if (job[field]) {
            locationText = String(job[field]);
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
                locationText = String(value);
                break;
            }
        }
    }

    // null, undefined, or empty string ? PASS
    if (!locationText || locationText.trim() === '') {
        return true;
    }

    const lower = locationText.toLowerCase();

    // If location matches any India location term ? PASS
    if (INDIA_LOCATIONS.some(term => lower.includes(term))) {
        return true;
    }

    // Not in India ? FAIL
    return false;
}

export function createLocationPreFilter(options = {}) {
    return (job) => universalLocationPreFilter(job, options);
}

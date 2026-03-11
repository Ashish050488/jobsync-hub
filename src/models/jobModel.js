/**
 * Job Model - NO LOCATION CLASSIFICATION
 * All jobs assumed to be in India (pre-filtered by sources/configs)
 */

const jobSchemaDefinition = {
    JobID: { type: String, required: true },
    sourceSite: { type: String, required: true },
    JobTitle: { type: String, required: true, trim: true },
    ApplicationURL: { type: String, required: true },
    Description: { type: String, default: "" },
    Location: { type: String, default: "N/A" },
    Company: { type: String, default: "N/A" },

    // --- WORKFLOW STATUS ---
    Status: { type: String, default: "active" },

    Department: { type: String, default: "N/A" },
    ContractType: { type: String, default: "N/A" },
    ExperienceLevel: { type: String, default: "N/A" },
    PostedDate: { type: Date, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
    scrapedAt: { type: Date },

    // --- ATS source data ---
    DirectApplyURL: { type: String, default: null },
    Team: { type: String, default: null },
    AllLocations: { type: Array, default: [] },
    Tags: { type: Array, default: [] },
    WorkplaceType: { type: String, default: null },
    IsRemote: { type: Boolean, default: null },

    // --- Description variants ---
    DescriptionPlain: { type: String, default: null },
    DescriptionLists: { type: Array, default: [] },
    AdditionalInfo: { type: String, default: null },

    // --- Salary ---
    SalaryMin: { type: Number, default: null },
    SalaryMax: { type: Number, default: null },
    SalaryCurrency: { type: String, default: null },
    SalaryInterval: { type: String, default: null },
    SalaryInfo: { type: String, default: null },

    // --- Office/Location detail ---
    Office: { type: String, default: null },

    // --- ATS platform ---
    ATSPlatform: { type: String, default: null },
};

class Job {
    constructor(data) {
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = new Date();
        this.scrapedAt = new Date();

        for (const key in jobSchemaDefinition) {
            if (key === 'createdAt' || key === 'updatedAt' || key === 'scrapedAt') continue;

            const schemaField = jobSchemaDefinition[key];
            let value = data[key];

            if (value === undefined || value === null) {
                this[key] = schemaField.default;
            } else {
                if (schemaField.type === String) {
                    this[key] = schemaField.trim ? String(value).trim() : String(value);
                } else if (schemaField.type === Number) {
                    this[key] = Number(value) || schemaField.default;
                } else if (schemaField.type === Boolean) {
                    if (typeof value === 'string') {
                        this[key] = value === 'true';
                    } else {
                        this[key] = Boolean(value);
                    }
                } else if (schemaField.type === Date) {
                    this[key] = new Date(value);
                } else {
                    this[key] = value;
                }
            }
        }
    }
}

export const createJobModel = (mappedJob, siteName) => {
    return new Job({
        ...mappedJob,
        sourceSite: siteName,
        Company: mappedJob.Company || siteName,
    });
}
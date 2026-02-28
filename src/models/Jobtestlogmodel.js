/**
 * Job Test Log Model
 * Saves ALL jobs (accepted + rejected) for testing and analysis
 * Includes AI evidence/reasoning for decisions
 * NO LOCATION CLASSIFICATION - All jobs assumed to be in Germany
 */

const jobTestLogSchemaDefinition = {
    JobID: { type: String, required: true },
    sourceSite: { type: String, required: true },
    JobTitle: { type: String, required: true, trim: true },
    ApplicationURL: { type: String, required: true },
    Description: { type: String, default: "" },
    Location: { type: String, default: "N/A" }, // ✅ Raw location from source (not classified)
    Company: { type: String, default: "N/A" },
    
    // --- CLASSIFICATION FIELDS ---
    GermanRequired: { type: Boolean, default: false },
    Domain: { type: String, default: "Unclear" },
    SubDomain: { type: String, default: "Other" },
    ConfidenceScore: { type: Number, default: 0 },
    
    // --- AI EVIDENCE (GERMAN ONLY) ---
    Evidence: {
        type: Object,
        default: {
            german_reason: ""
        }
    },
    
    // --- FINAL DECISION ---
    FinalDecision: { type: String, default: "rejected" }, // "accepted" or "rejected"
    RejectionReason: { type: String, default: null },
    
    // --- WORKFLOW STATUS ---
    Status: { type: String, default: "pending_review" },
    
    Department: { type: String, default: "N/A" },
    ContractType: { type: String, default: "N/A" },
    ExperienceLevel: { type: String, default: "N/A" },
    PostedDate: { type: Date, default: null },
    createdAt: { type: Date },
    scrapedAt: { type: Date }
};

class JobTestLog {
    constructor(data) {
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.scrapedAt = new Date();

        for (const key in jobTestLogSchemaDefinition) {
            if (key === 'createdAt' || key === 'scrapedAt') continue;

            const schemaField = jobTestLogSchemaDefinition[key];
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
                } else if (schemaField.type === Object) {
                    this[key] = value;
                } else {
                    this[key] = value;
                }
            }
        }
    }
}

export function createJobTestLog(jobData, sourceSite) {
    return {
        JobID: jobData.JobID,
        sourceSite: sourceSite,
        JobTitle: jobData.JobTitle,
        Company: jobData.Company,
        Location: jobData.Location, // ✅ Raw location (e.g., "Berlin", "Munich, Hamburg")
        Description: jobData.Description,
        ApplicationURL: jobData.ApplicationURL,
        PostedDate: jobData.PostedDate || jobData.DatePosted || null,
        
        // ✅ AI Classification Results (NO LOCATION CHECK)
        GermanRequired: jobData.GermanRequired,
        Domain: jobData.Domain || "N/A",
        SubDomain: jobData.SubDomain || "N/A",
        ConfidenceScore: jobData.ConfidenceScore || 0,
        
        // ✅ Evidence (GERMAN ONLY - NO LOCATION REASON)
        Evidence: jobData.Evidence || {
            german_reason: ""
        },
        
        // ✅ Decision Info
        FinalDecision: jobData.FinalDecision || "pending",
        RejectionReason: jobData.RejectionReason || null,
        Status: jobData.Status || "pending_review",
        
        createdAt: new Date(),
        scrapedAt: new Date()
    };
}
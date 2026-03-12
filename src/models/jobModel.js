/**
 * Job Model - NO LOCATION CLASSIFICATION
 * All jobs assumed to be in India (pre-filtered by sources/configs)
 */

import mongoose from 'mongoose';

import { cleanJobDescription } from '../core/cleanJobDescription.js';
import { generateJobTags, getPlainTextForTagging } from '../core/generateJobTags.js';

export const jobSchemaDefinition = {
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

    // --- Entry-level tagging ---
    isEntryLevel: { type: Boolean, default: null },

    // --- Auto-generated search tags ---
    autoTags: {
        techStack: { type: [String], default: [] },
        roleCategory: { type: String, default: 'Other' },
        experienceBand: { type: String, default: null },
        isEntryLevel: { type: Boolean, default: false },
        domain: { type: [String], default: [] },
        urgency: { type: String, default: null },
        education: { type: String, default: null },
    },

    // --- Cleaned/restructured description ---
    DescriptionCleaned: { type: String, default: null },
};

function isNestedSchemaDefinition(schemaField) {
    return schemaField && typeof schemaField === 'object' && !Array.isArray(schemaField) && !schemaField.type;
}

function castFieldValue(schemaField, value) {
    if (value === undefined || value === null) {
        return schemaField.default;
    }

    if (isNestedSchemaDefinition(schemaField)) {
        const nestedValue = value && typeof value === 'object' ? value : {};
        const nestedPayload = {};
        for (const key of Object.keys(schemaField)) {
            nestedPayload[key] = castFieldValue(schemaField[key], nestedValue[key]);
        }
        return nestedPayload;
    }

    if (schemaField.type === String) {
        return schemaField.trim ? String(value).trim() : String(value);
    }

    if (schemaField.type === Number) {
        const numeric = Number(value);
        return Number.isNaN(numeric) ? schemaField.default : numeric;
    }

    if (schemaField.type === Boolean) {
        if (typeof value === 'string') {
            return value === 'true';
        }
        return Boolean(value);
    }

    if (schemaField.type === Date) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? schemaField.default : date;
    }

    return value;
}

function applyDescriptionCleaning(target) {
    if (!target.Description) {
        target.DescriptionCleaned = null;
        target.DescriptionPlain = target.DescriptionPlain || null;
        return target;
    }

    target.DescriptionCleaned = cleanJobDescription(target.Description, target.Company);
    target.DescriptionPlain = getPlainTextForTagging(target);
    return target;
}

function applyAutoTags(target) {
    const autoTags = generateJobTags(target);
    target.autoTags = autoTags;
    target.isEntryLevel = autoTags.isEntryLevel;
    return target;
}

function buildJobPayload(data = {}, siteName) {
    const payload = {
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        scrapedAt: data.scrapedAt ? new Date(data.scrapedAt) : new Date(),
    };

    for (const key in jobSchemaDefinition) {
        if (key === 'createdAt' || key === 'updatedAt' || key === 'scrapedAt') continue;
        payload[key] = castFieldValue(jobSchemaDefinition[key], data[key]);
    }

    payload.sourceSite = payload.sourceSite || siteName;
    payload.Company = payload.Company || siteName || jobSchemaDefinition.Company.default;

    applyDescriptionCleaning(payload);
    return applyAutoTags(payload);
}

const jobSchema = new mongoose.Schema(jobSchemaDefinition, {
    collection: 'jobs',
    strict: false,
    versionKey: false,
});

jobSchema.pre('save', function onSave(next) {
    this.$locals.shouldRefreshAutoTags = this.isNew
        || this.isModified('Description')
        || this.isModified('DescriptionPlain')
        || this.isModified('Company')
        || this.isModified('JobTitle')
        || this.isModified('Department');

    if (this.$locals.shouldRefreshAutoTags) {
        applyDescriptionCleaning(this);
        applyAutoTags(this);
    }
    next();
});

jobSchema.post('save', async function onPostSave(doc, next) {
    if (!doc.$locals?.shouldRefreshAutoTags) {
        next();
        return;
    }

    try {
        const autoTags = generateJobTags(doc);
        const nextEntryLevel = autoTags.isEntryLevel;
        const changed = JSON.stringify(doc.autoTags ?? null) !== JSON.stringify(autoTags)
            || doc.isEntryLevel !== nextEntryLevel;

        if (changed) {
            await doc.constructor.updateOne(
                { _id: doc._id },
                { $set: { autoTags, isEntryLevel: nextEntryLevel, DescriptionPlain: getPlainTextForTagging(doc) } },
            );
        }
        next();
    } catch (error) {
        next(error);
    }
});

export const JobModel = mongoose.models.Job || mongoose.model('Job', jobSchema);

export const createJobModel = (mappedJob, siteName) => {
    return buildJobPayload({
        ...mappedJob,
        sourceSite: siteName,
        Company: mappedJob.Company || siteName,
    }, siteName);
};
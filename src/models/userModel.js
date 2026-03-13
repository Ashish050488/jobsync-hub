import { connectToDb } from '../Db/databaseManager.js';
import { ObjectId } from 'mongodb';

/**
 * User identity — no auth, just a name/slug for separating data.
 *
 * Collection: users
 *   _id          ObjectId (auto)
 *   name         string   (unique display name)
 *   slug         string   (unique, url-safe lowercase)
 *   createdAt    Date
 *   lastVisitAt  Date
 *   appliedJobs  { jobId: string, appliedAt: Date }[]
 *   appliedCount number (persistent historical total, never decremented)
 *   skills       string[]  (user's known tech skills for description highlighting)
 *   comeBackTo   { jobId: string, note: string, addedAt: Date }[]  (active intent flags)
 *   dailyGoal    number   (default: 5, range: 1-50, daily application target)
 *
 * Migration: legacy entries that are plain strings are normalised on read.
 */

async function usersCol() {
    const db = await connectToDb();
    return db.collection('users');
}

/** Ensure unique index on slug (idempotent) */
export async function ensureUserIndexes() {
    const col = await usersCol();
    await col.createIndex({ slug: 1 }, { unique: true });
    await col.updateMany(
        { appliedCount: { $exists: false } },
        [{ $set: { appliedCount: { $size: { $ifNull: ['$appliedJobs', []] } } } }],
    );
}

/** Return all users (name + slug only) */
export async function getAllUsers() {
    const col = await usersCol();
    return col.find({}, { projection: { name: 1, slug: 1, _id: 0 } })
        .sort({ name: 1 })
        .toArray();
}

/** Return full user doc by slug */
export async function getUserBySlug(slug) {
    const col = await usersCol();
    const user = await col.findOne({ slug });
    if (!user) return null;
    return {
        ...user,
        appliedCount: typeof user.appliedCount === 'number'
            ? user.appliedCount
            : normaliseApplied(user.appliedJobs).length,
    };
}

/** Create a new user (name → slug). Returns the inserted doc. */
export async function createUser(name) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const col = await usersCol();
    const doc = {
        name: name.trim(),
        slug,
        createdAt: new Date(),
        lastVisitAt: new Date(),
        appliedJobs: [],
        appliedCount: 0,
        skills: [],
        comeBackTo: [],
        dailyGoal: 5,
    };
    await col.insertOne(doc);
    return doc;
}

/** Touch lastVisitAt for a slug — returns { previousVisitAt, updatedVisitAt } */
export async function touchVisit(slug) {
    const col = await usersCol();
    const prev = await col.findOneAndUpdate(
        { slug },
        { $set: { lastVisitAt: new Date() } },
        { returnDocument: 'before' },
    );
    if (!prev) return null;
    return {
        previousVisitAt: prev.lastVisitAt ?? null,
        updatedVisitAt: new Date(),
    };
}

/**
 * Normalise a raw appliedJobs array — handles legacy plain-string entries.
 * Returns { jobId, appliedAt } objects.
 */
function normaliseApplied(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(entry =>
        typeof entry === 'string'
            ? { jobId: entry, appliedAt: new Date(0) }
            : entry
    );
}

/** Get the appliedJobs array for a user (normalised) */
export async function getAppliedJobs(slug) {
    const col = await usersCol();
    const user = await col.findOne({ slug }, { projection: { appliedJobs: 1, _id: 0 } });
    if (!user) return null;
    return normaliseApplied(user.appliedJobs);
}

/**
 * Get enriched applied jobs with title/company/url, sorted newest-first.
 * Missing jobs are kept with a placeholder title.
 */
export async function getAppliedJobDetails(slug) {
    const col = await usersCol();
    const user = await col.findOne({ slug }, { projection: { appliedJobs: 1, _id: 0 } });
    if (!user) return null;

    const appliedJobs = normaliseApplied(user.appliedJobs)
        .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
        .slice(0, 50);

    const db = await connectToDb();
    const validIds = appliedJobs
        .map(entry => entry.jobId)
        .filter(jobId => ObjectId.isValid(jobId))
        .map(jobId => new ObjectId(jobId));

    const jobs = validIds.length > 0
        ? await db.collection('jobs').find(
            { _id: { $in: validIds } },
            { projection: { JobTitle: 1, Company: 1, ApplicationURL: 1, DirectApplyURL: 1 } }
        ).toArray()
        : [];

    const jobMap = new Map(jobs.map(job => [String(job._id), job]));

    return appliedJobs.map(entry => {
        const job = jobMap.get(entry.jobId);
        return {
            jobId: entry.jobId,
            jobTitle: job?.JobTitle || 'Job no longer available',
            company: job?.Company || 'Unknown company',
            applicationURL: job?.DirectApplyURL || job?.ApplicationURL || null,
            appliedAt: entry.appliedAt,
        };
    });
}

/**
 * Add a jobId to appliedJobs.
 * Increments appliedCount only when this jobId is newly added.
 */
export async function addAppliedJob(slug, jobId) {
    const col = await usersCol();
    // Remove legacy string form first
    await col.updateOne(
        { slug },
        { $pull: { appliedJobs: jobId } },  // removes legacy string form
    );

    // Add only if not already present, and bump persistent counter once
    const result = await col.findOneAndUpdate(
        { slug, 'appliedJobs.jobId': { $ne: jobId } },
        {
            $push: { appliedJobs: { jobId, appliedAt: new Date() } },
            $inc: { appliedCount: 1 },
        },
        { returnDocument: 'after' },
    );

    if (result) return normaliseApplied(result.appliedJobs);

    const existing = await col.findOne({ slug }, { projection: { appliedJobs: 1, _id: 0 } });
    return existing ? normaliseApplied(existing.appliedJobs) : null;
}

/** Remove a jobId from appliedJobs (handles both string and object form) */
export async function removeAppliedJob(slug, jobId) {
    const col = await usersCol();
    // Pull both legacy string form and object form
    await col.updateOne(
        { slug },
        { $pull: { appliedJobs: jobId } },
    );
    const result = await col.findOneAndUpdate(
        { slug },
        { $pull: { appliedJobs: { jobId } } },
        { returnDocument: 'after' },
    );
    return result ? normaliseApplied(result.appliedJobs) : null;
}

/**
 * Set the skills array for a user.
 * Caller is responsible for validation/trimming/deduping.
 * Returns the updated skills array, or null if user not found.
 */
export async function updateSkills(slug, skills) {
    const col = await usersCol();
    const result = await col.findOneAndUpdate(
        { slug },
        { $set: { skills } },
        { returnDocument: 'after' },
    );
    return result ? (result.skills ?? []) : null;
}

/** Get the comeBackTo array for a user */
export async function getComeBackTo(slug) {
    const col = await usersCol();
    const user = await col.findOne({ slug }, { projection: { comeBackTo: 1, _id: 0 } });
    if (!user) return null;
    return Array.isArray(user.comeBackTo) ? user.comeBackTo : [];
}

/**
 * Upsert a comeBackTo entry.
 * If jobId already exists, updates the note and addedAt.
 * Returns the updated comeBackTo array.
 */
export async function upsertComeBackTo(slug, jobId, note) {
    const col = await usersCol();
    // Remove any existing entry first (idempotent upsert)
    await col.updateOne(
        { slug },
        { $pull: { comeBackTo: { jobId } } },
    );
    const result = await col.findOneAndUpdate(
        { slug },
        { $push: { comeBackTo: { jobId, note, addedAt: new Date() } } },
        { returnDocument: 'after' },
    );
    return result ? (Array.isArray(result.comeBackTo) ? result.comeBackTo : []) : null;
}

/** Remove a comeBackTo entry by jobId */
export async function removeComeBackTo(slug, jobId) {
    const col = await usersCol();
    const result = await col.findOneAndUpdate(
        { slug },
        { $pull: { comeBackTo: { jobId } } },
        { returnDocument: 'after' },
    );
    return result ? (Array.isArray(result.comeBackTo) ? result.comeBackTo : []) : null;
}

/**
 * Set the user's daily application goal.
 * Validates range 1-50; defaults to 5 if not set.
 * Returns the updated dailyGoal, or null if user not found.
 */
export async function setDailyGoal(slug, goal) {
    const col = await usersCol();
    const validated = Math.max(1, Math.min(50, parseInt(goal) || 5));
    const result = await col.findOneAndUpdate(
        { slug },
        { $set: { dailyGoal: validated } },
        { returnDocument: 'after' },
    );
    return result ? (result.dailyGoal ?? 5) : null;
}

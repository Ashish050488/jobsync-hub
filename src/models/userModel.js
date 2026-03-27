import { connectToDb } from '../Db/databaseManager.js';
import { ObjectId } from 'mongodb';
import { GOOGLE_CLIENT_ID } from '../env.js';

/** Fast guard — avoids BSONError from invalid ObjectId strings */
function isValidId(id) {
    return typeof id === 'string' && id.length > 0 && ObjectId.isValid(id);
}

async function usersCol() {
    const db = await connectToDb();
    return db.collection('users');
}

/** Ensure unique index on googleId and slug (idempotent) */
export async function ensureUserIndexes() {
    const col = await usersCol();
    await col.createIndex({ googleId: 1 }, { unique: true, sparse: true });
    await col.createIndex({ slug: 1 }, { unique: true });
    await col.updateMany(
        { appliedCount: { $exists: false } },
        [{ $set: { appliedCount: { $size: { $ifNull: ['$appliedJobs', []] } } } }],
    );
}

// getAllUsers removed (no longer needed)

/** Return full user doc by userId (ObjectId string) */
export async function getUserById(userId) {
    if (!isValidId(userId)) return null;
    const col = await usersCol();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) return null;
    return {
        ...user,
        appliedCount: typeof user.appliedCount === 'number'
            ? user.appliedCount
            : normaliseApplied(user.appliedJobs).length,
    };
}

// createUser removed (creation now via Google)

function slugify(str) {
    return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Find or create a user from Google profile. Handles migration from slug-based users. */
export async function findOrCreateGoogleUser({ googleId, email, name, picture }) {
    const col = await usersCol();
    // 1. Try to find by googleId
    let user = await col.findOne({ googleId });
    if (user) return user;

    // 2. Try to find by email or name (migration)
    user = await col.findOne({ $or: [{ email }, { name }] });
    if (user) {
        // Link googleId/email/picture
        await col.updateOne(
            { _id: user._id },
            { $set: { googleId, email, name, picture } }
        );
        return { ...user, googleId, email, name, picture };
    }

    // 3. Create new user
    const slug = slugify(name || email);
    const now = new Date();
    const doc = {
        googleId,
        email,
        name,
        picture,
        slug,
        createdAt: now,
        lastVisitAt: now,
        appliedJobs: [],
        appliedCount: 0,
        skills: [],
        comeBackTo: [],
        dailyGoal: 5,
    };
    const result = await col.insertOne(doc);
    return { ...doc, _id: result.insertedId };
}

/** Touch lastVisitAt for a userId — returns { previousVisitAt, updatedVisitAt } */
export async function touchVisit(userId) {
    if (!isValidId(userId)) return null;
    const col = await usersCol();
    const prev = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
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
 * Returns { jobId, appliedAt, jobTitle, company, applicationURL } objects.
 */
function normaliseApplied(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(entry =>
        typeof entry === 'string'
            ? { jobId: entry, appliedAt: new Date(0), jobTitle: null, company: null, applicationURL: null, location: null, department: null, stage: 'applied', stageUpdatedAt: new Date(0) }
            : {
                jobId: entry.jobId,
                appliedAt: entry.appliedAt || new Date(0),
                jobTitle: entry.jobTitle || null,
                company: entry.company || null,
                applicationURL: entry.applicationURL || null,
                location: entry.location || null,
                department: entry.department || null,
                stage: entry.stage || 'applied',
                stageUpdatedAt: entry.stageUpdatedAt || entry.appliedAt || new Date(0),
            }
    );
}

/** Get the appliedJobs array for a userId (normalised) */
export async function getAppliedJobs(userId) {
    if (!isValidId(userId)) return [];
    const col = await usersCol();
    const user = await col.findOne({ _id: new ObjectId(userId) }, { projection: { appliedJobs: 1, _id: 0 } });
    if (!user) return null;
    return normaliseApplied(user.appliedJobs);
}

/**
 * Get enriched applied jobs with title/company/url, sorted newest-first.
 * Missing jobs are kept with a placeholder title.
 */
export async function getAppliedJobDetails(userId) {
    if (!isValidId(userId)) return [];
    const col = await usersCol();
    const user = await col.findOne({ _id: new ObjectId(userId) }, { projection: { appliedJobs: 1, _id: 0 } });
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
            { projection: { JobTitle: 1, Company: 1, ApplicationURL: 1, DirectApplyURL: 1, Location: 1, Department: 1 } }
        ).toArray()
        : [];

    const jobMap = new Map(jobs.map(job => [String(job._id), job]));

    return appliedJobs.map(entry => {
        const liveJob = jobMap.get(entry.jobId);
        return {
            jobId: entry.jobId,
            jobTitle: liveJob?.JobTitle || entry.jobTitle || 'Job no longer available',
            company: liveJob?.Company || entry.company || 'Unknown company',
            applicationURL: liveJob?.DirectApplyURL || liveJob?.ApplicationURL || entry.applicationURL || null,
            location: liveJob?.Location || entry.location || null,
            department: liveJob?.Department || entry.department || null,
            stage: entry.stage || 'applied',
            stageUpdatedAt: entry.stageUpdatedAt || entry.appliedAt,
            appliedAt: entry.appliedAt,
            isListingActive: !!liveJob,
        };
    });
} // FIX 2: Added the missing closing brace for getAppliedJobDetails()

// Valid stages for applied job status
const VALID_STAGES = ['applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'ghosted'];

/**
 * Update the stage of an applied job for a user
 */
export async function updateAppliedJobStage(userId, jobId, stage) {
    if (!isValidId(userId)) return null;
    if (!VALID_STAGES.includes(stage)) return null;
    const col = await usersCol();
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId), 'appliedJobs.jobId': jobId },
        {
            $set: {
                'appliedJobs.$.stage': stage,
                'appliedJobs.$.stageUpdatedAt': new Date(),
            },
        },
        { returnDocument: 'after' },
    );
    return result ? normaliseApplied(result.appliedJobs) : null;
}

/**
 * Add a jobId to appliedJobs for userId.
 * Increments appliedCount only when this jobId is newly added.
 */
export async function addAppliedJob(userId, jobId, jobSnapshot = {}) {
    if (!isValidId(userId) || !jobId) return [];
    const col = await usersCol();
    // Remove legacy string form first
    await col.updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { appliedJobs: jobId } },  // removes legacy string form
    );

    const entry = {
        jobId,
        appliedAt: new Date(),
        jobTitle: jobSnapshot.jobTitle || null,
        company: jobSnapshot.company || null,
        applicationURL: jobSnapshot.applicationURL || null,
        location: jobSnapshot.location || null,
        department: jobSnapshot.department || null,
        stage: 'applied',
        stageUpdatedAt: new Date(),
    };

    // Add only if not already present, and bump persistent counter once
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId), 'appliedJobs.jobId': { $ne: jobId } },
        {
            $push: { appliedJobs: entry },
            $inc: { appliedCount: 1 },
        },
        { returnDocument: 'after' },
    );

    if (result) return normaliseApplied(result.appliedJobs);

    const existing = await col.findOne({ _id: new ObjectId(userId) }, { projection: { appliedJobs: 1, _id: 0 } });
    return existing ? normaliseApplied(existing.appliedJobs) : null;
}

/** Remove a jobId from appliedJobs (handles both string and object form) for userId */
export async function removeAppliedJob(userId, jobId) {
    if (!isValidId(userId) || !jobId) return [];
    const col = await usersCol();
    // Pull both legacy string form and object form
    await col.updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { appliedJobs: jobId } },
    );
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $pull: { appliedJobs: { jobId } } },
        { returnDocument: 'after' },
    );
    return result ? normaliseApplied(result.appliedJobs) : null;
}

/**
 * Set the skills array for a userId.
 * Caller is responsible for validation/trimming/deduping.
 * Returns the updated skills array, or null if user not found.
 */
export async function updateSkills(userId, skills) {
    if (!isValidId(userId)) return [];
    const sanitised = Array.isArray(skills)
        ? skills.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()).slice(0, 100)
        : [];
    const col = await usersCol();
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: { skills: sanitised } },
        { returnDocument: 'after' },
    );
    return result ? (result.skills ?? []) : [];
}

/** Get the comeBackTo array for a userId */
export async function getComeBackTo(userId) {
    if (!isValidId(userId)) return [];
    const col = await usersCol();
    const user = await col.findOne({ _id: new ObjectId(userId) }, { projection: { comeBackTo: 1, _id: 0 } });
    if (!user) return null;
    return Array.isArray(user.comeBackTo) ? user.comeBackTo : [];
}

/**
 * Upsert a comeBackTo entry for userId.
 * If jobId already exists, updates the note and addedAt.
 * Returns the updated comeBackTo array.
 */
export async function upsertComeBackTo(userId, jobId, note) {
    if (!isValidId(userId) || !jobId) return [];
    const safeNote = typeof note === 'string' ? note.slice(0, 200) : '';
    const col = await usersCol();
    await col.updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { comeBackTo: { jobId } } },
    );
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $push: { comeBackTo: { jobId, note: safeNote, addedAt: new Date() } } },
        { returnDocument: 'after' },
    );
    return result ? (Array.isArray(result.comeBackTo) ? result.comeBackTo : []) : [];
}

export async function removeComeBackTo(userId, jobId) {
    if (!isValidId(userId) || !jobId) return [];
    const col = await usersCol();
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $pull: { comeBackTo: { jobId } } },
        { returnDocument: 'after' },
    );
    return result ? (Array.isArray(result.comeBackTo) ? result.comeBackTo : []) : null;
}

/**
 * Set the user's daily application goal for userId.
 * Validates range 1-50; defaults to 5 if not set.
 * Returns the updated dailyGoal, or null if user not found.
 */
export async function setDailyGoal(userId, goal) {
    if (!isValidId(userId)) return null;
    const col = await usersCol();
    const validated = Math.max(1, Math.min(50, parseInt(goal) || 5));
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: { dailyGoal: validated } },
        { returnDocument: 'after' },
    );
    return result ? (result.dailyGoal ?? 5) : null;
}

/**
 * Return the array of dismissed job IDs for a user.
 */
export async function getDismissedJobs(userId) {
    if (!isValidId(userId)) return [];
    const col = await usersCol();
    const user = await col.findOne(
        { _id: new ObjectId(userId) },
        { projection: { dismissedJobs: 1 } },
    );
    return Array.isArray(user?.dismissedJobs) ? user.dismissedJobs : [];
}

/**
 * Add a jobId to the user's dismissedJobs array.
 * Uses $addToSet so duplicates are never stored.
 * Returns the updated dismissedJobs array.
 */
export async function addDismissedJob(userId, jobId) {
    if (!isValidId(userId) || !jobId) return [];
    const col = await usersCol();
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $addToSet: { dismissedJobs: jobId } },
        { returnDocument: 'after' },
    );
    return Array.isArray(result?.dismissedJobs) ? result.dismissedJobs : [];
}

/**
 * Remove a jobId from the user's dismissedJobs array (undo).
 * Returns the updated dismissedJobs array.
 */
export async function removeDismissedJob(userId, jobId) {
    if (!isValidId(userId) || !jobId) return [];
    const col = await usersCol();
    const result = await col.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $pull: { dismissedJobs: jobId } },
        { returnDocument: 'after' },
    );
    return Array.isArray(result?.dismissedJobs) ? result.dismissedJobs : [];
}
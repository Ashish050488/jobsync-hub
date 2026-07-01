// FILE: src/models/employer/employer-user-model.js
// EmployerUser identity. Separate collection and separate functions from the
// seeker User — the "Employer" prefix prevents any confusion at call sites.
// companyId stays null until Company onboarding (Step 3).

import { ObjectId } from 'mongodb';
import { col } from '../../Db/connection.js';

const EMAIL_COLLATION = { locale: 'en', strength: 2 };

const employerUsersCol = () => col('employer_users');

/** Lowercase + trim an email; returns '' for null/undefined/non-string input. */
function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/** Accept a string or ObjectId; return an ObjectId or null. */
function toOid(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

/** Idempotent index setup. Called on boot. */
export async function ensureEmployerUserIndexes() {
  const collection = await employerUsersCol();
  await collection.createIndex(
    { googleId: 1 },
    { unique: true, sparse: true, name: 'employer_users_googleId' },
  );
  await collection.createIndex(
    { email: 1 },
    { unique: true, collation: EMAIL_COLLATION, name: 'employer_users_email' },
  );
  await collection.createIndex({ companyId: 1 }, { name: 'employer_users_companyId' });
}

/** Fetch an employer user by ObjectId string. Returns null when missing/invalid. */
export async function getEmployerUserById(employerUserId) {
  const oid = toOid(employerUserId);
  if (!oid) return null;
  const collection = await employerUsersCol();
  return collection.findOne({ _id: oid });
}

/**
 * Find an employer user by Google profile, or create one.
 *   1. lookup by googleId   → update lastLoginAt + return
 *   2. lookup by email      → link googleId onto it + return (manual-insert safety)
 *   3. insert a fresh doc with companyId=null
 * Relies on the unique indexes to settle races; never throws on a normal race.
 */
export async function findOrCreateEmployerGoogleUser({ googleId, email, name, picture }) {
  const collection = await employerUsersCol();
  const lowered = normalizeEmail(email);
  const now = new Date();

  const byGoogleId = await collection.findOne({ googleId });
  if (byGoogleId) {
    await collection.updateOne(
      { _id: byGoogleId._id },
      { $set: { lastLoginAt: now, updatedAt: now } },
    );
    return { ...byGoogleId, lastLoginAt: now, updatedAt: now };
  }

  const byEmail = await collection.findOne(
    { email: lowered },
    { collation: EMAIL_COLLATION },
  );
  if (byEmail) {
    await collection.updateOne(
      { _id: byEmail._id },
      { $set: { googleId, name, picture: picture || null, lastLoginAt: now, updatedAt: now } },
    );
    return { ...byEmail, googleId, name, picture: picture || null, lastLoginAt: now, updatedAt: now };
  }

  const doc = {
    googleId,
    email: lowered,
    name,
    picture: picture || null,
    companyId: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  try {
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  } catch (err) {
    // Lost an insert race — fetch and return the doc the winner created.
    if (err?.code === 11000) {
      const winner =
        (await collection.findOne({ googleId })) ||
        (await collection.findOne({ email: lowered }, { collation: EMAIL_COLLATION }));
      if (winner) return winner;
    }
    throw err;
  }
}

/**
 * Link a company onto an employer user. Called by onboarding as the final,
 * committing step. Returns the updated doc, or null when the user is missing.
 */
export async function linkCompanyToEmployerUser(employerUserId, companyId) {
  const userOid = toOid(employerUserId);
  if (!userOid) return null;
  const collection = await employerUsersCol();
  return collection.findOneAndUpdate(
    { _id: userOid },
    { $set: { companyId, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

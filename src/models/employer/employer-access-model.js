// FILE: src/models/employer/employer-access-model.js
// Admin-controlled employer signup gate. One collection, two document kinds:
//   - a singleton config doc (_id: 'config') holding the global toggle
//   - whitelist entries (kind: 'whitelist') keyed by lowercased email
// Default-deny: when the config doc is absent, signup is treated as closed.

import { col } from '../../Db/connection.js';

const CONFIG_ID = 'config';
const EMAIL_COLLATION = { locale: 'en', strength: 2 };
const MAXIMUM_NOTE_LENGTH = 200;

const accessCol = () => col('employer_access');

/** Lowercase + trim an email; returns '' for null/undefined/non-string input. */
function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/** Truncate an optional admin note to the storage limit; null when absent. */
function normalizeNote(note) {
  if (typeof note !== 'string') return null;
  return note.slice(0, MAXIMUM_NOTE_LENGTH);
}

/** Idempotent index setup. Called on boot. */
export async function ensureEmployerAccessIndexes() {
  const collection = await accessCol();
  await collection.createIndex(
    { kind: 1, email: 1 },
    {
      unique: true,
      partialFilterExpression: { kind: 'whitelist' },
      collation: EMAIL_COLLATION,
      name: 'employer_access_kind_email',
    },
  );
  await collection.createIndex({ kind: 1 }, { name: 'employer_access_kind' });
}

/** Read the gate config. Returns a default-deny shape when no doc exists (R7). */
export async function getEmployerAccessConfig() {
  const collection = await accessCol();
  const config = await collection.findOne({ _id: CONFIG_ID });
  if (!config) return { isEmployerSignupOpen: false, updatedAt: null };
  return {
    isEmployerSignupOpen: config.isEmployerSignupOpen === true,
    updatedAt: config.updatedAt || null,
  };
}

/** Flip the global signup toggle. Upserts the singleton config doc. */
export async function setEmployerSignupOpen(isOpen, adminUserId) {
  const collection = await accessCol();
  const updatedAt = new Date();
  await collection.updateOne(
    { _id: CONFIG_ID },
    {
      $set: {
        kind: 'config',
        isEmployerSignupOpen: isOpen === true,
        updatedAt,
        updatedByUserId: adminUserId || null,
      },
    },
    { upsert: true },
  );
  return { isEmployerSignupOpen: isOpen === true, updatedAt };
}

/** List whitelist entries, newest first. */
export async function listEmployerAccessWhitelist() {
  const collection = await accessCol();
  return collection
    .find({ kind: 'whitelist' })
    .sort({ addedAt: -1 })
    .toArray();
}

/**
 * Add a whitelist entry. Idempotent: if the email already exists (any case),
 * the existing entry is returned unchanged rather than inserting a duplicate.
 */
export async function addEmployerAccessWhitelistEntry(email, note, adminUserId) {
  const lowered = normalizeEmail(email);
  if (!lowered) return null;
  const collection = await accessCol();

  const existing = await collection.findOne(
    { kind: 'whitelist', email: lowered },
    { collation: EMAIL_COLLATION },
  );
  if (existing) return existing;

  const entry = {
    kind: 'whitelist',
    email: lowered,
    note: normalizeNote(note),
    addedAt: new Date(),
    addedByUserId: adminUserId || null,
  };
  try {
    const result = await collection.insertOne(entry);
    return { ...entry, _id: result.insertedId };
  } catch (err) {
    // Lost an insert race against the unique index — return the winner.
    if (err?.code === 11000) {
      return collection.findOne(
        { kind: 'whitelist', email: lowered },
        { collation: EMAIL_COLLATION },
      );
    }
    throw err;
  }
}

/** Remove a whitelist entry. Idempotent: missing entry is not an error. */
export async function removeEmployerAccessWhitelistEntry(email) {
  const lowered = normalizeEmail(email);
  if (!lowered) return { deleted: false };
  const collection = await accessCol();
  await collection.deleteOne(
    { kind: 'whitelist', email: lowered },
    { collation: EMAIL_COLLATION },
  );
  return { deleted: true };
}

/**
 * Core gate function. Returns true when the global toggle is open OR the
 * (case-insensitively matched) email is whitelisted. Never throws on bad input.
 */
export async function isEmployerSignupAllowed(email) {
  const collection = await accessCol();

  const config = await collection.findOne({ _id: CONFIG_ID });
  if (config?.isEmployerSignupOpen === true) return true;

  const lowered = normalizeEmail(email);
  if (!lowered) return false;

  const hit = await collection.findOne(
    { kind: 'whitelist', email: lowered },
    { collation: EMAIL_COLLATION },
  );
  return !!hit;
}

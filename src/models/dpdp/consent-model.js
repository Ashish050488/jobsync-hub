// FILE: src/models/dpdp/consent-model.js
// consents collection — one document per consent grant (DPDP Rule 3 evidence).
// Every user-scoped read carries the owning userId (§6.5). ipAddress + userAgent
// are evidence fields, stripped from client responses by toPublicConsent (R1).

import { ObjectId } from 'mongodb';
import { col } from '../../Db/connection.js';

const consentsCol = () => col('consents');

/** Accept a string or ObjectId; return an ObjectId or null. */
function toOid(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

/** Idempotent index setup. Called on boot. */
export async function ensureConsentIndexes() {
  const collection = await consentsCol();
  await collection.createIndex({ userId: 1, purpose: 1, grantedAt: -1 }, { name: 'consents_user_purpose' });
  await collection.createIndex({ userId: 1, withdrawnAt: 1 }, { name: 'consents_user_active' });
}

/** Pure insert. Stamps createdAt/updatedAt. Returns the inserted doc. */
export async function insertConsent(doc) {
  const collection = await consentsCol();
  const now = new Date();
  const full = {
    userId: toOid(doc.userId),
    contactEmail: doc.contactEmail ?? null,
    purpose: doc.purpose,
    dataItems: doc.dataItems,
    grantedAt: doc.grantedAt ?? now,
    withdrawnAt: doc.withdrawnAt ?? null,
    noticeVersion: doc.noticeVersion,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    method: doc.method,
    crossBorderTransfer: doc.crossBorderTransfer ?? false,
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection.insertOne(full);
  return { ...full, _id: result.insertedId };
}

/** Fetch a consent by id. Returns null when missing/invalid. */
export async function findConsentById(consentId) {
  const oid = toOid(consentId);
  if (!oid) return null;
  const collection = await consentsCol();
  return collection.findOne({ _id: oid });
}

/** The user's active (non-withdrawn) consent for a purpose, or null. */
export async function findActiveConsentForUser(userId, purpose) {
  const oid = toOid(userId);
  if (!oid) return null;
  const collection = await consentsCol();
  return collection.findOne({ userId: oid, purpose, withdrawnAt: null });
}

/** All consents for a user. Hides withdrawn unless includeWithdrawn is set. */
export async function listConsentsForUser(userId, { includeWithdrawn = false } = {}) {
  const oid = toOid(userId);
  if (!oid) return [];
  const collection = await consentsCol();
  const filter = includeWithdrawn ? { userId: oid } : { userId: oid, withdrawnAt: null };
  return collection.find(filter).sort({ grantedAt: -1 }).toArray();
}

/** Mark a consent withdrawn, scoped to its owner (§6.5). Returns updated doc. */
export async function markConsentWithdrawn(consentId, userId) {
  const consentOid = toOid(consentId);
  const ownerOid = toOid(userId);
  if (!consentOid || !ownerOid) return null;
  const collection = await consentsCol();
  const now = new Date();
  return collection.findOneAndUpdate(
    { _id: consentOid, userId: ownerOid },
    { $set: { withdrawnAt: now, updatedAt: now } },
    { returnDocument: 'after' },
  );
}

/** Client-safe projection — strips ipAddress + userAgent evidence fields. */
export function toPublicConsent(consent) {
  return {
    id: consent._id.toString(),
    purpose: consent.purpose,
    dataItems: consent.dataItems,
    grantedAt: consent.grantedAt,
    withdrawnAt: consent.withdrawnAt ?? null,
    noticeVersion: consent.noticeVersion,
    method: consent.method,
    crossBorderTransfer: consent.crossBorderTransfer ?? false,
    createdAt: consent.createdAt,
  };
}

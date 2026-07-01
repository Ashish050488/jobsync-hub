// FILE: tests/_helpers/test-db.js
// Shared test database helper. MUST be the FIRST import in every test file:
// its top-level body redirects MONGO_URI to a SEPARATE test database BEFORE any
// src module (which reads env at import time) is evaluated. src modules are
// pulled in lazily via dynamic import so they observe the redirected env.
//
// Developer note: set MONGO_URI_TEST locally to override the default
// (mongodb://localhost:27017/jobmesh_test). Tests never run against MONGO_URI.

process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/jobmesh_test';
process.env.EMPLOYER_JWT_SECRET = process.env.EMPLOYER_JWT_SECRET || 'test-employer-jwt-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-seeker-jwt-secret';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.ADMIN_EMAILS = process.env.ADMIN_EMAILS || 'admin@jobmesh.in';

export async function connectTestDb() {
  const { connectToDb } = await import('../../src/Db/connection.js');
  return connectToDb();
}

export async function closeTestDb() {
  const { closeDb } = await import('../../src/Db/connection.js');
  await closeDb();
}

/** Drop the named collections if they exist. Missing collections are ignored. */
export async function dropCollections(...names) {
  const db = await connectTestDb();
  const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  for (const name of names) {
    if (existing.includes(name)) await db.collection(name).drop();
  }
}

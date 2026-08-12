/**
 * logAdminAccess — Audit trail for admin panel access attempts.
 *
 * Why this exists
 * ---------------
 * We need to track who tries to access the admin panel, both successful
 * and denied attempts. The audit log is stored in RTDB at `auditLog/`
 * which is NOT writable by clients (database rules). This function is
 * the ONLY path that can write there.
 *
 * Rate limit: 20 calls / 60 seconds per UID.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.database();

const RATE = { WINDOW_MS: 60 * 1000, MAX: 20 };
const _buckets = new Map();

function checkRate(uid) {
  const now = Date.now();
  const bucket = _buckets.get(uid) || [];
  const fresh = bucket.filter((t) => now - t < RATE.WINDOW_MS);
  if (fresh.length >= RATE.MAX) return false;
  fresh.push(now);
  _buckets.set(uid, fresh);
  return true;
}

exports.logAdminAccess = functions.https.onCall(async (data, context) => {
  // Auth is optional here (denied attempts may come from unauthenticated users)
  const uid = context.auth ? context.auth.uid : null;
  const email = context.auth ? (context.auth.token && context.auth.token.email) : null;

  // Rate limit by UID (or IP fallback) so a malicious actor can't flood the log.
  const key = uid || (data && data._ip) || 'anon';
  if (!checkRate(key)) {
    throw new functions.https.HttpsError('resource-exhausted', 'Quá nhiều yêu cầu.');
  }

  const entry = {
    action: 'admin_access',
    uid: uid || null,
    email: email || (data && data.email) || null,
    granted: Boolean(data && data.granted),
    role: (data && data.role) || null,
    reason: (data && data.reason) || null,
    path: (data && data.path) || '',
    userAgent: (data && data.ua) || null,
    grantedByRole: (data && data.granted && data.role) ? 'firebase' : null,
    clientTs: Number(data && data.at) || Date.now(),
  };

  try {
    const ref = db.ref('auditLog/adminAccess').push();
    await ref.set({
      ...entry,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      serverTs: Date.now(),
    });
  } catch (e) {
    console.warn('[logAdminAccess] write failed:', e && e.message);
    // Do NOT throw — audit failure must not break the admin gate UX.
  }

  return { success: true };
});

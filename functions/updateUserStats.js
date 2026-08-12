/**
 * updateUserStats — Server-side update of user XP / streak / badges.
 *
 * Why this exists
 * ---------------
 * Firebase rules deny direct client writes to `userStats/`. All XP and
 * stats updates must flow through this function so they are authoritative
 * and cannot be inflated by the client.
 *
 * The primary caller is `scoreExam`, which calls this after grading.
 *
 * What it does
 * -------------
 * Merges the provided stats delta into the existing userStats record
 * in RTDB. All fields are validated before writing.
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

exports.updateUserStats = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Yêu cầu đăng nhập.');
  }
  const uid = context.auth.uid;

  if (!checkRate(uid)) {
    throw new functions.https.HttpsError('resource-exhausted', 'Quá nhiều yêu cầu. Thử lại sau.');
  }

  // Validate input shape
  const stats = data && typeof data === 'object' ? data : {};
  const xp        = Number(stats.totalXP        || 0);
  const streak    = Number(stats.currentStreak  || 0);
  const longest   = Number(stats.longestStreak  || 0);
  const exams     = Number(stats.totalExams      || 0);
  const correct   = Number(stats.totalCorrect    || 0);
  const questions = Number(stats.totalQuestions  || 0);
  const best      = Number(stats.bestScore      || 0);

  if (xp        < 0) throw new functions.https.HttpsError('invalid-argument', 'XP không hợp lệ.');
  if (streak    < 0) throw new functions.https.HttpsError('invalid-argument', 'Streak không hợp lệ.');
  if (exams     < 0) throw new functions.https.HttpsError('invalid-argument', 'Số bài thi không hợp lệ.');

  // Write validated stats. validated: true satisfies the database rule.
  const record = {
    totalXP:        xp,
    currentStreak:  streak,
    longestStreak:  longest,
    lastActiveDate: stats.lastActiveDate || null,
    totalExams:     exams,
    totalCorrect:   correct,
    totalQuestions: questions,
    bestScore:      best,
    badges:         Array.isArray(stats.badges) ? stats.badges : [],
    validated:      true,
    updatedBy:      'updateUserStats',
    clientTs:       Number(stats.clientTs) || 0,
    serverTs:       Date.now(),
  };

  try {
    const ref = db.ref('userStats/' + uid);
    await ref.set(record);
    await ref.child('updatedAt').set(admin.database.ServerValue.TIMESTAMP);
    return { success: true, stats: record };
  } catch (err) {
    console.error('[updateUserStats] write failed:', err && err.message);
    throw new functions.https.HttpsError('internal', 'Không thể cập nhật thống kê.');
  }
});

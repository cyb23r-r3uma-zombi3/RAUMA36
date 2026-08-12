/**
 * scoreExam — Secure server-side exam grading for Sky Edu.
 *
 * Why this exists
 * ---------------
 * Prior to this function, grading happened entirely client-side and the
 * resulting score was pushed to Firebase by the browser. That meant a
 * student could:
 *   - edit the questions locally before taking the exam
 *   - fake their score before it was uploaded
 *   - inflate leaderboard / XP values
 *
 * scoreExam removes all of those vectors:
 *   1. The exam is fetched server-side from RTDB (immutable copy).
 *   2. The user's answers are graded against the authoritative question
 *      definitions using the SAME logic the renderer uses client-side.
 *   3. The result is written with a `validated: true` flag and an audit
 *      log entry. Firebase rules refuse any client write that lacks the
 *      `validated: true` flag (see database.rules.json).
 *   4. Duplicate submissions within 60s are deduplicated (idempotent).
 *   5. Rate-limit per user: 10 submissions / 5 minutes.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.database();

// ------------------------------------------------------------------
// Rate limiting (in-memory). Resets on cold start — acceptable because
// the worst case is letting through a few extra requests after a
// function restart, not a security bypass.
// ------------------------------------------------------------------
const RATE = { WINDOW_MS: 5 * 60 * 1000, MAX: 10 };
const _rateBuckets = new Map();

function checkRate(uid) {
  const now = Date.now();
  const bucket = _rateBuckets.get(uid) || [];
  const fresh = bucket.filter((t) => now - t < RATE.WINDOW_MS);
  if (fresh.length >= RATE.MAX) return false;
  fresh.push(now);
  _rateBuckets.set(uid, fresh);
  return true;
}

// ------------------------------------------------------------------
// Grading — mirrors QuestionTypes.grade() from assets/js/question-types.js
// Returns { correct: boolean, earned: number, max: number }.
// ------------------------------------------------------------------
function gradeOne(question, userAnswer) {
  const type = (question.type || 'mcq_single').toLowerCase();
  const max = Number(question.points || 1);

  switch (type) {
    case 'mcq_single': {
      const correct = String(question.correctAnswer || '').trim();
      const saved = String(userAnswer == null ? '' : userAnswer).trim();
      if (!correct) return { correct: false, earned: 0, max };
      if (saved === correct) return { correct: true, earned: max, max };
      // Also allow answer stored as the option text (back-compat)
      if (Array.isArray(question.options) && question.options.includes(saved)) {
        const idx = question.options.indexOf(saved);
        const letter = String.fromCharCode(65 + idx);
        if (letter === correct) return { correct: true, earned: max, max };
      }
      return { correct: false, earned: 0, max };
    }

    case 'mcq_multi': {
      // Unescape HTML entities - Firebase stores options without HTML entities,
      // but correctAnswers may have escaped values from form submission
      function unescapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }

      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const rawCorrect = Array.isArray(question.correctAnswers)
        ? question.correctAnswers
        : [];

      // Log warning if correctAnswers is suspiciously empty
      if (rawCorrect.length === 0) {
        console.warn('[scoreExam] mcq_multi: empty correctAnswers', {
          qid: question.id || 'unknown',
          options: question.options
        });
      }

      // Normalize correctAnswers: convert letters to option text, then unescape
      const correct = rawCorrect
        .filter(ans => ans != null && String(ans).trim() !== '')
        .map(ans => {
          const idx = letters.indexOf(ans);
          if (idx >= 0 && question.options && question.options[idx] !== undefined) {
            return unescapeHtml(question.options[idx]);
          }
          return unescapeHtml(ans);
        })
        .sort();

      // If all answers were invalid/empty
      if (!correct.length) {
        console.error('[scoreExam] mcq_multi: corrupted correctAnswers after normalization', {
          qid: question.id || 'unknown',
          original: rawCorrect,
          options: question.options
        });
        return { correct: false, earned: 0, max };
      }

      // Normalize userAnswer
      const rawSaved = Array.isArray(userAnswer) ? userAnswer : [];
      const saved = rawSaved
        .filter(ans => ans != null && String(ans).trim() !== '')
        .map(ans => {
          const unescaped = unescapeHtml(ans);
          const idx = letters.indexOf(unescaped);
          if (idx >= 0 && question.options && question.options[idx] !== undefined) {
            return unescapeHtml(question.options[idx]);
          }
          return unescaped;
        })
        .sort();

      const isExact = JSON.stringify(correct) === JSON.stringify(saved);
      if (isExact) return { correct: true, earned: max, max };
      const setC = new Set(correct);
      const setS = new Set(saved);
      const intersect = [...setS].filter((v) => setC.has(v)).length;
      if (intersect === 0) return { correct: false, earned: 0, max };
      const ratio = intersect / correct.length;
      return { correct: false, earned: Math.round(ratio * max * 100) / 100, max };
    }

    case 'true_false': {
      const correct = String(question.correctAnswer || '').toLowerCase();
      const saved = String(userAnswer == null ? '' : userAnswer).toLowerCase();
      if (!correct) return { correct: false, earned: 0, max };
      return { correct: saved === correct, earned: saved === correct ? max : 0, max };
    }

    case 'fill_blank': {
      const answers = Array.isArray(question.correctAnswers)
        ? question.correctAnswers
        : [];
      const saved = Array.isArray(userAnswer) ? userAnswer : [];
      if (!answers.length) return { correct: false, earned: 0, max };
      let totalEarned = 0;
      let totalPossible = answers.length;
      let exactHits = 0;
      for (let i = 0; i < answers.length; i++) {
        const accept = answers[i];
        const given = (saved[i] == null ? '' : String(saved[i])).trim();
        if (!accept) continue;
        const accepted = Array.isArray(accept) ? accept : [accept];
        const hit = accepted.some((a) => norm(String(a)) === norm(given));
        if (hit) {
          totalEarned += max / answers.length;
          exactHits++;
        }
      }
      const isPerfect = exactHits === totalPossible;
      return {
        correct: isPerfect,
        earned: round2(totalEarned),
        max,
      };
    }

    case 'matching': {
      const pairs = question.pairs || [];
      const saved = (userAnswer && typeof userAnswer === 'object') ? userAnswer : {};
      if (!pairs.length) return { correct: false, earned: 0, max };
      let hits = 0;
      for (let i = 0; i < pairs.length; i++) {
        if (saved[i] != null && String(saved[i]) === String(pairs[i].right)) hits++;
      }
      const isPerfect = hits === pairs.length;
      return {
        correct: isPerfect,
        earned: round2((hits / pairs.length) * max),
        max,
      };
    }

    case 'drag_drop': {
      const choices = Array.isArray(question.choices) ? question.choices : [];
      const saved = (userAnswer && typeof userAnswer === 'object' && !Array.isArray(userAnswer))
        ? userAnswer
        : {};
      if (!choices.length) return { correct: false, earned: 0, max };
      let hits = 0;
      for (let i = 0; i < choices.length; i++) {
        if (saved[i] != null && String(saved[i]) === String(choices[i])) hits++;
      }
      const isPerfect = hits === choices.length;
      return {
        correct: isPerfect,
        earned: round2((hits / choices.length) * max),
        max,
      };
    }

    case 'matrix_choice': {
      const rows = Array.isArray(question.rows) ? question.rows : [];
      const saved = (userAnswer && typeof userAnswer === 'object' && !Array.isArray(userAnswer))
        ? userAnswer
        : {};
      if (!rows.length) return { correct: false, earned: 0, max };
      let hits = 0;
      for (let i = 0; i < rows.length; i++) {
        const expected = String(rows[i].correct || '');
        if (expected && String(saved[i]) === expected) hits++;
      }
      const isPerfect = hits === rows.length;
      return {
        correct: isPerfect,
        earned: round2((hits / rows.length) * max),
        max,
      };
    }

    case 'word_arrange':
    case 'sentence_order': {
      const correct = Array.isArray(question.correctOrder) ? question.correctOrder.map(String) : [];
      const saved = Array.isArray(userAnswer) ? userAnswer.map(String) : [];
      const isPerfect = JSON.stringify(correct) === JSON.stringify(saved);
      return { correct: isPerfect, earned: isPerfect ? max : 0, max };
    }

    case 'essay': {
      // Essays can never be auto-graded. Mark as needs-review.
      return { correct: false, earned: 0, max, needsReview: true };
    }

    case 'short_answer': {
      // Trả lời ngắn - so sánh string trực tiếp, case-insensitive
      const correct = norm(String(question.correctAnswer || ''));
      const saved = norm(String(userAnswer == null ? '' : userAnswer));
      if (!correct) return { correct: false, earned: 0, max };
      // Hỗ trợ nhiều đáp án đúng (phân cách bằng -)
      const correctOptions = correct.split('-').map(a => a.trim()).filter(Boolean);
      const isCorrect = correctOptions.some(opt => opt === saved);
      return { correct: isCorrect, earned: isCorrect ? max : 0, max };
    }

    default: {
      // Unknown type — fail closed (0 points) to avoid silent inflating.
      return { correct: false, earned: 0, max };
    }
  }
}

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function sha256(s) {
  // Lazy require so unit tests can stub crypto.
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(s))
    .then((buf) => {
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    });
}

// Use Node's built-in crypto.subtle (available via globalThis in v18+).
const crypto = require('crypto').webcrypto;

// ------------------------------------------------------------------
// Audit log writer
// ------------------------------------------------------------------
async function writeAudit(entry) {
  try {
    const ref = db.ref('auditLog').push();
    await ref.set({
      ...entry,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });
  } catch (e) {
    console.warn('[scoreExam] audit log failed', e && e.message);
  }
}

// ------------------------------------------------------------------
// scoreExam — main entry point
// ------------------------------------------------------------------
exports.scoreExam = functions.https.onCall(async (data, context) => {
  // 1. Authentication
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập để nộp bài.');
  }
  const uid = context.auth.uid;

  // 2. Input validation
  const examId = data && data.examId;
  const userAnswers = data && data.userAnswers;
  const timeUsed = Number((data && data.timeUsed) || 0);
  const submittedAt = Number((data && data.timestamp) || Date.now());

  if (!examId || typeof examId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu examId.');
  }
  if (!userAnswers || typeof userAnswers !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu userAnswers.');
  }

  // 3. Rate limit
  if (!checkRate(uid)) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Bạn nộp bài quá nhanh. Vui lòng thử lại sau ít phút.'
    );
  }

  // 4. Ban check
  const userSnap = await db.ref('users/' + uid).once('value');
  const user = userSnap.val();
  if (user && user.banned === true) {
    throw new functions.https.HttpsError('permission-denied', 'Tài khoản đã bị khóa.');
  }

  // 5. Idempotency: if a result was submitted for this (uid, examId) within
  //    the last 60s, return it instead of writing again.
  const recentSnap = await db
    .ref('examResults')
    .child(uid)
    .orderByChild('examId')
    .equalTo(examId)
    .once('value');
  const recent = recentSnap.val() || {};
  const now = Date.now();
  for (const k of Object.keys(recent)) {
    const r = recent[k];
    if (r && r.submittedAt && now - Number(r.submittedAt) < 60000) {
      // Return existing result so the client gets an idempotent response.
      return { ...r, resultId: k, idempotent: true };
    }
  }

  // 6. Fetch authoritative exam (server-side; user can't tamper).
  const examSnap = await db.ref('phongluyen_exams/' + examId).once('value');
  if (!examSnap.exists()) {
    // Fallback to generic exams/ collection
    const alt = await db.ref('exams/' + examId).once('value');
    if (!alt.exists()) {
      throw new functions.https.HttpsError('not-found', 'Đề thi không tồn tại.');
    }
    var exam = alt.val();
  } else {
    var exam = examSnap.val();
  }
  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  if (questions.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Đề thi chưa có câu hỏi.');
  }

  // 7. Grade each question server-side.
  let correctCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  const gradedDetails = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qid = q && (q.id || ('q' + (i + 1)));
    const ans = userAnswers[qid];
    const r = gradeOne(q, ans);
    if (r.correct) correctCount++;
    totalPoints += r.max;
    earnedPoints += r.earned;
    gradedDetails.push({
      qid,
      earned: r.earned,
      max: r.max,
      needsReview: !!r.needsReview,
    });
  }

  const score10 = totalPoints > 0 ? round2((earnedPoints / totalPoints) * 10) : 0;
  const scorePct = totalPoints > 0 ? round2((earnedPoints / totalPoints) * 100) : 0;
  const wrong = Math.max(0, questions.length - correctCount);
  const skipped = questions.length - answeredCount(questions, userAnswers);

  // 8. Build result record (validated: true is REQUIRED by database rules).
  const resultId = db.ref('examResults').child(uid).push().key;
  const examChecksum = await sha256(JSON.stringify({ id: examId, q: questions.length }));
  const resultRecord = {
    examId,
    examName: typeof exam.name === 'string' ? exam.name.slice(0, 500) : '',
    uid,
    score: score10,                  // 0..10 scale (display)
    scorePercent: scorePct,          // 0..100 scale
    correct: correctCount,
    wrong,
    skipped,
    total: questions.length,
    answered: answeredCount(questions, userAnswers),
    timeUsed,
    totalTime: Number(exam.timeMinutes || 60) * 60,
    submittedAt,
    completedAt: new Date(submittedAt).toISOString(),
    validated: true,                 // <- rules require this
    checksum: examChecksum,
    serverVersion: 1,
    details: gradedDetails,
  };

  // 9. Persist (with rules enforcement — client could not do this directly).
  await db.ref('examResults/' + uid + '/' + resultId).set(resultRecord);

  // 10. Update per-exam leaderboard (server-side only).
  const lbEntry = {
    uid,
    examId,
    examName: resultRecord.examName,
    subject: typeof exam.subject === 'string' ? exam.subject : (exam.type || ''),
    score: score10,
    correct: correctCount,
    total: questions.length,
    timeUsed,
    completedAt: resultRecord.completedAt,
    displayName: (user && (user.fullname || user.username)) || '',
    username: (user && user.username) || '',
    avatar: (user && user.avatar) || null,
    validated: true,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  };
  await db.ref('leaderboardByExam/' + examId + '/' + uid).set(lbEntry);

  // 11. Update aggregate userStats (XP / totalExams / streak) — server-side.
  const xpDelta = computeXP(resultRecord);
  const statsSnap = await db.ref('userStats/' + uid).once('value');
  const prev = statsSnap.val() || {};
  const merged = mergeStats(prev, resultRecord, xpDelta);
  await db.ref('userStats/' + uid).set({ ...merged, uid, validated: true });

  // 12. Update global leaderboard summary.
  const lbGlobal = {
    uid,
    username: lbEntry.username,
    displayName: lbEntry.displayName,
    avatar: lbEntry.avatar,
    xp: merged.totalXP,
    level: merged.level,
    streak: merged.currentStreak,
    badges: Array.isArray(merged.badges) ? merged.badges.length : 0,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
    validated: true,
  };
  await db.ref('leaderboard/' + uid).set(lbGlobal);

  // 13. Audit log entry.
  await writeAudit({
    action: 'exam_submitted',
    actor: uid,
    changes: { examId, resultId, score: score10, scorePct },
    ipAddress: (context.rawRequest && context.rawRequest.ip) || 'unknown',
    userAgent: (context.rawRequest && context.rawRequest.headers && context.rawRequest.headers['user-agent']) || 'unknown',
  });

  return { ...resultRecord, resultId };
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function answeredCount(questions, userAnswers) {
  let n = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qid = q && (q.id || ('q' + (i + 1)));
    const a = userAnswers[qid];
    if (a == null) continue;
    if (Array.isArray(a)) {
      if (a.length > 0 && a.some((v) => v != null && String(v).trim() !== '')) n++;
    } else if (typeof a === 'object') {
      if (Object.values(a).some((v) => v != null && String(v).trim() !== '')) n++;
    } else if (String(a).trim() !== '') {
      n++;
    }
  }
  return n;
}

function computeXP(r) {
  let xp = 10; // base
  xp += r.correct * 2;
  if (r.scorePercent >= 100) xp += 50;
  else if (r.scorePercent >= 80) xp += 25;
  if (r.skipped === 0) xp += 15;
  if (r.timeUsed && r.totalTime && r.timeUsed < r.totalTime * 0.5) xp += 10;
  return xp;
}

function mergeStats(prev, r, xpDelta) {
  const totalXP = (Number(prev.totalXP) || 0) + xpDelta;
  const totalExams = (Number(prev.totalExams) || 0) + 1;
  const totalCorrect = (Number(prev.totalCorrect) || 0) + (r.correct || 0);
  const totalQuestions = (Number(prev.totalQuestions) || 0) + (r.total || 0);

  const today = new Date().toDateString();
  let currentStreak = Number(prev.currentStreak) || 0;
  if (prev.lastActiveDate === today) {
    // already counted today
  } else {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (prev.lastActiveDate === y.toDateString()) currentStreak++;
    else currentStreak = 1;
  }
  const longestStreak = Math.max(Number(prev.longestStreak) || 0, currentStreak);

  // Simple level mapping — matches LEVELS[].minXP in assets/js/gamification.js
  const LEVELS = [0, 100, 300, 600, 1000, 2000, 4000, 8000, 15000, 30000];
  let level = 1;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i]) { level = i + 1; break; }
  }

  return {
    totalXP,
    totalExams,
    totalCorrect,
    totalQuestions,
    currentStreak,
    longestStreak,
    lastActiveDate: today,
    bestScore: Math.max(Number(prev.bestScore) || 0, r.scorePercent || 0),
    level,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  };
}
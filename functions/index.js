/**
 * Sky Edu — Cloud Functions entry point.
 *
 * Exports:
 *   - scoreExam        (httpsCallable)  Secure server-side exam grading.
 *   - logAdminAccess   (httpsCallable)  Audit trail for admin panel access.
 *   - updateUserStats  (httpsCallable)  Server-side XP / streak / badge update.
 *   - submitForReview  (httpsCallable)  Reserved hook for future review workflows.
 *
 * Only functions declared here will be deployed.
 */

const { scoreExam } = require('./scoreExam');
const { logAdminAccess } = require('./logAdminAccess');
const { updateUserStats } = require('./updateUserStats');

exports.scoreExam        = scoreExam;
exports.logAdminAccess   = logAdminAccess;
exports.updateUserStats  = updateUserStats;
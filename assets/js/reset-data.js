/**
 * RESET TOOL - Xóa toàn bộ dữ liệu đề thi & câu hỏi trong localStorage
 *
 * Cách dùng:
 *   1. Mở trang web bất kỳ (ví dụ index.html)
 *   2. Mở DevTools (F12) → Console
 *   3. Dán toàn bộ nội dung file này vào Console, Enter
 *   4. Hoặc gõ:  fetch('assets/js/reset-data.js').then(r=>r.text()).then(eval)
 */
(function resetAllExamData() {
    const KEYS_TO_REMOVE = [
        'exams',                  // Phòng luyện TSA/HSA
        'sky_exams',              // Alias admin cũ
        'phongluyen_exams',       // Firebase path alias
        'currentExam',            // Đề đang làm
        'examProgress',           // Tiến độ làm bài
        'examResult',             // Kết quả (key chung)
        'examResultHSA',          // Kết quả HSA
        'examResultTSA',          // Kết quả TSA
        'examHistory',            // Lịch sử làm bài (dashboard)
        'questionBank',           // Kho câu hỏi admin
        'questionCategories',     // Thư mục
        'questionDraft',          // Bản nháp câu hỏi
        'examDraft',              // Bản nháp đề
        'exam-tsa-skyedu-imported',
        'exam-hsa-skyedu-imported',
        'skyedu_dashboard',
        'skyedu_gamification',
        'skyedu_leaderboard'
    ];

    let removed = 0;
    KEYS_TO_REMOVE.forEach(k => {
        if (localStorage.getItem(k) !== null) {
            localStorage.removeItem(k);
            removed++;
        }
    });

    // Reset sessionStorage cũng
    try { sessionStorage.clear(); } catch (e) { console.error('[ResetData] SessionStorage clear error:', e); }

    console.log('✅ Đã xóa', removed, 'key trong localStorage.');
    console.log('🔄 Reload trang để thấy thay đổi: location.reload();');
})();

/**
 * admin-ai.js - AI Assistant & auto features
 * Tách ra từ admin.html để giảm dung lượng
 */
(function(global) {
    'use strict';

    // AI Panel visibility
    function showAIPanel() {
        var panel = document.getElementById('aiPanel');
        if (panel) panel.style.display = 'block';
    }

    function hideAIPanel() {
        var panel = document.getElementById('aiPanel');
        if (panel) panel.style.display = 'none';
    }

    function toggleAIPanel() {
        var panel = document.getElementById('aiPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    // Refresh AI assistant display
    function refreshAIAssistant() {
        var panel = document.getElementById('aiAssistantContent');
        if (panel) {
            panel.innerHTML = '<p style="color:var(--text-muted);text-align:center;">AI Assistant đang được cập nhật...</p>';
        }
    }

    function refreshAIExamAssistant() {
        var panel = document.getElementById('aiExamAssistantContent');
        if (panel) {
            panel.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Đang phân tích đề thi...</p>';
        }
    }

    // AI Suggestion functions (stubs - implement based on AI service)
    function aiAutoLatex() {
        if (global.App && global.App.toast) {
            global.App.toast('AI Auto LaTeX: Chọn văn bản cần chuyển đổi', 'info');
        }
    }

    function aiSuggestDistractors() {
        if (global.App && global.App.toast) {
            global.App.toast('AI gợi ý đáp án sai...', 'info');
        }
        // Placeholder - integrate with AI service
        setTimeout(function() {
            if (global.App && global.App.toast) {
                global.App.toast('Đã gợi ý 3 đáp án nhiễu', 'success');
            }
        }, 1000);
    }

    function aiGuessCorrect() {
        if (global.App && global.App.toast) {
            global.App.toast('AI dự đoán đáp án đúng...', 'info');
        }
    }

    function aiSuggestSimilar() {
        if (global.App && global.App.toast) {
            global.App.toast('AI tìm câu hỏi tương tự...', 'info');
        }
    }

    function aiApplySample() {
        if (global.App && global.App.toast) {
            global.App.toast('Đã áp dụng mẫu', 'success');
        }
    }

    function aiAddTag() {
        if (global.App && global.App.toast) {
            global.App.toast('AI gợi ý tags...', 'info');
        }
    }

    // Exam AI functions
    function aiApplySuggestedTime() {
        if (global.App && global.App.toast) {
            global.App.toast('AI tính toán thời gian gợi ý...', 'info');
        }
    }

    function aiAutoSelectQuestions() {
        if (global.App && global.App.toast) {
            global.App.toast('AI đang chọn câu hỏi phù hợp...', 'info');
        }
    }

    function aiOptimizeExam() {
        if (global.App && global.App.toast) {
            global.App.toast('AI tối ưu hóa đề thi...', 'info');
        }
    }

    function aiSaveDraft() {
        if (global.App && global.App.toast) {
            global.App.toast('Đã lưu bản nháp', 'success');
        }
    }

    function aiExportExam() {
        if (global.App && global.App.toast) {
            global.App.toast('Đang xuất đề thi...', 'info');
        }
    }

    // Render sample suggestions UI
    function renderSampleSuggestions() {
        var container = document.getElementById('sampleSuggestions');
        if (!container) return;

        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">' +
            '<p>Chọn một câu hỏi để xem gợi ý mẫu</p>' +
            '</div>';
    }

    // Export
    global.AdminAI = {
        showAIPanel: showAIPanel,
        hideAIPanel: hideAIPanel,
        toggleAIPanel: toggleAIPanel,
        refreshAIAssistant: refreshAIAssistant,
        refreshAIExamAssistant: refreshAIExamAssistant,
        aiAutoLatex: aiAutoLatex,
        aiSuggestDistractors: aiSuggestDistractors,
        aiGuessCorrect: aiGuessCorrect,
        aiSuggestSimilar: aiSuggestSimilar,
        aiApplySample: aiApplySample,
        aiAddTag: aiAddTag,
        aiApplySuggestedTime: aiApplySuggestedTime,
        aiAutoSelectQuestions: aiAutoSelectQuestions,
        aiOptimizeExam: aiOptimizeExam,
        aiSaveDraft: aiSaveDraft,
        aiExportExam: aiExportExam,
        renderSampleSuggestions: renderSampleSuggestions
    };

})(typeof window !== 'undefined' ? window : globalThis);

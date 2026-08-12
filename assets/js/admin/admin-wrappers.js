/**
 * admin-wrappers.js - Maps module functions to App object
 * Tách ra từ admin.html để giảm dung lượng
 */
(function(global) {
    'use strict';

    // Wait for all modules to load (with safety timeout)
    // [FIX] Previously polled forever every 50ms if any module failed to load
    // (network error, 404, blocked CDN) — this blocked App.init() from ever running
    // and the admin panel stayed non-interactive indefinitely.
    // Now: bounded retries + timeout + safe callback fallback so admin still initializes.
    var WAIT_MAX_RETRIES = 60;        // 60 * 50ms = 3 seconds
    var WAIT_RETRY_DELAY = 50;
    function waitForModules(callback) {
        var required = ['AdminDashboard', 'AdminBank', 'AdminPicker', 'AdminPreview', 'AdminForm', 'AdminAI', 'AdminExam'];
        var retries = 0;
        var aborted = false;
        var check = function() {
            if (aborted) return;
            var allReady = required.every(function(name) {
                return typeof global[name] !== 'undefined';
            });
            if (allReady) {
                callback(false /* no missing */);
                return;
            }
            retries++;
            if (retries >= WAIT_MAX_RETRIES) {
                // [FIX] Bounded wait — don't hang forever if a module fails to load.
                // Run callback anyway so admin can still init via fallbacks
                // (App.renderDashboard, App.renderBank, App.renderPicker, App.renderExamList
                // all have inline implementations in admin.html).
                var missing = required.filter(function(name) {
                    return typeof global[name] === 'undefined';
                });
                console.warn('[admin-wrappers] Module(s) not loaded after ' + (WAIT_MAX_RETRIES * WAIT_RETRY_DELAY) + 'ms:', missing.join(', '));
                aborted = true;
                callback(true /* hasMissing */);
                return;
            }
            setTimeout(check, WAIT_RETRY_DELAY);
        };
        check();
    }

    // Map all module functions to App
    function initAppWrappers(App) {
        // Dashboard
        if (global.AdminDashboard) {
            App.renderDashboard = function() { global.AdminDashboard.renderDashboard(); };
            App.openModal = function(t, b, f, c) { global.AdminDashboard.openModal(t, b, f, c); };
            App.closeModal = function() { global.AdminDashboard.closeModal(); };
            App.toast = function(m, t) { global.AdminDashboard.toast(m, t); };
        }

        // Bank
        if (global.AdminBank) {
            App.renderBank = function() { global.AdminBank.renderBank(); };
            App.populateBankCategoryFilter = function() { global.AdminBank.populateBankCategoryFilter(); };
            App.populateBankYearFilter = function() { global.AdminBank.populateBankYearFilter(); };
            App.populateBankBlueprintFilter = function() { global.AdminBank.populateBankBlueprintFilter(); };
            App.bindBankFilters = function() { global.AdminBank.bindBankFilters(); };
            App.filterBankByBlueprint = function(id) { global.AdminBank.filterBankByBlueprint(id); };
        }

        // Picker
        if (global.AdminPicker) {
            App.renderPicker = function() { global.AdminPicker.renderPicker(); };
            App.setPickerFilter = function(f) { global.AdminPicker.setPickerFilter(f); };
            App.populatePickerCategoryFilter = function() { global.AdminPicker.populatePickerCategoryFilter(); };
            App.populateYearFilter = function() { global.AdminPicker.populateYearFilter(); };
            App.togglePickQuestion = function(id) { global.AdminPicker.togglePickQuestion(id); };
            App.clearSelected = function() { global.AdminPicker.clearSelected(); };
            App.promptAddCategory = function(id) { global.AdminPicker.promptAddCategory(id); };
            App.editCategory = function(id) { global.AdminPicker.editCategory(id); };
            App.deleteCategory = function(id) { global.AdminPicker.deleteCategory(id); };
        }

        // Preview
        if (global.AdminPreview) {
            App.openExamPreview = function(id) { global.AdminPreview.openExamPreview(id); };
            App.previewExam = function(id) { global.AdminPreview.openExamPreview(id); };
            App.closeExamPreview = function() { global.AdminPreview.closeExamPreview(); };
            // Note: editExam is defined directly in App object in admin.html
        }

        // Form
        if (global.AdminForm) {
            App.collectFormData = function() { return global.AdminForm.collectFormData(); };
            App.saveNewQuestion = function() { global.AdminForm.saveNewQuestion(); };
            App.editQuestion = function(id) { global.AdminForm.editQuestion(id); };
            App.duplicateQuestion = function(id) { global.AdminForm.duplicateQuestion(id); };
            App.deleteQuestion = function(id) { global.AdminForm.deleteQuestion(id); };
            App.resetCreateForm = function() { global.AdminForm.resetCreateForm(); };
        }

        // AI
        if (global.AdminAI) {
            App.showAIPanel = function() { global.AdminAI.showAIPanel(); };
            App.hideAIPanel = function() { global.AdminAI.hideAIPanel(); };
            App.toggleAIPanel = function() { global.AdminAI.toggleAIPanel(); };
            App.refreshAIAssistant = function() { global.AdminAI.refreshAIAssistant(); };
            App.refreshAIExamAssistant = function() { global.AdminAI.refreshAIExamAssistant(); };
            App.aiAutoLatex = function() { global.AdminAI.aiAutoLatex(); };
            App.aiSuggestDistractors = function() { global.AdminAI.aiSuggestDistractors(); };
            App.aiGuessCorrect = function() { global.AdminAI.aiGuessCorrect(); };
            App.aiSuggestSimilar = function() { global.AdminAI.aiSuggestSimilar(); };
            App.aiApplySample = function() { global.AdminAI.aiApplySample(); };
            App.aiAddTag = function() { global.AdminAI.aiAddTag(); };
            App.aiApplySuggestedTime = function() { global.AdminAI.aiApplySuggestedTime(); };
            App.aiAutoSelectQuestions = function() { global.AdminAI.aiAutoSelectQuestions(); };
            App.aiOptimizeExam = function() { global.AdminAI.aiOptimizeExam(); };
            App.aiSaveDraft = function() { global.AdminAI.aiSaveDraft(); };
            App.aiExportExam = function() { global.AdminAI.aiExportExam(); };
        }

        // Exam
        if (global.AdminExam) {
            App.renderExamList = function() { global.AdminExam.renderExamList(); };
            // [BUG 4 FIX] Setup sync listener for realtime updates
            global.AdminExam.setupExamSyncListener();
        }
    }

    // Export
    global.AdminWrappers = {
        waitForModules: waitForModules,
        initAppWrappers: initAppWrappers
    };

})(typeof window !== 'undefined' ? window : globalThis);

/**
 * FIREBASE INITIALIZATION WRAPPER
 * ==============================
 * Provides robust Firebase initialization with:
 * - Timeout protection (5 seconds default)
 * - Retry logic with exponential backoff
 * - Graceful fallback on failure
 * 
 * Usage:
 *   // Wait for Firebase to be ready
 *   await FirebaseInit.waitForReady();
 *   
 *   // Check if Firebase is available
 *   if (FirebaseInit.isReady()) {
 *     // Use Firebase
 *   }
 */

(function(global) {
    'use strict';

    const FirebaseInit = {
        initialized: false,
        initializing: false,
        initPromise: null,
        timeout: 5000, // 5 seconds default timeout
        maxRetries: 3,
        error: null,

        /**
         * Initialize Firebase with timeout protection
         */
        async init() {
            return new Promise((resolve, reject) => {
                // Check if already initialized
                if (this.initialized && window.firebaseInitialized) {
                    resolve(true);
                    return;
                }

                const timer = setTimeout(() => {
                    if (!this.initialized) {
                        this.error = new Error('Firebase init timeout (5s)');
                        console.error('[FirebaseInit]', this.error.message);
                        reject(this.error);
                    }
                }, this.timeout);

                try {
                    // Check if Firebase SDK is loaded
                    if (typeof firebase === 'undefined') {
                        clearTimeout(timer);
                        this.error = new Error('Firebase SDK not loaded - check CDN connection');
                        console.error('[FirebaseInit]', this.error.message);
                        reject(this.error);
                        return;
                    }

                    // Initialize Firebase if not already done
                    if (firebase.apps.length === 0) {
                        // firebaseConfig should be defined in firebase-config.js
                        if (typeof firebaseConfig !== 'undefined') {
                            firebase.initializeApp(firebaseConfig);
                        } else {
                            clearTimeout(timer);
                            this.error = new Error('firebaseConfig not defined');
                            console.error('[FirebaseInit]', this.error.message);
                            reject(this.error);
                            return;
                        }
                    }

                    // Verify auth and database are available
                    if (!firebase.auth || !firebase.database) {
                        clearTimeout(timer);
                        this.error = new Error('Firebase auth/database SDK incomplete');
                        console.error('[FirebaseInit]', this.error.message);
                        reject(this.error);
                        return;
                    }

                    // Test connection
                    const testRef = firebase.database().ref('.info/connected');
                    testRef.once('value').then(() => {
                        this.initialized = true;
                        window.firebaseInitialized = true;
                        clearTimeout(timer);
                        window.dispatchEvent(new Event('firebaseReady'));
                        console.log('[FirebaseInit] Initialized successfully');
                        resolve(true);
                    }).catch((err) => {
                        clearTimeout(timer);
                        this.error = err;
                        console.error('[FirebaseInit] Connection test failed:', err);
                        reject(err);
                    });

                } catch (e) {
                    clearTimeout(timer);
                    this.error = e;
                    console.error('[FirebaseInit] Initialization error:', e);
                    reject(e);
                }
            });
        },

        /**
         * Initialize Firebase with retry logic
         * @param {number} maxRetries - Maximum number of retry attempts
         */
        async initWithRetry(maxRetries = 3) {
            this.maxRetries = maxRetries;

            for (let i = 0; i < maxRetries; i++) {
                try {
                    console.log(`[FirebaseInit] Attempt ${i + 1}/${maxRetries}...`);
                    await this.init();
                    console.log(`[FirebaseInit] Attempt ${i + 1} succeeded`);
                    return true;
                } catch (e) {
                    console.warn(`[FirebaseInit] Attempt ${i + 1} failed:`, e.message);
                    this.error = e;

                    if (i < maxRetries - 1) {
                        // Exponential backoff: 1s, 2s, 4s, etc.
                        const delay = 1000 * Math.pow(2, i);
                        console.log(`[FirebaseInit] Retrying in ${delay}ms...`);
                        await this.sleep(delay);
                    }
                }
            }

            console.error('[FirebaseInit] All retry attempts failed');
            return false;
        },

        /**
         * Wait for Firebase to be ready (non-blocking)
         * @param {number} timeout - Maximum wait time in ms
         */
        async waitForReady(timeout = 15000) {
            // If already initialized, return immediately
            if (this.initialized && window.firebaseInitialized) {
                return true;
            }

            // If currently initializing, wait for it
            if (this.initPromise) {
                return this.initPromise.then(() => true).catch(() => false);
            }

            // Try to initialize with retry
            const result = await Promise.race([
                this.initWithRetry(this.maxRetries),
                this.sleep(timeout).then(() => false)
            ]);

            return result;
        },

        /**
         * Check if Firebase is ready
         */
        isReady() {
            return this.initialized && window.firebaseInitialized === true;
        },

        /**
         * Get last initialization error
         */
        getError() {
            return this.error;
        },

        /**
         * Utility: sleep for ms milliseconds
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * Reset initialization state (useful for testing)
         */
        reset() {
            this.initialized = false;
            this.initializing = false;
            this.initPromise = null;
            this.error = null;
            window.firebaseInitialized = false;
        }
    };

    // Expose globally
    global.FirebaseInit = FirebaseInit;

    // NOTE: Auto-initialization is handled by firebase-config.js
    // This module provides helper methods (waitForReady, isReady, etc.)
    // Use FirebaseInit.waitForReady() to wait for Firebase to be ready

})(window);

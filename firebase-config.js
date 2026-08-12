/**
 * FIREBASE CONFIGURATION - SKY EDU
 * --------------------------------
 * File này chứa thông tin Firebase project THẬT của Sky Edu.
 * Vì lý do dự án đã public nên thông tin KHÔNG nhạy cảm (apiKey chỉ dùng cho client SDK,
 * đã được bảo vệ bởi ALLOWED_DOMAINS + Firebase Security Rules + App Check).
 *
 * Nếu cần khởi tạo project mới, tạo project Firebase mới và thay các giá trị dưới đây.
 *
 * Lấy thông tin tại: Firebase Console > Project Settings > General > Your apps
 */
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDD0TO5ZNkZI6RyiIZp5GyyxB947aQ6XSo",
  authDomain: "skyedu-b80a1.firebaseapp.com",
  databaseURL: "https://skyedu-b80a1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "skyedu-b80a1",
  storageBucket: "skyedu-b80a1.firebasestorage.app",
  messagingSenderId: "173791675462",
  appId: "1:173791675462:web:855c4e79ddd6576ff0f647",
  measurementId: "G-BEJLXG9G8H"
};
// Allowed domains cho security check.
// Thêm domain hosting thật của bạn vào đây.
const ALLOWED_DOMAINS = [
    'skyedu.id.vn',              // Custom domain (GitHub Pages / shared hosting)
    'sky-edu-8be67.web.app',
    'sky-edu-8be67.firebaseapp.com',
    'skyedu-b80a1.web.app',
    'skyedu-b80a1.firebaseapp.com',
    'sky-edu.vercel.app',
    'huynhbui25.github.io',  // GitHub Pages
    'localhost',
    '127.0.0.1',
    ''                         // File protocol (mở file:// trực tiếp)
];

// Rate limiting cho login attempts
const LOGIN_RATE_LIMIT = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 phút
    attempts: {}
};

// Initialize Firebase
let app, auth, database;
let firebaseInitialized = false;
let firebaseInitializationAttempts = 0;

// Security: Validate domain
function validateDomain() {
    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '';

    if (isLocalhost) return true;

    const isAllowed = ALLOWED_DOMAINS.some(domain =>
        currentHost === domain || currentHost.endsWith('.' + domain)
    );

    if (!isAllowed) {
        console.error('Domain không được phép:', currentHost);
        return false;
    }
    return true;
}

// Security: Hash session token
function hashToken(token) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + token.length;
}

// Security: Generate secure session token
function generateSecureToken(uid) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    const rawToken = `${uid}_${timestamp}_${random}_${random2}`;
    return {
        raw: rawToken,
        hashed: hashToken(rawToken)
    };
}

// Security: Admin password from environment or generated
function getAdminPassword() {
    if (typeof process !== 'undefined' && process.env && process.env.FIREBASE_ADMIN_PASSWORD) {
        return process.env.FIREBASE_ADMIN_PASSWORD;
    }
    const generated = _generateRandomPassword();
    if (typeof window !== 'undefined' && !window.__firebase_admin_password_warned) {
        window.__firebase_admin_password_warned = true;
        console.warn('Using generated admin password. Set FIREBASE_ADMIN_PASSWORD env var in production.');
    }
    return generated;
}

// Security: Verify admin role from Firebase
async function validateAdminAccess(userId) {
    if (!firebaseInitialized || !database) return false;
    try {
        const snapshot = await database.ref('users/' + userId).once('value');
        const user = snapshot.val();
        return user && (user.role === 'admin' || user.isAdmin === true);
    } catch (error) {
        console.error('Error verifying admin role:', error);
        return false;
    }
}

// Security: Audit logging — writes to /auditLog (admin/owner only, see database.rules.json).
// New shape: AuditLogger.log(action, { actor, targetUser, targetId, changes, metadata }).
// Backward-compat: passing the legacy (actor, changes, metadata) args still works.
const AuditLogger = {
    log: async function(action, payload, metadata = {}) {
        if (!database) return { success: false, error: 'Firebase not ready' };
        try {
            // Backward compat: allow callers passing a string actor as 2nd arg.
            const opts = (payload && typeof payload === 'object') ? payload : { actor: payload, changes: metadata };
            const meta = (payload && typeof payload === 'object') ? metadata : (arguments[3] || {});
            const logEntry = {
                action: action,
                actor: opts.actor || (typeof payload === 'string' ? payload : 'unknown'),
                targetUser: opts.targetUser || null,
                targetId: opts.targetId || null,
                changes: opts.changes || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                ipAddress: meta.ipAddress || 'unknown',
                userAgent: meta.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
                metadata: meta
            };
            const newRef = database.ref('auditLog').push();
            await newRef.set(logEntry);
            if (typeof console !== 'undefined' && typeof window !== 'undefined' && !window.__isProduction) {
                console.log('[AUDIT]', action, 'by', logEntry.actor, logEntry.changes);
            }
            return { success: true, id: newRef.key };
        } catch (error) {
            console.error('Audit logging error:', error);
            return { success: false, error: error.message };
        }
    }
};

// Security: CSRF protection
const CSRFProtection = {
    generate: function() {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('csrf_token', token);
        }
        return token;
    },
    get: function() {
        if (typeof sessionStorage === 'undefined') return null;
        return sessionStorage.getItem('csrf_token');
    },
    validate: function(token) {
        const stored = this.get();
        return stored && stored === token;
    },
    refresh: function() {
        return this.generate();
    }
};

// Security: Session token manager
const SessionTokenManager = {
    TOKEN_EXPIRY_MS: 60 * 60 * 1000,
    generateToken: async function(userId) {
        try {
            const token = {
                raw: Array.from(crypto.getRandomValues(new Uint8Array(32)))
                    .map(b => b.toString(16).padStart(2, '0')).join(''),
                createdAt: Date.now(),
                expiresAt: Date.now() + this.TOKEN_EXPIRY_MS
            };
            const hashedToken = await this._hashToken(token.raw);
            await database.ref('sessionTokens/' + userId + '/' + Date.now().toString(36)).set({
                hashedToken: hashedToken,
                expiresAt: token.expiresAt,
                createdAt: token.createdAt
            });
            return token.raw;
        } catch (error) {
            console.error('Error generating session token:', error);
            return null;
        }
    },
    validateToken: async function(userId, token) {
        if (!token) return false;
        try {
            const snapshot = await database.ref('sessionTokens/' + userId).once('value');
            const tokens = snapshot.val() || {};
            const now = Date.now();
            for (const tokenId in tokens) {
                const tokenData = tokens[tokenId];
                if (tokenData.expiresAt < now) {
                    await database.ref('sessionTokens/' + userId + '/' + tokenId).remove();
                    continue;
                }
                const hashedInput = await this._hashToken(token);
                if (hashedInput === tokenData.hashedToken) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error validating session token:', error);
            return false;
        }
    },
    _hashToken: async function(token) {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

// Security: Check rate limit
function checkRateLimit(identifier) {
    const now = Date.now();
    const record = LOGIN_RATE_LIMIT.attempts[identifier];

    if (!record) {
        LOGIN_RATE_LIMIT.attempts[identifier] = {
            count: 1,
            firstAttempt: now,
            blockedUntil: null
        };
        return { allowed: true, remaining: LOGIN_RATE_LIMIT.maxAttempts - 1 };
    }

    if (now - record.firstAttempt > LOGIN_RATE_LIMIT.windowMs) {
        LOGIN_RATE_LIMIT.attempts[identifier] = {
            count: 1,
            firstAttempt: now,
            blockedUntil: null
        };
        return { allowed: true, remaining: LOGIN_RATE_LIMIT.maxAttempts - 1 };
    }

    if (record.blockedUntil && now < record.blockedUntil) {
        const remainingTime = Math.ceil((record.blockedUntil - now) / 1000 / 60);
        return {
            allowed: false,
            blocked: true,
            remainingTime: remainingTime,
            message: `Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${remainingTime} phút.`
        };
    }

    record.count++;

    if (record.count > LOGIN_RATE_LIMIT.maxAttempts) {
        record.blockedUntil = now + LOGIN_RATE_LIMIT.windowMs;
        return {
            allowed: false,
            blocked: true,
            remainingTime: 15,
            message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.'
        };
    }

    return {
        allowed: true,
        remaining: LOGIN_RATE_LIMIT.maxAttempts - record.count
    };
}

function resetRateLimit(identifier) {
    delete LOGIN_RATE_LIMIT.attempts[identifier];
}

// Hàm khởi tạo Firebase với error handling tốt hơn
async function initializeFirebase() {
    if (firebaseInitialized) return true;

    // Kiểm tra Firebase SDK đã load chưa
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK chưa được load. Kiểm tra kết nối mạng.');
        if (typeof showFirebaseError === 'function') {
            showFirebaseError('Không thể kết nối. Vui lòng kiểm tra kết nối internet.');
        }
        return false;
    }

    try {
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        database = firebase.database();

        // Test connection
        await database.ref('.info/connected').once('value');

        firebaseInitialized = true;
        window.firebaseInitialized = true;
        
        // [GUARD] Chỉ dispatch firebaseReady một lần duy nhất
        if (!window._firebaseReadyDispatched) {
            window._firebaseReadyDispatched = true;
            window.dispatchEvent(new Event('firebaseReady'));
            console.warn('[Firebase] Đã kết nối thành công');
        }
        return true;
    } catch (e) {
        console.error('Firebase init lỗi:', e);
        // Nếu là lỗi network, retry sau 3s (nhưng không retry quá 1 lần)
        if (e.code === 'unavailable' || (e.message && e.message.includes('network'))) {
            if (!window._firebaseRetryAttempted) {
                window._firebaseRetryAttempted = true;
                setTimeout(() => initializeFirebase(), 3000);
            }
        }
        return false;
    }
}

// Auto-initialize Firebase
(function initFirebase() {
    function tryInit() {
        if (typeof firebase === 'undefined') {
            setTimeout(tryInit, 100);
            return;
        }
        initializeFirebase();
    }
    tryInit();
})();

/**
 * FIREBASE API WRAPPER
 */
const FirebaseAPI = {

    isReady: function() {
        return firebaseInitialized && !!auth && !!database;
    },

    /**
     * Call a Firebase Cloud Function over HTTPS.
     * Used for server-side validation flows (e.g. scoreExam).
     *
     * @param {string} functionName - the callable function name (e.g. 'scoreExam')
     * @param {object} data         - payload to send to the function
     * @returns {Promise<object>}   - the data returned by the function
     */
    callCloudFunction: async function(functionName, data) {
        if (typeof firebase === 'undefined' || !firebase.functions) {
            throw new Error('Firebase Functions SDK chưa được load. Kiểm tra kết nối mạng.');
        }
        if (!this.isReady()) {
            throw new Error('Firebase chưa sẵn sàng. Vui lòng đợi...');
        }
        try {
            const functions = firebase.app().functions();
            // If user is on a known emulator port, attach it.
            if (typeof location !== 'undefined' &&
                (location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
                typeof window !== 'undefined' && window.__FUNCTIONS_EMULATOR_PORT) {
                try {
                    functions.useFunctionsEmulator('http://localhost:' + window.__FUNCTIONS_EMULATOR_PORT);
                } catch (_) { /* already attached */ }
            }
            const fn = functions.httpsCallable(functionName);
            const result = await fn(data || {});
            return result && result.data;
        } catch (error) {
            // Translate Firebase Functions errors into a friendly message
            const code = error && error.code;
            const msg = error && error.message;
            console.error('[FirebaseAPI.callCloudFunction] error:', code, msg, error);
            throw error;
        }
    },

    // ==================== USERS ====================
    createUser: async function(email, password, fullname, username) {
        if (!this.isReady()) {
            return { success: false, error: 'Firebase chưa sẵn sàng. Vui lòng đợi...' };
        }

        try {
            if (!email || !email.includes('@')) {
                return { success: false, error: 'Email không hợp lệ!' };
            }

            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#])[A-Za-z\d@$!%*?&.#]{8,}$/;
            if (!passwordRegex.test(password)) {
                return { success: false, error: 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt!' };
            }

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            try {
                await database.ref('users/' + uid).set({
                    fullname: this.sanitizeString(fullname),
                    username: this.sanitizeString(username),
                    email: this.sanitizeString(email),
                    role: 'user',
                    banned: false,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    enrollments: [],
                    emailVerified: userCredential.user.emailVerified
                });
            } catch (profileErr) {
                // [PHASE 12] Profile write FAILED sau khi Auth account được tạo.
                // Best-effort rollback: xóa Auth user để tránh "orphan account"
                // (Auth user exists nhưng /users/{uid} không tồn tại — user đăng nhập
                // bị treo ở "Không tìm thấy thông tin tài khoản!").
                // Client SDK có thể không xóa được Auth user vừa tạo (token chưa stable),
                // nhưng thử trước khi rethrow.
                console.error('[FirebaseAPI.createUser] profile write failed, attempting rollback:', profileErr);
                try {
                    const cUser = auth.currentUser;
                    if (cUser && cUser.uid === uid) {
                        await cUser.delete();
                    }
                } catch (rbErr) {
                    console.error('[FirebaseAPI.createUser] rollback failed (orphan account persisted):', rbErr);
                }
                return { success: false, error: this.getErrorMessage(profileErr.code) || (profileErr.message || 'Lỗi tạo hồ sơ người dùng. Vui lòng thử lại.') };
            }

            return { success: true, uid };
        } catch (error) {
            console.error('Lỗi tạo user:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    loginUser: async function(email, password) {
        const rateCheck = checkRateLimit(email);
        if (!rateCheck.allowed) {
            return {
                success: false,
                error: rateCheck.message,
                rateLimited: true,
                remainingTime: rateCheck.remainingTime
            };
        }

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            const snapshot = await database.ref('users/' + uid).once('value');
            const userData = snapshot.val();

            if (!userData) {
                await auth.signOut();
                return { success: false, error: 'Không tìm thấy thông tin tài khoản!' };
            }

            if (userData.banned) {
                await auth.signOut();
                return { success: false, error: 'Tài khoản đã bị khóa! Vui lòng liên hệ hỗ trợ.' };
            }

            const tokenData = generateSecureToken(uid);

            await database.ref('users/' + uid).update({
                sessionToken: tokenData.hashed,
                lastLogin: firebase.database.ServerValue.TIMESTAMP
            });

            resetRateLimit(email);

            return {
                success: true,
                sessionToken: tokenData.raw,
                userData: { uid, ...userData, sessionToken: tokenData.raw }
            };
        } catch (error) {
            console.error('Lỗi đăng nhập:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code),
                attemptsRemaining: rateCheck.remaining - 1
            };
        }
    },

    validateSession: async function(uid, token) {
        try {
            const snapshot = await database.ref('users/' + uid).once('value');
            const userData = snapshot.val();

            if (!userData) return false;
            if (userData.banned) return false;

            const hashedInput = hashToken(token);
            if (userData.sessionToken !== hashedInput) return false;

            return true;
        } catch (error) {
            console.error('Lỗi kiểm tra session:', error);
            return false;
        }
    },

    validateSessionToken: async function(uid, token) {
        return this.validateSession(uid, token);
    },

    logoutUser: async function(uid) {
        try {
            await database.ref('users/' + uid).update({
                sessionToken: null
            });
            await auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Lỗi đăng xuất:', error);
            return { success: false, error: error.message };
        }
    },

    getUserIP: async function() {
        // Đã bỏ chặn 1 IP = 1 tài khoản, hàm này giữ lại để tương thích ngược
        // (tránh lỗi nếu code khác vẫn đang gọi) nhưng trả về chuỗi rỗng.
        return '';
    },

    checkIPExists: async function(ip) {
        // Đã bỏ chặn 1 IP = 1 tài khoản, luôn trả về false.
        return false;
    },

    getAllUsers: async function() {
        try {
            const snapshot = await database.ref('users').once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, user]) => ({ id, ...user })) : [];
        } catch (error) {
            console.error('Lỗi lấy users:', error);
            return [];
        }
    },

    // [LỖI 1] Realtime listener for users — returns unsubscribe() function.
    // Call unsubscribe() when the component unmounts or page closes to prevent
    // memory leaks and duplicate listeners.
    getAllUsersRealtime: function(callback) {
        if (typeof database === 'undefined') return function() {};
        const ref = database.ref('users');
        const handler = function(snap) {
            const data = snap.val();
            callback(data ? Object.entries(data).map(([id, user]) => ({ id, ...user })) : []);
        };
        ref.on('value', handler);
        return function() { ref.off('value', handler); };
    },

    // [LỖI 3] Read all registrations from Firebase /registrations node.
    getAllRegistrations: async function() {
        if (typeof database === 'undefined') return [];
        try {
            const snapshot = await database.ref('registrations').once('value');
            const data = snapshot.val();
            if (!data) return [];
            return Object.entries(data).map(([id, reg]) => ({ id, ...reg }));
        } catch (error) {
            console.error('[FirebaseAPI] getAllRegistrations error:', error);
            return [];
        }
    },

    // [LỖI 3] Read registrations as a realtime listener — returns unsubscribe().
    getAllRegistrationsRealtime: function(callback) {
        if (typeof database === 'undefined') return function() {};
        const ref = database.ref('registrations');
        const handler = function(snap) {
            const data = snap.val();
            callback(data ? Object.entries(data).map(([id, reg]) => ({ id, ...reg })) : []);
        };
        ref.on('value', handler);
        return function() { ref.off('value', handler); };
    },

    // [LỖI 3] Save a new registration to Firebase /registrations/{id}.
    // Retries up to 3 times with exponential backoff for transient network
    // errors. PERMISSION_DENIED is NOT retried (it would fail forever).
    saveRegistration: async function(regData) {
        if (typeof database === 'undefined') return { success: false, error: 'Firebase not ready' };

        const id = regData.id || ('REG-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase());
        const maxAttempts = 3;
        let lastErr = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await database.ref('registrations/' + id).set({
                    ...regData,
                    id: id,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
                return { success: true, id: id };
            } catch (error) {
                lastErr = error;
                const code = error && error.code;
                // Don't retry PERMISSION_DENIED — it will always fail.
                if (code === 'PERMISSION_DENIED') {
                    console.error('[FirebaseAPI] saveRegistration PERMISSION_DENIED (rule chưa deploy?):', error);
                    return { success: false, error: error.message, code: code };
                }
                if (attempt < maxAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    console.warn(`[FirebaseAPI] saveRegistration attempt ${attempt} failed (${code || 'unknown'}). Retrying in ${delay}ms...`);
                    await new Promise(function(r) { setTimeout(r, delay); });
                }
            }
        }
        console.error('[FirebaseAPI] saveRegistration error after retries:', lastErr);
        return { success: false, error: (lastErr && lastErr.message) || 'unknown' };
    },

    // [LỖI 3] Update an existing registration record.
    updateRegistration: async function(id, updates) {
        if (typeof database === 'undefined') return { success: false, error: 'Firebase not ready' };
        if (!id) return { success: false, error: 'Registration ID required' };
        try {
            await database.ref('registrations/' + id).update({
                ...updates,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('[FirebaseAPI] updateRegistration error:', error);
            return { success: false, error: error.message };
        }
    },

    deleteRegistration: async function(id) {
        if (typeof database === 'undefined') return { success: false, error: 'Firebase not ready' };
        if (!id) return { success: false, error: 'Registration ID required' };
        try {
            await database.ref('registrations/' + id).remove();
            return { success: true };
        } catch (error) {
            console.error('[FirebaseAPI] deleteRegistration error:', error);
            return { success: false, error: error.message };
        }
    },

    // [LỖI 3 + 4] Read registrations for a specific user (by uid or gmail),
    // returns unsubscribe function for realtime updates.
    getUserRegistrationsRealtime: function(uid, gmail, callback) {
        if (typeof database === 'undefined') return function() {};
        if (!uid && !gmail) return function() {};
        const ref = database.ref('registrations');
        const handler = function(snap) {
            const data = snap.val();
            const all = data ? Object.entries(data).map(([id, reg]) => ({ id, ...reg })) : [];
            const filtered = all.filter(r =>
                // Match by userId (Firebase uid)
                (uid && r.userId === uid) ||
                // Match by gmail entered in form
                (gmail && r.gmail && r.gmail.toLowerCase() === gmail.toLowerCase()) ||
                // Match by userEmail (stored when user was logged in during registration)
                (gmail && r.userEmail && r.userEmail.toLowerCase() === gmail.toLowerCase()) ||
                // Match by username
                (uid && r.username && r.username === uid)
            );
            callback(filtered);
        };
        ref.on('value', handler);
        return function() { ref.off('value', handler); };
    },

    getUser: async function(uid) {
        if (!uid) return null;
        try {
            const snapshot = await database.ref('users/' + uid).once('value');
            return snapshot.val() || null;
        } catch (error) {
            console.error('Lỗi lấy user:', error);
            return null;
        }
    },

    getUserByUsername: async function(username) {
        try {
            const sanitized = this.sanitizeString(username);
            const snapshot = await database.ref('users')
                .orderByChild('username')
                .equalTo(sanitized)
                .once('value');
            const data = snapshot.val();
            if (data) {
                const entries = Object.entries(data);
                return { id: entries[0][0], ...entries[0][1] };
            }
            return null;
        } catch (error) {
            console.error('Lỗi lấy user:', error);
            return null;
        }
    },

    updateUser: async function(userId, updates) {
        try {
            // Kiểm tra database ready
            if (typeof database === 'undefined') {
                return { success: false, error: 'Firebase database chưa sẵn sàng' };
            }

            // Kiểm tra userId
            if (!userId) {
                return { success: false, error: 'userId không được rỗng' };
            }

            const sanitizedUpdates = {};
            for (const [key, value] of Object.entries(updates)) {
                if (value === undefined || value === null) {
                    // Skip undefined/null values
                    continue;
                }
                if (typeof value === 'string') {
                    // Skip sanitization for role-related fields - they contain system values
                    // like 'admin', 'HSA', 'TSA' that shouldn't be HTML-escaped
                    if (key === 'role' || key === 'roles') {
                        sanitizedUpdates[key] = value;
                    } else {
                        sanitizedUpdates[key] = this.sanitizeString(value);
                    }
                } else if (Array.isArray(value)) {
                    // Xử lý mảng roles - đảm bảo chỉ chứa giá trị hợp lệ
                    if (key === 'roles') {
                        sanitizedUpdates[key] = value.filter(r =>
                            ['admin', 'owner', 'qtv', 'HSA', 'TSA', 'user'].includes(r)
                        );
                    } else {
                        sanitizedUpdates[key] = value;
                    }
                } else {
                    sanitizedUpdates[key] = value;
                }
            }

            console.log('[FirebaseAPI.updateUser] Writing to /users/' + userId, sanitizedUpdates);

            await database.ref('users/' + userId).update(sanitizedUpdates);
            console.log('[FirebaseAPI.updateUser] Success for uid:', userId);
            return { success: true };
        } catch (error) {
            console.error('[FirebaseAPI.updateUser] Error:', error);
            console.error('[FirebaseAPI.updateUser] Error code:', error.code);
            console.error('[FirebaseAPI.updateUser] Error message:', error.message);

            // Phân tích loại lỗi để trả về thông báo hữu ích
            let errorDetail = error.message || 'Lỗi không xác định';
            if (error.code === 'PERMISSION_DENIED') {
                errorDetail = 'PERMISSION_DENIED: Bạn không có quyền ghi vào /users/' + userId + '. Kiểm tra Firebase Security Rules.';
            } else if (error.code === 'NETWORK_ERROR') {
                errorDetail = 'NETWORK_ERROR: Không thể kết nối Firebase. Kiểm tra kết nối mạng.';
            } else if (error.code === 'DISCONNECTED') {
                errorDetail = 'DISCONNECTED: Mất kết nối Firebase.';
            }

            return { success: false, error: errorDetail, code: error.code };
        }
    },

    toggleBanUser: async function(userId, banned) {
        try {
            await database.ref('users/' + userId).update({ banned });
            return { success: true };
        } catch (error) {
            console.error('Lỗi ban user:', error);
            return { success: false, error: error.message };
        }
    },

    deleteUser: async function(userId) {
        try {
            const snapshot = await database.ref('users/' + userId).once('value');
            const userData = snapshot.val();

            if (!userData) {
                return { success: false, error: 'User không tồn tại!' };
            }

            await database.ref('users/' + userId).remove();

            return {
                success: true,
                message: 'User đã được xóa khỏi database.'
            };
        } catch (error) {
            console.error('Lỗi xóa user:', error);
            return { success: false, error: error.message };
        }
    },

    // ==================== UTILITY ====================
    sanitizeString: function(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    },

    getErrorMessage: function(errorCode) {
        const errorMessages = {
            'auth/email-already-in-use': 'Email đã được sử dụng bởi tài khoản khác!',
            'auth/invalid-email': 'Email không hợp lệ!',
            'auth/operation-not-allowed': 'Đăng nhập bằng email/mật khẩu chưa được kích hoạt!',
            'auth/weak-password': 'Mật khẩu quá yếu!',
            'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa!',
            'auth/user-not-found': 'Không tìm thấy tài khoản!',
            'auth/wrong-password': 'Mật khẩu không đúng!',
            'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng thử lại sau!',
            'auth/network-request-failed': 'Lỗi kết nối mạng. Vui lòng kiểm tra internet!',
            'auth/invalid-credential': 'Thông tin đăng nhập không hợp lệ!',
            'auth/invalid-api-key': 'Lỗi cấu hình Firebase. Vui lòng liên hệ quản trị viên!',
            'auth/app-not-authorized': 'Ứng dụng không được phép truy cập Firebase!',
            'PERMISSION_DENIED': 'Không có quyền truy cập. Kiểm tra Firebase Rules.',
            'default': 'Đã xảy ra lỗi. Vui lòng thử lại sau!'
        };

        return errorMessages[errorCode] || errorMessages['default'];
    },

    // ==================== EXAMS ====================
    saveExam: async function(examId, examData) {
        // [FIX P0-5] Permission check trước khi tạo/sửa
        if (typeof RoleSystem !== 'undefined' && RoleSystem.can) {
            try {
                var u = RoleSystem.getCurrentUser ? RoleSystem.getCurrentUser() : null;
                if (!u || !RoleSystem.can(u, 'canEditExams')) {
                    console.error('[saveExam] Permission denied: canEditExams');
                    return { success: false, error: 'Bạn không có quyền tạo/sửa đề thi.' };
                }
            } catch (e) { /* role check fail → tiếp tục, để Firebase rule xử lý */ }
        }
        if (!examId || !examData) {
            return { success: false, error: 'Thiếu tham số' };
        }
        try {
            await database.ref('exams/' + examId).set({
                ...examData,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            // Mirror
            try {
                await database.ref('phongluyen_exams/' + examId).set(examData);
            } catch (mirrorErr) {
                console.warn('[saveExam] mirror failed (non-fatal):', mirrorErr);
            }
            return { success: true };
        } catch (error) {
            console.error('Lỗi lưu đề thi:', error);
            return { success: false, error: error.message };
        }
    },

    getAllExams: async function() {
        try {
            const snapshot = await database.ref('exams').once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, exam]) => ({ id, ...exam })) : [];
        } catch (error) {
            console.error('Lỗi lấy đề thi:', error);
            return [];
        }
    },

    deleteExam: async function(examId) {
        // [FIX P0-5] Permission check trước khi xóa
        if (typeof RoleSystem !== 'undefined' && RoleSystem.can) {
            try {
                var u = RoleSystem.getCurrentUser ? RoleSystem.getCurrentUser() : null;
                if (!u || !RoleSystem.can(u, 'canDeleteExams')) {
                    console.error('[deleteExam] Permission denied: canDeleteExams');
                    return { success: false, error: 'Bạn không có quyền xóa đề thi. Vui lòng liên hệ admin.' };
                }
            } catch (e) {
                console.warn('[deleteExam] RoleSystem check failed:', e);
            }
        }

        // Validate input
        if (!examId || typeof examId !== 'string') {
            return { success: false, error: 'ID đề không hợp lệ' };
        }

        try {
            // [FIX P0-2] Xóa cả 2 path exams/ và phongluyen_exams/
            const ref = database.ref('exams/' + examId);
            await ref.remove();
            try {
                await database.ref('phongluyen_exams/' + examId).remove();
            } catch (mirrorErr) {
                console.warn('[deleteExam] mirror phongluyen_exams/ failed (non-fatal):', mirrorErr);
            }
            return { success: true };
        } catch (error) {
            console.error('Lỗi xóa đề thi:', error);
            return { success: false, error: error.message };
        }
    },

    // ==================== EXAM RESULTS ====================
    saveExamResult: async function(uid, resultId, resultData) {
        try {
            await database.ref('examResults/' + uid + '/' + resultId).set({
                ...resultData,
                uid,
                resultId,
                savedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi lưu kết quả bài thi:', error);
            return { success: false, error: error.message };
        }
    },

    // ==================== ADMIN AUDIT LOG ====================
    // [SECURITY] Logs admin panel access attempts. Routed via a Cloud Function so
    // ordinary users cannot write to auditLog (the database rules deny direct
    // client writes there).
    logAdminAccess: async function(payload) {
        try {
            if (typeof this.callCloudFunction !== 'function') return { success: false, error: 'no-cf' };
            const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
            return await this.callCloudFunction('logAdminAccess', {
                uid: user ? user.uid : null,
                email: user ? user.email : null,
                ...payload,
                at: Date.now(),
                path: (typeof location !== 'undefined') ? location.pathname : ''
            });
        } catch (e) {
            // Never block UI on audit failure.
            console.warn('[FirebaseAPI.logAdminAccess] failed:', e && e.message);
            return { success: false, error: e && e.message };
        }
    },

    getExamResults: async function(uid) {
        try {
            const snapshot = await database.ref('examResults/' + uid).once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
        } catch (error) {
            console.error('Lỗi lấy kết quả bài thi:', error);
            return [];
        }
    },

    getExamResult: async function(uid, resultId) {
        try {
            const snapshot = await database.ref('examResults/' + uid + '/' + resultId).once('value');
            const data = snapshot.val();
            return data ? { id: resultId, ...data } : null;
        } catch (error) {
            console.error('Lỗi lấy chi tiết kết quả bài thi:', error);
            return null;
        }
    },

    // ==================== QUESTION BANK ====================
    saveQuestionBank: async function(bankId, data) {
        try {
            await database.ref('questionBank/' + bankId).set({
                ...data,
                bankId,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi lưu ngân hàng câu hỏi:', error);
            return { success: false, error: error.message };
        }
    },

    getQuestionBank: async function() {
        try {
            const snapshot = await database.ref('questionBank').once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
        } catch (error) {
            console.error('Lỗi lấy ngân hàng câu hỏi:', error);
            return [];
        }
    },

    // ==================== EXAM BLUEPRINTS ====================
    saveExamBlueprint: async function(id, data) {
        try {
            await database.ref('exam_blueprints/' + id).set({
                ...data,
                id,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi lưu blueprint đề thi:', error);
            return { success: false, error: error.message };
        }
    },

    getExamBlueprints: async function() {
        try {
            const snapshot = await database.ref('exam_blueprints').once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
        } catch (error) {
            console.error('Lỗi lấy danh sách blueprint:', error);
            return [];
        }
    },

    // ==================== PHONG LUYEN EXAMS ====================
    savePhongLuyenExam: async function(id, data) {
        try {
            await database.ref('phongluyen_exams/' + id).set({
                ...data,
                id,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi lưu đề phòng luyện:', error);
            return { success: false, error: error.message };
        }
    },

    getPhongLuyenExams: async function(subject) {
        try {
            let ref = database.ref('phongluyen_exams');
            const snapshot = await ref.once('value');
            const data = snapshot.val();
            let items = data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
            if (subject) {
                items = items.filter(item => item.subject === subject || item.type === subject || item.category === subject);
            }
            return items;
        } catch (error) {
            console.error('Lỗi lấy đề phòng luyện:', error);
            return [];
        }
    },

    // ==================== QUESTION CATEGORIES ====================
    saveQuestionCategory: async function(id, data) {
        try {
            await database.ref('questionCategories/' + id).set({
                ...data,
                id,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi lưu danh mục câu hỏi:', error);
            return { success: false, error: error.message };
        }
    },

    getQuestionCategories: async function() {
        try {
            const snapshot = await database.ref('questionCategories').once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
        } catch (error) {
            console.error('Lỗi lấy danh mục câu hỏi:', error);
            return [];
        }
    },

    // ==================== LEADERBOARD ====================
    updateLeaderboardScore: async function(uid, data) {
        try {
            await database.ref('leaderboard/' + uid).set({
                ...data,
                uid,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi cập nhật leaderboard:', error);
            return { success: false, error: error.message };
        }
    },

    getLeaderboard: async function() {
        try {
            const snapshot = await database.ref('leaderboard').once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
        } catch (error) {
            console.error('Lỗi lấy leaderboard:', error);
            return [];
        }
    },

    // ==================== COURSES ====================
    saveCourse: async function(courseId, courseData) {
        try {
            await database.ref('courses/' + courseId).set({
                ...courseData,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi lưu khóa học:', error);
            return { success: false, error: error.message };
        }
    },

    getAllCourses: async function() {
        try {
            const snapshot = await database.ref('courses').once('value');
            const data = snapshot.val();
            return data ? Object.entries(data).map(([id, course]) => ({ id, ...course })) : [];
        } catch (error) {
            console.error('Lỗi lấy khóa học:', error);
            return [];
        }
    },

    // ==================== ENROLLMENTS ====================
    enrollUser: async function(userId, courseId) {
        try {
            const enrollmentId = `${userId}_${courseId}`;
            await database.ref('enrollments/' + enrollmentId).set({
                userId,
                courseId,
                enrolledAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi gán khóa học:', error);
            return { success: false, error: error.message };
        }
    },

    unenrollUser: async function(userId, courseId) {
        try {
            const enrollmentId = `${userId}_${courseId}`;
            await database.ref('enrollments/' + enrollmentId).remove();
            return { success: true };
        } catch (error) {
            console.error('Lỗi hủy gán khóa học:', error);
            return { success: false, error: error.message };
        }
    },

    getUserCourses: async function(userId) {
        try {
            const snapshot = await database.ref('enrollments')
                .orderByChild('userId')
                .equalTo(userId)
                .once('value');
            const data = snapshot.val();
            return data ? Object.values(data).map(e => e.courseId) : [];
        } catch (error) {
            console.error('Lỗi lấy khóa học của user:', error);
            return [];
        }
    },

    hasEnrollment: async function(userId, courseId) {
        if (!userId || !courseId) return false;
        try {
            const enrollmentId = `${userId}_${courseId}`;
            const snap = await database.ref('enrollments/' + enrollmentId).once('value');
            return snap.exists();
        } catch (error) {
            console.error('Lỗi kiểm tra enrollment:', error);
            return false;
        }
    },

    getCourse: async function(courseId) {
        try {
            const snapshot = await database.ref('courses/' + courseId).once('value');
            const data = snapshot.val();
            return data ? { id: courseId, ...data } : null;
        } catch (error) {
            console.error('Lỗi lấy khóa học:', error);
            return null;
        }
    },

    // ==================== USER STATS (XP/Streak/Achievement) ====================
    getUserStats: async function(uid) {
        if (!uid) return null;
        try {
            const snapshot = await database.ref('userStats/' + uid).once('value');
            return snapshot.val() || null;
        } catch (error) {
            console.error('Lỗi đọc userStats:', error);
            return null;
        }
    },

    saveUserStats: async function(uid, stats) {
        if (!uid) return { success: false, error: 'uid rỗng' };
        try {
            await database.ref('userStats/' + uid).set({
                ...stats,
                uid,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi ghi userStats:', error);
            return { success: false, error: error.message };
        }
    },

    // ==================== LEADERBOARD BY EXAM (per-exam) ====================
    saveExamLeaderboardEntry: async function(examId, entry) {
        if (!examId || !entry || !entry.uid) return { success: false, error: 'Thiếu examId hoặc uid' };
        try {
            await database.ref('leaderboardByExam/' + examId + '/' + entry.uid).set({
                uid: entry.uid,
                displayName: entry.displayName || entry.username || '',
                username: entry.username || '',
                avatar: entry.avatar || null,
                examId,
                examName: entry.examName || '',
                subject: entry.subject || '',
                score: Number(entry.score) || 0,
                correct: entry.correct || 0,
                total: entry.total || 0,
                timeUsed: entry.timeUsed || 0,
                completedAt: entry.completedAt || new Date().toISOString(),
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            console.error('Lỗi ghi leaderboard theo đề:', error);
            return { success: false, error: error.message };
        }
    },

    getExamLeaderboard: async function(examId) {
        if (!examId) return [];
        try {
            const snapshot = await database.ref('leaderboardByExam/' + examId).once('value');
            const data = snapshot.val();
            if (!data) return [];
            return Object.values(data).map(e => ({ ...e }));
        } catch (error) {
            console.error('Lỗi đọc leaderboard theo đề:', error);
            return [];
        }
    },

    // ==================== ADMIN OPERATIONS ====================
    /**
     * Sinh password ngẫu nhiên cho admin lần đầu tạo.
     * @returns {string} password mới
     */
    _generateRandomPassword: function() {
        const charset = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#$%';
        let pass = '';
        pass += 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)];
        pass += 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)];
        pass += '23456789'[Math.floor(Math.random() * 8)];
        pass += '@#$%'[Math.floor(Math.random() * 4)];
        for (let i = 0; i < 8; i++) {
            pass += charset[Math.floor(Math.random() * charset.length)];
        }
        return pass.split('').sort(() => Math.random() - 0.5).join('');
    },

    createDefaultAdmin: async function() {
        try {
            const adminUser = await this.getUserByUsername('admin');
            if (adminUser) {
                return { success: true, exists: true };
            }

            const adminEmail = 'admin@skyedu.id.vn';
            const adminUsername = 'admin';
            const adminFullname = 'Administrator';
            const adminPassword = this._generateRandomPassword();

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
                const uid = userCredential.user.uid;

                await database.ref('users/' + uid).set({
                    fullname: adminFullname,
                    username: adminUsername,
                    email: adminEmail,
                    role: 'admin',
                    isAdmin: true,
                    roles: ['admin', 'HSA', 'TSA'],
                    banned: false,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    enrollments: [],
                    mustChangePassword: true,
                    sessionExpiresAt: Date.now() + (60 * 60 * 1000)
                });

                return { success: true, generatedPassword: adminPassword };
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    return { success: true, exists: true };
                }
                throw authError;
            }
        } catch (error) {
            console.error('Lỗi tạo admin:', error);
            return { success: false, error: error.message };
        }
    },

    // ==================== REAL-TIME LISTENERS ====================
    listenToUsers: function(callback) {
        database.ref('users').on('value', (snapshot) => {
            const data = snapshot.val();
            const users = data ? Object.entries(data).map(([id, user]) => ({ id, ...user })) : [];
            callback(users);
        });
    },

    stopListening: function(path) {
        database.ref(path).off();
    }
};

// ==================== TransactionSync ====================
// New centralized transaction module that provides:
// 1. /transactions/{transactionId} - Primary source of truth for all transactions
// 2. /userTransactions/{uid}/{transactionId} - Index for fast user-specific queries
//
// This ensures:
// - Admin can read all transactions from /transactions
// - User can read their own transactions from /userTransactions/{uid}
// - No full users/ scan needed for admin
// - True cross-device sync via Firebase realtime listeners
const TransactionSync = {
    TRANSACTIONS_PATH: 'transactions',
    USER_TRANSACTIONS_PATH: 'userTransactions',

    /**
     * Generate a unique transaction ID
     * Format: TX-{TIMESTAMP}-{RANDOM}
     */
    generateId: function() {
        return 'TX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    },

    /**
     * Create a new transaction in Firebase
     * Writes to both /transactions and /userTransactions index
     * @param {Object} data - Transaction data
     * @returns {Promise<{success, id, error}>}
     */
    create: async function(data) {
        if (!database) return { success: false, error: 'Firebase not ready' };

        console.log('[TRANSACTION][CREATE_START]', {
            code: data.code,
            price: data.price,
            userId: data.userId || 'anonymous'
        });

        try {
            const id = data.id || this.generateId();
            const timestamp = firebase.database.ServerValue.TIMESTAMP;
            
            // Standard transaction object
            const txData = {
                id: id,
                userId: data.userId || null,
                username: data.username || null,
                email: data.email || null,
                gmail: data.gmail || null,
                courseId: data.courseId || data.code,
                courseName: data.courseName || data.packageName || data.name,
                amount: data.amount || data.price || 0,
                paymentContent: data.paymentContent || data.transferContent,
                status: data.status || 'pending_payment',
                phone: data.phone || null,
                province: data.province || null,
                school: data.school || null,
                createdAt: data.createdAt || timestamp,
                updatedAt: timestamp,
                verifiedAt: null,
                verifiedBy: null,
                rejectedAt: null,
                rejectedBy: null
            };

            // Write to primary transactions path
            await database.ref(this.TRANSACTIONS_PATH + '/' + id).set(txData);
            console.log('[TRANSACTION][CREATE_SUCCESS]', { id: id, path: this.TRANSACTIONS_PATH + '/' + id });

            // Write to user index if userId exists
            if (txData.userId) {
                await database.ref(this.USER_TRANSACTIONS_PATH + '/' + txData.userId + '/' + id).set(true);
                console.log('[TRANSACTION][INDEX_CREATED]', { userId: txData.userId, txId: id });
            }

            return { success: true, id: id };
        } catch (error) {
            console.error('[TRANSACTION][CREATE_ERROR]', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Update transaction status
     * @param {string} id - Transaction ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<{success, error}>}
     */
    update: async function(id, updates) {
        if (!database) return { success: false, error: 'Firebase not ready' };
        if (!id) return { success: false, error: 'Transaction ID required' };

        console.log('[TRANSACTION][UPDATE_START]', { id: id, updates: Object.keys(updates) });

        try {
            updates.updatedAt = firebase.database.ServerValue.TIMESTAMP;
            await database.ref(this.TRANSACTIONS_PATH + '/' + id).update(updates);
            console.log('[TRANSACTION][UPDATE_SUCCESS]', { id: id });
            return { success: true };
        } catch (error) {
            console.error('[TRANSACTION][UPDATE_ERROR]', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get all transactions (for Admin)
     * @returns {Promise<Array>}
     */
    getAll: async function() {
        if (!database) return [];

        console.log('[ADMIN][TRANSACTIONS_LOAD_START]');

        try {
            const snapshot = await database.ref(this.TRANSACTIONS_PATH).once('value');
            const data = snapshot.val();
            const list = data ? Object.entries(data).map(([id, tx]) => ({ id, ...tx })) : [];
            
            console.log('[ADMIN][TRANSACTIONS_RECEIVED]', { count: list.length });
            return list;
        } catch (error) {
            console.error('[ADMIN][TRANSACTIONS_LOAD_ERROR]', error);
            return [];
        }
    },

    /**
     * Listen to all transactions (realtime for Admin)
     * @param {Function} callback - Called with transactions array
     * @returns {Function} Unsubscribe function
     */
    listenToAll: function(callback) {
        if (!database) return function() {};

        console.log('[ADMIN][TRANSACTIONS_LISTENER_ACTIVE]');

        const ref = database.ref(this.TRANSACTIONS_PATH);
        const handler = function(snap) {
            const data = snap.val();
            const list = data ? Object.entries(data).map(([id, tx]) => ({ id, ...tx })) : [];
            console.log('[ADMIN][TRANSACTIONS_RECEIVED]', { count: list.length });
            callback(list);
        };

        ref.on('value', handler);
        return function() {
            ref.off('value', handler);
            console.log('[ADMIN][TRANSACTIONS_LISTENER_STOPPED]');
        };
    },

    /**
     * Get user's transactions via index (fast, no full scan)
     * @param {string} uid - User ID
     * @returns {Promise<Array>}
     */
    getUserTransactions: async function(uid) {
        if (!database || !uid) return [];

        console.log('[PROFILE][USER_TRANSACTIONS_LOAD_START]', { uid: uid });

        try {
            // First get the index (keys only)
            const indexSnapshot = await database.ref(this.USER_TRANSACTIONS_PATH + '/' + uid).once('value');
            const index = indexSnapshot.val();
            
            if (!index) {
                console.log('[PROFILE][USER_TRANSACTIONS_RECEIVED]', { uid: uid, count: 0 });
                return [];
            }

            // Then fetch all transactions in parallel
            const txIds = Object.keys(index);
            const promises = txIds.map(txId => 
                database.ref(this.TRANSACTIONS_PATH + '/' + txId).once('value')
            );
            
            const snapshots = await Promise.all(promises);
            const list = snapshots
                .filter(snap => snap.exists())
                .map(snap => ({ id: snap.key, ...snap.val() }));

            console.log('[PROFILE][USER_TRANSACTIONS_RECEIVED]', { uid: uid, count: list.length });
            return list;
        } catch (error) {
            console.error('[PROFILE][USER_TRANSACTIONS_LOAD_ERROR]', error);
            return [];
        }
    },

    /**
     * Listen to user's transactions (realtime for Profile)
     * @param {string} uid - User ID
     * @param {Function} callback - Called with transactions array
     * @returns {Function} Unsubscribe function
     */
    listenToUserTransactions: function(uid, callback) {
        if (!database || !uid) return function() {};

        console.log('[PROFILE][USER_TRANSACTIONS_LISTENER_ACTIVE]', { uid: uid });

        // Fetch and callback helper
        let _fetchTimer = null;
        const fetchAndCallback = async function() {
            // Debounce to coalesce rapid changes
            if (_fetchTimer) clearTimeout(_fetchTimer);
            _fetchTimer = setTimeout(async function() {
                _fetchTimer = null;
                try {
                    const indexSnapshot = await database.ref(TransactionSync.USER_TRANSACTIONS_PATH + '/' + uid).once('value');
                    const index = indexSnapshot.val();
                    
                    if (!index) {
                        callback([]);
                        return;
                    }

                    const txIds = Object.keys(index);
                    const promises = txIds.map(txId => 
                        database.ref(TransactionSync.TRANSACTIONS_PATH + '/' + txId).once('value')
                    );
                    
                    const snapshots = await Promise.all(promises);
                    const list = snapshots
                        .filter(snap => snap.exists())
                        .map(snap => ({ id: snap.key, ...snap.val() }));

                    console.log('[PROFILE][USER_TRANSACTIONS_RENDERED]', { uid: uid, count: list.length });
                    callback(list);
                } catch (error) {
                    console.error('[PROFILE][USER_TRANSACTIONS_LISTENER_ERROR]', error);
                }
            }, 100);
        };

        // Listen to user's index for changes (new transaction or removed)
        const indexRef = database.ref(TransactionSync.USER_TRANSACTIONS_PATH + '/' + uid);
        
        // Initial fetch
        fetchAndCallback();

        // Listen for index changes
        indexRef.on('child_added', fetchAndCallback);
        indexRef.on('child_removed', fetchAndCallback);
        
        // Also listen for any transaction changes in the main transactions path
        // This catches updates like status change (verified/rejected)
        const mainTxRef = database.ref(TransactionSync.TRANSACTIONS_PATH);
        const txChangeHandler = function(snap) {
            // Check if this transaction belongs to the current user
            indexRef.once('value').then(function(idxSnap) {
                const index = idxSnap.val();
                if (index && index[snap.key]) {
                    // This tx belongs to the user, refresh the list
                    console.log('[PROFILE][TX_CHANGED]', { txId: snap.key });
                    fetchAndCallback();
                }
            });
        };
        mainTxRef.on('child_changed', txChangeHandler);

        return function() {
            indexRef.off('child_added', fetchAndCallback);
            indexRef.off('child_removed', fetchAndCallback);
            mainTxRef.off('child_changed', txChangeHandler);
            if (_fetchTimer) clearTimeout(_fetchTimer);
            console.log('[PROFILE][USER_TRANSACTIONS_LISTENER_STOPPED]', { uid: uid });
        };
    },

    /**
     * Mark transaction as awaiting verification
     */
    markAwaiting: async function(id) {
        return this.update(id, {
            status: 'awaiting_verification',
            awaitingSince: firebase.database.ServerValue.TIMESTAMP
        });
    },

    /**
     * Mark transaction as verified
     */
    markVerified: async function(id, extra) {
        return this.update(id, {
            status: 'verified',
            verifiedAt: firebase.database.ServerValue.TIMESTAMP,
            ...(extra || {})
        });
    },

    /**
     * Mark transaction as rejected
     */
    markRejected: async function(id, extra) {
        return this.update(id, {
            status: 'rejected',
            rejectedAt: firebase.database.ServerValue.TIMESTAMP,
            ...(extra || {})
        });
    }
};

// ==================== RegistrationSync ====================
// Single entry point for "save / read / mutate" a registration. Always writes
// to Firebase first, then mirrors into localStorage as a backup. Reads are
// Firebase-first and fall back to localStorage.
const RegistrationSync = {
    LS_KEY: 'skyedu_registrations',

    _readLocal: function() {
        try { return JSON.parse(localStorage.getItem(this.LS_KEY) || '[]'); }
        catch (e) { return []; }
    },
    _writeLocal: function(list) {
        try { localStorage.setItem(this.LS_KEY, JSON.stringify(list)); }
        catch (e) { console.warn('[RegistrationSync] localStorage write failed:', e); }
    },
    _writeUserMirror: function(data) {
        if (!data || !data.userId) return;
        try {
            const txKey = 'skyedu_transactions_' + data.userId;
            const txList = JSON.parse(localStorage.getItem(txKey) || '[]');
            const idx = txList.findIndex(r => r.id === data.id);
            if (idx >= 0) txList[idx] = { ...txList[idx], ...data };
            else txList.push(data);
            localStorage.setItem(txKey, JSON.stringify(txList));
        } catch (e) { /* ignore */ }
    },
    // Username-based mirror. Lets a logged-in user find their tx from the
    // same browser even when the registration isn't linked to a uid yet
    // (e.g. user registered before logging in, or the link was lost).
    _writeUserMirrorByUsername: function(data) {
        if (!data || !data.username) return;
        try {
            const txKey = 'skyedu_transactions_user_' + data.username;
            const txList = JSON.parse(localStorage.getItem(txKey) || '[]');
            const idx = txList.findIndex(r => r.id === data.id);
            if (idx >= 0) txList[idx] = { ...txList[idx], ...data };
            else txList.push(data);
            localStorage.setItem(txKey, JSON.stringify(txList));
        } catch (e) { /* ignore */ }
    },

    /**
     * Save a registration. Firebase is authoritative; localStorage is a mirror.
     * Caller should pass `data.id` if pre-generated (form does that), else one
     * is minted by FirebaseAPI.saveRegistration.
     */
    save: async function(data) {
        if (!data || typeof data !== 'object') return { success: false, error: 'Invalid data' };

        // [DIAGNOSTIC] Log registration attempt
        console.log('[REGISTRATION][AUTH] Firebase auth state:', 
            typeof firebase !== 'undefined' && firebase.auth ? 
                (firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'not logged in') : 
                'firebase auth not available');
        console.log('[REGISTRATION][PAYLOAD] id:', data.id || 'not set', 
            '| code:', data.code || 'not set',
            '| status:', data.status || 'not set',
            '| name:', data.name || 'not set');

        // Ensure id + transferContent + status are present before persisting
        if (!data.id) {
            data.id = 'REG-' + Date.now().toString(36).toUpperCase()
                + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
        }
        if (!data.status) data.status = 'pending_payment';
        if (!data.createdAt) data.createdAt = new Date().toISOString();

        // Link to current user when available (fix the id-vs-uid inconsistency)
        if (!data.userId) {
            try {
                const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
                if (cu) {
                    // Prefer Firebase uid (authoritative, matches Security Rules).
                    data.userId = cu.uid || cu.id || null;
                    data.username = cu.username || cu.email || null;
                    data.linkedAccount = !!data.userId;
                    // Persist the user's account email separately so that
                    // getMyTransactions() in tai-khoan.html can match even
                    // when the form was filled with a different gmail or
                    // the uid/username changed.
                    data.userEmail = cu.email || cu.gmail || null;
                }
            } catch (e) { /* ignore */ }
        }

        // 1) Firebase (authoritative)
        let fbResult = { success: false };
        console.log('[REGISTRATION][WRITE_START] Path: /registrations/' + data.id);
        if (typeof FirebaseAPI !== 'undefined' && FirebaseAPI.saveRegistration) {
            try {
                fbResult = await FirebaseAPI.saveRegistration(data);
                if (fbResult && fbResult.success) {
                    console.log('[REGISTRATION][WRITE_SUCCESS] id:', fbResult.id);
                } else {
                    console.error('[REGISTRATION][WRITE_ERROR] Firebase write failed:', fbResult && fbResult.error);
                }
            } catch (e) {
                // Loud log so silent Permission Denied doesn't go unnoticed.
                console.error('[REGISTRATION][WRITE_ERROR] Firebase saveRegistration threw:', e && (e.code || e.message) || e);
                fbResult = { success: false, error: e && (e.code || e.message) || String(e) };
            }
        } else {
            console.error('[REGISTRATION][WRITE_ERROR] FirebaseAPI.saveRegistration not available');
            fbResult = { success: false, error: 'FirebaseAPI not available' };
        }

        // 2) localStorage mirror — always updated so the user still has a copy
        //    even if Firebase is down. Use the Firebase id when available.
        if (fbResult && fbResult.success && fbResult.id) {
            data.id = fbResult.id;
        }
        try {
            const list = this._readLocal();
            const idx = list.findIndex(r => r.id === data.id);
            if (idx >= 0) list[idx] = { ...list[idx], ...data };
            else list.push(data);
            this._writeLocal(list);
            // Per-user mirror under cu.username as fallback when no uid is
            // attached — lets a logged-in user find the tx even before we
            // have linked the registration to a Firebase uid.
            this._writeUserMirror(data);
            this._writeUserMirrorByUsername(data);
        } catch (e) { console.warn('[RegistrationSync] localStorage mirror failed:', e); }

        // Notify all admins about the new registration
        if (fbResult && fbResult.success) {
            console.log('[REGISTRATION][ADMIN_NOTIFY] Notifying admins about new registration:', data.id);
            try {
                if (typeof AdminNotificationService !== 'undefined' && AdminNotificationService.notifyNewRegistration) {
                    AdminNotificationService.notifyNewRegistration(data).catch(function(e) {
                        console.warn('[RegistrationSync] AdminNotificationService failed:', e);
                    });
                }
            } catch (e) { console.warn('[RegistrationSync] Admin notification failed:', e); }
        }

        return fbResult && fbResult.success
            ? { success: true, id: data.id, source: 'firebase+local' }
            : { success: false, id: data.id, source: 'local-only', error: fbResult && fbResult.error };
    },

    /** Update fields on an existing registration, both stores. */
    update: async function(id, patch) {
        if (!id) return { success: false, error: 'Registration ID required' };
        const ts = new Date().toISOString();
        const payload = { ...patch, updatedAt: ts };

        console.log('[REGISTRATION][UPDATE_START]', { id: id, patch: Object.keys(patch) });

        let fbResult = { success: false };
        if (typeof FirebaseAPI !== 'undefined' && FirebaseAPI.updateRegistration) {
            fbResult = await FirebaseAPI.updateRegistration(id, payload);
        }

        try {
            const list = this._readLocal();
            const idx = list.findIndex(r => r.id === id);
            if (idx >= 0) {
                list[idx] = { ...list[idx], ...payload };
                this._writeLocal(list);
                this._writeUserMirror(list[idx]);
                this._writeUserMirrorByUsername(list[idx]);
            }
        } catch (e) { /* ignore */ }

        return fbResult;
    },

    /** Convenience wrappers for the standard status transitions. */
    markAwaiting: async function(id, awaitingSinceIso) {
        return this.update(id, {
            status: 'awaiting_verification',
            awaitingSince: awaitingSinceIso || new Date().toISOString()
        });
    },
    markVerified: async function(id, extra) {
        return this.update(id, { status: 'verified', ...(extra || {}) });
    },
    markRejected: async function(id, extra) {
        return this.update(id, { status: 'rejected', ...(extra || {}) });
    },

    /**
     * Read all registrations. Firebase first, fall back to localStorage,
     * merge by id (Firebase wins for conflicts).
     */
    loadAll: async function() {
        let fbRegs = [];
        if (typeof FirebaseAPI !== 'undefined' && FirebaseAPI.getAllRegistrations) {
            try { fbRegs = await FirebaseAPI.getAllRegistrations(); }
            catch (e) { console.warn('[RegistrationSync] Firebase load failed:', e); }
        }
        const localRegs = this._readLocal();
        const map = {};
        fbRegs.forEach(r => { if (r && r.id) map[r.id] = r; });
        localRegs.forEach(r => {
            if (r && r.id && !map[r.id]) map[r.id] = r;
        });
        const merged = Object.values(map);
        return {
            regs: merged,
            source: fbRegs.length ? (localRegs.length ? 'merged' : 'firebase') : 'local'
        };
    }
};

// ==================== NotificationService ====================
// In-app notifications under /notifications/{uid}/{notifId}. See database.rules.json.
const NotificationService = {
    create: async function(uid, data) {
        if (!uid || !data) return { success: false, error: 'uid + data required' };
        if (!database) return { success: false, error: 'Firebase not ready' };
        try {
            const notifId = 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
            const payload = {
                type: data.type || 'generic',
                title: data.title || 'Thông báo',
                message: data.message || '',
                actionUrl: data.actionUrl || null,
                read: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            await database.ref('notifications/' + uid + '/' + notifId).set(payload);
            return { success: true, id: notifId };
        } catch (e) {
            console.error('[NotificationService] create failed:', e);
            return { success: false, error: e.message };
        }
    },

    markRead: async function(uid, notifId) {
        if (!uid || !notifId) return { success: false };
        try {
            await database.ref('notifications/' + uid + '/' + notifId + '/read').set(true);
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    },

    markAllRead: async function(uid) {
        if (!uid) return { success: false };
        try {
            await database.ref('notifications/' + uid).update({ /* no-op parent */ });
            const snap = await database.ref('notifications/' + uid).once('value');
            const data = snap.val() || {};
            const updates = {};
            Object.keys(data).forEach(id => { if (!data[id].read) updates[id + '/read'] = true; });
            if (Object.keys(updates).length) {
                await database.ref('notifications/' + uid).update(updates);
            }
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    },

    /**
     * Live unread count for the bell badge. Returns an unsubscribe fn.
     * Usage: const off = NotificationService.unreadCount(uid, (n) => badge.textContent = n);
     */
    unreadCount: function(uid, cb) {
        if (!uid || !database) { cb(0); return function() {}; }
        const ref = database.ref('notifications/' + uid);
        const handler = (snap) => {
            const data = snap.val() || {};
            let n = 0;
            Object.values(data).forEach(v => { if (v && !v.read) n++; });
            cb(n);
        };
        ref.on('value', handler);
        return function() { ref.off('value', handler); };
    },

    /** Get latest N notifications for the dropdown panel. */
    list: async function(uid, limit) {
        if (!uid || !database) return [];
        try {
            const snap = await database.ref('notifications/' + uid)
                .orderByChild('createdAt').limitToLast(limit || 20).once('value');
            const data = snap.val() || {};
            return Object.entries(data)
                .map(([id, v]) => ({ id, ...v }))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } catch (e) { return []; }
    }
};

// ==================== EnrollmentSync ====================
// Helper that wraps FirebaseAPI.enrollUser with the implicit package→course mapping.
// In this codebase, courseId === packageCode (e.g. TSA01). If you ever split them,
// replace this single function.
const EnrollmentSync = {
    grantForPackage: async function(uid, packageCode) {
        if (!uid || !packageCode) return { success: false, error: 'uid + packageCode required' };
        if (typeof FirebaseAPI === 'undefined' || !FirebaseAPI.enrollUser) {
            return { success: false, error: 'FirebaseAPI.enrollUser not available' };
        }
        return FirebaseAPI.enrollUser(uid, packageCode);
    }
};

window.initializeFirebase = initializeFirebase;
window.FirebaseAPI = FirebaseAPI;
window.RegistrationSync = RegistrationSync;
window.TransactionSync = TransactionSync;
window.NotificationService = NotificationService;
window.EnrollmentSync = EnrollmentSync;
window.AuditLogger = AuditLogger;
window.firebaseInitialized = firebaseInitialized;

// Helper function to format VND currency
function formatVND(amount) {
    return (amount || 0).toLocaleString('vi-VN') + ' VND';
}

// ==================== Admin Notification System ====================
// Notify all admins when a new registration is submitted
const AdminNotificationService = {
    // Get all admin UIDs from Firebase
    getAdminUids: async function() {
        if (!database) return [];
        try {
            const snapshot = await database.ref('users')
                .orderByChild('role')
                .once('value');
            const adminUids = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const user = child.val();
                    if (user && (user.role === 'admin' || user.role === 'owner' || user.role === 'qtv')) {
                        adminUids.push(child.key);
                    }
                });
            }
            return adminUids;
        } catch (e) {
            console.error('[AdminNotificationService] getAdminUids failed:', e);
            return [];
        }
    },

    // Notify all admins about a new registration awaiting verification
    notifyNewRegistration: async function(registration) {
        const adminUids = await this.getAdminUids();
        if (adminUids.length === 0) {
            console.warn('[AdminNotificationService] No admins found to notify');
            return { success: false, error: 'No admins found' };
        }

        const notifPromises = adminUids.map(uid => {
            return NotificationService.create(uid, {
                type: 'new_registration',
                title: 'Đăng ký mới',
                message: `Đăng ký mới từ ${registration.name} - ${registration.code} (${formatVND(registration.price)})`,
                actionUrl: 'account/admin.html?tab=registrations'
            });
        });

        try {
            const results = await Promise.all(notifPromises);
            const successCount = results.filter(r => r.success).length;
            console.log(`[AdminNotificationService] Notified ${successCount}/${adminUids.length} admins`);
            return { success: true, notified: successCount, total: adminUids.length };
        } catch (e) {
            console.error('[AdminNotificationService] notifyNewRegistration failed:', e);
            return { success: false, error: e.message };
        }
    }
};

window.AdminNotificationService = AdminNotificationService;
window.formatVND = formatVND;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseAPI;
}

// Tự động tạo admin khi load lần đầu
if (typeof window !== 'undefined') {
    window.addEventListener('load', function() {
        setTimeout(() => {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                setTimeout(() => {
                    if (FirebaseAPI.isReady()) {
                        FirebaseAPI.createDefaultAdmin().catch(err => {
                            console.warn('Không thể tạo admin tự động:', err.message);
                        });
                    }
                }, 2000);
            }
        }, 500);
    });
}

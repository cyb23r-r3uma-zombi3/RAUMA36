// =====================================
// FIREBASE AUTH INTEGRATION
// =====================================

/**
 * Hiển thị lỗi auth thân thiện trên UI (thay vì alert())
 * Fallback về alert nếu không có element trên trang.
 */
function showAuthError(code, fallbackMessage) {
    const errorMessages = {
        'auth/email-already-in-use': 'Tên đăng nhập này đã được sử dụng.',
        'auth/invalid-email': 'Định dạng email không hợp lệ.',
        'auth/weak-password': 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.',
        'auth/wrong-password': 'Sai mật khẩu. Vui lòng thử lại.',
        'auth/user-not-found': 'Tài khoản không tồn tại.',
        'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa.',
        'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng chờ 15 phút.',
        'auth/network-request-failed': 'Lỗi kết nối mạng. Kiểm tra internet của bạn.',
        'auth/operation-not-allowed': 'Đăng nhập bằng email/mật khẩu chưa được kích hoạt.',
        'auth/invalid-credential': 'Thông tin đăng nhập không hợp lệ.',
        'auth/invalid-api-key': 'Lỗi cấu hình Firebase. Liên hệ quản trị viên.',
        'auth/app-not-authorized': 'Ứng dụng không được phép truy cập Firebase.',
        'PERMISSION_DENIED': 'Không có quyền truy cập. Kiểm tra Firebase Rules.',
        'default': 'Có lỗi xảy ra. Vui lòng thử lại.'
    };

    const message = errorMessages[code] || fallbackMessage || errorMessages.default;

    const errorEl = document.getElementById('authError') || document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
    } else {
        alert(message);
    }
}

/**
 * Helper: lấy element button đang submit (an toàn với event truyền vào)
 */
function _getSubmitBtn(event) {
    if (event && event.target && event.target.tagName !== 'BUTTON') {
        // Trong trường hợp onclick trên div cha, tìm button
        const btn = event.target.closest('button');
        if (btn) return btn;
    }
    return (event && event.target) ? event.target : null;
}

// =====================================
// ĐĂNG KÝ
// =====================================

async function register(event) {
    if (event) event.preventDefault();

    const fullnameEl = document.getElementById("fullname");
    const usernameEl = document.getElementById("username");
    const passwordEl = document.getElementById("password");

    const fullname = fullnameEl ? fullnameEl.value.trim() : '';
    const username = usernameEl ? usernameEl.value.trim().toLowerCase() : '';
    const password = passwordEl ? passwordEl.value.trim() : '';

    if (!fullname || !username || !password) {
        showAuthError(null, 'Vui lòng nhập đầy đủ thông tin');
        return;
    }

    if (username.length < 6) {
        showAuthError(null, 'Tên đăng nhập phải từ 6 ký tự trở lên');
        return;
    }

    const usernameRegex = /^[a-z0-9_]{6,}$/;
    if (!usernameRegex.test(username)) {
        showAuthError(null, 'Tên đăng nhập chỉ được chứa: chữ a-z, số 0-9, dấu _ (tối thiểu 6 ký tự)');
        return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#])[A-Za-z\d@$!%*?&.#]{8,}$/;

    if (!passwordRegex.test(password)) {
        showAuthError(null, 'Mật khẩu phải có: ít nhất 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt');
        return;
    }

    // Tạo email từ username. Firebase Auth yêu cầu email format hợp lệ.
    // Domain skyedu.id.vn là domain thật đã đăng ký cho dự án SKY EDU.
    // Nếu đổi domain hosting, cần cập nhật cả đây và Firebase Authorized Domains.
    const email = username + "@skyedu.id.vn";

    // Loading state — dùng event.target an toàn
    const btn = _getSubmitBtn(event);
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.textContent = "Đang xử lý...";
        btn.disabled = true;
    }

    try {
        // Kiểm tra username đã tồn tại chưa
        const existingUser = await FirebaseAPI.getUserByUsername(username);
        if (existingUser) {
            showAuthError(null, 'Tên đăng nhập đã tồn tại!');
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
            return;
        }

        const result = await FirebaseAPI.createUser(email, password, fullname, username);

        if (result.success) {
            showAuthError(null, 'Đăng ký thành công! Đang chuyển hướng...');
            setTimeout(() => {
                window.location.href = "dang-nhap.html";
            }, 800);
        } else {
            showAuthError(null, result.error);
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
        }
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        showAuthError(error.code, error.message);
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
}

// =====================================
// ĐĂNG NHẬP
// =====================================

async function login(event) {
    if (event) event.preventDefault();

    const username = document.getElementById("username").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        showAuthError(null, 'Vui lòng nhập đầy đủ thông tin');
        return;
    }

    const email = username + "@skyedu.id.vn";

    const btn = _getSubmitBtn(event);
    const originalText = btn ? btn.textContent : '';
    if (btn) {
        btn.textContent = "Đang đăng nhập...";
        btn.disabled = true;
    }

    try {
        const result = await FirebaseAPI.loginUser(email, password);

        if (result.success) {
            const userData = {
                ...result.userData,
                sessionToken: result.sessionToken
            };
            // Áp dụng RoleSystem + SessionSecurity (TTL 1 giờ)
            let normalized;
            if (typeof RoleSystem !== 'undefined' && typeof SessionSecurity !== 'undefined') {
                normalized = RoleSystem.normalize(userData);
                SessionSecurity.saveSession(normalized);
            } else if (typeof RoleSystem !== 'undefined') {
                normalized = RoleSystem.saveCurrentUser(userData);
            } else {
                localStorage.setItem('currentUser', JSON.stringify(userData));
                normalized = userData;
            }

            showAuthError(null, 'Đăng nhập thành công!');

            // Dispatch event để các trang đang mở (vd: thi-thu) cập nhật navbar
            window.dispatchEvent(new CustomEvent('userLogin', { detail: { user: normalized } }));

            setTimeout(() => {
                if (RoleSystem.hasAnyRole(normalized, ['admin', 'owner', 'qtv'])) {
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "../index.html";
                }
            }, 500);
        } else {
            showAuthError(result.rateLimited ? 'auth/too-many-requests' : null, result.error);
            if (btn) { btn.textContent = originalText; btn.disabled = false; }
        }
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        showAuthError(error.code, error.message);
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
}

// =====================================
// ĐĂNG XUẤT
// =====================================

async function logout() {
    try {
        const currentUser = (typeof SessionSecurity !== 'undefined')
            ? SessionSecurity.getSession()
            : SessionSecurity.safeParse(localStorage.getItem("currentUser"), null);

        if (currentUser && currentUser.uid) {
            await FirebaseAPI.logoutUser(currentUser.uid);
        }
    } catch (error) {
        console.error("Lỗi đăng xuất:", error);
    }

    // Xoá sạch session + các storage quan trọng
    if (typeof SessionSecurity !== 'undefined') {
        SessionSecurity.clearSession();
    } else {
        localStorage.removeItem("currentUser");
    }
    try {
        // Xoá các cache có thể chứa PII
        localStorage.removeItem('sky_users');
        sessionStorage.clear();
    } catch (e) {}

    // [PHASE 14] AWAIT signOut() trước khi redirect để đảm bảo Firebase Auth state
    // không còn cached. Đã có try/catch fail-safe — nếu signOut lỗi vẫn redirect.
    try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await firebase.auth().signOut();
        }
    } catch (e) {
        console.warn('Firebase signOut error:', e);
    }

    // Dispatch event để các trang đang mở (vd: thi-thu) cập nhật navbar
    window.dispatchEvent(new CustomEvent('userLogout'));

    window.location.href = "../index.html";
}

// Make functions globally accessible
window.register = register;
window.login = login;
window.logout = logout;
window.showAuthError = showAuthError;

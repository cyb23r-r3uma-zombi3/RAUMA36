/* ================================================================
   MAIN.JS — SKY EDU
   Navbar, countdown, theme toggle, session validation
   ================================================================ */

document.addEventListener("DOMContentLoaded", async () => {

    let currentUser = null;
    try {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
            currentUser = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error parsing currentUser from storage:', error);
        localStorage.removeItem("currentUser");
        currentUser = null;
    }

    // Use Firebase auth state listener as source of truth.
    // IMPORTANT: Chỉ SYNC dữ liệu từ Firebase khi user đã đăng nhập.
    // KHÔNG xoá currentUser khi Firebase trả về null — vì:
    //  - Firebase auth state có thể trả null thoáng qua khi init/refresh token
    //  - Session của SKY EDU có TTL 10 năm (xem session-security.js)
    //  - Trang chủ (index.html) và các trang khác vẫn dùng session local
    // Việc logout phải do user chủ động (qua nút Đăng xuất hoặc event userLogout).
    if (typeof firebase !== 'undefined' && firebase.auth) {
        try {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
                        const userData = snapshot.val();
                        if (userData) {
                            // [FIX] Read BOTH role and roles[] from Firebase — not just role
                            const rawUser = {
                                uid: user.uid,
                                email: user.email,
                                fullname: userData.fullname || userData.displayName || user.displayName,
                                username: userData.username,
                                role: userData.role || 'user',
                                roles: userData.roles || (userData.role ? [userData.role] : []),
                                isAdmin: userData.isAdmin || false,
                                avatar: userData.avatar || null
                            };
                            // Normalize via RoleSystem so permissions/auto-grants are computed
                            currentUser = (typeof RoleSystem !== 'undefined')
                                ? RoleSystem.normalize(rawUser)
                                : rawUser;
                            // Persist to localStorage so other pages pick up the latest roles
                            // Dùng SessionSecurity.saveSession để gắn sessionExpiresAt (10 năm)
                            if (typeof SessionSecurity !== 'undefined' && typeof SessionSecurity.saveSession === 'function') {
                                SessionSecurity.saveSession(currentUser);
                            } else {
                                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                            }
                            updateUserUI(currentUser);
                        }
                    } catch (syncErr) {
                        console.warn('User sync error:', syncErr);
                    }
                }
                // Nếu user === null thì KHÔNG xoá currentUser — giữ nguyên session local.
                // Session local có TTL 10 năm (xem session-security.js) và sẽ tự đăng xuất
                // khi user chủ động logout hoặc khi SessionSecurity.getSession() phát hiện hết hạn.
            });
        } catch (e) {
            console.warn('Firebase onAuthStateChanged error:', e);
        }
    }

    const guestMenu = document.getElementById("guestMenu");
    const guestRegister = document.getElementById("guestRegister");
    const userMenu = document.getElementById("userMenu");
    const userBtn = document.getElementById("userBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const navUsername = document.getElementById("navUsername");
    const navAvatar = document.getElementById("navAvatar");
    const dropdownAvatar = document.getElementById("dropdownAvatar");
    const dropdownName = document.getElementById("dropdownName");
    const adminLink = document.getElementById("adminLink");
    const dashboardLink = document.getElementById("dashboardLink");
    const leaderboardLink = document.getElementById("leaderboardLink");

    const userFullname = currentUser?.fullname || 'Người dùng';

    updateUserUI(currentUser);

    function updateUserUI(user) {
        if (!user) {
            if (guestMenu) guestMenu.style.display = "block";
            if (guestRegister) guestRegister.style.display = "block";
            if (userMenu) userMenu.style.display = "none";
            if (dashboardLink) dashboardLink.style.display = "none";
            if (leaderboardLink) leaderboardLink.style.display = "none";
            if (adminLink) adminLink.style.display = "none";
            return;
        }

        if (guestMenu) guestMenu.style.display = "none";
        if (guestRegister) guestRegister.style.display = "none";
        if (userMenu) userMenu.style.display = "block";

        if (navUsername) {
            navUsername.innerText = userFullname;
        }

        if (user?.avatar) {
            if (navAvatar) {
                navAvatar.style.backgroundImage = `url(${user.avatar})`;
                navAvatar.style.backgroundSize = 'cover';
                navAvatar.style.backgroundPosition = 'center';
                navAvatar.innerText = '';
            }
            if (dropdownAvatar) {
                dropdownAvatar.innerHTML = `<img src="${user.avatar}" alt="Ảnh đại diện người dùng" loading="lazy">`;
            }
        } else {
            const initial = (userFullname || 'U').charAt(0).toUpperCase();
            if (navAvatar) navAvatar.innerText = initial;
            if (dropdownAvatar) dropdownAvatar.innerText = initial;
        }

        if (dropdownName) dropdownName.innerText = userFullname;

        if (dashboardLink) dashboardLink.style.display = "flex";
        if (leaderboardLink) leaderboardLink.style.display = "flex";

        const adminRoles = ['admin', 'owner', 'qtv', 'moderator'];
        if (adminRoles.includes(user?.role) && adminLink) {
            adminLink.style.display = "flex";
            if (user?.role === "moderator") {
                adminLink.innerHTML = '⚙️ Quản trị viên';
            }
        }
    }

    if (userBtn) {
        const _attach = (t, e, h) => typeof eventManager !== 'undefined' ? eventManager.on(t, e, h) : t.addEventListener(e, h);
        _attach(userBtn, "click", function (e) {
            e.preventDefault();
            if (dropdownMenu) dropdownMenu.classList.toggle("show");
        });
    }

    _attach(document, "click", function (e) {
        if (!e.target.closest("#userMenu")) {
            if (dropdownMenu) dropdownMenu.classList.remove("show");
        }
    });

    const loginBtnNav = document.getElementById("loginBtnNav");
    const registerBtnNav = document.getElementById("registerBtnNav");
    const userMenuNav = document.getElementById("userMenuNav");
    const navUsernameNav = document.getElementById("navUsernameNav");

    if (currentUser) {
        if (loginBtnNav) loginBtnNav.style.display = "none";
        if (registerBtnNav) registerBtnNav.style.display = "none";
        if (userMenuNav) userMenuNav.style.display = "flex";
        if (navUsernameNav) navUsernameNav.textContent = userFullname;
    }

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    if (mobileMenuBtn) {
        _attach(mobileMenuBtn, "click", function () {
            const navCenter = document.querySelector(".nav-center");
            if (navCenter) navCenter.classList.toggle("mobile-open");
        });
    }

    const getExamDate = () => {
        const savedDate = localStorage.getItem('examDate');
        if (savedDate) {
            return new Date(savedDate).getTime();
        }
        return new Date("December 15, 2026 09:00:00").getTime();
    };

    window.setExamDate = (dateString) => {
        localStorage.setItem('examDate', dateString);
        updateCountdown();
    };

    const examDate = getExamDate();

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = examDate - now;

        if (distance > 0) {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const daysEl = document.getElementById("days");
            const hoursEl = document.getElementById("hours");
            const minutesEl = document.getElementById("minutes");
            const secondsEl = document.getElementById("seconds");

            if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
            if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
            if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
            if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
        }
    }

    if (document.getElementById("days")) {
        updateCountdown();
        if (typeof timerManager !== 'undefined') timerManager.setInterval(updateCountdown, 1000, 'countdown-timer');
        else setInterval(updateCountdown, 1000);
    }

});

/* ================================================================
   CROSS-TAB ROLE SYNC
   ================================================================ */
// Listen for cross-tab login events so we update immediately without reload
_attach(window, 'userLogin', (e) => {
    if (e.detail && e.detail.user) {
        const rawUser = e.detail.user;
        const syncedUser = (typeof RoleSystem !== 'undefined')
            ? RoleSystem.normalize(rawUser)
            : rawUser;
        localStorage.setItem('currentUser', JSON.stringify(syncedUser));
        updateUserUI(syncedUser);
    }
});

_attach(window, 'userLogout', () => {
    localStorage.removeItem('currentUser');
    updateUserUI(null);
});

// [FIX] When admin changes user role in admin panel, other open tabs should
// re-sync from Firebase. Fire this event from admin.html after role update:
_attach(window, 'role-updated', () => {
    const uid = (typeof currentUser !== 'undefined' && currentUser?.uid) ? currentUser.uid : null;
    if (!uid) return;
    if (typeof firebase !== 'undefined' && firebase.database) {
        firebase.database().ref('users/' + uid).once('value').then(snap => {
            const userData = snap.val();
            if (!userData) return;
            const rawUser = {
                uid: uid,
                email: userData.email || currentUser?.email,
                fullname: userData.fullname || currentUser?.fullname,
                username: userData.username,
                role: userData.role || 'user',
                roles: userData.roles || [],
                avatar: userData.avatar || null
            };
            const synced = (typeof RoleSystem !== 'undefined')
                ? RoleSystem.normalize(rawUser)
                : rawUser;
            localStorage.setItem('currentUser', JSON.stringify(synced));
            updateUserUI(synced);
        }).catch(err => {
            console.error('[main] Failed to sync role from Firebase:', err);
            // User can still continue with cached role
        });
    }
});

/* ================================================================
   Toast / notification
   ================================================================ */
function showNotification(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.style.animation = 'slideInRight 0.3s ease forwards';

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    // Sanitize message tránh XSS khi render
    const safe = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${safe}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

window.showNotification = showNotification;

function logoutNavbar() {
    localStorage.removeItem("currentUser");

    if (typeof showNotification === 'function') {
        showNotification("Đăng xuất thành công! Hẹn gặp lại 👋", "success");
    }

    setTimeout(() => {
        location.reload();
    }, 1000);
}

window.logoutNavbar = logoutNavbar;

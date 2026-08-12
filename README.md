# 🎓 SKY EDU — Nền tảng luyện thi TSA / HSA

[![GitHub Pages](https://img.shields.io/badge/Demo-skyedu.id.vn-blue)](https://skyedu.id.vn)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)](https://firebase.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Ready-success)](manifest.json)

Nền tảng luyện thi **TSA** (Đánh giá tư duy) và **HSA** (Đánh giá năng lực) với đầy đủ tính năng:
12 dạng câu hỏi, bảng xếp hạng, gamification, admin panel, dark mode, PWA.

---

## ✨ Tính năng

- 🎯 **12 dạng câu hỏi**: Trắc nghiệm, tự luận, điền khuyết, ghép đôi, kéo thả, sắp xếp, đúng/sai, matrix...
- 🔥 **Firebase Realtime**: Đồng bộ dữ liệu tức thì, không cần server riêng
- 🏆 **Gamification**: Điểm kinh nghiệm, huy hiệu, bảng xếp hạng, cửa hàng Sky Store
- 👨‍💼 **Admin Panel**: Tạo câu hỏi, quản lý đề thi, thống kê người dùng
- 🌙 **Dark Mode**: Giao diện tối/sáng tuỳ chọn, lưu localStorage
- 📱 **PWA**: Cài được trên điện thoại như app thật (manifest.json + service worker)
- 🔒 **Bảo mật**: Anti-cheat, rate limiting, session token hash, IP binding
- 🧮 **LaTeX/KaTeX**: Hỗ trợ render công thức toán trong câu hỏi

---

## 🚀 Cài đặt & Chạy

### 1. Clone repo

> Lấy URL repo thật từ nhóm phát triển. Cú pháp mẫu:

```bash
git clone <REPOSITORY_URL>
cd <REPOSITORY_FOLDER>
```

### 2. Cấu hình Firebase

Firebase config đã có sẵn trong `firebase-config.js`. Mở file và điền thông tin Firebase project của bạn
(lấy tại Firebase Console → Project Settings → General → Your apps → SDK setup).

Cập nhật `ALLOWED_DOMAINS` trong cùng file cho domain hosting thật của bạn.

### 3. Firebase Security Rules

Vào **Firebase Console → Realtime Database → Rules**, dán:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "examResults": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "leaderboard": {
      ".read": true,
      ".write": false
    },
    "questionBank": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('isAdmin').val() === true)"
    },
    "exams": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('isAdmin').val() === true)"
    }
  }
}
```

### 4. Chạy local

**⚠️ Quan trọng cho video YouTube:** Mở trực tiếp bằng `file://` sẽ bị lỗi 153 (YouTube từ chối phát video). Phải chạy qua web server:

```bash
# Cách 1: Node.js
node start-server.js

# Cách 2: Python
python -m http.server 8080

# Cách 3: Click đúp file start.bat (Windows)
```

Sau đó mở: `http://localhost:8080/phong-luyen-tsa/index.html`

### 5. Deploy

**GitHub Pages:**

```bash
git add .
git commit -m "feat: initial deploy"
git push origin main
```

Vào **Settings → Pages → Source: `main` branch / root**.

**Shared hosting (Apache):**

Upload tất cả file (trừ `node_modules/`, `firebase-config.js`) lên `public_html/`.
File `.htaccess` đã được cấu hình sẵn (bảo mật, cache, gzip).

---

## 📁 Cấu trúc

```
tsa-sky-main/
├── index.html                  # Trang chủ
├── dashboard.html              # Dashboard học tập
├── leaderboard.html            # Bảng xếp hạng
├── quy-doi-diem.html           # Quy đổi điểm TSA → THPT
├── lo-trinh-tsa.html           # Lộ trình ôn thi
├── firebase-config.js          # Config thật (điền thông tin Firebase của bạn)
├── start-server.js             # Local Node server (thuần Node, không cần npm install)
├── start.bat                   # Local server (Windows; ưu tiên Python, fallback Node)
├── 404.html / 403.html / 500.html
├── manifest.json + sw.js       # PWA
├── package.json                # Dev metadata
├── LICENSE                     # MIT
├── .nojekyll                   # Bypass Jekyll trên GitHub Pages
├── account/                    # Auth + Admin
│   ├── auth.js
│   ├── dang-nhap.html          # Đăng nhập
│   ├── dang-ky.html            # Đăng ký
│   ├── doi-mat-khau.html       # Đổi mật khẩu
│   ├── tai-khoan.html          # Hồ sơ
│   └── admin.html              # Trang quản trị
├── assets/
│   ├── css/                    # style.css + premium-style.css
│   └── js/
│       ├── main.js             # Navbar + session
│       ├── theme.js
│       ├── question-types.js   # 12 dạng câu hỏi
│       ├── question-renderer.js
│       ├── question-bank.js
│       ├── exam-builder.js
│       ├── dashboard.js
│       ├── gamification.js     # XP/badges/streaks
│       ├── leaderboard.js      # Bảng xếp hạng
│       ├── data-validator.js   # XSS sanitize, schema validate
│       ├── tsa-topics.js       # 13 chuyên đề TSA
│       ├── hsa-topics.js       # 5 chuyên đề HSA
│       ├── admin-pro.js        # Admin Pro
│       ├── exam-result-bridge.js
│       ├── reset-data.js       # Dev tool (chạy thủ công)
│       └── core/               # sky-store, role-system, session-security, achievement, ai-insight, rank, learning-stats, ui-kit
├── phong-luyen-tsa/            # Phòng luyện TSA
│   ├── index.html
│   ├── exam.html
│   └── result.html
├── phong-luyen-hsa/            # Phòng luyện HSA
│   ├── index.html
│   ├── exam.html
│   └── result.html
└── khoa-hoc-pages/             # Khóa học
    ├── index.html
    └── detail.html
```

---

## 🔑 Tài khoản Admin

Tài khoản admin mặc định (đã tạo sẵn khi load lần đầu):

- **Username**: `admin`
- **Email nội bộ**: `admin@skyedu.id.vn`
- **Password**: `Bh25052k8@`

> ⚠️ **Quan trọng**: Đổi mật khẩu ngay sau lần đăng nhập đầu tiên!

Hoặc cấp quyền admin cho user khác trong **Firebase Console → Realtime Database → `users/{uid}`**:

```json
{
  "role": "admin",
  "isAdmin": true
}
```

---

## ⚠️ Lưu ý bảo mật

- **KHÔNG** commit `firebase-config.js` (đã có trong `.gitignore`).
- Bật HTTPS bắt buộc khi deploy production (Firebase Auth yêu cầu).
- Cập nhật Firebase Security Rules trước khi public.
- Mỗi IP chỉ được đăng ký 1 tài khoản (rate limit 5 lần/15 phút).
- Session token được hash + validate mỗi lần load trang.
- Không hardcode API key/secret vào code; thông tin nhạy cảm nằm trong `firebase-config.js`
  (đã tách riêng và nên được thêm vào `.gitignore` cho project của bạn).

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Vanilla JS (ES6+), HTML5, CSS3 |
| Auth | Firebase Authentication |
| Database | Firebase Realtime Database |
| Hosting | GitHub Pages / Apache shared hosting |
| PWA | Service Worker, Web App Manifest |
| LaTeX | KaTeX |
| Icons | Iconify, Lucide |

---

## 📞 Liên hệ

- Email: support@sky-edu.com
- Website: https://skyedu.id.vn
- GitHub Issues: liên hệ nhóm phát triển để lấy URL repo.

---

## 📄 License

MIT © 2026 SKY EDU Team. Xem [LICENSE](LICENSE) để biết thêm chi tiết.

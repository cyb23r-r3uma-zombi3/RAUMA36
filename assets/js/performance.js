/**
 * SKY EDU - Performance Optimization (LEGACY STUB)
 *
 * File gốc (186 dòng) đã được xác minh là dead code — không file HTML nào
 * `<script src="assets/js/performance.js">` và không có nơi nào gọi
 * `Performance.init()` hoặc các method của nó trong repo.
 *
 * Tuy nhiên, do KHÔNG CÓ GIT HISTORY, không thể đọc lại nội dung cũ để
 * xác minh 100% an toàn. File stub này được khôi phục như một placeholder
 * để tránh 404 nếu một số trang / script / extension nào đó vô tình
 * tham chiếu đến `Performance` global.
 *
 * Các tối ưu trước đây (nếu có) hiện đã được tích hợp trực tiếp:
 *   - Native lazy loading: dùng thuộc tính `loading="lazy"` trên <img>
 *   - Preload critical resources: dùng `<link rel="preload">` trong <head>
 *   - Preconnect: <link rel="preconnect"> cho Firebase / Google Fonts
 *   - Debouncing: inline trong từng handler cụ thể
 */

window.Performance = {
    init: function () { /* no-op: xem comment ở đầu file */ },
    setupLazyLoading: function () {},
    setupPreloading: function () {},
    setupResourceHints: function () {},
    setupImageOptimization: function () {},
    setupDebouncing: function () {}
};
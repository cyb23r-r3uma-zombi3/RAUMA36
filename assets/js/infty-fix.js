/* ================================================================
   SKY EDU - Infinity Symbol Rendering Fix
   --------------------------------------------------------------
   Mục đích: Sửa lỗi hiển thị ký hiệu -\infty và +\infty trong các
   trang dùng KaTeX (admin, phòng luyện TSA/HSA, kết quả) và
   MathJax (phòng luyện HSA).
   --------------------------------------------------------------
   Nguyên nhân: Project đang ép `.katex` dùng
     font-family: 'KaTeX_Main', 'Times New Roman', 'Cambria Math',
                  'Lucida Bright', serif !important;
   Khiến ký tự ∞ (U+221E) có thể bị trình duyệt fallback sang font
   hệ thống (Times New Roman / serif) → ∞ mỏng, nhỏ, lệch baseline,
   khoảng cách với + / - không tự nhiên.
   --------------------------------------------------------------
   Cách sửa:
   - KHÔNG thay đổi ký tự Unicode ∞ (giữ nguyên ∞).
   - KHÔNG replace chuỗi `\infty` (giữ nguyên LaTeX).
   - CHỈ đánh dấu các node KaTeX/MathJax chứa ∞ bằng class
     `sky-infty` SAU KHI math engine đã render xong → dùng CSS
     riêng để ép font KaTeX_Main/MathJax-TeX, baseline, text-shadow
     nhẹ để ∞ đậm/sắc nét như KaTeX/MathJax mặc định và SGK.
   - KHÔNG ảnh hưởng tới bất kỳ ký hiệu toán học nào khác.
   ================================================================ */

(function () {
    'use strict';

    var INFTY_CHAR = '∞';                 // U+221E
    var INFTY_CLASS = 'sky-infty';

    function tagInfty(root) {
        if (!root || root.nodeType !== 1) return;

        // Trường hợp 1: KaTeX render \infty thành
        //   <span class="mord">∞</span>  (không có phần tử con)
        if (
            root.classList &&
            root.classList.contains('mord') &&
            root.childElementCount === 0 &&
            root.textContent &&
            root.textContent.indexOf(INFTY_CHAR) !== -1 &&
            !root.classList.contains(INFTY_CLASS)
        ) {
            root.classList.add(INFTY_CLASS);
        }

        // Trường hợp 2: MathJax render \infty với class mjx-c221E
        if (
            root.classList &&
            root.classList.contains('mjx-c221E') &&
            !root.classList.contains(INFTY_CLASS)
        ) {
            root.classList.add(INFTY_CLASS);
        }

        // Đệ quy xuống các phần tử con (KHÔNG đệ quy text node)
        var children = root.children;
        if (children && children.length) {
            for (var i = 0; i < children.length; i++) {
                tagInfty(children[i]);
            }
        }
    }

    function startObserver() {
        if (!document || !document.body) {
            setTimeout(startObserver, 10);
            return;
        }
        // Gắn class cho mọi ∞ đã có sẵn trong DOM
        tagInfty(document.body);

        // Theo dõi DOM để bắt mọi ∞ mới được KaTeX/MathJax render
        try {
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var added = mutations[i].addedNodes;
                    if (!added) continue;
                    for (var j = 0; j < added.length; j++) {
                        tagInfty(added[j]);
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) {
            /* MutationObserver không khả dụng → đã tag sẵn là đủ */
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();
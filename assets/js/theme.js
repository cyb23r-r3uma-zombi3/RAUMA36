/**
 * SKY EDU - Dark Mode Only
 */

const Theme = {
    STORAGE_KEY: 'skyedu_theme',
    THEMES: {
        dark: {
            name: 'Dark Mode',
            colors: {
                '--dark-navy':    '#0D1117',
                '--navy-deep':    '#161B22',
                '--navy-light':   '#21262D',
                '--electric-blue':'#60A5FA',
                '--violet':       '#A78BFA',
                '--cyan':         '#34D399',
                '--glass-bg':     'rgba(33, 38, 45, 0.85)',
                '--glass-border': 'rgba(139, 148, 158, 0.2)',
                '--glass-shadow': 'rgba(0, 0, 0, 0.25)',
                '--bg-primary':   '#0D1117',
                '--bg-secondary': '#161B22',
                '--bg-tertiary':  '#21262D',
                '--text-primary': '#E6EDF3',
                '--text-secondary':'#8B949E',
                '--text-muted':   '#6E7681',
                '--border':       '#30363D',
                '--primary':      '#60A5FA',
                '--primary-hover':'#3B82F6',
                '--success':      '#3FB950',
                '--warning':      '#D29922',
                '--danger':       '#F85149',
                '--shadow':       'rgba(0, 0, 0, 0.2)',
                '--card-bg':      '#161B22',
                '--nav-bg':       '#010409',
                '--white':        '#E6EDF3',
                '--gray-100':     '#21262D',
                '--gray-200':     '#30363D',
                '--gray-300':     '#8B949E',
                '--gray-400':     '#6E7681'
            }
        }
    },

    currentTheme: 'dark',

    init() {
        this.applyTheme(this.currentTheme);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._bindAll());
        } else {
            this._bindAll();
        }
    },

    _bindAll() {
        this._hideThemeToggle();
    },

    _hideThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.style.display = 'none';
        }
    },

    applyTheme(theme) {
        const themeData = this.THEMES[theme];
        if (!themeData) return;
        const root = document.documentElement;
        for (const [variable, value] of Object.entries(themeData.colors)) {
            root.style.setProperty(variable, value);
        }
        root.classList.toggle('dark-mode', theme === 'dark');
        root.classList.remove('light-premium-mode', 'light');
        document.body.classList.toggle('dark-mode', theme === 'dark');
        document.body.classList.remove('light-premium-mode', 'light');
        this.currentTheme = theme;
        window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme } }));
        window.dispatchEvent(new CustomEvent('skyEduThemeApplied'));
    },

    toggle() {
        // Dark mode only - no toggle available
    }
};

// Dark mode CSS
const darkModeCSS = `
/* ===== BASE Dark ===== */
body {
    background-color: #0D1117 !important;
    color: #E6EDF3 !important;
}

/* ===== Dark Mode Background ===== */
.dark-mode .page-bg {
    background: #060D1F !important;
}
.dark-mode .bg-gradient {
    background: radial-gradient(
        ellipse 120% 60% at 50% -5%,
        rgba(0, 212, 255, 0.14) 0%,
        rgba(59, 130, 246, 0.09) 30%,
        rgba(139, 92, 246, 0.06) 55%,
        transparent 75%
    ) !important;
}
.dark-mode .bg-grid {
    background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px) !important;
    background-size: 64px 64px !important;
}

.dark-mode .orb-1 {
    width: 500px !important;
    height: 500px !important;
    background: radial-gradient(circle,
        rgba(0, 212, 255, 0.18) 0%,
        rgba(0, 150, 255, 0.1) 50%,
        transparent 70%) !important;
    top: 5% !important;
    left: -5% !important;
}
.dark-mode .orb-2 {
    width: 400px !important;
    height: 400px !important;
    background: radial-gradient(circle,
        rgba(139, 92, 246, 0.16) 0%,
        rgba(168, 85, 247, 0.08) 50%,
        transparent 70%) !important;
    bottom: 10% !important;
    right: -5% !important;
}
.dark-mode .floating-orb.orb-3 {
    display: block !important;
    opacity: 1 !important;
    width: 300px !important;
    height: 300px !important;
    background: radial-gradient(circle,
        rgba(16, 185, 129, 0.1) 0%,
        rgba(5, 150, 105, 0.05) 50%,
        transparent 70%) !important;
    top: 40% !important;
    left: 60% !important;
    animation-delay: -10s !important;
}

/* Hero background */
.dark-mode .hero-bg-image {
    opacity: 0.5 !important;
}
.dark-mode .hero-overlay {
    background: linear-gradient(
        135deg,
        rgba(5,11,26,0.9) 0%,
        rgba(5,11,26,0.75) 40%,
        rgba(5,11,26,0.5) 70%,
        transparent 100%
    ) !important;
    opacity: 1 !important;
}
`;

// Inject dark mode CSS only
const styleEl = document.createElement('style');
styleEl.id = 'skyedu-theme-css';
styleEl.textContent = darkModeCSS;
document.head.appendChild(styleEl);

// Export
window.Theme = Theme;

// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Theme.init());
} else {
    Theme.init();
}

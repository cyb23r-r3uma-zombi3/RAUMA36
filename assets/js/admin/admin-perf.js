/**
 * ADMIN PERFORMANCE MONITOR
 * =========================
 * Performance monitoring utilities for the admin panel:
 * - Measure initialization time
 * - Track Firebase connection time
 * - Monitor script loading performance
 * - Log slow operations
 * 
 * Usage:
 *   AdminPerf.mark('firebase-init-start');
 *   // ... operation ...
 *   AdminPerf.measure('Firebase Init', 'firebase-init-start');
 *   
 *   AdminPerf.logReport(); // Print all metrics to console
 */

(function(global) {
    'use strict';

    const AdminPerf = {
        metrics: {},
        marks: {},
        logs: [],
        enabled: true,
        slowThreshold: 1000, // Log operations slower than 1 second

        /**
         * Mark a timestamp with a name
         */
        mark(name) {
            if (!this.enabled) return;
            const time = performance.now();
            this.marks[name] = time;
            this.metrics[name] = { start: time, end: null, duration: null };
            console.debug(`[Perf] ▶ ${name}: start`);
        },

        /**
         * Measure duration between a mark and now (or another mark)
         */
        measure(name, startMark, endMark = null) {
            if (!this.enabled) return 0;

            const start = this.marks[startMark];
            if (start === undefined) {
                console.warn(`[Perf] No mark found: ${startMark}`);
                return 0;
            }

            const end = endMark ? this.marks[endMark] : performance.now();
            const duration = end - start;

            this.metrics[name] = {
                start: start,
                end: end,
                duration: duration
            };

            const formatted = duration.toFixed(2);
            const isSlow = duration > this.slowThreshold;
            
            if (isSlow) {
                console.warn(`[Perf] ⚠️ SLOW: ${name}: ${formatted}ms`);
            } else {
                console.log(`[Perf] ✓ ${name}: ${formatted}ms`);
            }

            return duration;
        },

        /**
         * Time a function execution
         */
        async time(name, fn) {
            if (!this.enabled) return fn();

            this.mark(name);
            try {
                const result = await fn();
                this.measure(name, name);
                return result;
            } catch (e) {
                this.measure(name, name);
                throw e;
            }
        },

        /**
         * Track async operation with start/end
         */
        async track(name, promise) {
            if (!this.enabled) return promise;

            this.mark(name);
            try {
                const result = await promise;
                this.measure(name, name);
                return result;
            } catch (e) {
                this.measure(name, name);
                throw e;
            }
        },

        /**
         * Log a custom metric
         */
        log(type, message, data = {}) {
            const entry = {
                type,
                message,
                data,
                timestamp: Date.now(),
                perfTime: performance.now()
            };
            this.logs.push(entry);
            console.log(`[Perf][${type}] ${message}`, data);
        },

        /**
         * Get all metrics
         */
        getMetrics() {
            return { ...this.metrics };
        },

        /**
         * Get summary report
         */
        getReport() {
            const report = {
                totalMarks: Object.keys(this.marks).length,
                totalMeasures: Object.keys(this.metrics).filter(k => this.metrics[k].duration !== null).length,
                marks: Object.keys(this.marks),
                measures: []
            };

            for (const [name, data] of Object.entries(this.metrics)) {
                if (data.duration !== null) {
                    report.measures.push({
                        name,
                        duration: data.duration.toFixed(2) + 'ms',
                        durationMs: data.duration,
                        isSlow: data.duration > this.slowThreshold
                    });
                }
            }

            // Sort by duration (slowest first)
            report.measures.sort((a, b) => b.durationMs - a.durationMs);

            return report;
        },

        /**
         * Print report to console
         */
        logReport() {
            const report = this.getReport();
            
            console.group('[Perf] Performance Report');
            console.log(`Total marks: ${report.totalMarks}`);
            console.log(`Total measurements: ${report.totalMeasures}`);
            
            if (report.measures.length > 0) {
                console.group('Timings (sorted by duration)');
                report.measures.forEach(m => {
                    const icon = m.isSlow ? '⚠️' : '✓';
                    console.log(`${icon} ${m.name}: ${m.duration}`);
                });
                console.groupEnd();
            }

            console.groupEnd();

            // Return for programmatic use
            return report;
        },

        /**
         * Get total initialization time
         */
        getInitTime() {
            const marks = Object.keys(this.marks);
            if (marks.length < 2) return null;

            // Find first and last mark
            const sorted = marks.sort((a, b) => this.marks[a] - this.marks[b]);
            const first = this.marks[sorted[0]];
            const last = this.marks[sorted[sorted.length - 1]];

            return (last - first).toFixed(2) + 'ms';
        },

        /**
         * Clear all metrics
         */
        reset() {
            this.metrics = {};
            this.marks = {};
            this.logs = [];
        },

        /**
         * Enable/disable monitoring
         */
        setEnabled(enabled) {
            this.enabled = enabled;
        }
    };

    // Auto-start tracking when loaded
    AdminPerf.mark('admin-script-load');

    // Expose globally
    global.AdminPerf = AdminPerf;

})(window);

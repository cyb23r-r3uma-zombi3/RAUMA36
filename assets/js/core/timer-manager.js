/**
 * TIMER MANAGER - Centralized setInterval/setTimeout lifecycle
 * Prevents memory leaks from uncleared intervals
 */

class TimerManager {
    constructor() {
        this.timers = new Map();
        this.idCounter = 0;
    }

    /**
     * Managed setInterval
     */
    setInterval(callback, ms, label = null) {
        const id = this.idCounter++;
        const timerId = setInterval(callback, ms);
        
        this.timers.set(id, {
            type: 'interval',
            timerId,
            label,
            createdAt: Date.now()
        });
        
        return id;
    }

    /**
     * Managed setTimeout
     */
    setTimeout(callback, ms, label = null) {
        const id = this.idCounter++;
        const timerId = setTimeout(callback, ms);
        
        this.timers.set(id, {
            type: 'timeout',
            timerId,
            label,
            createdAt: Date.now()
        });
        
        return id;
    }

    /**
     * Clear specific timer
     */
    clear(managedId) {
        const timer = this.timers.get(managedId);
        if (!timer) return;
        
        if (timer.type === 'interval') {
            clearInterval(timer.timerId);
        } else {
            clearTimeout(timer.timerId);
        }
        
        this.timers.delete(managedId);
    }

    /**
     * Clear all timers - call on page unload
     */
    clearAll() {
        for (const [id, timer] of this.timers) {
            try {
                if (timer.type === 'interval') {
                    clearInterval(timer.timerId);
                } else {
                    clearTimeout(timer.timerId);
                }
            } catch (e) {
                console.error('Error clearing timer:', e);
            }
        }
        this.timers.clear();
    }

    /**
     * Get stats
     */
    getStats() {
        const intervals = Array.from(this.timers.values()).filter(t => t.type === 'interval').length;
        const timeouts = Array.from(this.timers.values()).filter(t => t.type === 'timeout').length;
        return { intervals, timeouts, total: this.timers.size };
    }
}

// Export as global singleton
const timerManager = new TimerManager();
if (typeof window !== 'undefined') {
    window.timerManager = timerManager;
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        timerManager.clearAll();
    });
}

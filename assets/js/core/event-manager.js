/**
 * EVENT MANAGER - Centralized listener lifecycle management
 * Prevents memory leaks from accumulating event listeners
 */

class EventManager {
    constructor() {
        this.listeners = [];
    }

    /**
     * Add event listener and track it for cleanup
     * @param {Element} target - DOM element or window/document
     * @param {string} eventType - Event type (click, keydown, etc.)
     * @param {Function} handler - Event handler
     * @param {boolean|Object} options - Event listener options
     */
    on(target, eventType, handler, options = false) {
        if (!target) return;
        
        const listener = { target, eventType, handler, options };
        this.listeners.push(listener);
        target.addEventListener(eventType, handler, options);
        
        return () => this.off(target, eventType, handler, options);
    }

    /**
     * Remove event listener
     */
    off(target, eventType, handler, options = false) {
        if (!target) return;
        
        target.removeEventListener(eventType, handler, options);
        this.listeners = this.listeners.filter(l =>
            !(l.target === target && l.eventType === eventType && l.handler === handler)
        );
    }

    /**
     * Remove all tracked listeners - call on page unload
     */
    cleanup() {
        for (const listener of this.listeners) {
            try {
                listener.target.removeEventListener(listener.eventType, listener.handler, listener.options);
            } catch (e) {
                console.error('Error removing listener:', e);
            }
        }
        this.listeners = [];
    }

    /**
     * Get count of active listeners
     */
    count() {
        return this.listeners.length;
    }
}

// Export as global singleton
const eventManager = new EventManager();
if (typeof window !== 'undefined') {
    window.eventManager = eventManager;
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        eventManager.cleanup();
    });
}

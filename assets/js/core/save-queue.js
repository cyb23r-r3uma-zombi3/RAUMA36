/**
 * SAVE QUEUE - Serializes save operations to prevent race conditions
 * Ensures only one save operation runs at a time
 * Deduplicates rapid saves to same key
 */

class SaveQueue {
    constructor(maxRetries = 3) {
        this.queue = [];
        this.isProcessing = false;
        this.inFlight = new Map(); // Key -> Promise
        this.lastError = null;
        this.maxRetries = maxRetries;
    }

    /**
     * Add a save operation to queue
     * @param {string} key - Unique identifier (examId, questionId, etc.)
     * @param {Function} saveFunc - Async function that performs save
     * @param {Object} options - { dedup: true, timeout: 30000 }
     */
    async enqueue(key, saveFunc, options = {}) {
        const { dedup = true, timeout = 30000 } = options;

        // If duplicate key is in flight, wait for it
        if (dedup && this.inFlight.has(key)) {
            return this.inFlight.get(key);
        }

        // Create promise for this save
        const promise = new Promise(async (resolve, reject) => {
            this.queue.push({ key, saveFunc, resolve, reject, timeout, attempts: 0 });
            this.process();
        });

        // Track in-flight
        this.inFlight.set(key, promise);
        promise.finally(() => this.inFlight.delete(key));

        return promise;
    }

    /**
     * Process queue items one at a time
     */
    async process() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            const { key, saveFunc, resolve, reject, timeout, attempts } = item;

            try {
                // Execute save with timeout
                const result = await Promise.race([
                    saveFunc(),
                    new Promise((_, rej) =>
                        setTimeout(() => rej(new Error('Save timeout')), timeout)
                    )
                ]);

                this.lastError = null;
                resolve(result);

            } catch (error) {
                if (attempts < this.maxRetries) {
                    // Retry
                    console.warn(`[SaveQueue] Retry ${attempts + 1}/${this.maxRetries} for ${key}:`, error);
                    item.attempts++;
                    this.queue.unshift(item); // Re-add to front
                    
                    // Wait before retry
                    await new Promise(r => setTimeout(r, 1000 * (attempts + 1)));
                } else {
                    // Failed all retries
                    this.lastError = error;
                    console.error(`[SaveQueue] Save failed for ${key} after ${this.maxRetries} retries:`, error);
                    reject(error);
                }
            }
        }

        this.isProcessing = false;
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queued: this.queue.length,
            inFlight: this.inFlight.size,
            isProcessing: this.isProcessing,
            lastError: this.lastError?.message
        };
    }
}

const saveQueue = new SaveQueue();
if (typeof window !== 'undefined') {
    window.saveQueue = saveQueue;
}

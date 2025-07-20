/**
 * Audio Dropout Detector
 * Monitors audio context for performance issues and dropouts
 */
class AudioDropoutDetector {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.lastCallbackTime = audioContext.currentTime;
        this.dropoutCount = 0;
        this.monitoringActive = true;
        this.checkInterval = null;
        this.dropoutThreshold = 5;
        this.dropoutCallbacks = [];
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        this.checkInterval = setInterval(() => {
            if (!this.monitoringActive) {
                clearInterval(this.checkInterval);
                return;
            }
            
            const currentTime = this.audioContext.currentTime;
            const expectedInterval = 0.1; // 100ms
            const actualInterval = currentTime - this.lastCallbackTime;
            
            // Check if we've had a dropout (more than 150% of expected interval)
            if (actualInterval > expectedInterval * 1.5) {
                this.dropoutCount++;
                console.warn(`Audio dropout detected: ${actualInterval.toFixed(3)}s gap (count: ${this.dropoutCount})`);
                
                // Notify listeners of dropout
                this.notifyDropout({
                    gap: actualInterval,
                    count: this.dropoutCount,
                    timestamp: currentTime
                });
                
                // Trigger recovery if too many dropouts
                if (this.dropoutCount > this.dropoutThreshold) {
                    this.onCriticalDropouts();
                }
            }
            
            this.lastCallbackTime = currentTime;
        }, 100);
    }
    
    stopMonitoring() {
        this.monitoringActive = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    onCriticalDropouts() {
        console.error('Critical audio dropouts detected, initiating recovery...');
        
        // Notify all listeners of critical state
        this.dropoutCallbacks.forEach(callback => {
            if (callback.onCritical) {
                callback.onCritical(this.dropoutCount);
            }
        });
        
        // Reset counter after critical event
        this.dropoutCount = 0;
    }
    
    notifyDropout(dropoutInfo) {
        this.dropoutCallbacks.forEach(callback => {
            if (callback.onDropout) {
                callback.onDropout(dropoutInfo);
            }
        });
    }
    
    addDropoutListener(callback) {
        this.dropoutCallbacks.push(callback);
    }
    
    removeDropoutListener(callback) {
        const index = this.dropoutCallbacks.indexOf(callback);
        if (index > -1) {
            this.dropoutCallbacks.splice(index, 1);
        }
    }
    
    resetCounter() {
        this.dropoutCount = 0;
    }
    
    getDropoutCount() {
        return this.dropoutCount;
    }
    
    setDropoutThreshold(threshold) {
        this.dropoutThreshold = threshold;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioDropoutDetector;
} else {
    window.AudioDropoutDetector = AudioDropoutDetector;
}
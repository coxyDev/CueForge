/**
 * Memory Leak Monitor
 * Tracks memory usage and detects potential leaks in the audio system
 */
class MemoryLeakMonitor {
    constructor() {
        this.isMonitoring = false;
        this.monitorInterval = null;
        this.memorySnapshots = [];
        this.maxSnapshots = 60; // Keep 5 minutes of history at 5-second intervals
        this.leakThreshold = 50 * 1024 * 1024; // 50MB threshold
        this.leakCallbacks = [];
        this.warningIssued = false;
        
        // Track specific resources
        this.audioBuffers = new WeakMap();
        this.audioNodes = new WeakMap();
        this.resourceCounts = {
            audioBuffers: 0,
            audioNodes: 0,
            vstPlugins: 0,
            timers: 0
        };
    }
    
    startMonitoring(interval = 5000) {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('🔍 Memory leak monitoring started');
        
        this.monitorInterval = setInterval(() => {
            this.checkMemory();
        }, interval);
        
        // Take initial snapshot
        this.checkMemory();
    }
    
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.isMonitoring = false;
        console.log('Memory leak monitoring stopped');
    }
    
    checkMemory() {
        if (!performance.memory) {
            console.warn('Performance.memory API not available');
            return;
        }
        
        const snapshot = {
            timestamp: Date.now(),
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            resourceCounts: { ...this.resourceCounts }
        };
        
        this.memorySnapshots.push(snapshot);
        
        // Keep only recent snapshots
        if (this.memorySnapshots.length > this.maxSnapshots) {
            this.memorySnapshots.shift();
        }
        
        // Check for potential leaks
        this.detectLeaks();
    }
    
    detectLeaks() {
        if (this.memorySnapshots.length < 10) return; // Need enough data
        
        // Check memory growth over time
        const oldSnapshot = this.memorySnapshots[0];
        const currentSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
        const memoryGrowth = currentSnapshot.usedJSHeapSize - oldSnapshot.usedJSHeapSize;
        
        // Calculate growth rate
        const timeElapsed = (currentSnapshot.timestamp - oldSnapshot.timestamp) / 1000; // seconds
        const growthRate = memoryGrowth / timeElapsed; // bytes per second
        
        // Check if we're approaching heap limit
        const heapUsagePercent = (currentSnapshot.usedJSHeapSize / currentSnapshot.jsHeapSizeLimit) * 100;
        
        if (memoryGrowth > this.leakThreshold) {
            this.onPotentialLeak({
                memoryGrowth,
                growthRate,
                heapUsagePercent,
                currentUsage: currentSnapshot.usedJSHeapSize,
                timeElapsed
            });
        } else if (heapUsagePercent > 80 && !this.warningIssued) {
            this.onMemoryWarning({
                heapUsagePercent,
                currentUsage: currentSnapshot.usedJSHeapSize,
                limit: currentSnapshot.jsHeapSizeLimit
            });
            this.warningIssued = true;
        } else if (heapUsagePercent < 70) {
            this.warningIssued = false;
        }
    }
    
    onPotentialLeak(leakInfo) {
        console.error('⚠️ Potential memory leak detected:', {
            growth: `${(leakInfo.memoryGrowth / 1024 / 1024).toFixed(2)} MB`,
            rate: `${(leakInfo.growthRate / 1024).toFixed(2)} KB/s`,
            heapUsage: `${leakInfo.heapUsagePercent.toFixed(1)}%`
        });
        
        // Notify listeners
        this.leakCallbacks.forEach(callback => {
            if (callback.onLeak) {
                callback.onLeak(leakInfo);
            }
        });
    }
    
    onMemoryWarning(warningInfo) {
        console.warn('⚠️ High memory usage:', {
            usage: `${warningInfo.heapUsagePercent.toFixed(1)}%`,
            current: `${(warningInfo.currentUsage / 1024 / 1024).toFixed(2)} MB`,
            limit: `${(warningInfo.limit / 1024 / 1024).toFixed(2)} MB`
        });
        
        // Notify listeners
        this.leakCallbacks.forEach(callback => {
            if (callback.onWarning) {
                callback.onWarning(warningInfo);
            }
        });
    }
    
    // Resource tracking methods
    trackAudioBuffer(buffer) {
        this.audioBuffers.set(buffer, Date.now());
        this.resourceCounts.audioBuffers++;
    }
    
    releaseAudioBuffer(buffer) {
        if (this.audioBuffers.has(buffer)) {
            this.audioBuffers.delete(buffer);
            this.resourceCounts.audioBuffers--;
        }
    }
    
    trackAudioNode(node) {
        this.audioNodes.set(node, Date.now());
        this.resourceCounts.audioNodes++;
    }
    
    releaseAudioNode(node) {
        if (this.audioNodes.has(node)) {
            this.audioNodes.delete(node);
            this.resourceCounts.audioNodes--;
        }
    }
    
    addLeakListener(callback) {
        this.leakCallbacks.push(callback);
    }
    
    removeLeakListener(callback) {
        const index = this.leakCallbacks.indexOf(callback);
        if (index > -1) {
            this.leakCallbacks.splice(index, 1);
        }
    }
    
    getMemoryStats() {
        if (this.memorySnapshots.length === 0) return null;
        
        const current = this.memorySnapshots[this.memorySnapshots.length - 1];
        return {
            timestamp: current.timestamp,
            heapUsed: current.usedJSHeapSize,
            heapTotal: current.totalJSHeapSize,
            heapLimit: current.jsHeapSizeLimit,
            heapUsagePercent: (current.usedJSHeapSize / current.jsHeapSizeLimit) * 100,
            resourceCounts: current.resourceCounts
        };
    }
    
    forceGarbageCollection() {
        // Note: This only works in certain environments with --expose-gc flag
        if (global.gc) {
            console.log('Forcing garbage collection...');
            global.gc();
        } else {
            console.warn('Garbage collection not exposed. Run with --expose-gc flag.');
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryLeakMonitor;
} else {
    window.MemoryLeakMonitor = MemoryLeakMonitor;
}
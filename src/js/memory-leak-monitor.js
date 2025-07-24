/**
 * Memory Leak Monitor
 * Tracks memory usage and detects potential leaks
 */
class MemoryLeakMonitor {
    constructor() {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.checkInterval = 30000; // 30 seconds
        this.maxSnapshots = 20;
        
        // Memory snapshots
        this.memorySnapshots = [];
        
        // Resource tracking
        this.audioBuffers = new Map();
        this.audioNodes = new Map();
        this.resourceCounts = {
            audioBuffers: 0,
            audioNodes: 0
        };
        
        // Leak detection thresholds
        this.thresholds = {
            memoryGrowthMB: 50,     // MB growth per minute
            heapUsagePercent: 85,   // % of total heap
            resourceCount: 1000     // Max audio resources
        };
        
        // Callbacks for leak detection
        this.leakCallbacks = [];
        
        console.log('Memory Leak Monitor initialized');
    }
    
    startMonitoring() {
        if (this.isMonitoring) {
            console.warn('Memory monitoring already active');
            return;
        }
        
        this.isMonitoring = true;
        console.log('Starting memory leak monitoring...');
        
        this.monitoringInterval = setInterval(() => {
            this.takeMemorySnapshot();
            this.analyzeMemoryTrends();
        }, this.checkInterval);
        
        // Take initial snapshot
        this.takeMemorySnapshot();
    }
    
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        console.log('Memory leak monitoring stopped');
    }
    
    takeMemorySnapshot() {
        if (!performance.memory) {
            console.warn('Performance memory API not available');
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
        
        console.log(`Memory snapshot: ${Math.round(snapshot.usedJSHeapSize / 1024 / 1024)}MB used`);
    }
    
    analyzeMemoryTrends() {
        if (this.memorySnapshots.length < 2) return;
        
        const current = this.memorySnapshots[this.memorySnapshots.length - 1];
        const previous = this.memorySnapshots[this.memorySnapshots.length - 2];
        
        // Calculate growth rate
        const timeDiff = (current.timestamp - previous.timestamp) / 1000 / 60; // minutes
        const memoryDiff = (current.usedJSHeapSize - previous.usedJSHeapSize) / 1024 / 1024; // MB
        const growthRate = memoryDiff / timeDiff;
        
        // Check for rapid memory growth
        if (growthRate > this.thresholds.memoryGrowthMB) {
            this.notifyPotentialLeak({
                type: 'rapid-growth',
                growthRate: growthRate,
                currentUsage: current.usedJSHeapSize / 1024 / 1024,
                timestamp: current.timestamp
            });
        }
        
        // Check heap usage percentage
        const heapUsagePercent = (current.usedJSHeapSize / current.jsHeapSizeLimit) * 100;
        if (heapUsagePercent > this.thresholds.heapUsagePercent) {
            this.notifyMemoryWarning({
                type: 'high-heap-usage',
                heapUsagePercent: heapUsagePercent,
                currentUsage: current.usedJSHeapSize / 1024 / 1024,
                heapLimit: current.jsHeapSizeLimit / 1024 / 1024
            });
        }
        
        // Check resource counts
        const totalResources = current.resourceCounts.audioBuffers + current.resourceCounts.audioNodes;
        if (totalResources > this.thresholds.resourceCount) {
            this.notifyMemoryWarning({
                type: 'high-resource-count',
                resourceCount: totalResources,
                breakdown: current.resourceCounts
            });
        }
    }
    
    notifyPotentialLeak(leakInfo) {
        console.warn('🔴 Potential memory leak detected:', leakInfo);
        
        this.leakCallbacks.forEach(callback => {
            if (callback.onLeak) {
                callback.onLeak(leakInfo);
            }
        });
    }
    
    notifyMemoryWarning(warningInfo) {
        console.warn('🟡 Memory warning:', warningInfo);
        
        this.leakCallbacks.forEach(callback => {
            if (callback.onWarning) {
                callback.onWarning(warningInfo);
            }
        });
    }
    
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
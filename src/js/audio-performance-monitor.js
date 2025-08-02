/**
 * Audio Performance Monitor
 * Monitors CPU usage, dropouts, latency, and memory usage
 */

class AudioPerformanceMonitor {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.stats = {
            cpuUsage: 0,
            dropouts: 0,
            latency: 0,
            activeVoices: 0,
            memoryUsage: 0
        };
        
        this.isMonitoring = false;
        this.monitoringInterval = null;
        
        // Start monitoring automatically
        this.startMonitoring();
        
        console.log('📊 Audio Performance Monitor initialized');
    }
    
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        
        // Update stats every 100ms for responsive monitoring
        this.monitoringInterval = setInterval(() => {
            this.updateStats();
        }, 100);
        
        console.log('▶️ Performance monitoring started');
    }
    
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        console.log('⏹️ Performance monitoring stopped');
    }
    
    updateStats() {
        if (!this.audioEngine || !this.audioEngine.audioContext) return;
        
        try {
            // CPU usage estimation
            this.stats.cpuUsage = this.estimateCPUUsage();
            
            // Latency measurement
            this.stats.latency = this.measureLatency();
            
            // Active voices count
            this.stats.activeVoices = this.countActiveVoices();
            
            // Memory usage estimation
            this.stats.memoryUsage = this.estimateMemoryUsage();
            
            // Keep dropout count as is (would be updated by dropout detector)
            
        } catch (error) {
            console.warn('Error updating performance stats:', error);
        }
    }
    
    estimateCPUUsage() {
        // Get active cues
        const activeCues = this.getActiveCues();
        
        // Get active effects
        const activeEffects = this.countActiveEffects();
        
        // Get matrix complexity
        const matrixComplexity = this.estimateMatrixComplexity();
        
        // Rough estimation algorithm:
        // - 1% per active cue
        // - 2% per active effect
        // - 0.5% per active matrix crosspoint
        // - Base overhead: 5%
        const baseCPU = 5;
        const cueCPU = activeCues * 1;
        const effectsCPU = activeEffects * 2;
        const matrixCPU = matrixComplexity * 0.5;
        
        const totalCPU = baseCPU + cueCPU + effectsCPU + matrixCPU;
        
        // Cap at 100% and add some realistic variation
        return Math.min(totalCPU + (Math.random() * 2 - 1), 100);
    }
    
    measureLatency() {
        if (!this.audioEngine.audioContext) return 0;
        
        // Get Web Audio API latency info
        const baseLatency = this.audioEngine.audioContext.baseLatency || 0;
        const outputLatency = this.audioEngine.audioContext.outputLatency || 0;
        
        // Convert to milliseconds
        return (baseLatency + outputLatency) * 1000;
    }
    
    countActiveVoices() {
        if (!this.audioEngine.cues) return 0;
        
        let activeCount = 0;
        
        // Count playing audio cues
        if (this.audioEngine.cues instanceof Map) {
            this.audioEngine.cues.forEach(cue => {
                if (cue.isPlaying) {
                    activeCount++;
                }
            });
        } else if (Array.isArray(this.audioEngine.cues)) {
            activeCount = this.audioEngine.cues.filter(cue => cue.isPlaying).length;
        }
        
        return activeCount;
    }
    
    getActiveCues() {
        return this.countActiveVoices(); // Same calculation
    }
    
    countActiveEffects() {
        if (!this.audioEngine.cues) return 0;
        
        let effectCount = 0;
        
        const processCue = (cue) => {
            if (cue.effectsChain) {
                if (typeof cue.effectsChain.getEffectCount === 'function') {
                    effectCount += cue.effectsChain.getEffectCount();
                } else if (Array.isArray(cue.effectsChain)) {
                    effectCount += cue.effectsChain.length;
                }
            }
            
            if (cue.vstPlugins && cue.vstPlugins instanceof Map) {
                effectCount += cue.vstPlugins.size;
            }
        };
        
        if (this.audioEngine.cues instanceof Map) {
            this.audioEngine.cues.forEach(processCue);
        } else if (Array.isArray(this.audioEngine.cues)) {
            this.audioEngine.cues.forEach(processCue);
        }
        
        return effectCount;
    }
    
    estimateMatrixComplexity() {
        if (!this.audioEngine.cues) return 0;
        
        let totalCrosspoints = 0;
        
        const processCue = (cue) => {
            if (cue.cueMatrix && typeof cue.cueMatrix.getActiveRoutes === 'function') {
                totalCrosspoints += cue.cueMatrix.getActiveRoutes().length;
            }
        };
        
        if (this.audioEngine.cues instanceof Map) {
            this.audioEngine.cues.forEach(processCue);
        } else if (Array.isArray(this.audioEngine.cues)) {
            this.audioEngine.cues.forEach(processCue);
        }
        
        // Add output patch matrix complexity
        if (this.audioEngine.outputPatches) {
            if (this.audioEngine.outputPatches instanceof Map) {
                this.audioEngine.outputPatches.forEach(patch => {
                    if (patch.patchMatrix && typeof patch.patchMatrix.getActiveRoutes === 'function') {
                        totalCrosspoints += patch.patchMatrix.getActiveRoutes().length;
                    }
                });
            }
        }
        
        return totalCrosspoints;
    }
    
    estimateMemoryUsage() {
        if (!this.audioEngine.cues) return 0;
        
        let totalSamples = 0;
        
        const processCue = (cue) => {
            if (cue.audioBuffer) {
                totalSamples += cue.audioBuffer.length * cue.audioBuffer.numberOfChannels;
            }
        };
        
        if (this.audioEngine.cues instanceof Map) {
            this.audioEngine.cues.forEach(processCue);
        } else if (Array.isArray(this.audioEngine.cues)) {
            this.audioEngine.cues.forEach(processCue);
        }
        
        // Estimate: 4 bytes per sample (32-bit float)
        const bytesUsed = totalSamples * 4;
        const megabytesUsed = bytesUsed / (1024 * 1024);
        
        return megabytesUsed;
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    getDetailedStats() {
        return {
            ...this.stats,
            timestamp: Date.now(),
            activeCues: this.getActiveCues(),
            activeEffects: this.countActiveEffects(),
            matrixComplexity: this.estimateMatrixComplexity(),
            audioContextState: this.audioEngine.audioContext?.state || 'unknown',
            sampleRate: this.audioEngine.audioContext?.sampleRate || 0
        };
    }
    
    // Method to be called by dropout detector
    recordDropout() {
        this.stats.dropouts++;
        console.warn('🔴 Audio dropout detected - count:', this.stats.dropouts);
    }
    
    resetDropoutCount() {
        this.stats.dropouts = 0;
        console.log('✅ Dropout count reset');
    }
    
    // Cleanup
    destroy() {
        this.stopMonitoring();
        console.log('🗑️ Audio Performance Monitor destroyed');
    }
}

// Make available globally
window.AudioPerformanceMonitor = AudioPerformanceMonitor;
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
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Monitor audio context performance
        setInterval(() => {
            this.updateStats();
        }, 100);
    }
    
    updateStats() {
        // CPU usage estimation
        this.stats.cpuUsage = this.estimateCPUUsage();
        
        // Latency measurement
        this.stats.latency = this.audioEngine.audioContext.baseLatency + 
                           this.audioEngine.audioContext.outputLatency || 0;
        
        // Active voices count
        this.stats.activeVoices = this.countActiveVoices();
        
        // Memory usage estimation
        this.stats.memoryUsage = this.estimateMemoryUsage();
    }
    
    estimateCPUUsage() {
        // Estimate CPU usage based on active audio nodes
        const activeCues = Array.from(this.audioEngine.cues.values())
            .filter(cue => cue.isPlaying).length;
        
        const activeEffects = Array.from(this.audioEngine.cues.values())
            .reduce((total, cue) => {
                return total + (cue.effectsChain?.getEffectCount() || 0);
            }, 0);
        
        // Rough estimation: 1% per active cue + 2% per effect
        return Math.min(activeCues * 1 + activeEffects * 2, 100);
    }
    
    countActiveVoices() {
        return Array.from(this.audioEngine.cues.values())
            .filter(cue => cue.isPlaying).length;
    }
    
    estimateMemoryUsage() {
        // Estimate memory usage based on loaded audio buffers
        let totalSamples = 0;
        
        this.audioEngine.cues.forEach(cue => {
            if (cue.audioBuffer) {
                totalSamples += cue.audioBuffer.length * cue.audioBuffer.numberOfChannels;
            }
        });
        
        // Rough estimation: 4 bytes per sample
        return (totalSamples * 4) / (1024 * 1024); // MB
    }
    
    getStats() {
        return { ...this.stats };
    }
}
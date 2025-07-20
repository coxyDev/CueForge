/**
 * Audio Recovery Manager
 * Handles automatic recovery from audio system failures
 */
class AudioRecoveryManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 3;
        this.recoveryInProgress = false;
        this.lastRecoveryTime = 0;
        this.recoveryDelay = 1000; // Start with 1 second delay
        
        // Recovery strategies
        this.recoveryStrategies = [
            this.attemptContextResume.bind(this),
            this.recreateAudioNodes.bind(this),
            this.fullSystemReset.bind(this)
        ];
        
        // Track system state
        this.systemState = {
            lastKnownGoodState: null,
            activeCues: new Map(),
            failureCount: 0
        };
        
        this.setupRecoveryHandlers();
    }
    
    setupRecoveryHandlers() {
        // Listen for dropout detector events
        if (this.audioEngine.dropoutDetector) {
            this.audioEngine.dropoutDetector.addDropoutListener({
                onCritical: (count) => this.handleCriticalDropouts(count)
            });
        }
        
        // Listen for memory monitor events
        if (this.audioEngine.memoryMonitor) {
            this.audioEngine.memoryMonitor.addLeakListener({
                onLeak: (info) => this.handleMemoryLeak(info),
                onWarning: (info) => this.handleMemoryWarning(info)
            });
        }
    }
    
    async initiateRecovery(reason = 'Unknown') {
        if (this.recoveryInProgress) {
            console.warn('Recovery already in progress');
            return false;
        }
        
        const now = Date.now();
        if (now - this.lastRecoveryTime < this.recoveryDelay) {
            console.warn('Recovery attempted too soon, waiting...');
            return false;
        }
        
        this.recoveryInProgress = true;
        this.lastRecoveryTime = now;
        
        console.log(`🔧 Initiating audio recovery (attempt ${this.recoveryAttempts + 1}/${this.maxRecoveryAttempts}) - Reason: ${reason}`);
        
        // Save current state before recovery
        this.saveSystemState();
        
        try {
            // Try recovery strategies in order
            for (const strategy of this.recoveryStrategies) {
                if (await strategy()) {
                    console.log('✅ Recovery successful');
                    this.recoveryAttempts = 0;
                    this.recoveryDelay = 1000; // Reset delay
                    this.recoveryInProgress = false;
                    
                    // Restore state after successful recovery
                    await this.restoreSystemState();
                    
                    return true;
                }
            }
            
            // All strategies failed
            throw new Error('All recovery strategies exhausted');
            
        } catch (error) {
            console.error('❌ Recovery failed:', error);
            this.recoveryAttempts++;
            
            // Exponential backoff for recovery attempts
            this.recoveryDelay = Math.min(this.recoveryDelay * 2, 30000); // Max 30 seconds
            
            if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
                this.onRecoveryFailed(reason);
            }
            
            this.recoveryInProgress = false;
            return false;
        }
    }
    
    async attemptContextResume() {
        console.log('Strategy 1: Attempting audio context resume...');
        
        try {
            const context = this.audioEngine.audioContext;
            
            if (context.state === 'suspended') {
                await context.resume();
                
                // Wait a moment to ensure it's stable
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (context.state === 'running') {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Context resume failed:', error);
            return false;
        }
    }
    
    async recreateAudioNodes() {
        console.log('Strategy 2: Recreating audio nodes...');
        
        try {
            // Disconnect all existing nodes
            this.audioEngine.cues.forEach(cue => {
                if (cue.sourceNode) {
                    cue.sourceNode.disconnect();
                    cue.sourceNode = null;
                }
                
                if (cue.gainNode) {
                    cue.gainNode.disconnect();
                    cue.gainNode = null;
                }
            });
            
            // Recreate master gain
            if (this.audioEngine.masterGainNode) {
                this.audioEngine.masterGainNode.disconnect();
                this.audioEngine.masterGainNode = this.audioEngine.audioContext.createGain();
                this.audioEngine.masterGainNode.connect(this.audioEngine.audioContext.destination);
            }
            
            // Give nodes time to clean up
            await new Promise(resolve => setTimeout(resolve, 200));
            
            return true;
        } catch (error) {
            console.error('Node recreation failed:', error);
            return false;
        }
    }
    
    async fullSystemReset() {
        console.log('Strategy 3: Full audio system reset...');
        
        try {
            // Close existing context
            if (this.audioEngine.audioContext) {
                await this.audioEngine.audioContext.close();
            }
            
            // Wait before creating new context
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Reinitialize audio context
            await this.audioEngine.initializeAudioContext();
            
            // Reinitialize all subsystems
            if (this.audioEngine.setupCriticalErrorHandling) {
                this.audioEngine.setupCriticalErrorHandling();
            }
            
            return true;
        } catch (error) {
            console.error('Full system reset failed:', error);
            return false;
        }
    }
    
    saveSystemState() {
        this.systemState.lastKnownGoodState = {
            timestamp: Date.now(),
            activeCues: new Map(),
            masterVolume: this.audioEngine.masterVolume || 1,
            cueStates: {}
        };
        
        // Save active cue states
        this.audioEngine.cues.forEach((cue, id) => {
            if (cue.isPlaying) {
                this.systemState.lastKnownGoodState.cueStates[id] = {
                    playing: true,
                    currentTime: cue.currentTime || 0,
                    volume: cue.volume || 1
                };
            }
        });
    }
    
    async restoreSystemState() {
        if (!this.systemState.lastKnownGoodState) return;
        
        const state = this.systemState.lastKnownGoodState;
        
        // Restore master volume
        if (this.audioEngine.setMasterVolume) {
            this.audioEngine.setMasterVolume(state.masterVolume);
        }
        
        // Restart cues that were playing
        for (const [cueId, cueState] of Object.entries(state.cueStates)) {
            const cue = this.audioEngine.getCue(cueId);
            if (cue && cueState.playing) {
                try {
                    await cue.play();
                    if (cue.seek && cueState.currentTime > 0) {
                        cue.seek(cueState.currentTime);
                    }
                } catch (error) {
                    console.warn(`Failed to restore cue ${cueId}:`, error);
                }
            }
        }
    }
    
    handleCriticalDropouts(count) {
        console.warn(`Handling critical dropouts (${count} detected)`);
        this.initiateRecovery('Critical audio dropouts');
    }
    
    handleMemoryLeak(leakInfo) {
        console.warn('Handling potential memory leak:', leakInfo);
        
        // Try to free up memory first
        this.freeUnusedResources();
        
        // If memory usage is critical, initiate recovery
        if (leakInfo.heapUsagePercent > 90) {
            this.initiateRecovery('Critical memory usage');
        }
    }
    
    handleMemoryWarning(warningInfo) {
        console.warn('Memory warning:', warningInfo);
        
        // Preventive measures
        this.freeUnusedResources();
    }
    
    freeUnusedResources() {
        console.log('Freeing unused audio resources...');
        
        let freedCount = 0;
        
        // Release unused audio buffers
        this.audioEngine.cues.forEach(cue => {
            if (!cue.isPlaying && cue.audioBuffer && cue.releaseBuffer) {
                cue.releaseBuffer();
                freedCount++;
            }
        });
        
        console.log(`Freed ${freedCount} unused audio buffers`);
        
        // Request garbage collection if available
        if (this.audioEngine.memoryMonitor) {
            this.audioEngine.memoryMonitor.forceGarbageCollection();
        }
    }
    
    onRecoveryFailed(reason) {
        console.error('🚨 Audio recovery failed completely');
        
        this.systemState.failureCount++;
        
        // Notify UI of critical failure
        if (this.audioEngine.showCriticalError) {
            this.audioEngine.showCriticalError(
                `Audio system recovery failed after ${this.maxRecoveryAttempts} attempts. Reason: ${reason}`
            );
        }
        
        // Emit event for UI handling
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('audioSystemFailure', {
                detail: { reason, attempts: this.recoveryAttempts }
            }));
        }
    }
    
    resetRecoverySystem() {
        this.recoveryAttempts = 0;
        this.recoveryDelay = 1000;
        this.recoveryInProgress = false;
        this.systemState.failureCount = 0;
    }
    
    getRecoveryStats() {
        return {
            attempts: this.recoveryAttempts,
            inProgress: this.recoveryInProgress,
            lastRecoveryTime: this.lastRecoveryTime,
            failureCount: this.systemState.failureCount,
            nextRecoveryDelay: this.recoveryDelay
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioRecoveryManager;
} else {
    window.AudioRecoveryManager = AudioRecoveryManager;
}
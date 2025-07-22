// Replace entire file with enhanced version that includes fade automation
class ProfessionalAudioEngine extends AudioEngineWithFades {
    constructor() {
        super();
        
        // VST Management
        this.vstManager = new VSTManager();
        
        // Enhanced matrix UI components
        this.matrixUIs = new Map();
        
        // Performance monitoring
        this.performanceMonitor = new AudioPerformanceMonitor(this);
        
        // Initialize Patch Manager
        this.patchManager = new AudioPatchManager(this);
        
        console.log('🎛️ Professional Audio Engine with VST support initialized');
    }
    
    async initializeAudioContext() {
        await super.initializeAudioContext();
        
        // Initialize VST scanning
        if (this.vstManager) {
            this.vstManager.scanForPlugins((progress) => {
                console.log(`VST Scan: ${progress.phase} - ${Math.round(progress.progress * 100)}%`);
            });
        }
        
        // Create default audio patches
        this.createDefaultPatches();
    }

    createDefaultPatches() {
    // Create main output patch
    const mainPatch = this.patchManager.createPatch('Main', 'default', 64);
        mainPatch.setDefaultRouting();
        
        // Create monitor output patch
        const monitorPatch = this.patchManager.createPatch('Monitor', 'default', 16);
        monitorPatch.routeCueOutputsToStereo(0, false);
        
        console.log('✅ Default audio patches created');
    }

    setupCriticalErrorHandling() {
    // Audio dropout detection
    this.dropoutDetector = new AudioDropoutDetector(this.audioContext);
    
    // Memory leak monitoring
    this.memoryMonitor = new MemoryLeakMonitor();
    this.memoryMonitor.startMonitoring();
    
    // Automatic recovery procedures
    this.recoveryManager = new AudioRecoveryManager(this);
    
    console.log('✅ Critical error handling initialized');
}
    
    /**
     * Create enhanced audio cue with full professional features
     */
  async createAudioCue(id, filePath) {
        // Use enhanced audio cue if available
        if (typeof AudioCueEnhanced !== 'undefined') {
            const cue = new AudioCueEnhanced(id, this, filePath);
            this.cues.set(id, cue);
            return cue;
        } else {
            // Fallback to regular AudioCue
            const cue = new AudioCue(id, this, filePath);
            this.cues.set(id, cue);
            
            // Create effects chain for compatibility
            if (window.ProfessionalAudioManager) {
                const effectsManager = new ProfessionalAudioManager(this);
                const effectsChain = effectsManager.createEffectsChain(id);
                cue.connectEffectsChain(effectsChain);
            }
            
            return cue;
        }
    }

        createOutputPatch(name, deviceId = 'default', numCueOutputs = 64) {
        return this.patchManager.createPatch(name, deviceId, numCueOutputs);
    }

    getOutputPatch(name) {
        return this.patchManager.getPatch(name);
    }

    getAllOutputPatches() {
        return this.patchManager.getAllPatches();
    }

    setDefaultOutputPatch(patchName) {
        return this.patchManager.setDefaultPatch(patchName);
    }

    getCue(id) {
        return this.cues.get(id);
    }

    getOutputNode() {
        return this.masterGainNode || this.audioContext.destination;
    }

    async ensureAudioContext() {
        if (!this.initialized || this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.error('Failed to resume audio context:', error);
                throw error;
            }
        }
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGainNode) {
            this.masterGainNode.gain.value = this.masterVolume;
        }
    }

    // File URL helper (if not already present)
    getFileUrl(filePath) {
        if (!filePath) return null;
        
        if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
            return filePath;
        }
        
        if (filePath.startsWith('file://')) {
            return filePath;
        }
        
        let normalizedPath = filePath.replace(/\\/g, '/');
        
        if (/^[A-Z]:/i.test(normalizedPath)) {
            return `file:///${normalizedPath}`;
        }
        
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        
        return `file://${normalizedPath}`;
    }
    
    /**
     * Load VST plugin for cue
     */
    async loadVSTForCue(cueId, pluginId) {
        const cue = this.getCue(cueId);
        if (!cue) throw new Error(`Cue not found: ${cueId}`);
        
        const vstPlugin = await this.vstManager.loadPlugin(pluginId, this.audioContext);
        cue.vstPlugins.set(pluginId, vstPlugin);
        
        // Add to effects chain
        cue.effectsChain.addEffect(vstPlugin);
        
        return vstPlugin;
    }
    
    /**
     * Create matrix mixer UI
     */
    createMatrixUI(cue, container) {
        if (cue.matrixUI) {
            cue.matrixUI.destroy();
        }
        
        cue.matrixUI = new MatrixMixerUI(container, cue.cueMatrix, {
            showMeters: true,
            enableVSTSupport: true,
            enableGangs: true,
            colorScheme: 'professional'
        });
        
        this.matrixUIs.set(cue.id, cue.matrixUI);
        return cue.matrixUI;
    }

    /**
 * Optimize for live performance
 */
enableLiveMode() {
    // Reduce audio buffer size for lower latency
    this.setLatencyOptimization('ultra-low');
    
    // Pre-load all audio files
    this.preloadAllAudioFiles();
    
    // Enable audio worklets for better performance
    this.enableAudioWorklets();
    
    // Disable non-essential features
    this.disableNonEssentialFeatures();
    
    console.log('🎪 Live performance mode enabled');
}

/**
 * Pre-load audio files to prevent dropouts
 */
async preloadAllAudioFiles() {
    const preloadPromises = [];
    
    this.cues.forEach(cue => {
        if (cue.filePath && !cue.audioBuffer) {
            preloadPromises.push(cue.loadAudioFile(cue.filePath));
        }
    });
    
    await Promise.all(preloadPromises);
    console.log(`Preloaded ${preloadPromises.length} audio files`);
}

/**
 * Error recovery system
 */
setupErrorRecovery() {
    // Audio context state monitoring
    this.audioContext.addEventListener('statechange', () => {
        if (this.audioContext.state === 'suspended') {
            console.warn('Audio context suspended, attempting recovery...');
            this.recoverAudioContext();
        }
    });
    
    // Global error handler for audio operations
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message?.includes('audio')) {
            console.error('Audio error caught:', event.reason);
            this.handleAudioError(event.reason);
        }
    });
}

async recoverAudioContext() {
    try {
        await this.audioContext.resume();
        console.log('✅ Audio context recovered');
        
        // Reconnect all cues
        this.cues.forEach(cue => {
            if (cue.isPlaying) {
                cue.stop();
                setTimeout(() => cue.play(), 100);
            }
        });
        
    } catch (error) {
        console.error('Failed to recover audio context:', error);
        this.showCriticalError('Audio system recovery failed');
    }
}

showCriticalError(message) {
    console.error('🚨 Critical Error:', message);
    
    // Show in UI if available
    if (window.uiManager && window.uiManager.showStatusMessage) {
        window.uiManager.showStatusMessage(message, 'error');
    }
    
    // Show system alert as fallback
    if (window.alert) {
        window.alert(`Critical Audio Error:\n\n${message}\n\nPlease save your work and restart the application.`);
    }
}

    /**
     * Audio worklet for high-performance processing
     */
    async createAudioWorklet(cueId) {
        try {
            await this.audioContext.audioWorklet.addModule('/js/audio-worklet-processor.js');
            
            const workletNode = new AudioWorkletNode(this.audioContext, 'professional-audio-processor', {
                processorOptions: { cueId }
            });
            
            return workletNode;
        } catch (error) {
            console.warn('AudioWorklet not supported, using fallback processing');
            return null;
        }
    }

    /**
 * Clean up resources when destroying the audio engine
 */
    destroy() {
        // Stop all monitoring
        if (this.dropoutDetector) {
            this.dropoutDetector.stopMonitoring();
        }
        
        if (this.memoryMonitor) {
            this.memoryMonitor.stopMonitoring();
        }
        
        // Stop all cues
        this.stopAllCues();
        
        // Disconnect all nodes
        if (this.masterGainNode) {
            this.masterGainNode.disconnect();
        }
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        console.log('Audio engine destroyed');
    }

    /**
     * Handle audio errors
     */
    handleAudioError(error) {
        console.error('Audio error:', error);
        
        // Determine severity
        const isCritical = error.message && (
            error.message.includes('AudioContext') ||
            error.message.includes('suspended') ||
            error.message.includes('memory')
        );
        
        if (isCritical && this.recoveryManager) {
            this.recoveryManager.initiateRecovery(error.message);
        } else {
            // Log non-critical errors
            console.warn('Non-critical audio error:', error);
        }
    }
}
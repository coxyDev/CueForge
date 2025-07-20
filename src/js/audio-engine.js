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
    }
    
    /**
     * Create enhanced audio cue with full professional features
     */
    async createAudioCue(id, filePath) {
        const cue = await super.createAudioCue(id, filePath);
        
        if (cue) {
            // Add VST support
            cue.vstPlugins = new Map();
            
            // Enhanced effects chain
            cue.effectsChain = new EffectsChain(this.audioContext);
            
            // Professional matrix mixer UI
            cue.matrixUI = null;
            
            // Performance optimization
            cue.audioWorkletProcessor = await this.createAudioWorklet(id);
        }
        
        return cue;
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
}
/**
 * Professional Audio Engine with Enhanced Features
 * Extends AudioEngineWithFades to provide QLab-level capabilities
 */

// First, ensure the base AudioEngineWithFades exists
if (typeof AudioEngineWithFades === 'undefined') {
    // Fallback base class if AudioEngineWithFades is not available
    class AudioEngineWithFades {
        constructor() {
            this.audioContext = null;
            this.masterGainNode = null;
            this.cues = new Map();
            this.initialized = false;
            this.masterVolume = 0.7;
        }
        
        async initializeAudioContext() {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGainNode = this.audioContext.createGain();
                this.masterGainNode.connect(this.audioContext.destination);
                this.masterGainNode.gain.value = this.masterVolume;
                this.initialized = true;
                console.log('Base audio context initialized');
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
                throw error;
            }
        }
        
        async createAudioCue(id, filePath) {
            // Basic cue creation - will be enhanced by ProfessionalAudioEngine
            const cue = new AudioCue(id, this, filePath);
            this.cues.set(id, cue);
            return cue;
        }
        
        stopAllCues() {
            this.cues.forEach(cue => {
                if (cue.isPlaying) {
                    cue.stop();
                }
            });
        }
    }
}

class ProfessionalAudioEngine extends AudioEngineWithFades {
    constructor() {
        super();
        
        console.log('🎬 Initializing Professional Audio Engine...');
        
        // VST Management
        this.vstManager = new VSTManager();
        
        // Enhanced matrix UI components
        this.matrixUIs = new Map();
        
        // Performance monitoring (Initialize AFTER ensuring dependencies exist)
        this.performanceMonitor = null;
        this.dropoutDetector = null;
        this.memoryMonitor = null;
        this.recoveryManager = null;
        
        // Initialize Patch Manager (will be created after audio context)
        this.patchManager = null;
        
        console.log('🎛️ Professional Audio Engine constructed');
    }
    
    async initializeAudioContext() {
        console.log('Initializing Professional Audio Context...');
        
        try {
            // Call parent initialization
            await super.initializeAudioContext();
            
            // Initialize monitoring components AFTER audio context is ready
            this.initializeMonitoring();
            
            // Initialize Patch Manager
            if (typeof AudioPatchManager !== 'undefined') {
                this.patchManager = new AudioPatchManager(this);
                this.createDefaultPatches();
            } else {
                console.warn('AudioPatchManager not available');
            }
            
            // Initialize VST scanning
            if (this.vstManager) {
                this.vstManager.scanForPlugins((progress) => {
                    console.log(`VST Scan: ${progress.phase} - ${Math.round(progress.progress * 100)}%`);
                });
            }
            
            console.log('✅ Professional Audio Engine initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Professional Audio Engine:', error);
            throw error;
        }
    }
    
    initializeMonitoring() {
        try {
            // Performance monitoring
            if (typeof AudioPerformanceMonitor !== 'undefined') {
                this.performanceMonitor = new AudioPerformanceMonitor(this);
                console.log('✅ Performance monitor initialized');
            } else {
                console.warn('AudioPerformanceMonitor not available');
            }
            
            // Setup critical error handling
            this.setupCriticalErrorHandling();
            
        } catch (error) {
            console.error('Failed to initialize monitoring:', error);
        }
    }
    
    setupCriticalErrorHandling() {
        try {
            // Audio dropout detection
            if (typeof AudioDropoutDetector !== 'undefined' && this.audioContext) {
                this.dropoutDetector = new AudioDropoutDetector(this.audioContext);
                console.log('✅ Dropout detector initialized');
            } else {
                console.warn('AudioDropoutDetector not available or no audio context');
            }
            
            // Memory leak monitoring
            if (typeof MemoryLeakMonitor !== 'undefined') {
                this.memoryMonitor = new MemoryLeakMonitor();
                this.memoryMonitor.startMonitoring();
                console.log('✅ Memory monitor initialized');
            } else {
                console.warn('MemoryLeakMonitor not available');
            }
            
            // Automatic recovery procedures
            if (typeof AudioRecoveryManager !== 'undefined') {
                this.recoveryManager = new AudioRecoveryManager(this);
                console.log('✅ Recovery manager initialized');
            } else {
                console.warn('AudioRecoveryManager not available');
            }
            
            console.log('✅ Critical error handling initialized');
            
        } catch (error) {
            console.error('Failed to setup error handling:', error);
        }
    }

    createDefaultPatches() {
        if (!this.patchManager) {
            console.warn('Cannot create default patches - patchManager not available');
            return;
        }
        
        try {
            // Create main output patch
            const mainPatch = this.patchManager.createPatch('Main', 'default', 64);
            mainPatch.setDefaultRouting();
            
            // Create monitor output patch
            const monitorPatch = this.patchManager.createPatch('Monitor', 'default', 16);
            monitorPatch.routeCueOutputsToStereo(0, false);
            
            console.log('✅ Default audio patches created');
        } catch (error) {
            console.error('Failed to create default patches:', error);
        }
    }
    
    /**
     * Create enhanced audio cue with full professional features
     */
    async createAudioCue(id, filePath) {
        try {
            // Use enhanced audio cue if available
            if (typeof AudioCueEnhanced !== 'undefined') {
                const cue = new AudioCueEnhanced(id, this, filePath);
                this.cues.set(id, cue);
                
                // Add VST support
                cue.vstPlugins = new Map();
                
                // Enhanced effects chain
                if (typeof EffectsChain !== 'undefined') {
                    cue.effectsChain = new EffectsChain(this.audioContext);
                }
                
                // Professional matrix mixer UI
                cue.matrixUI = null;
                
                // Performance optimization
                cue.audioWorkletProcessor = await this.createAudioWorklet(id);
                
                return cue;
            } else {
                // Fallback to regular AudioCue
                const cue = await super.createAudioCue(id, filePath);
                
                // Create effects chain for compatibility
                if (typeof ProfessionalAudioManager !== 'undefined') {
                    const effectsManager = new ProfessionalAudioManager(this);
                    const effectsChain = effectsManager.createEffectsChain(id);
                    if (cue.connectEffectsChain) {
                        cue.connectEffectsChain(effectsChain);
                    }
                }
                
                return cue;
            }
        } catch (error) {
            console.error('Failed to create audio cue:', error);
            throw error;
        }
    }
    
    /**
     * Load VST plugin for cue
     */
    async loadVSTForCue(cueId, pluginId) {
        const cue = this.getCue(cueId);
        if (!cue) throw new Error(`Cue not found: ${cueId}`);
        
        try {
            const vstPlugin = await this.vstManager.loadPlugin(pluginId, this.audioContext);
            cue.vstPlugins.set(pluginId, vstPlugin);
            
            // Add to effects chain
            if (cue.effectsChain) {
                cue.effectsChain.addEffect(vstPlugin);
            }
            
            return vstPlugin;
        } catch (error) {
            console.error('Failed to load VST plugin:', error);
            throw error;
        }
    }
    
    /**
     * Create matrix mixer UI
     */
    createMatrixUI(cue, container) {
        if (typeof MatrixMixerUI === 'undefined') {
            console.warn('MatrixMixerUI not available');
            return null;
        }
        
        try {
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
        } catch (error) {
            console.error('Failed to create matrix UI:', error);
            return null;
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

    // Patch Management Methods
    createOutputPatch(name, deviceId = 'default', numCueOutputs = 64) {
        if (!this.patchManager) {
            console.warn('Patch manager not available');
            return null;
        }
        return this.patchManager.createPatch(name, deviceId, numCueOutputs);
    }

    getOutputPatch(name) {
        if (!this.patchManager) return null;
        return this.patchManager.getPatch(name);
    }

    getAllOutputPatches() {
        if (!this.patchManager) return [];
        return this.patchManager.getAllPatches();
    }

    setDefaultOutputPatch(patchName) {
        if (!this.patchManager) return false;
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
        
        // If already a URL, return as-is
        if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('file://')) {
            return filePath;
        }
        
        // Convert file path to URL
        const normalizedPath = filePath.replace(/\\/g, '/');
        
        // Handle Windows paths
        if (normalizedPath.match(/^[A-Z]:/i)) {
            return `file:///${normalizedPath}`;
        }
        
        // Handle Unix-style paths
        if (normalizedPath.startsWith('/')) {
            return `file://${normalizedPath}`;
        }
        
        // For relative paths
        return `file://${normalizedPath}`;
    }

    /**
     * Show critical error to user
     */
    showCriticalError(message) {
        console.error('🚨 Critical Audio Error:', message);
        
        // Try to show user-friendly error
        if (typeof alert !== 'undefined') {
            alert(`Critical Audio Error:\n\n${message}\n\nPlease save your work and restart the application.`);
        }
        
        // Emit event for UI handling
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('criticalAudioError', {
                detail: { message }
            }));
        }
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

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const stats = {
            cpu: 0,
            memory: 0,
            dropouts: 0,
            activeVoices: 0,
            latency: 0
        };
        
        if (this.performanceMonitor) {
            const monitorStats = this.performanceMonitor.getStats();
            stats.cpu = monitorStats.cpuUsage;
            stats.memory = monitorStats.memoryUsage;
            stats.activeVoices = monitorStats.activeVoices;
            stats.latency = monitorStats.latency;
        }
        
        if (this.dropoutDetector) {
            stats.dropouts = this.dropoutDetector.getDropoutCount();
        }
        
        return stats;
    }

    /**
     * Clean up resources when destroying the audio engine
     */
    destroy() {
        console.log('Destroying Professional Audio Engine...');
        
        // Stop all monitoring
        if (this.dropoutDetector) {
            this.dropoutDetector.stopMonitoring();
        }
        
        if (this.memoryMonitor) {
            this.memoryMonitor.stopMonitoring();
        }
        
        // Stop all cues
        this.stopAllCues();
        
        // Clean up matrix UIs
        this.matrixUIs.forEach(ui => {
            if (ui.destroy) ui.destroy();
        });
        this.matrixUIs.clear();
        
        // Disconnect all nodes
        if (this.masterGainNode) {
            this.masterGainNode.disconnect();
        }
        
        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        console.log('✅ Professional Audio Engine destroyed');
    }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfessionalAudioEngine;
} else {
    window.ProfessionalAudioEngine = ProfessionalAudioEngine;
}
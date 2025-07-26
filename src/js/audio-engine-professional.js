/**
 * CueForge Professional Audio Engine - Phase 1 Foundation
 * 
 * This file contains the complete foundation layer for QLab-competitive audio:
 * - Professional Audio Engine
 * - Audio Output Patch System  
 * - Basic Matrix Routing
 * - Performance Monitoring
 * 
 * Designed to integrate cleanly with existing CueManager/UIManager
 */

// ===== FOUNDATION AUDIO ENGINE =====

class ProfessionalAudioEngine {
    constructor() {
        console.log('🎛️ Initializing Professional Audio Engine - Foundation');
        
        // Core audio context
        this.audioContext = null;
        this.masterGainNode = null;
        this.initialized = false;
        this.masterVolume = 0.7;
        
        // Audio cue management
        this.cues = new Map();
        
        // Audio Output Patch System
        this.outputPatches = new Map();
        this.defaultPatchName = 'Main';
        
        // Performance monitoring
        this.performanceStats = {
            cpu: 0,
            memory: 0,
            dropouts: 0,
            activeVoices: 0,
            latency: 0
        };
        
        // Monitoring intervals
        this.performanceInterval = null;
        this.dropoutCount = 0;
        this.lastAudioTime = 0;
        
        console.log('✅ Professional Audio Engine constructed');
    }
    
    // ===== INITIALIZATION =====
    
    async initializeAudioContext() {
        try {
            console.log('Initializing professional audio context...');
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.gain.value = this.masterVolume;
            this.masterGainNode.connect(this.audioContext.destination);
            
            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create default audio output patch
            this.createDefaultPatches();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            this.initialized = true;
            console.log('✅ Professional audio context initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize audio context:', error);
            throw error;
        }
    }
    
    createDefaultPatches() {
        // Create Main output patch (default)
        const mainPatch = new AudioOutputPatch('Main', this);
        this.outputPatches.set('Main', mainPatch);
        
        // Create Monitor output patch 
        const monitorPatch = new AudioOutputPatch('Monitor', this);
        this.outputPatches.set('Monitor', monitorPatch);
        
        console.log('✅ Default audio patches created');
    }
    
    // ===== AUDIO CUE MANAGEMENT =====
    
    async createAudioCue(id, filePath) {
        try {
            const cue = new ProfessionalAudioCue(id, this, filePath);
            await cue.loadAudio();
            
            this.cues.set(id, cue);
            console.log(`✅ Created audio cue: ${id}`);
            
            return cue;
        } catch (error) {
            console.error(`❌ Failed to create audio cue ${id}:`, error);
            throw error;
        }
    }
    
    getCue(id) {
        return this.cues.get(id);
    }
    
    async ensureAudioContext() {
        if (!this.initialized || this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
    
    stopAllCues() {
        this.cues.forEach(cue => {
            if (cue.isPlaying) {
                cue.stop();
            }
        });
    }
    
    // ===== PATCH MANAGEMENT =====
    
    getOutputPatch(name = null) {
        if (!name) name = this.defaultPatchName;
        return this.outputPatches.get(name);
    }
    
    getAllPatches() {
        return Array.from(this.outputPatches.values());
    }
    
    createOutputPatch(name, numCueOutputs = 64) {
        const patch = new AudioOutputPatch(name, this, numCueOutputs);
        this.outputPatches.set(name, patch);
        return patch;
    }
    
    // ===== PERFORMANCE MONITORING =====
    
    startPerformanceMonitoring() {
        this.performanceInterval = setInterval(() => {
            this.updatePerformanceStats();
        }, 1000); // Update every second
        
        // Audio dropout detection
        this.monitorAudioDropouts();
    }
    
    updatePerformanceStats() {
        // CPU usage estimation (basic)
        const activeCues = Array.from(this.cues.values()).filter(cue => cue.isPlaying).length;
        this.performanceStats.cpu = Math.min(activeCues * 5, 100); // Rough estimate
        
        // Memory usage (if available)
        if (performance.memory) {
            this.performanceStats.memory = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        }
        
        // Active voices
        this.performanceStats.activeVoices = activeCues;
        
        // Latency
        this.performanceStats.latency = this.audioContext.baseLatency + (this.audioContext.outputLatency || 0);
        
        // Dropouts
        this.performanceStats.dropouts = this.dropoutCount;
    }
    
    monitorAudioDropouts() {
        setInterval(() => {
            const currentTime = this.audioContext.currentTime;
            const expectedDelta = 0.1; // 100ms
            const actualDelta = currentTime - this.lastAudioTime;
            
            if (this.lastAudioTime > 0 && actualDelta > expectedDelta * 1.5) {
                this.dropoutCount++;
                console.warn(`Audio dropout detected: ${actualDelta.toFixed(3)}s`);
            }
            
            this.lastAudioTime = currentTime;
        }, 100);
    }
    
    getPerformanceStats() {
        return { ...this.performanceStats };
    }
    
    // ===== MASTER CONTROLS =====
    
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGainNode) {
            this.masterGainNode.gain.value = this.masterVolume;
        }
    }
    
    getMasterVolume() {
        return this.masterVolume;
    }
    
    // ===== CLEANUP =====
    
    destroy() {
        console.log('Destroying Professional Audio Engine...');
        
        // Stop monitoring
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
        }
        
        // Stop all cues
        this.stopAllCues();
        
        // Cleanup patches
        this.outputPatches.forEach(patch => patch.destroy());
        this.outputPatches.clear();
        
        // Cleanup audio context
        if (this.masterGainNode) {
            this.masterGainNode.disconnect();
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        console.log('✅ Professional Audio Engine destroyed');
    }
}

// ===== AUDIO OUTPUT PATCH =====

class AudioOutputPatch {
    constructor(name, audioEngine, numCueOutputs = 64) {
        this.name = name;
        this.audioEngine = audioEngine;
        this.audioContext = audioEngine.audioContext;
        this.numCueOutputs = numCueOutputs;
        this.numDeviceOutputs = 8; // Default, will be configurable
        
        // Audio routing
        this.cueOutputNodes = [];
        this.deviceOutputNodes = [];
        this.routingMatrix = [];
        
        // Patch settings
        this.mainLevel = 0; // dB
        this.outputLevels = new Array(numCueOutputs).fill(0);
        
        this.initializeAudioGraph();
        this.setDefaultRouting();
        
        console.log(`✅ Audio Output Patch "${name}" created`);
    }
    
    initializeAudioGraph() {
        // Create cue output nodes (busses)
        for (let i = 0; i < this.numCueOutputs; i++) {
            const outputNode = this.audioContext.createGain();
            outputNode.gain.value = this.dbToGain(this.outputLevels[i]);
            this.cueOutputNodes.push(outputNode);
        }
        
        // Create device output nodes
        for (let i = 0; i < this.numDeviceOutputs; i++) {
            const deviceNode = this.audioContext.createGain();
            // Connect first 2 outputs to destination (stereo)
            if (i < 2) {
                deviceNode.connect(this.audioContext.destination);
            }
            this.deviceOutputNodes.push(deviceNode);
        }
        
        // Initialize routing matrix
        this.routingMatrix = Array(this.numCueOutputs).fill(null).map(() => 
            new Array(this.numDeviceOutputs).fill(null)
        );
    }
    
    setDefaultRouting() {
        // Route first cue outputs to first device outputs (1:1)
        const maxRoutes = Math.min(this.numCueOutputs, this.numDeviceOutputs);
        for (let i = 0; i < maxRoutes; i++) {
            this.setRouting(i, i, 0); // 0dB = unity gain
        }
    }
    
    setRouting(cueOutput, deviceOutput, gainDb) {
        if (cueOutput >= this.numCueOutputs || deviceOutput >= this.numDeviceOutputs) {
            return false;
        }
        
        // Disconnect existing routing for this cue output -> device output
        if (this.routingMatrix[cueOutput][deviceOutput] !== null) {
            // Would disconnect existing gain node here
        }
        
        // Set new routing
        this.routingMatrix[cueOutput][deviceOutput] = gainDb;
        
        // Create audio connection with gain
        if (gainDb !== null) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.dbToGain(gainDb);
            
            this.cueOutputNodes[cueOutput].connect(gainNode);
            gainNode.connect(this.deviceOutputNodes[deviceOutput]);
        }
        
        return true;
    }
    
    routeCueToOutput(cue, cueOutputIndex = 0) {
        if (cueOutputIndex >= this.numCueOutputs) {
            cueOutputIndex = 0;
        }
        
        // Connect cue's output to the specified cue output bus
        if (cue.outputNode) {
            cue.outputNode.connect(this.cueOutputNodes[cueOutputIndex]);
        }
    }
    
    dbToGain(db) {
        if (db === null || db <= -60) return 0;
        return Math.pow(10, db / 20);
    }
    
    gainToDb(gain) {
        if (gain <= 0) return -60;
        return 20 * Math.log10(gain);
    }
    
    destroy() {
        // Disconnect all nodes
        this.cueOutputNodes.forEach(node => node.disconnect());
        this.deviceOutputNodes.forEach(node => node.disconnect());
        
        this.cueOutputNodes = [];
        this.deviceOutputNodes = [];
        this.routingMatrix = [];
        
        console.log(`Audio Output Patch "${this.name}" destroyed`);
    }
}

// ===== PROFESSIONAL AUDIO CUE =====

class ProfessionalAudioCue {
    constructor(id, audioEngine, filePath) {
        this.id = id;
        this.audioEngine = audioEngine;
        this.audioContext = audioEngine.audioContext;
        this.filePath = filePath;
        
        // Audio nodes
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.outputNode = null;
        
        // Playback state
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        
        // Audio properties
        this.volume = 1.0;
        this.rate = 1.0;
        this.pan = 0.0;
        
        this.setupAudioGraph();
    }
    
    setupAudioGraph() {
        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        
        // Create output node
        this.outputNode = this.audioContext.createGain();
        
        // Connect: gain -> output
        this.gainNode.connect(this.outputNode);
        
        // Route to default patch
        const defaultPatch = this.audioEngine.getOutputPatch();
        if (defaultPatch) {
            defaultPatch.routeCueToOutput(this, 0);
        }
    }
    
    async loadAudio() {
        try {
            const response = await fetch(this.filePath);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            console.log(`✅ Audio loaded: ${this.filePath}`);
        } catch (error) {
            console.error(`❌ Failed to load audio: ${this.filePath}`, error);
            throw error;
        }
    }
    
    async play() {
        if (!this.audioBuffer) {
            throw new Error('Audio not loaded');
        }
        
        await this.audioEngine.ensureAudioContext();
        
        // Create new source node
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.playbackRate.value = this.rate;
        
        // Connect source to gain
        this.sourceNode.connect(this.gainNode);
        
        // Handle playback end
        this.sourceNode.onended = () => {
            this.isPlaying = false;
            this.sourceNode = null;
        };
        
        // Start playback
        this.sourceNode.start(0);
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;
        
        console.log(`▶️ Playing audio cue: ${this.id}`);
    }
    
    stop() {
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode = null;
        }
        
        this.isPlaying = false;
        console.log(`⏹️ Stopped audio cue: ${this.id}`);
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }
    
    setRate(rate) {
        this.rate = Math.max(0.25, Math.min(4.0, rate));
        if (this.sourceNode) {
            this.sourceNode.playbackRate.value = this.rate;
        }
    }
    
    setPan(pan) {
        this.pan = Math.max(-1, Math.min(1, pan));
        // Pan implementation would go here
    }
    
    getProgress() {
        if (!this.isPlaying || !this.audioBuffer) return 0;
        const elapsed = this.audioContext.currentTime - this.startTime;
        return Math.min(elapsed / this.audioBuffer.duration, 1);
    }
    
    getDuration() {
        return this.audioBuffer ? this.audioBuffer.duration : 0;
    }
}

// ===== COMPATIBILITY LAYER =====

// Ensure compatibility with existing AudioEngineWithFades API
class AudioEngineWithFades extends ProfessionalAudioEngine {
    constructor() {
        super();
        console.log('AudioEngineWithFades compatibility layer active');
    }
}

// ===== EXPORTS =====

// Make classes available globally
window.ProfessionalAudioEngine = ProfessionalAudioEngine;
window.AudioEngineWithFades = AudioEngineWithFades; // Compatibility
window.AudioOutputPatch = AudioOutputPatch;
window.ProfessionalAudioCue = ProfessionalAudioCue;

// Module exports for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ProfessionalAudioEngine,
        AudioEngineWithFades,
        AudioOutputPatch,
        ProfessionalAudioCue
    };
}
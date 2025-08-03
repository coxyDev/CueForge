/**
 * Native Audio Engine Wrapper
 * Connects the JavaScript API bridge to the JUCE C++ backend
 */

class NativeAudioEngine {
    constructor() {
        this.nativeEngine = null;
        this.isInitialized = false;
        this.eventCallbacks = new Map();
        
        console.log('🔧 Native Audio Engine wrapper created');
    }
    
    async initialize() {
        try {
            // Try to load the native module
            const nativeModule = require('../../native/build/Release/cueforge_audio.node');
            this.nativeEngine = new nativeModule.AudioEngine();
            
            // Initialize the native engine
            const success = this.nativeEngine.initialize(44100, 512);
            
            if (success) {
                this.isInitialized = true;
                console.log('✅ Native JUCE audio engine initialized');
                
                // Set up event monitoring
                this.startEventMonitoring();
                
                return true;
            } else {
                console.error('❌ Failed to initialize native audio engine');
                return false;
            }
            
        } catch (error) {
            console.warn('⚠️ Native audio engine not available:', error.message);
            console.log('📝 This is normal during development before the native module is built');
            return false;
        }
    }
    
    async sendCommand(command, params = {}) {
        if (!this.isInitialized || !this.nativeEngine) {
            throw new Error('Native engine not initialized');
        }
        
        const commandObj = {
            command,
            params,
            id: Date.now()
        };
        
        try {
            const response = this.nativeEngine.sendCommand(commandObj);
            return response;
        } catch (error) {
            console.error('Native command failed:', error);
            throw error;
        }
    }
    
    // System Management Commands
    async initializeAudioSystem(sampleRate = 44100, bufferSize = 512, maxCueOutputs = 64, maxDeviceOutputs = 128) {
        return await this.sendCommand('initializeAudioSystem', {
            sampleRate,
            bufferSize,
            maxCueOutputs,
            maxDeviceOutputs
        });
    }
    
    async setAudioDevice(deviceId, inputChannels, outputChannels, sampleRate, bufferSize) {
        return await this.sendCommand('setAudioDevice', {
            deviceId,
            inputChannels,
            outputChannels,
            sampleRate,
            bufferSize
        });
    }
    
    async getSystemStatus() {
        return await this.sendCommand('getSystemStatus');
    }
    
    // Cue Management Commands
    async createAudioCue(cueId, filePath, outputPatchId = 'main') {
        return await this.sendCommand('createAudioCue', {
            cueId,
            filePath,
            outputPatchId
        });
    }
    
    async playCue(cueId, startTime = 0.0, fadeInTime = 0.0, volume = 1.0, playbackRate = 1.0) {
        return await this.sendCommand('playCue', {
            cueId,
            startTime,
            fadeInTime,
            volume,
            playbackRate
        });
    }
    
    async stopCue(cueId, fadeOutTime = 0.0) {
        return await this.sendCommand('stopCue', {
            cueId,
            fadeOutTime
        });
    }
    
    async pauseCue(cueId) {
        return await this.sendCommand('pauseCue', { cueId });
    }
    
    async resumeCue(cueId) {
        return await this.sendCommand('resumeCue', { cueId });
    }
    
    async setCueProperties(cueId, properties) {
        return await this.sendCommand('setCueProperties', {
            cueId,
            properties
        });
    }
    
    // Matrix Routing Commands
    async setCueMatrixRouting(cueId, matrix) {
        return await this.sendCommand('setCueMatrixRouting', {
            cueId,
            matrix
        });
    }
    
    async setCrosspoint(cueId, input, output, level, muted = false) {
        return await this.sendCommand('setCrosspoint', {
            cueId,
            input,
            output,
            level,
            muted
        });
    }
    
    async setCueInputLevel(cueId, input, level, muted = false) {
        return await this.sendCommand('setCueInputLevel', {
            cueId,
            input,
            level,
            muted
        });
    }
    
    async setCueOutputLevel(cueId, output, level, muted = false) {
        return await this.sendCommand('setCueOutputLevel', {
            cueId,
            output,
            level,
            muted
        });
    }
    
    async setCueGangGroup(cueId, gangId, crosspoints) {
        return await this.sendCommand('setCueGangGroup', {
            cueId,
            gangId,
            crosspoints
        });
    }
    
    // Patch Management Commands
    async createOutputPatch(patchId, name, cueOutputs, deviceOutputs, audioDeviceId) {
        return await this.sendCommand('createOutputPatch', {
            patchId,
            name,
            cueOutputs,
            deviceOutputs,
            audioDeviceId
        });
    }
    
    async setPatchMatrixRouting(patchId, matrix) {
        return await this.sendCommand('setPatchMatrixRouting', {
            patchId,
            matrix
        });
    }
    
    async loadPatch(patchName, patchId) {
        return await this.sendCommand('loadPatch', {
            patchName,
            patchId
        });
    }
    
    // Device Management Commands
    async getAudioDevices() {
        return await this.sendCommand('getAudioDevices');
    }
    
    async setDeviceOutputCount(patchId, outputCount) {
        return await this.sendCommand('setDeviceOutputCount', {
            patchId,
            outputCount
        });
    }
    
    // Event handling
    addEventListener(eventType, callback) {
        if (!this.eventCallbacks.has(eventType)) {
            this.eventCallbacks.set(eventType, []);
        }
        this.eventCallbacks.get(eventType).push(callback);
    }
    
    removeEventListener(eventType, callback) {
        if (this.eventCallbacks.has(eventType)) {
            const callbacks = this.eventCallbacks.get(eventType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emitEvent(eventType, data) {
        if (this.eventCallbacks.has(eventType)) {
            this.eventCallbacks.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in event callback:', error);
                }
            });
        }
    }
    
    startEventMonitoring() {
        // In a full implementation, you'd set up proper event callbacks from C++
        // For now, we'll simulate periodic events
        setInterval(() => {
            if (this.isInitialized) {
                // Emit performance stats event
                this.emitEvent('performanceStats', {
                    cpuUsage: Math.random() * 20,
                    dropouts: 0,
                    memoryUsage: Math.random() * 100,
                    activeVoices: 0
                });
            }
        }, 1000);
    }
    
    shutdown() {
        if (this.nativeEngine) {
            try {
                this.nativeEngine.shutdown();
            } catch (error) {
                console.error('Error shutting down native engine:', error);
            }
        }
        
        this.isInitialized = false;
        this.nativeEngine = null;
        console.log('🔧 Native audio engine shut down');
    }
}

// Export the class
window.NativeAudioEngine = NativeAudioEngine;

// =============================================================================
// File: src/js/audio-engine-api-enhanced.js
// Enhanced API bridge that can use either stub or native implementation
// =============================================================================

/**
 * Enhanced Audio Engine API Bridge
 * Automatically uses native JUCE engine if available, falls back to stubs
 */

class EnhancedAudioEngineAPI extends AudioEngineAPI {
    constructor() {
        super();
        
        this.nativeEngine = null;
        this.preferNative = true;
        
        console.log('🔌 Enhanced Audio Engine API Bridge initialized');
    }
    
    async initialize() {
        // Try to initialize native engine first
        if (this.preferNative) {
            try {
                this.nativeEngine = new NativeAudioEngine();
                const nativeSuccess = await this.nativeEngine.initialize();
                
                if (nativeSuccess) {
                    this.useNativeEngine = true;
                    console.log('✅ Using native JUCE audio engine');
                    
                    // Forward events from native engine
                    this.nativeEngine.addEventListener('performanceStats', (data) => {
                        this.emitEvent('performanceStats', data);
                    });
                    
                    this.nativeEngine.addEventListener('playbackStatus', (data) => {
                        this.emitEvent('playbackStatus', data);
                    });
                    
                    return true;
                }
            } catch (error) {
                console.warn('Failed to initialize native engine:', error);
            }
        }
        
        // Fall back to stub implementation
        this.useNativeEngine = false;
        console.log('📝 Using stub implementation');
        return true;
    }
    
    async sendCommand(command, params = {}) {
        if (this.useNativeEngine && this.nativeEngine) {
            try {
                return await this.nativeEngine.sendCommand(command, params);
            } catch (error) {
                console.error('Native command failed, falling back to stub:', error);
                this.useNativeEngine = false;
                this.nativeEngine = null;
            }
        }
        
        // Use stub implementation (parent class)
        return await super.sendCommand(command, params);
    }
    
    enableNativeEngine() {
        this.preferNative = true;
        console.log('🚀 Native engine preference enabled');
    }
    
    disableNativeEngine() {
        this.preferNative = false;
        this.useNativeEngine = false;
        
        if (this.nativeEngine) {
            this.nativeEngine.shutdown();
            this.nativeEngine = null;
        }
        
        console.log('⚠️ Native engine disabled, using stubs');
    }
    
    getEngineType() {
        return this.useNativeEngine ? 'native' : 'stub';
    }
    
    async switchToNative() {
        if (!this.useNativeEngine) {
            return await this.initialize();
        }
        return true;
    }
}

// Replace the global AudioEngineAPI with the enhanced version
window.AudioEngineAPI = EnhancedAudioEngineAPI;
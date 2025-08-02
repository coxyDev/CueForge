/**
 * Audio Engine API Bridge
 * Implements the Phase 1 JSON API for communication with native audio engine
 * Initially contains stub implementations for testing
 */

class AudioEngineAPI {
    constructor() {
        this.initialized = false;
        this.useNativeEngine = false; // Switch between stub and native
        this.commandId = 0;
        this.pendingCommands = new Map();
        this.eventCallbacks = new Map();
        
        // Stub data for testing
        this.stubCues = new Map();
        this.stubPatches = new Map();
        this.stubDevices = this.createStubDevices();
        
        console.log('🔌 Audio Engine API Bridge initialized');
    }
    
    // ==================== SYSTEM MANAGEMENT ====================
    
    async sendCommand(command, params = {}) {
        const commandObj = {
            command,
            params,
            id: ++this.commandId
        };
        
        if (this.useNativeEngine) {
            // Future: Send to native engine via Node module
            return await this.sendToNativeEngine(commandObj);
        } else {
            // Current: Use stub implementations
            return await this.handleStubCommand(commandObj);
        }
    }
    
    async initializeAudioSystem(sampleRate = 44100, bufferSize = 512, maxCueOutputs = 64, maxDeviceOutputs = 128) {
        const response = await this.sendCommand('initializeAudioSystem', {
            sampleRate,
            bufferSize,
            maxCueOutputs,
            maxDeviceOutputs
        });
        
        this.initialized = response.success;
        return response;
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
    
    // ==================== CUE MANAGEMENT ====================
    
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
    
    // ==================== MATRIX ROUTING ====================
    
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
    
    // ==================== PATCH MANAGEMENT ====================
    
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
    
    // ==================== DEVICE MANAGEMENT ====================
    
    async getAudioDevices() {
        return await this.sendCommand('getAudioDevices');
    }
    
    async setDeviceOutputCount(patchId, outputCount) {
        return await this.sendCommand('setDeviceOutputCount', {
            patchId,
            outputCount
        });
    }
    
    // ==================== EVENT HANDLING ====================
    
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
    
    // ==================== STUB IMPLEMENTATIONS ====================
    
    async handleStubCommand(commandObj) {
        const { command, params } = commandObj;
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 10));
        
        switch (command) {
            case 'initializeAudioSystem':
                return { 
                    success: true,
                    message: 'Audio system initialized (stub)'
                };
                
            case 'getSystemStatus':
                return {
                    success: true,
                    status: 'ready',
                    currentDevice: 'Default Audio Device (stub)',
                    sampleRate: 44100,
                    bufferSize: 512,
                    cpuUsage: Math.random() * 20,
                    dropouts: 0,
                    activeCues: Array.from(this.stubCues.keys())
                };
                
            case 'createAudioCue':
                this.stubCues.set(params.cueId, {
                    id: params.cueId,
                    filePath: params.filePath,
                    channels: 2, // Stub: assume stereo
                    duration: 120.5, // Stub duration
                    sampleRate: 44100,
                    isPlaying: false,
                    matrix: this.createStubMatrix(2, 64)
                });
                
                return {
                    success: true,
                    cueId: params.cueId,
                    audioInfo: {
                        channels: 2,
                        sampleRate: 44100,
                        duration: 120.5,
                        format: 'WAV'
                    },
                    defaultMatrix: this.createStubMatrix(2, 64)
                };
                
            case 'playCue':
                if (this.stubCues.has(params.cueId)) {
                    this.stubCues.get(params.cueId).isPlaying = true;
                    
                    // Simulate playback status events
                    setTimeout(() => {
                        this.emitEvent('playbackStatus', {
                            cueId: params.cueId,
                            status: 'playing',
                            currentTime: 0.0,
                            duration: 120.5
                        });
                    }, 50);
                    
                    return { success: true, message: 'Cue started (stub)' };
                }
                return { success: false, error: { code: 'CUE_NOT_FOUND', message: 'Cue not found' } };
                
            case 'stopCue':
                if (this.stubCues.has(params.cueId)) {
                    this.stubCues.get(params.cueId).isPlaying = false;
                    
                    setTimeout(() => {
                        this.emitEvent('playbackStatus', {
                            cueId: params.cueId,
                            status: 'stopped',
                            currentTime: 0.0,
                            duration: 120.5
                        });
                    }, 50);
                    
                    return { success: true, message: 'Cue stopped (stub)' };
                }
                return { success: false, error: { code: 'CUE_NOT_FOUND', message: 'Cue not found' } };
                
            case 'getAudioDevices':
                return {
                    success: true,
                    devices: this.stubDevices
                };
                
            default:
                return { 
                    success: true, 
                    message: `Command ${command} executed (stub)` 
                };
        }
    }
    
    createStubMatrix(inputs, outputs) {
        const routing = [];
        // Default routing: input 0 -> output 0, input 1 -> output 1
        for (let i = 0; i < Math.min(inputs, outputs); i++) {
            routing.push({
                input: i,
                output: i,
                level: 0.0,
                muted: false,
                ganged: false
            });
        }
        
        return {
            inputs,
            outputs,
            routing
        };
    }
    
    createStubDevices() {
        return [
            {
                id: 'default',
                name: 'Default Audio Device',
                type: 'DirectSound',
                inputChannels: 2,
                outputChannels: 2,
                supportedSampleRates: [44100, 48000],
                supportedBufferSizes: [512, 1024, 2048]
            },
            {
                id: 'ASIO::Stub Device',
                name: 'Professional Audio Interface (Stub)',
                type: 'ASIO',
                inputChannels: 8,
                outputChannels: 8,
                supportedSampleRates: [44100, 48000, 88200, 96000],
                supportedBufferSizes: [64, 128, 256, 512]
            }
        ];
    }
    
    // ==================== NATIVE ENGINE CONNECTION (Future) ====================
    
    async sendToNativeEngine(commandObj) {
        // Future: This will send commands to C++ via Node Native Module
        throw new Error('Native engine not yet implemented');
    }
    
    enableNativeEngine() {
        this.useNativeEngine = true;
        console.log('🚀 Native engine enabled');
    }
    
    disableNativeEngine() {
        this.useNativeEngine = false;
        console.log('⚠️ Native engine disabled, using stubs');
    }
}

// Global instance
window.AudioEngineAPI = AudioEngineAPI;
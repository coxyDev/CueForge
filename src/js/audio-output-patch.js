/**
 * Audio Output Patch System
 * Implements QLab-style audio output patches with matrix routing
 */

class AudioOutputPatch {
    constructor(name, audioEngine, deviceId = 'default', numCueOutputs = 64) {
        this.name = name;
        this.audioEngine = audioEngine;
        this.deviceId = deviceId;
        this.numCueOutputs = numCueOutputs;
        this.numDeviceOutputs = 2; // Default stereo, will update based on device
        
        // Patch matrix mixer: routes cue outputs to device outputs
        this.patchMatrix = new MatrixMixer(this.numCueOutputs, this.numDeviceOutputs, `${name} Patch`);
        
        // Audio routing and processing
        this.context = audioEngine.audioContext;
        this.cueOutputBusses = new Map(); // cueOutputId -> bus object
        this.deviceOutputNodes = [];
        
        // Cue output names and settings
        this.cueOutputNames = new Array(numCueOutputs).fill(null).map((_, i) => `${i + 1}`);
        this.cueOutputEffects = new Map(); // cueOutputId -> effects chain
        
        // Device output names (read-only from device)
        this.deviceOutputNames = [];
        
        // Initialize audio graph
        this.initializeAudioGraph();
        
        // Set default routing (1:1 for first channels)
        this.setDefaultRouting();
    }
    
    async initializeAudioGraph() {
        // Create cue output busses
        for (let i = 0; i < this.numCueOutputs; i++) {
            const bus = {
                input: this.context.createGain(),
                effects: null, // Will be created if effects are added
                output: this.context.createGain(),
                meter: null, // Could add metering
                muted: false,
                soloed: false
            };
            
            // Connect bus chain
            bus.input.connect(bus.output);
            
            this.cueOutputBusses.set(i, bus);
        }
        
        // Get device info and create output nodes
        await this.updateDeviceOutputs();
        
        // Update matrix routing
        this.updateMatrixRouting();
    }
    
    async updateDeviceOutputs() {
        // In a real implementation, this would query the audio device
        // For now, we'll simulate based on the deviceId
        if (this.deviceId === 'default') {
            this.numDeviceOutputs = 2; // Stereo
            this.deviceOutputNames = ['L', 'R'];
        } else if (this.deviceId === 'surround') {
            this.numDeviceOutputs = 8; // 7.1 surround
            this.deviceOutputNames = ['L', 'R', 'C', 'LFE', 'Ls', 'Rs', 'Lb', 'Rb'];
        } else if (this.deviceId.includes('dante') || this.deviceId.includes('madi')) {
            this.numDeviceOutputs = 64; // Professional interface
            this.deviceOutputNames = Array(64).fill(null).map((_, i) => `Out ${i + 1}`);
        }
        
        // Update patch matrix size
        this.patchMatrix = new MatrixMixer(this.numCueOutputs, this.numDeviceOutputs, `${this.name} Patch`);
        
        // Create device output nodes
        this.deviceOutputNodes = [];
        for (let i = 0; i < this.numDeviceOutputs; i++) {
            const outputNode = this.context.createGain();
            this.deviceOutputNodes.push(outputNode);
            
            // Connect to destination (in real app, would route to specific device outputs)
            if (i < 2 && this.context.destination) {
                // For development, connect first 2 outputs to speakers
                const merger = this.context.createChannelMerger(2);
                outputNode.connect(merger, 0, i);
                merger.connect(this.context.destination);
            }
        }
    }
    
    updateMatrixRouting() {
        // Disconnect all current routing
        this.cueOutputBusses.forEach(bus => {
            try {
                bus.output.disconnect();
            } catch (e) {
                // Ignore if not connected
            }
        });
        
        // Route according to patch matrix
        for (let cueOut = 0; cueOut < this.numCueOutputs; cueOut++) {
            const bus = this.cueOutputBusses.get(cueOut);
            if (!bus) continue;
            
            for (let deviceOut = 0; deviceOut < this.numDeviceOutputs; deviceOut++) {
                const gain = this.patchMatrix.calculateGain(cueOut, deviceOut);
                if (gain > 0 && this.deviceOutputNodes[deviceOut]) {
                    const routingGain = this.context.createGain();
                    routingGain.gain.value = gain;
                    
                    bus.output.connect(routingGain);
                    routingGain.connect(this.deviceOutputNodes[deviceOut]);
                }
            }
        }
    }
    
    setDefaultRouting() {
        // Clear all routing first
        this.patchMatrix.setSilent();
        
        // Set 1:1 routing for as many channels as possible
        const routeCount = Math.min(this.numCueOutputs, this.numDeviceOutputs);
        for (let i = 0; i < routeCount; i++) {
            this.patchMatrix.setCrosspoint(i, i, 0); // Unity gain
        }
        
        this.updateMatrixRouting();
    }
    
    // === Cue Output Management ===
    
    getCueOutputBus(cueOutputId) {
        return this.cueOutputBusses.get(cueOutputId);
    }
    
    setCueOutputName(cueOutputId, name) {
        if (cueOutputId >= 0 && cueOutputId < this.numCueOutputs) {
            this.cueOutputNames[cueOutputId] = name;
        }
    }
    
    getCueOutputName(cueOutputId) {
        return this.cueOutputNames[cueOutputId] || `${cueOutputId + 1}`;
    }
    
    // === Effects Management ===
    
    addEffectToCueOutput(cueOutputId, effect) {
        const bus = this.cueOutputBusses.get(cueOutputId);
        if (!bus) return false;
        
        // Create effects chain if needed
        if (!bus.effects) {
            bus.effects = new EffectsChain(this.context);
            
            // Reconnect with effects in chain
            bus.input.disconnect();
            bus.input.connect(bus.effects.inputNode);
            bus.effects.connect(bus.output);
        }
        
        // Add effect to chain
        bus.effects.addEffect(effect);
        
        // Store in effects map
        if (!this.cueOutputEffects.has(cueOutputId)) {
            this.cueOutputEffects.set(cueOutputId, []);
        }
        this.cueOutputEffects.get(cueOutputId).push(effect);
        
        return true;
    }
    
    removeEffectFromCueOutput(cueOutputId, effectName) {
        const bus = this.cueOutputBusses.get(cueOutputId);
        if (!bus || !bus.effects) return false;
        
        return bus.effects.removeEffect(effectName);
    }
    
    // === Patch Configuration ===
    
    setNumCueOutputs(num) {
        num = Math.max(1, Math.min(128, num));
        if (num === this.numCueOutputs) return;
        
        this.numCueOutputs = num;
        this.initializeAudioGraph();
    }
    
    async setAudioDevice(deviceId) {
        this.deviceId = deviceId;
        await this.updateDeviceOutputs();
        this.updateMatrixRouting();
    }
    
    // === Routing Helpers ===
    
    routeCueOutputsToStereo(startOutput = 0, spread = true) {
        // Clear existing routing
        this.patchMatrix.setSilent();
        
        if (spread) {
            // Spread outputs across L/R
            for (let i = startOutput; i < this.numCueOutputs && i < startOutput + 8; i++) {
                const pan = (i - startOutput) / 7; // 0 to 1
                const leftGain = Math.cos(pan * Math.PI / 2);
                const rightGain = Math.sin(pan * Math.PI / 2);
                
                this.patchMatrix.setCrosspoint(i, 0, this.patchMatrix.gainToDb(leftGain));
                this.patchMatrix.setCrosspoint(i, 1, this.patchMatrix.gainToDb(rightGain));
            }
        } else {
            // Simple stereo routing
            this.patchMatrix.setCrosspoint(startOutput, 0, 0); // Left
            this.patchMatrix.setCrosspoint(startOutput + 1, 1, 0); // Right
        }
        
        this.updateMatrixRouting();
    }
    
    routeCueOutputsToSurround(startOutput = 0) {
        if (this.numDeviceOutputs < 6) {
            console.warn('Not enough device outputs for surround routing');
            return;
        }
        
        // Clear existing routing
        this.patchMatrix.setSilent();
        
        // Standard 5.1 routing
        this.patchMatrix.setCrosspoint(startOutput, 0, 0); // L
        this.patchMatrix.setCrosspoint(startOutput + 1, 1, 0); // R
        this.patchMatrix.setCrosspoint(startOutput + 2, 2, 0); // C
        this.patchMatrix.setCrosspoint(startOutput + 3, 3, 0); // LFE
        this.patchMatrix.setCrosspoint(startOutput + 4, 4, 0); // Ls
        this.patchMatrix.setCrosspoint(startOutput + 5, 5, 0); // Rs
        
        this.updateMatrixRouting();
    }
    
    // === State Management ===
    
    getState() {
        return {
            name: this.name,
            deviceId: this.deviceId,
            numCueOutputs: this.numCueOutputs,
            cueOutputNames: [...this.cueOutputNames],
            patchMatrixState: this.patchMatrix.getState(),
            effects: Array.from(this.cueOutputEffects.entries()).map(([id, effects]) => ({
                cueOutputId: id,
                effects: effects.map(e => ({
                    name: e.name,
                    type: e.constructor.name
                }))
            }))
        };
    }
    
    setState(state) {
        this.name = state.name || this.name;
        if (state.deviceId !== this.deviceId) {
            this.setAudioDevice(state.deviceId);
        }
        if (state.numCueOutputs !== this.numCueOutputs) {
            this.setNumCueOutputs(state.numCueOutputs);
        }
        if (state.cueOutputNames) {
            this.cueOutputNames = [...state.cueOutputNames];
        }
        if (state.patchMatrixState) {
            this.patchMatrix.setState(state.patchMatrixState);
            this.updateMatrixRouting();
        }
    }
}

// === Patch Manager ===

class AudioPatchManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.patches = new Map();
        this.defaultPatch = null;
    }
    
    createPatch(name, deviceId = 'default', numCueOutputs = 64) {
        const patch = new AudioOutputPatch(name, this.audioEngine, deviceId, numCueOutputs);
        this.patches.set(name, patch);
        
        if (!this.defaultPatch) {
            this.defaultPatch = patch;
        }
        
        return patch;
    }
    
    getPatch(name) {
        return this.patches.get(name);
    }
    
    deletePatch(name) {
        if (this.patches.has(name)) {
            const patch = this.patches.get(name);
            if (patch === this.defaultPatch) {
                // Set a new default
                this.defaultPatch = this.patches.values().next().value || null;
            }
            this.patches.delete(name);
            return true;
        }
        return false;
    }
    
    setDefaultPatch(name) {
        const patch = this.patches.get(name);
        if (patch) {
            this.defaultPatch = patch;
            return true;
        }
        return false;
    }
    
    getDefaultPatch() {
        return this.defaultPatch;
    }
    
    getAllPatches() {
        return Array.from(this.patches.values());
    }
}

// Export for use
window.AudioOutputPatch = AudioOutputPatch;
window.AudioPatchManager = AudioPatchManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioOutputPatch, AudioPatchManager };
}
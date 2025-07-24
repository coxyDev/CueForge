/**
 * Audio Output Patch System
 * Implements QLab-style audio output patches with matrix routing
 * NOTE: AudioPatchManager is now in a separate file - audio-patch-manager.js
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
            this.deviceOutputNames = ['Left', 'Right'];
        } else {
            // Simulate multi-channel interfaces
            this.numDeviceOutputs = 8;
            this.deviceOutputNames = Array(8).fill(null).map((_, i) => `Out ${i + 1}`);
        }
        
        // Recreate device output nodes if count changed
        this.deviceOutputNodes = [];
        for (let i = 0; i < this.numDeviceOutputs; i++) {
            const outputNode = this.context.createGain();
            
            // In a real implementation, this would connect to the specific device output
            // For now, connect to the main destination (speakers)
            if (i < this.context.destination.maxChannelCount) {
                outputNode.connect(this.context.destination);
            }
            
            this.deviceOutputNodes.push(outputNode);
        }
        
        // Update matrix mixer dimensions
        this.patchMatrix = new MatrixMixer(this.numCueOutputs, this.numDeviceOutputs, `${this.name} Patch`);
    }
    
    setDefaultRouting() {
        // Route first cue outputs to first device outputs at unity gain
        const maxRoutes = Math.min(this.numCueOutputs, this.numDeviceOutputs);
        for (let i = 0; i < maxRoutes; i++) {
            this.patchMatrix.setCrosspoint(i, i, 0); // 0 dB = unity gain
        }
        
        this.updateMatrixRouting();
    }
    
    routeCueOutputsToStereo(startCueOutput = 0, sumToMono = false) {
        // Clear existing routing
        this.patchMatrix.clear();
        
        if (sumToMono) {
            // Sum all cue outputs to both L and R
            for (let i = startCueOutput; i < this.numCueOutputs; i++) {
                this.patchMatrix.setCrosspoint(i, 0, 0); // Left
                this.patchMatrix.setCrosspoint(i, 1, 0); // Right
            }
        } else {
            // Alternate cue outputs between L and R
            for (let i = startCueOutput; i < this.numCueOutputs; i++) {
                const outputChannel = i % 2; // 0 = Left, 1 = Right
                this.patchMatrix.setCrosspoint(i, outputChannel, 0);
            }
        }
        
        this.updateMatrixRouting();
    }
    
    updateMatrixRouting() {
        // Disconnect all current routing
        this.cueOutputBusses.forEach((bus, cueOutput) => {
            bus.output.disconnect();
        });
        
        // Connect based on matrix settings
        for (let cueOutput = 0; cueOutput < this.numCueOutputs; cueOutput++) {
            const bus = this.cueOutputBusses.get(cueOutput);
            if (!bus) continue;
            
            for (let deviceOutput = 0; deviceOutput < this.numDeviceOutputs; deviceOutput++) {
                const gain = this.patchMatrix.calculateGain(cueOutput, deviceOutput);
                
                if (gain > 0 && deviceOutput < this.deviceOutputNodes.length) {
                    // Create a gain node for this specific routing
                    const routeGain = this.context.createGain();
                    routeGain.gain.value = gain;
                    
                    // Connect: cue output -> route gain -> device output
                    bus.output.connect(routeGain);
                    routeGain.connect(this.deviceOutputNodes[deviceOutput]);
                }
            }
        }
    }
    
    // Cue Routing Methods
    
    routeCue(cue, cueOutputs = [0]) {
        // Connect a cue's audio to specific cue outputs
        if (!cue.outputNode) {
            console.warn(`Cue ${cue.id} has no output node to route`);
            return;
        }
        
        cueOutputs.forEach(outputIndex => {
            if (outputIndex < this.numCueOutputs) {
                const bus = this.cueOutputBusses.get(outputIndex);
                if (bus) {
                    cue.outputNode.connect(bus.input);
                }
            }
        });
    }
    
    unrouteCue(cue) {
        // Disconnect a cue from all cue outputs
        if (cue.outputNode) {
            cue.outputNode.disconnect();
        }
    }
    
    // Effects Management
    
    addEffectToCueOutput(cueOutput, effect) {
        const bus = this.cueOutputBusses.get(cueOutput);
        if (!bus) return false;
        
        if (!bus.effects) {
            bus.effects = this.context.createGain();
            
            // Rewire the bus: input -> effects -> output
            bus.input.disconnect();
            bus.input.connect(bus.effects);
            bus.effects.connect(bus.output);
        }
        
        // Add effect to the chain
        // This would need a proper effects chain implementation
        console.log(`Effect added to cue output ${cueOutput}:`, effect);
        
        if (!this.cueOutputEffects.has(cueOutput)) {
            this.cueOutputEffects.set(cueOutput, []);
        }
        this.cueOutputEffects.get(cueOutput).push(effect);
        
        return true;
    }
    
    removeEffectFromCueOutput(cueOutput, effectIndex) {
        const effects = this.cueOutputEffects.get(cueOutput);
        if (effects && effectIndex >= 0 && effectIndex < effects.length) {
            effects.splice(effectIndex, 1);
            
            // If no effects left, bypass effects bus
            if (effects.length === 0) {
                const bus = this.cueOutputBusses.get(cueOutput);
                if (bus && bus.effects) {
                    bus.input.disconnect();
                    bus.effects.disconnect();
                    bus.input.connect(bus.output);
                    bus.effects = null;
                }
            }
            
            return true;
        }
        return false;
    }
    
    // Utility Methods
    
    setCueOutputName(outputIndex, name) {
        if (outputIndex >= 0 && outputIndex < this.numCueOutputs) {
            this.cueOutputNames[outputIndex] = name;
        }
    }
    
    getCueOutputName(outputIndex) {
        return this.cueOutputNames[outputIndex] || `${outputIndex + 1}`;
    }
    
    getDeviceOutputName(outputIndex) {
        return this.deviceOutputNames[outputIndex] || `Out ${outputIndex + 1}`;
    }
    
    setAudioDevice(deviceId) {
        this.deviceId = deviceId;
        this.updateDeviceOutputs();
    }
    
    setNumCueOutputs(numOutputs) {
        const oldNum = this.numCueOutputs;
        this.numCueOutputs = numOutputs;
        
        if (numOutputs > oldNum) {
            // Add new busses
            for (let i = oldNum; i < numOutputs; i++) {
                const bus = {
                    input: this.context.createGain(),
                    effects: null,
                    output: this.context.createGain(),
                    meter: null,
                    muted: false,
                    soloed: false
                };
                bus.input.connect(bus.output);
                this.cueOutputBusses.set(i, bus);
                this.cueOutputNames.push(`${i + 1}`);
            }
        } else if (numOutputs < oldNum) {
            // Remove busses
            for (let i = numOutputs; i < oldNum; i++) {
                const bus = this.cueOutputBusses.get(i);
                if (bus) {
                    bus.input.disconnect();
                    bus.output.disconnect();
                    if (bus.effects) bus.effects.disconnect();
                }
                this.cueOutputBusses.delete(i);
            }
            this.cueOutputNames.splice(numOutputs);
        }
        
        // Recreate matrix with new dimensions
        this.patchMatrix = new MatrixMixer(this.numCueOutputs, this.numDeviceOutputs, `${this.name} Patch`);
        this.updateMatrixRouting();
    }
    
    getActiveRouteCount() {
        let count = 0;
        for (let i = 0; i < this.numCueOutputs; i++) {
            for (let o = 0; o < this.numDeviceOutputs; o++) {
                if (this.patchMatrix.calculateGain(i, o) > 0) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // Configuration Management
    
    getConfiguration() {
        return {
            name: this.name,
            deviceId: this.deviceId,
            numCueOutputs: this.numCueOutputs,
            cueOutputNames: [...this.cueOutputNames],
            patchMatrixState: this.patchMatrix.getState(),
            effects: Array.from(this.cueOutputEffects.entries()).map(([outputId, effects]) => ({
                outputId: outputId,
                effects: effects.map(e => ({
                    name: e.name,
                    type: e.constructor.name
                }))
            }))
        };
    }
    
    loadConfiguration(config) {
        this.name = config.name || this.name;
        if (config.deviceId !== this.deviceId) {
            this.setAudioDevice(config.deviceId);
        }
        if (config.numCueOutputs !== this.numCueOutputs) {
            this.setNumCueOutputs(config.numCueOutputs);
        }
        if (config.cueOutputNames) {
            this.cueOutputNames = [...config.cueOutputNames];
        }
        if (config.patchMatrixState) {
            this.patchMatrix.setState(config.patchMatrixState);
            this.updateMatrixRouting();
        }
    }
    
    destroy() {
        // Clean up all audio nodes
        this.cueOutputBusses.forEach(bus => {
            bus.input.disconnect();
            bus.output.disconnect();
            if (bus.effects) bus.effects.disconnect();
        });
        
        this.deviceOutputNodes.forEach(node => {
            node.disconnect();
        });
        
        this.cueOutputBusses.clear();
        this.deviceOutputNodes = [];
        
        console.log(`Audio Output Patch "${this.name}" destroyed`);
    }
}

// Export only AudioOutputPatch (AudioPatchManager is in separate file)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioOutputPatch;
} else {
    window.AudioOutputPatch = AudioOutputPatch;
}
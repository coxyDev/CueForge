/**
 * Enhanced Audio Cue with Professional Matrix Routing
 * Implements QLab-style two-stage audio routing
 */

class AudioCueEnhanced {
    constructor(id, audioEngine, filePath = null) {
        this.id = id;
        this.audioEngine = audioEngine;
        this.audioContext = audioEngine.audioContext;
        
        // Audio file properties
        this.filePath = filePath;
        this.audioBuffer = null;
        this.numChannels = 0;
        this.sampleRate = 44100;
        this.duration = 0;
        this.isLoaded = false;
        
        // Cue matrix mixer: routes file channels to cue outputs
        this.cueMatrix = null; // Will be created when file loads
        
        // Output patch assignment
        this.outputPatch = null;
        this.assignDefaultOutputPatch();
        
        // Playback state
        this.sourceNode = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        
        // Audio nodes for routing
        this.inputSplitter = null;
        this.outputNodes = new Map(); // cueOutputId -> GainNode
        
        // Settings
        this.volume = 1.0; // Master volume
        this.loop = false;
        this.playbackRate = 1.0;
        
        // Trim (post-fader) levels
        this.trimLevels = new Map(); // cueOutputId -> dB
        
        // Load file if provided
        if (filePath) {
            this.loadAudioFile(filePath);
        }
    }
    
    assignDefaultOutputPatch() {
        // Assign the default output patch
        if (this.audioEngine.patchManager) {
            this.outputPatch = this.audioEngine.patchManager.getDefaultPatch();
        }
    }
    
    setOutputPatch(patch) {
        if (this.isPlaying) {
            console.warn('Cannot change output patch while playing');
            return false;
        }
        
        this.outputPatch = patch;
        this.reconnectOutputs();
        return true;
    }
    
    async loadAudioFile(filePath) {
        if (!filePath) {
            console.error('No file path provided');
            return false;
        }
        
        try {
            console.log(`Loading audio file: ${filePath}`);
            this.filePath = filePath;
            
            // Convert file path to URL
            const fileUrl = this.audioEngine.getFileUrl(filePath);
            
            // Fetch the audio file
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to load audio file: ${response.statusText}`);
            }
            
            // Get array buffer
            const arrayBuffer = await response.arrayBuffer();
            
            // Decode audio data
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.numChannels = this.audioBuffer.numberOfChannels;
            this.sampleRate = this.audioBuffer.sampleRate;
            this.duration = this.audioBuffer.duration;
            this.isLoaded = true;
            
            // Create cue matrix based on file channels
            const numCueOutputs = this.outputPatch ? this.outputPatch.numCueOutputs : 64;
            this.cueMatrix = new MatrixMixer(this.numChannels, numCueOutputs, `Cue ${this.id}`);
            
            // Set default routing
            this.setDefaultCueRouting();
            
            // Initialize audio graph
            this.initializeAudioGraph();
            
            console.log(`✅ Audio loaded: ${filePath} (${this.numChannels}ch, ${this.duration.toFixed(2)}s)`);
            return true;
            
        } catch (error) {
            console.error('Failed to load audio file:', error);
            this.isLoaded = false;
            throw error;
        }
    }
    
    setDefaultCueRouting() {
        if (!this.cueMatrix) return;
        
        // Clear all routing first
        this.cueMatrix.setSilent();
        
        // Default routing based on channel count
        if (this.numChannels === 1) {
            // Mono: route to outputs 1 & 2
            this.cueMatrix.setCrosspoint(0, 0, 0); // Ch1 -> Out1
            this.cueMatrix.setCrosspoint(0, 1, 0); // Ch1 -> Out2
        } else if (this.numChannels === 2) {
            // Stereo: 1:1 routing
            this.cueMatrix.setCrosspoint(0, 0, 0); // L -> Out1
            this.cueMatrix.setCrosspoint(1, 1, 0); // R -> Out2
        } else {
            // Multi-channel: 1:1 for as many as possible
            for (let i = 0; i < this.numChannels && i < this.cueMatrix.numOutputs; i++) {
                this.cueMatrix.setCrosspoint(i, i, 0);
            }
        }
    }
    
    initializeAudioGraph() {
        if (!this.isLoaded || !this.outputPatch) return;
        
        // Create splitter for input channels
        this.inputSplitter = this.audioContext.createChannelSplitter(this.numChannels);
        
        // Create output nodes for each cue output that's being used
        this.outputNodes.clear();
        const activeRoutes = this.cueMatrix.getActiveRoutes();
        const usedOutputs = new Set(activeRoutes.map(r => r.output));
        
        usedOutputs.forEach(outputId => {
            const gainNode = this.audioContext.createGain();
            this.outputNodes.set(outputId, gainNode);
        });
        
        this.reconnectOutputs();
    }
    
    reconnectOutputs() {
        if (!this.outputPatch) return;
        
        // Connect cue outputs to patch cue inputs
        this.outputNodes.forEach((gainNode, cueOutputId) => {
            const patchBus = this.outputPatch.getCueOutputBus(cueOutputId);
            if (patchBus) {
                try {
                    gainNode.disconnect();
                } catch (e) {}
                
                gainNode.connect(patchBus.input);
            }
        });
    }
    
    async play() {
        if (!this.isLoaded || !this.audioBuffer) {
            console.error('Audio not loaded');
            return false;
        }
        
        if (this.isPlaying && !this.isPaused) {
            console.log('Already playing');
            return true;
        }
        
        try {
            // Ensure audio context is running
            await this.audioEngine.ensureAudioContext();
            
            // Create new source node
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = this.audioBuffer;
            this.sourceNode.loop = this.loop;
            this.sourceNode.playbackRate.value = this.playbackRate;
            
            // Connect to splitter
            this.sourceNode.connect(this.inputSplitter);
            
            // Route audio based on cue matrix
            this.updateAudioRouting();
            
            // Set up ended handler
            this.sourceNode.onended = () => {
                if (this.isPlaying && !this.loop) {
                    this.stop();
                }
            };
            
            // Calculate start offset for resume
            const offset = this.isPaused ? this.pauseTime : 0;
            
            // Start playback
            this.sourceNode.start(0, offset);
            this.startTime = this.audioContext.currentTime - offset;
            this.isPlaying = true;
            this.isPaused = false;
            
            console.log(`▶️ Playing audio cue: ${this.id}`);
            return true;
            
        } catch (error) {
            console.error('Failed to play audio:', error);
            return false;
        }
    }
    
    updateAudioRouting() {
        if (!this.inputSplitter || !this.cueMatrix) return;
        
        // Clear existing connections from splitter
        for (let i = 0; i < this.numChannels; i++) {
            try {
                this.inputSplitter.disconnect(i);
            } catch (e) {}
        }
        
        // Create routing based on cue matrix
        const activeRoutes = this.cueMatrix.getActiveRoutes();
        
        activeRoutes.forEach(route => {
            const inputChannel = route.input;
            const cueOutput = route.output;
            const gain = route.gain;
            
            // Get or create output node
            if (!this.outputNodes.has(cueOutput)) {
                const gainNode = this.audioContext.createGain();
                this.outputNodes.set(cueOutput, gainNode);
                
                // Connect to patch
                const patchBus = this.outputPatch?.getCueOutputBus(cueOutput);
                if (patchBus) {
                    gainNode.connect(patchBus.input);
                }
            }
            
            const outputNode = this.outputNodes.get(cueOutput);
            
            // Create gain node for this route
            const routeGain = this.audioContext.createGain();
            routeGain.gain.value = gain * this.volume;
            
            // Apply trim if set
            const trimDb = this.trimLevels.get(cueOutput) || 0;
            if (trimDb !== 0) {
                routeGain.gain.value *= this.cueMatrix.dbToGain(trimDb);
            }
            
            // Connect: splitter[input] -> routeGain -> outputNode
            this.inputSplitter.connect(routeGain, inputChannel);
            routeGain.connect(outputNode);
        });
    }
    
    pause() {
        if (!this.isPlaying || this.isPaused) return;
        
        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.stop(false); // Don't reset pause time
        this.isPaused = true;
        
        console.log(`⏸️ Paused audio cue: ${this.id}`);
    }
    
    resume() {
        if (!this.isPaused) return;
        this.play();
    }
    
    stop(resetTime = true) {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
                this.sourceNode.disconnect();
            } catch (e) {
                // Already stopped
            }
            this.sourceNode = null;
        }
        
        // Disconnect routing
        if (this.inputSplitter) {
            try {
                this.inputSplitter.disconnect();
            } catch (e) {}
        }
        
        this.isPlaying = false;
        if (resetTime) {
            this.isPaused = false;
            this.pauseTime = 0;
        }
        
        console.log(`⏹️ Stopped audio cue: ${this.id}`);
    }
    
    seek(time) {
        const wasPlaying = this.isPlaying && !this.isPaused;
        
        if (wasPlaying) {
            this.stop(false);
        }
        
        this.pauseTime = Math.max(0, Math.min(time, this.duration));
        
        if (wasPlaying) {
            this.play();
        }
    }
    
    // === Level Controls ===
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (this.isPlaying) {
            this.updateAudioRouting();
        }
    }
    
    setMainLevel(levelDb) {
        if (this.cueMatrix) {
            this.cueMatrix.setMainLevel(levelDb);
            if (this.isPlaying) {
                this.updateAudioRouting();
            }
        }
    }
    
    setInputLevel(input, levelDb) {
        if (this.cueMatrix) {
            this.cueMatrix.setInputLevel(input, levelDb);
            if (this.isPlaying) {
                this.updateAudioRouting();
            }
        }
    }
    
    setOutputLevel(output, levelDb) {
        if (this.cueMatrix) {
            this.cueMatrix.setOutputLevel(output, levelDb);
            if (this.isPlaying) {
                this.updateAudioRouting();
            }
        }
    }
    
    setCrosspoint(input, output, levelDb) {
        if (this.cueMatrix) {
            this.cueMatrix.setCrosspoint(input, output, levelDb);
            if (this.isPlaying) {
                this.updateAudioRouting();
            }
        }
    }
    
    setTrimLevel(cueOutput, levelDb) {
        this.trimLevels.set(cueOutput, levelDb);
        if (this.isPlaying) {
            this.updateAudioRouting();
        }
    }
    
    // === Playback Controls ===
    
    setPlaybackRate(rate) {
        this.playbackRate = Math.max(0.25, Math.min(4, rate));
        if (this.sourceNode) {
            this.sourceNode.playbackRate.value = this.playbackRate;
        }
    }
    
    setLoop(loop) {
        this.loop = loop;
        if (this.sourceNode) {
            this.sourceNode.loop = loop;
        }
    }
    
    // === Gang Controls ===
    
    createGang(members) {
        if (this.cueMatrix) {
            return this.cueMatrix.createGang(members);
        }
        return null;
    }
    
    // === State Management ===
    
    getCurrentTime() {
        if (this.isPlaying && !this.isPaused) {
            return this.audioContext.currentTime - this.startTime;
        }
        return this.pauseTime;
    }
    
    getDuration() {
        return this.duration;
    }
    
    getState() {
        return {
            id: this.id,
            filePath: this.filePath,
            volume: this.volume,
            loop: this.loop,
            playbackRate: this.playbackRate,
            outputPatchName: this.outputPatch?.name,
            cueMatrixState: this.cueMatrix?.getState(),
            trimLevels: Array.from(this.trimLevels.entries())
        };
    }
    
    setState(state) {
        if (state.volume !== undefined) this.volume = state.volume;
        if (state.loop !== undefined) this.loop = state.loop;
        if (state.playbackRate !== undefined) this.playbackRate = state.playbackRate;
        
        if (state.outputPatchName && this.audioEngine.patchManager) {
            const patch = this.audioEngine.patchManager.getPatch(state.outputPatchName);
            if (patch) this.setOutputPatch(patch);
        }
        
        if (state.cueMatrixState && this.cueMatrix) {
            this.cueMatrix.setState(state.cueMatrixState);
        }
        
        if (state.trimLevels) {
            this.trimLevels = new Map(state.trimLevels);
        }
    }
    
    // === Cleanup ===
    
    destroy() {
        this.stop();
        
        this.outputNodes.forEach(node => {
            try {
                node.disconnect();
            } catch (e) {}
        });
        
        this.outputNodes.clear();
        this.audioBuffer = null;
        this.isLoaded = false;
    }
}

// Export for use
window.AudioCueEnhanced = AudioCueEnhanced;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioCueEnhanced;
}
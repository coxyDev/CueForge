/**
 * Audio Cue Class
 * Handles audio file playback and controls for individual cues
 */

class AudioCue {
    constructor(id, audioEngine, filePath = null) {
        this.id = id;
        this.audioEngine = audioEngine;
        this.audioContext = audioEngine.audioContext;
        
        // Audio nodes
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.panNode = null;
        
        // State
        this.filePath = filePath;
        this.isPlaying = false;
        this.isPaused = false;
        this.isLoaded = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.currentTime = 0;
        
        // Settings
        this.volume = 1.0;
        this.pan = 0;
        this.loop = false;
        this.playbackRate = 1.0;
        
        // Effects chain connection point
        this.effectsChain = null;
        
        // Initialize nodes
        this.initializeNodes();
        
        // Load file if provided
        if (filePath) {
            this.loadAudioFile(filePath);
        }
    }
    
    initializeNodes() {
        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        
        // Create stereo panner for pan control
        if (this.audioContext.createStereoPanner) {
            this.panNode = this.audioContext.createStereoPanner();
            this.panNode.pan.value = this.pan;
        } else {
            // Fallback for older browsers
            this.panNode = this.audioContext.createPanner();
            this.panNode.panningModel = 'equalpower';
            this.setPannerPosition(this.pan);
        }
        
        // Connect nodes: source -> gain -> pan -> destination
        this.gainNode.connect(this.panNode);
        
        // Connect to effects chain if available, otherwise to engine output
        const destination = this.effectsChain?.inputNode || this.audioEngine.getOutputNode();
        this.panNode.connect(destination);
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
            this.isLoaded = true;
            
            console.log(`✅ Audio loaded: ${filePath} (${this.audioBuffer.duration.toFixed(2)}s)`);
            return true;
            
        } catch (error) {
            console.error('Failed to load audio file:', error);
            this.isLoaded = false;
            throw error;
        }
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
            
            // Connect source to gain
            this.sourceNode.connect(this.gainNode);
            
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
        
        this.isPlaying = false;
        if (resetTime) {
            this.isPaused = false;
            this.pauseTime = 0;
            this.currentTime = 0;
        }
        
        console.log(`⏹️ Stopped audio cue: ${this.id}`);
    }
    
    seek(time) {
        const wasPlaying = this.isPlaying && !this.isPaused;
        
        if (wasPlaying) {
            this.stop(false);
        }
        
        this.pauseTime = Math.max(0, Math.min(time, this.getDuration()));
        
        if (wasPlaying) {
            this.play();
        }
    }
    
    getCurrentTime() {
        if (this.isPlaying && !this.isPaused) {
            return this.audioContext.currentTime - this.startTime;
        }
        return this.pauseTime;
    }
    
    getDuration() {
        return this.audioBuffer ? this.audioBuffer.duration : 0;
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }
    
    setPan(pan) {
        this.pan = Math.max(-1, Math.min(1, pan));
        
        if (this.panNode) {
            if (this.panNode.pan) {
                this.panNode.pan.value = this.pan;
            } else {
                this.setPannerPosition(this.pan);
            }
        }
    }
    
    setPannerPosition(pan) {
        // Convert pan (-1 to 1) to 3D position
        const x = pan;
        const y = 0;
        const z = 1 - Math.abs(pan);
        this.panNode.setPosition(x, y, z);
    }
    
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
    
    // Connect to effects chain
    connectEffectsChain(effectsChain) {
        this.effectsChain = effectsChain;
        
        // Reconnect audio path
        this.panNode.disconnect();
        this.panNode.connect(effectsChain.inputNode);
        effectsChain.connect(this.audioEngine.getOutputNode());
    }
    
    // Release resources
    destroy() {
        this.stop();
        
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        
        if (this.panNode) {
            this.panNode.disconnect();
        }
        
        this.audioBuffer = null;
        this.isLoaded = false;
    }
    
    // For compatibility with memory monitor
    releaseBuffer() {
        if (!this.isPlaying) {
            this.audioBuffer = null;
            this.isLoaded = false;
            console.log(`Released audio buffer for cue: ${this.id}`);
        }
    }
}

// Export for use
window.AudioCue = AudioCue;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioCue;
}
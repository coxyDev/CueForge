class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeSounds = new Map(); // cueId -> audio data
        this.initialized = false;
        
        this.initializeAudioContext();
    }

    async initializeAudioContext() {
        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            
            // Handle suspend/resume for browser policies
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.initialized = true;
            console.log('Audio engine initialized');
        } catch (error) {
            console.error('Failed to initialize audio engine:', error);
        }
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

    async loadAudioFile(filePath) {
        try {
            // Convert Windows paths and handle file:// protocol
            const normalizedPath = filePath.replace(/\\/g, '/');
            const fileUrl = normalizedPath.startsWith('file://') ? 
                normalizedPath : 
                `file:///${normalizedPath.replace(/^([A-Z]):/, '$1')}`;
            
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            return audioBuffer;
        } catch (error) {
            console.error('Failed to load audio file:', error);
            throw new Error(`Could not load audio file: ${error.message}`);
        }
    }

    async playCue(cue, onComplete, onError) {
        try {
            await this.ensureAudioContext();
            
            if (!cue.filePath) {
                throw new Error('No audio file specified');
            }

            // Load the audio file
            const audioBuffer = await this.loadAudioFile(cue.filePath);
            
            // Create audio source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = cue.volume || 1.0;
            
            // Connect nodes
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // Apply fade-in if specified
            if (cue.fadeIn > 0) {
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(
                    cue.volume || 1.0, 
                    this.audioContext.currentTime + (cue.fadeIn / 1000)
                );
            }
            
            // Calculate start and end times
            const startTime = (cue.startTime || 0) / 1000;
            const duration = cue.endTime ? 
                (cue.endTime - (cue.startTime || 0)) / 1000 : 
                audioBuffer.duration - startTime;
            
            // Apply fade-out if specified
            if (cue.fadeOut > 0) {
                const fadeOutStart = this.audioContext.currentTime + duration - (cue.fadeOut / 1000);
                gainNode.gain.setValueAtTime(cue.volume || 1.0, fadeOutStart);
                gainNode.gain.linearRampToValueAtTime(0, fadeOutStart + (cue.fadeOut / 1000));
            }
            
            // Handle completion
            let completed = false;
            const handleEnd = () => {
                if (!completed) {
                    completed = true;
                    this.activeSounds.delete(cue.id);
                    if (onComplete) onComplete();
                }
            };
            
            source.onended = handleEnd;
            
            // Store reference for potential stopping
            this.activeSounds.set(cue.id, {
                source,
                gainNode,
                startTime: this.audioContext.currentTime,
                duration,
                onComplete: handleEnd
            });
            
            // Start playback
            if (cue.loop) {
                source.loop = true;
            }
            
            source.start(0, startTime, cue.loop ? undefined : duration);
            
            // If not looping, set up automatic completion
            if (!cue.loop) {
                setTimeout(() => {
                    handleEnd();
                }, duration * 1000);
            }
            
        } catch (error) {
            console.error('Audio playback error:', error);
            if (onError) onError(error);
        }
    }

    stopCue(cueId) {
        const audioData = this.activeSounds.get(cueId);
        if (audioData) {
            try {
                audioData.source.stop();
                audioData.onComplete();
            } catch (error) {
                // Source might already be stopped
                console.warn('Error stopping audio cue:', error);
            }
        }
    }

    pauseCue(cueId) {
        // Web Audio API doesn't have native pause/resume for BufferSources
        // This would require more complex implementation with real-time position tracking
        console.warn('Pause/resume not yet implemented for individual cues');
    }

    stopAllCues() {
        for (const [cueId, audioData] of this.activeSounds) {
            try {
                audioData.source.stop();
            } catch (error) {
                console.warn('Error stopping cue:', cueId, error);
            }
        }
        this.activeSounds.clear();
    }

    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    getMasterVolume() {
        return this.masterGain ? this.masterGain.gain.value : 1.0;
    }

    isPlaying(cueId) {
        return this.activeSounds.has(cueId);
    }

    getActiveCues() {
        return Array.from(this.activeSounds.keys());
    }

    // Get audio file metadata (duration, etc.)
    async getAudioFileInfo(filePath) {
        try {
            const audioBuffer = await this.loadAudioFile(filePath);
            return {
                duration: audioBuffer.duration * 1000, // Convert to milliseconds
                sampleRate: audioBuffer.sampleRate,
                channels: audioBuffer.numberOfChannels,
                length: audioBuffer.length
            };
        } catch (error) {
            console.error('Failed to get audio file info:', error);
            
            // Fallback using HTML5 audio element
            try {
                return await this.getAudioFileInfoViaElement(filePath);
            } catch (fallbackError) {
                return null;
            }
        }
    }

    async getAudioFileInfoViaElement(filePath) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            audio.addEventListener('loadedmetadata', () => {
                resolve({
                    duration: audio.duration * 1000,
                    sampleRate: 44100, // Assume standard rate
                    channels: 2, // Assume stereo
                    length: audio.duration * 44100
                });
            });
            
            audio.addEventListener('error', (e) => {
                reject(new Error(`Could not load metadata: ${e.message || 'Unknown error'}`));
            });
            
            // Convert Windows path
            const normalizedPath = filePath.replace(/\\/g, '/');
            audio.src = normalizedPath.startsWith('file://') ? 
                normalizedPath : 
                `file:///${normalizedPath}`;
        });
    }

    // Analyze audio file for waveform display (basic implementation)
    async analyzeAudioFile(filePath, resolution = 1000) {
        try {
            const audioBuffer = await this.loadAudioFile(filePath);
            const channelData = audioBuffer.getChannelData(0); // Use first channel
            const blockSize = Math.floor(channelData.length / resolution);
            const peaks = [];
            
            for (let i = 0; i < resolution; i++) {
                const start = i * blockSize;
                const end = Math.min(start + blockSize, channelData.length);
                let max = 0;
                
                for (let j = start; j < end; j++) {
                    const value = Math.abs(channelData[j]);
                    if (value > max) max = value;
                }
                
                peaks.push(max);
            }
            
            return peaks;
        } catch (error) {
            console.error('Failed to analyze audio file:', error);
            return null;
        }
    }

    // Windows-specific audio device management
    async getAudioDevices() {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                return devices.filter(device => device.kind === 'audiooutput');
            }
            return [];
        } catch (error) {
            console.error('Failed to enumerate audio devices:', error);
            return [];
        }
    }

    // Set audio output device (Chrome/Edge support)
    async setAudioOutputDevice(deviceId) {
        try {
            if (this.audioContext.setSinkId) {
                await this.audioContext.setSinkId(deviceId);
                console.log(`Audio output set to device: ${deviceId}`);
                return true;
            } else {
                console.warn('setSinkId not supported in this browser');
                return false;
            }
        } catch (error) {
            console.error('Failed to set audio output device:', error);
            return false;
        }
    }

    // Get supported audio formats
    getSupportedAudioFormats() {
        const audio = new Audio();
        const formats = [];
        
        const testFormats = [
            { type: 'audio/mpeg', ext: 'mp3' },
            { type: 'audio/wav', ext: 'wav' },
            { type: 'audio/ogg', ext: 'ogg' },
            { type: 'audio/aac', ext: 'aac' },
            { type: 'audio/flac', ext: 'flac' },
            { type: 'audio/mp4', ext: 'm4a' },
            { type: 'audio/x-ms-wma', ext: 'wma' }
        ];
        
        testFormats.forEach(format => {
            const canPlay = audio.canPlayType(format.type);
            if (canPlay === 'probably' || canPlay === 'maybe') {
                formats.push(format);
            }
        });
        
        return formats;
    }

    // Cleanup method
    destroy() {
        this.stopAllCues();
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioEngine;
} else {
    window.AudioEngine = AudioEngine;
}
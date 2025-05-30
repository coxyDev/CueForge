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
        // This method is no longer used for playback, but kept for compatibility
        console.warn('loadAudioFile called - this method is deprecated in favor of direct HTML5 audio');
        throw new Error('Use HTML5 Audio directly instead of loadAudioFile');
    }

    async loadAudioFileViaElement(fileUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            audio.addEventListener('canplaythrough', async () => {
                try {
                    // Create an AudioBuffer from the HTML audio element
                    // This is a simplified approach for basic functionality
                    const duration = audio.duration;
                    const sampleRate = this.audioContext.sampleRate;
                    const arrayBuffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate);
                    
                    console.log(`Audio loaded: ${duration}s, ${sampleRate}Hz`);
                    resolve(arrayBuffer);
                } catch (error) {
                    reject(error);
                }
            });
            
            audio.addEventListener('error', (e) => {
                const errorMsg = `Audio loading error: ${audio.error?.message || 'Unknown error'}`;
                console.error(errorMsg, e);
                reject(new Error(errorMsg));
            });
            
            // Set the source
            audio.src = fileUrl;
            audio.load(); // Explicitly load the audio
        });
    }

    async playCue(cue, onComplete, onError) {
        try {
            await this.ensureAudioContext();
            
            if (!cue.filePath) {
                throw new Error('No audio file specified');
            }

            console.log(`Playing audio cue: ${cue.name}`);
            console.log(`File path: ${cue.filePath}`);

            // Use HTML5 Audio element directly - much simpler!
            const audio = new Audio();
            
            // Set the source directly - let the browser handle the file path
            audio.src = cue.filePath;
            audio.volume = cue.volume || 1.0;
            audio.loop = cue.loop || false;
            
            console.log(`Audio src set to: ${audio.src}`);
            
            // Handle start time
            if (cue.startTime > 0) {
                audio.addEventListener('loadeddata', () => {
                    audio.currentTime = cue.startTime / 1000;
                });
            }
            
            // Handle completion
            let completed = false;
            const handleEnd = () => {
                if (!completed) {
                    completed = true;
                    this.activeSounds.delete(cue.id);
                    console.log(`Audio cue completed: ${cue.name}`);
                    if (onComplete) onComplete();
                }
            };
            
            audio.addEventListener('ended', handleEnd);
            
            audio.addEventListener('error', (e) => {
                const errorMsg = `Audio playback failed for: ${cue.name}`;
                console.error(errorMsg, e);
                console.error('Audio error details:', audio.error);
                if (onError) onError(new Error(errorMsg));
            });
            
            audio.addEventListener('canplay', () => {
                console.log(`Audio ready to play: ${cue.name}`);
            });
            
            // Handle end time
            if (cue.endTime) {
                audio.addEventListener('timeupdate', () => {
                    if (audio.currentTime >= (cue.endTime / 1000)) {
                        audio.pause();
                        handleEnd();
                    }
                });
            }
            
            // Store reference for potential stopping
            this.activeSounds.set(cue.id, {
                audio: audio,
                onComplete: handleEnd
            });
            
            // Start playback
            try {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }
                console.log(`Audio playback started successfully: ${cue.name}`);
            } catch (playError) {
                console.error('Audio play() failed:', playError);
                if (onError) onError(playError);
            }
            
        } catch (error) {
            console.error('Audio cue execution error:', error);
            if (onError) onError(error);
        }
    }

    stopCue(cueId) {
        const audioData = this.activeSounds.get(cueId);
        if (audioData) {
            try {
                if (audioData.audio) {
                    // HTML5 Audio element
                    audioData.audio.pause();
                    audioData.audio.currentTime = 0;
                } else if (audioData.source) {
                    // Web Audio API source
                    audioData.source.stop();
                }
                audioData.onComplete();
            } catch (error) {
                console.warn('Error stopping audio cue:', error);
            }
        }
    }

    stopAllCues() {
        for (const [cueId, audioData] of this.activeSounds) {
            try {
                if (audioData.audio) {
                    audioData.audio.pause();
                    audioData.audio.currentTime = 0;
                } else if (audioData.source) {
                    audioData.source.stop();
                }
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
            console.log('Getting audio file info for:', filePath);
            
            // Fix the file path for Windows
            let fileUrl = filePath;
            
            // If it's already a file:// URL, use it as-is
            if (!fileUrl.startsWith('file://')) {
                // Convert Windows path to proper file URL
                fileUrl = fileUrl.replace(/\\/g, '/');
                
                // Ensure it starts with file:// and has proper drive format
                if (fileUrl.match(/^[A-Z]:/)) {
                    fileUrl = `file:///${fileUrl}`;
                } else {
                    fileUrl = `file://${fileUrl}`;
                }
            }
            
            console.log('Getting metadata for URL:', fileUrl);
            return await this.getAudioFileInfoViaElement(fileUrl);
        } catch (error) {
            console.error('Failed to get audio file info:', error);
            return null;
        }
    }

    async getAudioFileInfoViaElement(fileUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            audio.addEventListener('loadedmetadata', () => {
                console.log(`Audio metadata loaded: ${audio.duration}s`);
                resolve({
                    duration: audio.duration * 1000, // Convert to milliseconds
                    sampleRate: 44100, // Assume standard rate
                    channels: 2, // Assume stereo
                    length: audio.duration * 44100
                });
            });
            
            audio.addEventListener('error', (e) => {
                const errorMsg = `Could not load metadata: ${audio.error?.message || 'Unknown error'}`;
                console.error(errorMsg);
                reject(new Error(errorMsg));
            });
            
            // Set source and load
            audio.src = fileUrl;
            audio.load();
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
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

    // Convert file path to proper URL format
    getFileUrl(filePath) {
        if (!filePath) return null;
        
        // If it's already a proper URL, return it
        if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
            return filePath;
        }
        
        // Handle file:// URLs
        if (filePath.startsWith('file://')) {
            return filePath;
        }
        
        // Convert Windows/Unix paths to file:// URLs
        let normalizedPath = filePath.replace(/\\/g, '/');
        
        // For Windows drive letters (C:, D:, etc.)
        if (normalizedPath.match(/^[A-Z]:/i)) {
            return `file:///${normalizedPath}`;
        }
        
        // For Unix-style absolute paths
        if (normalizedPath.startsWith('/')) {
            return `file://${normalizedPath}`;
        }
        
        // For relative paths, assume they're relative to the app
        return `file://${normalizedPath}`;
    }

    async playCue(cue, onComplete, onError) {
        try {
            await this.ensureAudioContext();
            
            if (!cue.filePath) {
                throw new Error('No audio file specified');
            }

            console.log(`Playing audio cue: ${cue.name}`);
            console.log(`File path: ${cue.filePath}`);

            // Get proper file URL
            const audioUrl = this.getFileUrl(cue.filePath);
            console.log(`Audio URL: ${audioUrl}`);

            // Use HTML5 Audio element
            const audio = new Audio();
            
            // Set properties before setting src
            audio.volume = Math.max(0, Math.min(1, cue.volume || 1.0));
            audio.loop = cue.loop || false;
            audio.preload = 'auto';
            
            // Handle start time
            if (cue.startTime > 0) {
                audio.addEventListener('loadeddata', () => {
                    audio.currentTime = cue.startTime / 1000;
                }, { once: true });
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
            
            audio.addEventListener('ended', handleEnd, { once: true });
            
            audio.addEventListener('error', (e) => {
                const errorMsg = `Audio playback failed for: ${cue.name} - ${audio.error?.message || 'Unknown error'}`;
                console.error(errorMsg, e);
                console.error('Audio error details:', audio.error);
                if (onError) onError(new Error(errorMsg));
            });
            
            audio.addEventListener('canplay', () => {
                console.log(`Audio ready to play: ${cue.name}`);
            }, { once: true });
            
            audio.addEventListener('loadstart', () => {
                console.log(`Audio loading started: ${cue.name}`);
            });
            
            // Handle end time
            if (cue.endTime && cue.endTime > 0) {
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
            
            // Set the source and load
            audio.src = audioUrl;
            audio.load();
            
            // Start playback
            try {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }
                console.log(`Audio playback started successfully: ${cue.name}`);
            } catch (playError) {
                console.error('Audio play() failed:', playError);
                // Remove from active sounds on failure
                this.activeSounds.delete(cue.id);
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
                    audioData.audio.pause();
                    audioData.audio.currentTime = 0;
                }
                audioData.onComplete();
            } catch (error) {
                console.warn('Error stopping audio cue:', error);
            }
        }
    }

    stopAllCues() {
        console.log('Stopping all audio cues');
        for (const [cueId, audioData] of this.activeSounds) {
            try {
                if (audioData.audio) {
                    audioData.audio.pause();
                    audioData.audio.currentTime = 0;
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
        const audioData = this.activeSounds.get(cueId);
        return audioData && audioData.audio && !audioData.audio.paused;
    }

    getActiveCues() {
        return Array.from(this.activeSounds.keys());
    }

    // Get audio file metadata (duration, etc.)
    async getAudioFileInfo(filePath) {
        try {
            console.log('Getting audio file info for:', filePath);
            const fileUrl = this.getFileUrl(filePath);
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
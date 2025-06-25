class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeSounds = new Map(); // cueId -> audio data
        this.initialized = false;
        this.masterVolume = 1.0;
        
        this.initializeAudioContext();
    }

    async initializeAudioContext() {
        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.masterVolume;
            
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
            
            // Calculate final volume (cue volume * master volume)
            const finalVolume = Math.max(0, Math.min(1, (cue.volume || 1.0) * this.masterVolume));
            audio.volume = finalVolume;
            audio.loop = cue.loop || false;
            audio.preload = 'auto';
            
            // Store original cue volume for later adjustments
            const audioData = {
                audio: audio,
                cueVolume: cue.volume || 1.0,
                gainNode: null,
                onComplete: null
            };
            
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
            
            audioData.onComplete = handleEnd;
            
            // Handle video events
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
            
            // Handle fade in
            if (cue.fadeIn > 0) {
                audio.volume = 0;
                const fadeInStep = finalVolume / (cue.fadeIn / 50); // 50ms steps
                const fadeInInterval = setInterval(() => {
                    if (audio.volume < finalVolume) {
                        audio.volume = Math.min(finalVolume, audio.volume + fadeInStep);
                    } else {
                        clearInterval(fadeInInterval);
                    }
                }, 50);
                audioData.fadeInInterval = fadeInInterval;
            }
            
            // Handle fade out
            if (cue.fadeOut > 0 && cue.endTime) {
                const fadeOutStart = (cue.endTime - cue.fadeOut) / 1000;
                audio.addEventListener('timeupdate', () => {
                    if (audio.currentTime >= fadeOutStart) {
                        const fadeProgress = (audio.currentTime - fadeOutStart) / (cue.fadeOut / 1000);
                        audio.volume = Math.max(0, finalVolume * (1 - fadeProgress));
                    }
                });
            }
            
            // Store reference
            this.activeSounds.set(cue.id, audioData);
            
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

    // Set volume for a specific cue
    setCueVolume(cueId, volume) {
        const audioData = this.activeSounds.get(cueId);
        if (audioData && audioData.audio) {
            // Store the new cue volume
            audioData.cueVolume = Math.max(0, Math.min(1, volume));
            
            // Apply volume (cue volume * master volume)
            const finalVolume = audioData.cueVolume * this.masterVolume;
            audioData.audio.volume = finalVolume;
            
            console.log(`Set volume for cue ${cueId}: ${Math.round(audioData.cueVolume * 100)}% (final: ${Math.round(finalVolume * 100)}%)`);
            return true;
        }
        return false;
    }

    // Get volume for a specific cue
    getCueVolume(cueId) {
        const audioData = this.activeSounds.get(cueId);
        if (audioData) {
            return audioData.cueVolume;
        }
        return null;
    }

    stopCue(cueId) {
        console.log(`Stopping audio cue: ${cueId}`);
        const audioData = this.activeSounds.get(cueId);
        if (audioData) {
            try {
                if (audioData.audio) {
                    // Clear any fade intervals
                    if (audioData.fadeInInterval) {
                        clearInterval(audioData.fadeInInterval);
                    }
                    
                    // Proper stop: pause and reset to beginning
                    audioData.audio.pause();
                    audioData.audio.currentTime = 0;
                    console.log(`Audio cue ${cueId} stopped and reset to beginning`);
                }
                // Call completion handler to clean up
                audioData.onComplete();
            } catch (error) {
                console.warn('Error stopping audio cue:', error);
                // Still remove from active sounds even if stop failed
                this.activeSounds.delete(cueId);
            }
        } else {
            console.log(`Audio cue ${cueId} not found in active sounds`);
        }
    }

    pauseCue(cueId) {
        console.log(`Pausing audio cue: ${cueId}`);
        const audioData = this.activeSounds.get(cueId);
        if (audioData && audioData.audio) {
            try {
                audioData.audio.pause();
                console.log(`Audio cue ${cueId} paused at ${audioData.audio.currentTime}s`);
            } catch (error) {
                console.warn('Error pausing audio cue:', error);
            }
        } else {
            console.log(`Audio cue ${cueId} not found in active sounds`);
        }
    }

    resumeCue(cueId) {
        console.log(`Resuming audio cue: ${cueId}`);
        const audioData = this.activeSounds.get(cueId);
        if (audioData && audioData.audio) {
            try {
                const playPromise = audioData.audio.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log(`Audio cue ${cueId} resumed from ${audioData.audio.currentTime}s`);
                    }).catch(error => {
                        console.warn('Error resuming audio cue:', error);
                    });
                }
            } catch (error) {
                console.warn('Error resuming audio cue:', error);
            }
        } else {
            console.log(`Audio cue ${cueId} not found in active sounds`);
        }
    }

    stopAllCues() {
        console.log(`Stopping all audio cues (${this.activeSounds.size} active)`);
        for (const [cueId, audioData] of this.activeSounds) {
            try {
                if (audioData.audio) {
                    // Clear any fade intervals
                    if (audioData.fadeInInterval) {
                        clearInterval(audioData.fadeInInterval);
                    }
                    
                    audioData.audio.pause();
                    audioData.audio.currentTime = 0;
                    // Set src to empty to fully stop streaming (for radio streams, etc.)
                    audioData.audio.src = '';
                    audioData.audio.load(); // Reset the audio element
                    console.log(`Audio cue ${cueId} fully stopped`);
                }
            } catch (error) {
                console.warn('Error stopping cue:', cueId, error);
            }
        }
        this.activeSounds.clear();
        console.log('All audio cues stopped and cleared');
    }

    // Master volume control
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        // Update master gain node if using Web Audio API
        if (this.masterGain) {
            this.masterGain.gain.value = this.masterVolume;
        }
        
        // Update all currently playing audio volumes
        for (const [cueId, audioData] of this.activeSounds) {
            if (audioData.audio) {
                const finalVolume = audioData.cueVolume * this.masterVolume;
                audioData.audio.volume = finalVolume;
            }
        }
        
        console.log(`Master audio volume set to: ${Math.round(this.masterVolume * 100)}%`);
    }

    getMasterVolume() {
        return this.masterVolume;
    }

    // Check if any audio is currently playing
    hasActiveCues() {
        return this.activeSounds.size > 0;
    }

    // Get detailed status of all active cues
    getPlaybackStatus() {
        const status = {};
        for (const [cueId, audioData] of this.activeSounds) {
            if (audioData.audio) {
                status[cueId] = {
                    paused: audioData.audio.paused,
                    currentTime: audioData.audio.currentTime,
                    duration: audioData.audio.duration,
                    volume: audioData.audio.volume,
                    cueVolume: audioData.cueVolume,
                    muted: audioData.audio.muted
                };
            }
        }
        return status;
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
       // Enhanced format support checking
    getSupportedAudioFormats() {
        const audio = document.createElement('audio');
        const formats = [];
        
        const testFormats = [
            { type: 'audio/mpeg', ext: 'mp3', name: 'MP3' },
            { type: 'audio/wav', ext: 'wav', name: 'WAV' },
            { type: 'audio/ogg', ext: 'ogg', name: 'OGG Vorbis' },
            { type: 'audio/aac', ext: 'aac', name: 'AAC' },
            { type: 'audio/mp4', ext: 'm4a', name: 'M4A/AAC' },
            { type: 'audio/x-m4a', ext: 'm4a', name: 'M4A (Apple)' },
            { type: 'audio/flac', ext: 'flac', name: 'FLAC' },
            { type: 'audio/webm', ext: 'webm', name: 'WebM Audio' },
            { type: 'audio/opus', ext: 'opus', name: 'Opus' },
            { type: 'audio/x-ms-wma', ext: 'wma', name: 'WMA' }
        ];
        
        testFormats.forEach(format => {
            const canPlay = audio.canPlayType(format.type);
            if (canPlay === 'probably' || canPlay === 'maybe') {
                formats.push({
                    ...format,
                    support: canPlay
                });
            }
        });
        
        console.log('Supported audio formats:', formats);
        return formats;
    }

    // Enhanced audio file loading with better error handling
    async getAudioFileInfo(filePath) {
        try {
            const audioUrl = this.getFileUrl(filePath);
            console.log(`Getting audio info for: ${filePath}`);
            console.log(`Audio URL: ${audioUrl}`);
            
            return new Promise((resolve, reject) => {
                const audio = document.createElement('audio');
                
                audio.addEventListener('loadedmetadata', () => {
                    const info = {
                        duration: audio.duration * 1000, // Convert to milliseconds
                        durationSeconds: audio.duration,
                        sampleRate: audio.sampleRate || 44100, // Fallback
                        channels: audio.mozChannels || 2, // Firefox property, fallback to stereo
                        length: Math.floor(audio.duration * 44100), // Estimated samples
                        canPlay: true,
                        format: this.detectAudioFormat(filePath)
                    };
                    
                    console.log(`Audio info loaded:`, info);
                    resolve(info);
                });
                
                audio.addEventListener('error', (e) => {
                    const errorMsg = this.getAudioErrorMessage(audio.error);
                    console.error(`Audio info loading failed: ${errorMsg}`, e);
                    
                    // Try to provide helpful error information
                    const format = this.detectAudioFormat(filePath);
                    const supportedFormats = this.getSupportedAudioFormats();
                    const isSupported = supportedFormats.some(f => f.ext === format.toLowerCase());
                    
                    if (!isSupported) {
                        reject(new Error(`Unsupported audio format: ${format}. Supported formats: ${supportedFormats.map(f => f.ext).join(', ')}`));
                    } else {
                        reject(new Error(`Audio loading failed: ${errorMsg}`));
                    }
                });
                
                audio.addEventListener('loadstart', () => {
                    console.log(`Audio loading started: ${filePath}`);
                });
                
                // Set source and load
                audio.src = audioUrl;
                audio.load();
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error('Audio loading timeout'));
                }, 10000);
            });
        } catch (error) {
            console.error('Failed to get audio file info:', error);
            throw error;
        }
    }

    detectAudioFormat(filePath) {
        const ext = filePath.split('.').pop().toLowerCase();
        return ext;
    }

    getAudioErrorMessage(error) {
        if (!error) return 'Unknown audio error';
        
        switch (error.code) {
            case 1: return 'MEDIA_ERR_ABORTED - Audio loading was aborted';
            case 2: return 'MEDIA_ERR_NETWORK - Network error occurred';
            case 3: return 'MEDIA_ERR_DECODE - Audio decoding error (codec issue)';
            case 4: return 'MEDIA_ERR_SRC_NOT_SUPPORTED - Audio format not supported';
            default: return `Unknown error code: ${error.code}`;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioEngine;
} else {
    window.AudioEngine = AudioEngine;
}
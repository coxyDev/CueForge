class VideoEngine {
    constructor() {
        this.activeVideos = new Map(); // cueId -> video data
        this.videoPreview = null;
        this.fullscreenVideo = null;
        this.initialized = false;
        this.masterVolume = 1.0;
        
        this.initializeVideoEngine();
    }

    initializeVideoEngine() {
        try {
            // Get video preview element
            this.videoPreview = document.getElementById('video-preview');
            
            // Set up fullscreen handling
            this.setupFullscreenHandling();
            
            this.initialized = true;
            console.log('Video engine initialized');
        } catch (error) {
            console.error('Failed to initialize video engine:', error);
        }
    }

    setupFullscreenHandling() {
        // Handle fullscreen changes
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && this.fullscreenVideo) {
                this.exitFullscreen();
            }
        });

        // Set up fullscreen button
        const fullscreenBtn = document.getElementById('video-fullscreen');
        const closeBtn = document.getElementById('video-close');

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideVideoPreview();
            });
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

    async loadVideoFile(filePath) {
        try {
            return this.getFileUrl(filePath);
        } catch (error) {
            console.error('Failed to load video file:', error);
            throw new Error(`Could not load video file: ${error.message}`);
        }
    }

    async playCue(cue, onComplete, onError) {
        try {
            if (!cue.filePath) {
                throw new Error('No video file specified');
            }

            console.log(`Playing video cue: ${cue.name}`);
            console.log(`File path: ${cue.filePath}`);

            // Load the video file
            const videoUrl = await this.loadVideoFile(cue.filePath);
            console.log(`Video URL: ${videoUrl}`);
            
            // Create video element for playback
            const video = document.createElement('video');
            video.src = videoUrl;
            
            // Calculate final volume (cue volume * master volume)
            const cueVolume = Math.max(0, Math.min(1, cue.volume || 1.0));
            const finalVolume = cueVolume * this.masterVolume;
            video.volume = finalVolume;
            
            video.loop = cue.loop || false;
            video.preload = 'auto';
            
            // Store video data with volume info
            const videoData = {
                video: video,
                cue: cue,
                cueVolume: cueVolume,
                onComplete: null
            };
            
            // Set start time
            if (cue.startTime && cue.startTime > 0) {
                video.addEventListener('loadeddata', () => {
                    video.currentTime = cue.startTime / 1000;
                }, { once: true });
            }
            
            // Handle aspect ratio
            this.setVideoAspectRatio(video, cue.aspectRatio);
            
            // Handle opacity
            video.style.opacity = cue.opacity || 1.0;
            
            // Apply fade-in if specified
            if (cue.fadeIn > 0) {
                video.style.opacity = '0';
                video.style.transition = `opacity ${cue.fadeIn}ms ease-in`;
                setTimeout(() => {
                    video.style.opacity = cue.opacity || 1.0;
                }, 10);
            }
            
            // Set up completion handling
            let completed = false;
            const handleEnd = () => {
                if (!completed) {
                    completed = true;
                    this.activeVideos.delete(cue.id);
                    if (video.parentNode) {
                        video.parentNode.removeChild(video);
                    }
                    console.log(`Video cue completed: ${cue.name}`);
                    if (onComplete) onComplete();
                }
            };
            
            videoData.onComplete = handleEnd;
            
            // Handle video events
            video.addEventListener('ended', handleEnd, { once: true });
            
            video.addEventListener('error', (e) => {
                const errorMsg = `Video playback error: ${video.error?.message || 'Unknown error'}`;
                console.error(errorMsg, e);
                console.error('Video error details:', video.error);
                if (onError) onError(new Error(errorMsg));
            });
            
            video.addEventListener('canplay', () => {
                console.log(`Video ready to play: ${cue.name}`);
            }, { once: true });

            video.addEventListener('loadstart', () => {
                console.log(`Video loading started: ${cue.name}`);
            });
            
            // Handle end time
            if (cue.endTime && cue.endTime > 0) {
                video.addEventListener('timeupdate', () => {
                    if (video.currentTime >= (cue.endTime / 1000)) {
                        video.pause();
                        handleEnd();
                    }
                });
            }
            
            // Apply fade-out if specified
            if (cue.fadeOut > 0 && cue.endTime) {
                const fadeOutStart = (cue.endTime - cue.fadeOut) / 1000;
                video.addEventListener('timeupdate', () => {
                    if (video.currentTime >= fadeOutStart) {
                        const fadeProgress = (video.currentTime - fadeOutStart) / (cue.fadeOut / 1000);
                        video.style.opacity = Math.max(0, (cue.opacity || 1.0) * (1 - fadeProgress));
                    }
                });
            }
            
            // Store reference
            this.activeVideos.set(cue.id, videoData);
            
            // Show video based on fullscreen setting
            if (cue.fullscreen) {
                await this.showFullscreenVideo(video);
            } else {
                this.showVideoInPreview(video);
            }
            
            // Load and start playback
            video.load();
            try {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }
                console.log(`Video playback started successfully: ${cue.name}`);
            } catch (playError) {
                console.error('Video play() failed:', playError);
                // Remove from active videos on failure
                this.activeVideos.delete(cue.id);
                if (onError) onError(playError);
            }
            
        } catch (error) {
            console.error('Video playback error:', error);
            if (onError) onError(error);
        }
    }

    // Set volume for a specific cue
    setCueVolume(cueId, volume) {
        const videoData = this.activeVideos.get(cueId);
        if (videoData && videoData.video) {
            // Store the new cue volume
            videoData.cueVolume = Math.max(0, Math.min(1, volume));
            
            // Apply volume (cue volume * master volume)
            const finalVolume = videoData.cueVolume * this.masterVolume;
            videoData.video.volume = finalVolume;
            
            console.log(`Set video volume for cue ${cueId}: ${Math.round(videoData.cueVolume * 100)}% (final: ${Math.round(finalVolume * 100)}%)`);
            return true;
        }
        return false;
    }

    // Get volume for a specific cue
    getCueVolume(cueId) {
        const videoData = this.activeVideos.get(cueId);
        if (videoData) {
            return videoData.cueVolume;
        }
        return null;
    }

    // Master volume control
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        // Update all currently playing video volumes
        for (const [cueId, videoData] of this.activeVideos) {
            if (videoData.video) {
                const finalVolume = videoData.cueVolume * this.masterVolume;
                videoData.video.volume = finalVolume;
            }
        }
        
        console.log(`Master video volume set to: ${Math.round(this.masterVolume * 100)}%`);
    }

    getMasterVolume() {
        return this.masterVolume;
    }

    setVideoAspectRatio(video, aspectRatio) {
        switch (aspectRatio) {
            case '16:9':
                video.style.aspectRatio = '16/9';
                video.style.objectFit = 'contain';
                break;
            case '4:3':
                video.style.aspectRatio = '4/3';
                video.style.objectFit = 'contain';
                break;
            case 'stretch':
                video.style.objectFit = 'fill';
                break;
            case 'auto':
            default:
                video.style.objectFit = 'contain';
                break;
        }
    }

    showVideoInPreview(video) {
        const previewContainer = document.querySelector('.video-preview-container');
        const videoSection = document.getElementById('video-preview-section');
        
        // Clear existing preview videos (but keep the preview element)
        const existingVideos = previewContainer.querySelectorAll('video:not(#video-preview)');
        existingVideos.forEach(v => v.remove());
        
        // Style the video for preview
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.style.borderRadius = '4px';
        video.controls = true;
        video.id = 'playing-video-preview';
        
        // Add to preview container
        previewContainer.appendChild(video);
        
        // Show video section
        videoSection.style.display = 'flex';
    }

    async showFullscreenVideo(video) {
        // Create fullscreen container
        const fullscreenContainer = document.createElement('div');
        fullscreenContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: black;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Style video for fullscreen
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.style.objectFit = 'contain';
        video.controls = true;
        
        fullscreenContainer.appendChild(video);
        document.body.appendChild(fullscreenContainer);
        
        this.fullscreenVideo = {
            container: fullscreenContainer,
            video: video
        };
        
        // Enter fullscreen mode
        try {
            await fullscreenContainer.requestFullscreen();
        } catch (error) {
            console.warn('Fullscreen not supported:', error);
        }
    }

    toggleFullscreen() {
        if (this.videoPreview && this.videoPreview.src) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                this.videoPreview.requestFullscreen().catch(console.error);
            }
        }
    }

    exitFullscreen() {
        if (this.fullscreenVideo) {
            if (this.fullscreenVideo.container.parentNode) {
                this.fullscreenVideo.container.parentNode.removeChild(this.fullscreenVideo.container);
            }
            this.fullscreenVideo = null;
        }
    }

    hideVideoPreview() {
        const videoSection = document.getElementById('video-preview-section');
        const previewContainer = document.querySelector('.video-preview-container');
        
        // Remove any playing videos in preview (but keep the preview element)
        const playingVideos = previewContainer.querySelectorAll('video:not(#video-preview)');
        playingVideos.forEach(video => {
            video.pause();
            video.remove();
        });
        
        // Reset the preview video element
        if (this.videoPreview) {
            this.videoPreview.src = '';
            this.videoPreview.load();
        }
        
        // Hide section
        videoSection.style.display = 'none';
    }

    stopCue(cueId) {
        console.log(`Stopping video cue: ${cueId}`);
        const videoData = this.activeVideos.get(cueId);
        if (videoData) {
            try {
                if (videoData.video) {
                    // Proper stop: pause and reset to beginning
                    videoData.video.pause();
                    videoData.video.currentTime = 0;
                    console.log(`Video cue ${cueId} stopped and reset to beginning`);
                }
                // Call completion handler to clean up
                videoData.onComplete();
            } catch (error) {
                console.warn('Error stopping video cue:', error);
                // Still remove from active videos even if stop failed
                this.activeVideos.delete(cueId);
            }
        } else {
            console.log(`Video cue ${cueId} not found in active videos`);
        }
    }

    pauseCue(cueId) {
        console.log(`Pausing video cue: ${cueId}`);
        const videoData = this.activeVideos.get(cueId);
        if (videoData && videoData.video) {
            try {
                videoData.video.pause();
                console.log(`Video cue ${cueId} paused at ${videoData.video.currentTime}s`);
            } catch (error) {
                console.warn('Error pausing video cue:', error);
            }
        } else {
            console.log(`Video cue ${cueId} not found in active videos`);
        }
    }

    resumeCue(cueId) {
        console.log(`Resuming video cue: ${cueId}`);
        const videoData = this.activeVideos.get(cueId);
        if (videoData && videoData.video) {
            try {
                const playPromise = videoData.video.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log(`Video cue ${cueId} resumed from ${videoData.video.currentTime}s`);
                    }).catch(error => {
                        console.warn('Error resuming video cue:', error);
                    });
                }
            } catch (error) {
                console.warn('Error resuming video cue:', error);
            }
        } else {
            console.log(`Video cue ${cueId} not found in active videos`);
        }
    }

    stopAllCues() {
        console.log(`Stopping all video cues (${this.activeVideos.size} active)`);
        for (const [cueId, videoData] of this.activeVideos) {
            try {
                if (videoData.video) {
                    videoData.video.pause();
                    videoData.video.currentTime = 0;
                    // Remove video element from DOM to fully stop
                    if (videoData.video.parentNode) {
                        videoData.video.parentNode.removeChild(videoData.video);
                    }
                    console.log(`Video cue ${cueId} fully stopped and removed`);
                }
            } catch (error) {
                console.warn('Error stopping video cue:', cueId, error);
            }
        }
        this.activeVideos.clear();
        this.hideVideoPreview();
        this.exitFullscreen();
        console.log('All video cues stopped and cleared');
    }

    // Check if any video is currently playing
    hasActiveCues() {
        return this.activeVideos.size > 0;
    }

    // Get detailed status of all active cues
    getPlaybackStatus() {
        const status = {};
        for (const [cueId, videoData] of this.activeVideos) {
            if (videoData.video) {
                status[cueId] = {
                    paused: videoData.video.paused,
                    currentTime: videoData.video.currentTime,
                    duration: videoData.video.duration,
                    volume: videoData.video.volume,
                    cueVolume: videoData.cueVolume,
                    muted: videoData.video.muted
                };
            }
        }
        return status;
    }

    isPlaying(cueId) {
        const videoData = this.activeVideos.get(cueId);
        return videoData && !videoData.video.paused;
    }

    getActiveCues() {
        return Array.from(this.activeVideos.keys());
    }

    // Get video file metadata
    async getVideoFileInfo(filePath) {
        try {
            const videoUrl = this.getFileUrl(filePath);
            
            return new Promise((resolve, reject) => {
                const video = document.createElement('video');
                
                video.addEventListener('loadedmetadata', () => {
                    resolve({
                        duration: video.duration * 1000, // Convert to milliseconds
                        width: video.videoWidth,
                        height: video.videoHeight,
                        aspectRatio: video.videoWidth / video.videoHeight
                    });
                });
                
                video.addEventListener('error', (e) => {
                    reject(new Error(`Could not load video metadata: ${video.error?.message || 'Unknown error'}`));
                });
                
                video.src = videoUrl;
                video.load();
            });
        } catch (error) {
            console.error('Failed to get video file info:', error);
            return null;
        }
    }

    // Get supported video formats
    getSupportedVideoFormats() {
        const video = document.createElement('video');
        const formats = [];
        
        const testFormats = [
            { type: 'video/mp4', ext: 'mp4' },
            { type: 'video/webm', ext: 'webm' },
            { type: 'video/ogg', ext: 'ogv' },
            { type: 'video/avi', ext: 'avi' },
            { type: 'video/quicktime', ext: 'mov' },
            { type: 'video/x-msvideo', ext: 'avi' },
            { type: 'video/x-ms-wmv', ext: 'wmv' }
        ];
        
        testFormats.forEach(format => {
            const canPlay = video.canPlayType(format.type);
            if (canPlay === 'probably' || canPlay === 'maybe') {
                formats.push(format);
            }
        });
        
        return formats;
    }

    // Preview video in inspector
    previewVideoInInspector(filePath) {
        if (this.videoPreview && filePath) {
            const videoUrl = this.getFileUrl(filePath);
            this.videoPreview.src = videoUrl;
            const videoSection = document.getElementById('video-preview-section');
            videoSection.style.display = 'flex';
        }
    }

    // Cleanup method
    destroy() {
        this.stopAllCues();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoEngine;
} else {
    window.VideoEngine = VideoEngine;
}
class VideoEngine {
    constructor() {
        this.activeVideos = new Map(); // cueId -> video data
        this.videoPreview = null;
        this.fullscreenVideo = null;
        this.initialized = false;
        
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

    async loadVideoFile(filePath) {
        try {
            // Convert Windows paths and handle file:// protocol
            const normalizedPath = filePath.replace(/\\/g, '/');
            const fileUrl = normalizedPath.startsWith('file://') ? 
                normalizedPath : 
                `file:///${normalizedPath.replace(/^([A-Z]):/, '$1')}`;
            
            return fileUrl;
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

            // Load the video file
            const videoUrl = await this.loadVideoFile(cue.filePath);
            
            // Create video element for playback
            const video = document.createElement('video');
            video.src = videoUrl;
            video.volume = cue.volume || 1.0;
            video.loop = cue.loop || false;
            
            // Set start and end times
            if (cue.startTime) {
                video.currentTime = cue.startTime / 1000;
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
                    if (onComplete) onComplete();
                }
            };
            
            // Handle video events
            video.addEventListener('ended', handleEnd);
            video.addEventListener('error', (e) => {
                if (onError) onError(new Error(`Video playback error: ${e.message || 'Unknown error'}`));
            });
            
            // Handle end time
            if (cue.endTime) {
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
            this.activeVideos.set(cue.id, {
                video,
                cue,
                onComplete: handleEnd
            });
            
            // Show video based on fullscreen setting
            if (cue.fullscreen) {
                await this.showFullscreenVideo(video);
            } else {
                this.showVideoInPreview(video);
            }
            
            // Start playback
            await video.play();
            
        } catch (error) {
            console.error('Video playback error:', error);
            if (onError) onError(error);
        }
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
        
        // Clear existing preview
        const existingVideo = previewContainer.querySelector('video:not(#video-preview)');
        if (existingVideo) {
            existingVideo.remove();
        }
        
        // Style the video for preview
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.style.borderRadius = '4px';
        video.controls = true;
        
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
        
        // Remove any playing videos in preview
        const playingVideos = previewContainer.querySelectorAll('video:not(#video-preview)');
        playingVideos.forEach(video => {
            video.pause();
            video.remove();
        });
        
        // Hide section
        videoSection.style.display = 'none';
    }

    stopCue(cueId) {
        const videoData = this.activeVideos.get(cueId);
        if (videoData) {
            try {
                videoData.video.pause();
                videoData.onComplete();
            } catch (error) {
                console.warn('Error stopping video cue:', error);
            }
        }
    }

    stopAllCues() {
        for (const [cueId, videoData] of this.activeVideos) {
            try {
                videoData.video.pause();
                if (videoData.video.parentNode) {
                    videoData.video.parentNode.removeChild(videoData.video);
                }
            } catch (error) {
                console.warn('Error stopping video cue:', cueId, error);
            }
        }
        this.activeVideos.clear();
        this.hideVideoPreview();
        this.exitFullscreen();
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
            const videoUrl = await this.loadVideoFile(filePath);
            
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
                    reject(new Error(`Could not load video metadata: ${e.message || 'Unknown error'}`));
                });
                
                video.src = videoUrl;
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
        if (this.videoPreview) {
            this.videoPreview.src = filePath;
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
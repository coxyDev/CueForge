// Main application initialization with improved error handling
class CueForgeApp {
    constructor() {
        this.cueManager = null;
        this.audioEngine = null;
        this.videoEngine = null;
        this.uiManager = null;
        this.displayManager = null;
        this.initialized = false;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing CueForge...');
            
            // Initialize core systems with error handling
            await this.initializeCoreComponents();
            
            // Initialize optional components
            await this.initializeOptionalComponents();
            
            // Set up global references
            this.setupGlobalReferences();
            
            // Initialize UI
            await this.initializeUI();
            
            // Set up error handling and cleanup
            this.setupErrorHandling();
            this.setupCleanup();
            
            // Initialize with sample data
            this.initSampleData();
            
            // Add basic playback functionality
            this.setupBasicPlayback();
            
            this.initialized = true;
            console.log('CueForge initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize CueForge:', error);
            this.showError('Failed to initialize application', error.message);
        }
    }

    async initializeCoreComponents() {
        // Initialize cue manager
        try {
            this.cueManager = new CueManager();
            console.log('✓ Cue Manager initialized');
        } catch (error) {
            throw new Error(`Failed to initialize CueManager: ${error.message}`);
        }

        // Initialize audio engine
        try {
            this.audioEngine = new AudioEngine();
            await this.waitForAudioEngine();
            console.log('✓ Audio Engine initialized');
        } catch (error) {
            console.warn('Audio Engine failed to initialize:', error.message);
            // Create a fallback audio engine
            this.audioEngine = this.createFallbackAudioEngine();
        }

        // Initialize video engine
        try {
            this.videoEngine = new VideoEngine();
            console.log('✓ Video Engine initialized');
        } catch (error) {
            console.warn('Video Engine failed to initialize:', error.message);
            // Create a fallback video engine
            this.videoEngine = this.createFallbackVideoEngine();
        }
    }

    async initializeOptionalComponents() {
        // Initialize display manager (optional)
        try {
            if (typeof DisplayManager !== 'undefined') {
                this.displayManager = new DisplayManager();
                await this.waitForDisplayManager();
                console.log('✓ Display Manager initialized');
            } else {
                console.log('ℹ Display Manager not available - using fallback');
                this.displayManager = new window.DisplayManager(); // Fallback from HTML
            }
        } catch (error) {
            console.warn('Display Manager failed to initialize:', error.message);
            this.displayManager = new window.DisplayManager(); // Fallback
        }
    }

    setupGlobalReferences() {
        // Make engines globally available
        window.audioEngine = this.audioEngine;
        window.videoEngine = this.videoEngine;
        window.displayManager = this.displayManager;
        
        console.log('✓ Global references established');
    }

    async initializeUI() {
        try {
            this.uiManager = new UIManager(this.cueManager, this.audioEngine);
            
            // Enhance audio engine with fade support
            if (this.uiManager.enhanceAudioEngineWithFades) {
                this.uiManager.enhanceAudioEngineWithFades();
            }
            
            console.log('✓ UI Manager initialized');
        } catch (error) {
            throw new Error(`Failed to initialize UI Manager: ${error.message}`);
        }
    }

    async waitForDisplayManager() {
        if (!this.displayManager) return;
        
        let attempts = 0;
        const maxAttempts = 30;
        
        while (!this.displayManager.initialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.displayManager.initialized) {
            console.warn('Display manager failed to initialize properly');
        }
    }

    async waitForAudioEngine() {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (!this.audioEngine.initialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.audioEngine.initialized) {
            console.warn('Audio engine failed to initialize properly');
        }
    }

    createFallbackAudioEngine() {
        return {
            initialized: true,
            masterVolume: 1.0,
            activeSounds: new Map(),
            
            playCue: async (cue, onComplete, onError) => {
                console.log(`Fallback: Playing audio cue ${cue.name}`);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, cue.duration || 1000);
            },
            
            stopCue: (cueId) => {
                console.log(`Fallback: Stopping audio cue ${cueId}`);
            },
            
            pauseCue: (cueId) => {
                console.log(`Fallback: Pausing audio cue ${cueId}`);
            },
            
            resumeCue: (cueId) => {
                console.log(`Fallback: Resuming audio cue ${cueId}`);
            },
            
            stopAllCues: () => {
                console.log('Fallback: Stopping all audio cues');
            },
            
            setMasterVolume: (volume) => {
                this.masterVolume = volume;
                console.log(`Fallback: Set master volume to ${Math.round(volume * 100)}%`);
            },
            
            setCueVolume: (cueId, volume) => {
                console.log(`Fallback: Set cue ${cueId} volume to ${Math.round(volume * 100)}%`);
                return true;
            },
            
            getCueVolume: (cueId) => {
                return 1.0;
            },
            
            getMasterVolume: () => {
                return this.masterVolume;
            },
            
            hasActiveCues: () => {
                return false;
            },
            
            getPlaybackStatus: () => {
                return {};
            },
            
            isPlaying: (cueId) => {
                return false;
            },
            
            getActiveCues: () => {
                return [];
            },
            
            getAudioFileInfo: async (filePath) => {
                console.log(`Fallback: Getting audio file info for ${filePath}`);
                return {
                    duration: 10000,
                    sampleRate: 44100,
                    channels: 2,
                    length: 441000
                };
            },
            
            getSupportedAudioFormats: () => {
                return [
                    { type: 'audio/mpeg', ext: 'mp3' },
                    { type: 'audio/wav', ext: 'wav' },
                    { type: 'audio/ogg', ext: 'ogg' }
                ];
            },
            
            destroy: () => {
                console.log('Fallback: Audio engine destroyed');
            }
        };
    }

    createFallbackVideoEngine() {
        return {
            initialized: true,
            masterVolume: 1.0,
            activeVideos: new Map(),
            videoPreview: null,
            
            playCue: async (cue, onComplete, onError) => {
                console.log(`Fallback: Playing video cue ${cue.name}`);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, cue.duration || 1000);
            },
            
            stopCue: (cueId) => {
                console.log(`Fallback: Stopping video cue ${cueId}`);
            },
            
            pauseCue: (cueId) => {
                console.log(`Fallback: Pausing video cue ${cueId}`);
            },
            
            resumeCue: (cueId) => {
                console.log(`Fallback: Resuming video cue ${cueId}`);
            },
            
            stopAllCues: () => {
                console.log('Fallback: Stopping all video cues');
            },
            
            setMasterVolume: (volume) => {
                this.masterVolume = volume;
                console.log(`Fallback: Set video master volume to ${Math.round(volume * 100)}%`);
            },
            
            setCueVolume: (cueId, volume) => {
                console.log(`Fallback: Set video cue ${cueId} volume to ${Math.round(volume * 100)}%`);
                return true;
            },
            
            getCueVolume: (cueId) => {
                return 1.0;
            },
            
            getMasterVolume: () => {
                return this.masterVolume;
            },
            
            hasActiveCues: () => {
                return false;
            },
            
            getPlaybackStatus: () => {
                return {};
            },
            
            isPlaying: (cueId) => {
                return false;
            },
            
            getActiveCues: () => {
                return [];
            },
            
            getVideoFileInfo: async (filePath) => {
                console.log(`Fallback: Getting video file info for ${filePath}`);
                return {
                    duration: 10000,
                    width: 1920,
                    height: 1080,
                    aspectRatio: 16/9
                };
            },
            
            getDetailedVideoInfo: async (filePath) => {
                console.log(`Fallback: Getting detailed video info for ${filePath}`);
                return {
                    duration: 10000,
                    durationSeconds: 10,
                    width: 1920,
                    height: 1080,
                    aspectRatio: 16/9,
                    frameRate: 30,
                    totalFrames: 300,
                    hasAudio: true
                };
            },
            
            getSupportedVideoFormats: () => {
                return [
                    { type: 'video/mp4', ext: 'mp4' },
                    { type: 'video/webm', ext: 'webm' },
                    { type: 'video/ogg', ext: 'ogv' }
                ];
            },
            
            previewVideoInInspector: (filePath) => {
                console.log(`Fallback: Previewing video ${filePath} in inspector`);
                const videoSection = document.getElementById('video-preview-section');
                const videoPreview = document.getElementById('video-preview');
                
                if (videoSection && videoPreview) {
                    videoPreview.src = filePath;
                    videoSection.style.display = 'flex';
                }
            },
            
            previewVideoWithTimeline: (filePath, canvas) => {
                console.log(`Fallback: Previewing video ${filePath} with timeline`);
                this.previewVideoInInspector(filePath);
                
                if (canvas && window.VideoTimeline) {
                    this.videoTimeline = new VideoTimeline(canvas);
                }
            },
            
            hideVideoPreview: () => {
                console.log('Fallback: Hiding video preview');
                const videoSection = document.getElementById('video-preview-section');
                if (videoSection) {
                    videoSection.style.display = 'none';
                }
            },
            
            initializeVideoTimeline: (video, canvas) => {
                console.log('Fallback: Initializing video timeline');
                if (canvas && window.VideoTimeline) {
                    this.videoTimeline = new VideoTimeline(canvas);
                    if (video) {
                        this.videoTimeline.setVideo(video);
                    }
                }
            },
            
            destroy: () => {
                console.log('Fallback: Video engine destroyed');
                this.hideVideoPreview();
            }
        };
    }

    setupBasicPlayback() {
        // Override the cue manager's execute methods to actually play cues
        const originalExecuteAudioCue = this.cueManager.executeAudioCue;
        const originalExecuteVideoCue = this.cueManager.executeVideoCue;
        
        this.cueManager.executeAudioCue = async (cue) => {
            console.log(`Playing audio cue: ${cue.name}`);
            return new Promise((resolve, reject) => {
                this.audioEngine.playCue(cue, resolve, reject);
            });
        };
        
        this.cueManager.executeVideoCue = async (cue) => {
            console.log(`Playing video cue: ${cue.name}`);
            
            // Use display manager if available
            if (this.displayManager && this.displayManager.getCurrentRouting() !== 'preview') {
                const success = await this.displayManager.playVideoOnOutput(cue);
                if (success) {
                    return Promise.resolve();
                }
            }
            
            // Fallback to preview window
            return new Promise((resolve, reject) => {
                this.videoEngine.playCue(cue, resolve, reject);
            });
        };
        
        console.log('✓ Basic playback functionality enabled');
    }

    initSampleData() {
        try {
            // Add some sample cues for demonstration
            this.cueManager.addCue('wait', {
                name: 'House to Half',
                duration: 3000
            });
            
            this.cueManager.addCue('audio', {
                name: 'Welcome Music',
                volume: 0.8,
                fadeIn: 2000,
                fadeOut: 1000
            });
            
            this.cueManager.addCue('video', {
                name: 'Opening Video',
                volume: 0.9,
                fadeIn: 1000,
                fullscreen: false
            });
            
            this.cueManager.addCue('wait', {
                name: 'Speaker Introduction',
                duration: 15000
            });
            
            this.cueManager.addCue('group', {
                name: 'Scene Change',
                mode: 'sequential'
            });
            
            console.log('✓ Sample cues added');
        } catch (error) {
            console.warn('Failed to add sample cues:', error);
        }
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showError('Application Error', event.error.message);
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('Promise Rejection', event.reason.toString());
        });
    }

    setupCleanup() {
        // Clean up on window close
        window.addEventListener('beforeunload', (event) => {
            if (this.cueManager && this.cueManager.unsavedChanges) {
                event.preventDefault();
                event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return event.returnValue;
            }
            
            this.cleanup();
        });
    }

    cleanup() {
        try {
            if (this.audioEngine && this.audioEngine.destroy) {
                this.audioEngine.destroy();
            }
            
            if (this.videoEngine && this.videoEngine.destroy) {
                this.videoEngine.destroy();
            }
            
            if (this.displayManager && this.displayManager.destroy) {
                this.displayManager.destroy();
            }
            
            console.log('Application cleanup completed');
        } catch (error) {
            console.warn('Error during cleanup:', error);
        }
    }

    showError(title, message) {
        // Create a simple error dialog
        const errorDialog = document.createElement('div');
        errorDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2d2d2d;
            border: 2px solid #dc3545;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            color: white;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        
        errorDialog.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #dc3545;">${title}</h3>
            <p style="margin: 0 0 15px 0; font-size: 14px;">${message}</p>
            <button id="error-close" style="
                background: #dc3545;
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                float: right;
            ">Close</button>
            <div style="clear: both;"></div>
        `;
        
        document.body.appendChild(errorDialog);
        
        document.getElementById('error-close').addEventListener('click', () => {
            document.body.removeChild(errorDialog);
        });
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (document.body.contains(errorDialog)) {
                document.body.removeChild(errorDialog);
            }
        }, 10000);
    }

    // Public API methods for debugging and external control
    getCueManager() {
        return this.cueManager;
    }

    getAudioEngine() {
        return this.audioEngine;
    }

    getVideoEngine() {
        return this.videoEngine;
    }

    getUIManager() {
        return this.uiManager;
    }

    getDisplayManager() {
        return this.displayManager;
    }

    // Development helpers
    addTestAudioCue(name = 'Test Audio') {
        return this.cueManager.addCue('audio', {
            name: name,
            volume: 0.7,
            fadeIn: 1000,
            fadeOut: 500
        });
    }

    addTestVideoCue(name = 'Test Video') {
        return this.cueManager.addCue('video', {
            name: name,
            volume: 0.8,
            fadeIn: 500,
            fadeOut: 500
        });
    }

    addTestWaitCue(duration = 5000, name = 'Test Wait') {
        return this.cueManager.addCue('wait', {
            name: name,
            duration: duration
        });
    }

    exportShow() {
        try {
            const showData = {
                name: this.cueManager.showName,
                version: '1.0',
                exported: new Date().toISOString(),
                cues: this.cueManager.cues,
                settings: {
                    currentCueIndex: this.cueManager.currentCueIndex
                }
            };
            
            const blob = new Blob([JSON.stringify(showData, null, 2)], { 
                type: 'application/json' 
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.cueManager.showName.replace(/[^a-zA-Z0-9]/g, '_')}.qlab`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Show exported successfully');
        } catch (error) {
            console.error('Failed to export show:', error);
            this.showError('Export Error', error.message);
        }
    }

    // Status and diagnostics
    getStatus() {
        return {
            initialized: this.initialized,
            components: {
                cueManager: !!this.cueManager,
                audioEngine: !!this.audioEngine && this.audioEngine.initialized,
                videoEngine: !!this.videoEngine && this.videoEngine.initialized,
                displayManager: !!this.displayManager && this.displayManager.initialized,
                uiManager: !!this.uiManager
            },
            stats: this.cueManager ? this.cueManager.getCueStats() : null
        };
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure all scripts are loaded
    setTimeout(() => {
        try {
            // Make sure all required classes are available
            const requiredClasses = ['CueManager', 'AudioEngine', 'VideoEngine', 'UIManager'];
            const missingClasses = requiredClasses.filter(className => typeof window[className] === 'undefined');
            
            if (missingClasses.length > 0) {
                console.error('Required classes not loaded:', missingClasses);
                document.body.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #dc3545; background: #1a1a1a; min-height: 100vh;">
                        <h2>CueForge - Loading Error</h2>
                        <p>Missing required classes: ${missingClasses.join(', ')}</p>
                        <p>Please check that all JavaScript files are loaded correctly.</p>
                        <button onclick="location.reload()" style="
                            background: #28a745; border: none; color: white; 
                            padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 20px;
                        ">Reload Page</button>
                    </div>
                `;
                return;
            }
            
            console.log('All required classes loaded successfully');
            
            // Initialize the main application
            window.app = new CueForgeApp();
            
            // Expose app globally for debugging
            window.qlabClone = window.app;
            
            // Development helpers
            window.debug = {
                cueManager: () => window.app.getCueManager(),
                audioEngine: () => window.app.getAudioEngine(),
                videoEngine: () => window.app.getVideoEngine(),
                uiManager: () => window.app.getUIManager(),
                displayManager: () => window.app.getDisplayManager(),
                addTestCue: (type, options) => {
                    if (type === 'audio') return window.app.addTestAudioCue(options?.name);
                    if (type === 'video') return window.app.addTestVideoCue(options?.name);
                    if (type === 'wait') return window.app.addTestWaitCue(options?.duration, options?.name);
                    return window.app.getCueManager().addCue(type, options);
                },
                exportShow: () => window.app.exportShow(),
                stats: () => window.app.getCueManager().getCueStats(),
                status: () => window.app.getStatus(),
                go: () => window.app.getCueManager().go(),
                stop: () => window.app.getCueManager().stop(),
                pause: () => window.app.getCueManager().pause()
            };
            
            console.log('Debug helpers available via window.debug');
            console.log('Try: debug.addTestCue("audio", {name: "My Test Audio"})');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            document.body.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #dc3545; background: #1a1a1a; min-height: 100vh;">
                    <h2>CueForge - Initialization Error</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="
                        background: #28a745; border: none; color: white; 
                        padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 20px;
                    ">Reload Page</button>
                </div>
            `;
        }
        
    }, 100); // Small delay to ensure all scripts are loaded
});

// Handle app focus/blur for audio context management
document.addEventListener('visibilitychange', () => {
    if (window.app && window.app.audioEngine && window.app.audioEngine.ensureAudioContext) {
        if (document.hidden) {
            console.log('App hidden');
        } else {
            console.log('App visible');
            window.app.audioEngine.ensureAudioContext().catch(console.error);
        }
    }
});
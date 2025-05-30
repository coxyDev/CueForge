// Main application initialization
class QLABCloneApp {
    constructor() {
        this.cueManager = null;
        this.audioEngine = null;
        this.videoEngine = null;
        this.uiManager = null;
        this.initialized = false;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing QLab Clone...');
            
            // Initialize core systems
            this.cueManager = new CueManager();
            this.audioEngine = new AudioEngine();
            this.videoEngine = new VideoEngine();
            
            // Wait for audio engine to initialize
            await this.waitForAudioEngine();
            
            // Initialize display manager if available
            if (typeof DisplayManager !== 'undefined') {
                this.displayManager = new DisplayManager();
                await this.waitForDisplayManager();
                window.displayManager = this.displayManager;
                console.log('Display manager initialized');
            } else {
                console.log('Display manager not available - continuing without advanced display features');
            }
            
            // Make engines globally available
            window.audioEngine = this.audioEngine;
            window.videoEngine = this.videoEngine;
            
            // Initialize UI manager
            this.uiManager = new UIManager(this.cueManager, this.audioEngine);
            
            // Set up global error handling
            this.setupErrorHandling();
            
            // Set up cleanup on window close
            this.setupCleanup();
            
            // Initialize with sample data for demo purposes
            this.initSampleData();
            
            // Add basic playback functionality
            this.setupBasicPlayback();
            
            this.initialized = true;
            console.log('QLab Clone initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize QLab Clone:', error);
            this.showError('Failed to initialize application', error.message);
        }
    }

    async waitForDisplayManager() {
        if (!this.displayManager) return;
        
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds max
        
        while (!this.displayManager.initialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.displayManager.initialized) {
            console.warn('Display manager failed to initialize properly');
        }
    }

    async waitForAudioEngine() {
        // Wait for audio engine to be ready
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        while (!this.audioEngine.initialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.audioEngine.initialized) {
            console.warn('Audio engine failed to initialize properly');
        }
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
            if (this.displayManager) {
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
        
        console.log('Basic playback functionality enabled');
    }

    initSampleData() {
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
            fullscreen: false // Start with preview mode
        });
        
        this.cueManager.addCue('wait', {
            name: 'Speaker Introduction',
            duration: 15000
        });
        
        this.cueManager.addCue('group', {
            name: 'Scene Change',
            mode: 'sequential'
        });
        
        console.log('Sample cues added');
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
        if (this.audioEngine) {
            this.audioEngine.destroy();
        }
        
        if (this.videoEngine) {
            this.videoEngine.destroy();
        }
        
        console.log('Application cleanup completed');
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

    // Development helpers
    addTestAudioCue(name = 'Test Audio') {
        return this.cueManager.addCue('audio', {
            name: name,
            volume: 0.7,
            fadeIn: 1000,
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
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure all scripts are loaded
    setTimeout(() => {
        // Make sure all required classes are available
        if (typeof CueManager === 'undefined' || 
            typeof AudioEngine === 'undefined' || 
            typeof VideoEngine === 'undefined' ||
            typeof UIManager === 'undefined') {
            console.error('Required classes not loaded');
            return;
        }
        
        console.log('All required classes loaded successfully');
        
        // Initialize the main application
        window.app = new QLABCloneApp();
        
        // Expose app globally for debugging
        window.qlabClone = window.app;
        
        // Development helpers
        window.debug = {
            cueManager: () => window.app.getCueManager(),
            audioEngine: () => window.app.getAudioEngine(),
            videoEngine: () => window.app.getVideoEngine(),
            uiManager: () => window.app.getUIManager(),
            addTestCue: (type, options) => {
                if (type === 'audio') return window.app.addTestAudioCue(options?.name);
                if (type === 'wait') return window.app.addTestWaitCue(options?.duration, options?.name);
                return window.app.getCueManager().addCue(type, options);
            },
            exportShow: () => window.app.exportShow(),
            stats: () => window.app.getCueManager().getCueStats()
        };
        
        console.log('Debug helpers available via window.debug');
        console.log('Try: debug.addTestCue("audio", {name: "My Test Audio"})');
        
    }, 100); // Small delay to ensure all scripts are loaded
});

// Handle app focus/blur for audio context management
document.addEventListener('visibilitychange', () => {
    if (window.app && window.app.audioEngine) {
        if (document.hidden) {
            console.log('App hidden');
        } else {
            console.log('App visible');
            window.app.audioEngine.ensureAudioContext().catch(console.error);
        }
    }
});
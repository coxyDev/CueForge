/**
 * CueForge Application Initialization
 * Sets up the complete targeting system and all components
 */

class CueForgeApp {
    constructor() {
        this.cueManager = null;
        this.uiManager = null;
        this.audioEngine = null;
        this.initialized = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        try {
            console.log('🎬 Initializing CueForge with Professional Audio System...');
            
            // Initialize core systems
            await this.initializeCoreComponents();
            
            // Set up global references for debugging and modal interactions
            this.setupGlobalReferences();
            
            // Load demo content
            this.loadDemoContent();
            
            // Set up error handling
            this.setupErrorHandling();
            
            this.initialized = true;
            console.log('✅ CueForge professional audio system initialized successfully!');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Failed to initialize CueForge:', error);
            this.showInitializationError(error);
        }
    }

    async initializeCoreComponents() {
        // Initialize Professional Audio Engine
        console.log('Initializing Professional Audio Engine...');
        
        // Use the ProfessionalAudioEngine if available, otherwise fall back
        if (typeof ProfessionalAudioEngine !== 'undefined') {
            this.audioEngine = new ProfessionalAudioEngine();
        } else {
            console.warn('ProfessionalAudioEngine not found, using AudioEngineWithFades');
            this.audioEngine = new AudioEngineWithFades();
        }
        
        // Initialize audio context
        try {
            await this.audioEngine.initializeAudioContext();
            console.log('✅ Audio context initialized');
            
            // Setup error recovery if available
            if (this.audioEngine.setupErrorRecovery) {
                this.audioEngine.setupErrorRecovery();
            }
            
            // Enable live mode for better performance
            if (this.audioEngine.enableLiveMode) {
                this.audioEngine.enableLiveMode();
            }
            
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            // Continue without audio for now
        }

        // Initialize Cue Manager with audio engine
        this.cueManager = new CueManager();
        this.cueManager.audioEngine = this.audioEngine; // Link audio engine to cue manager
        
        // Initialize UI Manager with targeting support
        this.uiManager = new UIManager(this.cueManager, this.audioEngine);
        
        // Set up audio cue playback
        this.setupAudioPlayback();
        
        console.log('✅ Core components initialized');
    }

    setupAudioPlayback() {
        // Override cue manager's play method to use audio engine
        const originalPlay = this.cueManager.playCue.bind(this.cueManager);
        
        this.cueManager.playCue = async (cueId) => {
            const cue = this.cueManager.getCue(cueId);
            if (!cue) return;
            
            if (cue.type === 'audio' && cue.fileTarget) {
                try {
                    // Ensure audio context is running
                    await this.audioEngine.ensureAudioContext();
                    
                    // Create or get audio cue from engine
                    let audioCue = this.audioEngine.getCue(cueId);
                    if (!audioCue) {
                        audioCue = await this.audioEngine.createAudioCue(cueId, cue.fileTarget);
                    }
                    
                    // Play the audio
                    if (audioCue && audioCue.play) {
                        await audioCue.play();
                        cue.isPlaying = true;
                        
                        // Update UI
                        if (this.uiManager) {
                            this.uiManager.updateCueDisplay(cueId);
                        }
                    }
                } catch (error) {
                    console.error('Failed to play audio cue:', error);
                    this.uiManager.showStatusMessage(`Failed to play audio: ${error.message}`, 'error');
                }
            } else {
                // Use original play method for non-audio cues
                originalPlay(cueId);
            }
        };
        
        // Override stop method
        const originalStop = this.cueManager.stopCue.bind(this.cueManager);
        
        this.cueManager.stopCue = (cueId) => {
            const cue = this.cueManager.getCue(cueId);
            if (!cue) return;
            
            if (cue.type === 'audio') {
                const audioCue = this.audioEngine.getCue(cueId);
                if (audioCue && audioCue.stop) {
                    audioCue.stop();
                }
            }
            
            originalStop(cueId);
        };
        
        // Override panic (stop all)
        const originalPanic = this.cueManager.panic.bind(this.cueManager);
        
        this.cueManager.panic = () => {
            // Stop all audio cues
            if (this.audioEngine && this.audioEngine.stopAllCues) {
                this.audioEngine.stopAllCues();
            }
            
            originalPanic();
        };
    }

    setupGlobalReferences() {
        // Set global references for modal interactions and debugging
        window.cueManager = this.cueManager;
        window.uiManager = this.uiManager;
        window.audioEngine = this.audioEngine;
        window.app = this;
        
        console.log('✅ Global references set up');
    }

    loadDemoContent() {
        console.log('📝 Loading demo content with targeting examples...');
        
        // Create demo show with targeting examples
        this.cueManager.newShow();
        this.cueManager.showName = 'Demo Show - Professional Audio System';
        
        // Add demo cues that showcase the targeting system
        
        // 1. Audio cue with file (you'll need to set a file target)
        const audioCue = this.cueManager.addCue('audio', {
            name: 'Background Music',
            duration: 30000, // 30 seconds
            volume: 0.8
        });
        
        // 2. Video cue (needs file target) 
        const videoCue = this.cueManager.addCue('video', {
            name: 'Title Sequence',
            duration: 15000 // 15 seconds
        });
        
        // 3. Wait cue (no target needed)
        const waitCue = this.cueManager.addCue('wait', {
            name: 'Wait for applause',
            duration: 5000 // 5 seconds
        });
        
        // 4. Start cue targeting the audio cue
        const startCue = this.cueManager.addCue('start', {
            targetCueId: audioCue.id
        });
        
        // 5. Fade cue targeting the audio cue
        const fadeCue = this.cueManager.addCue('fade', {
            targetCueId: audioCue.id,
            duration: 3000 // 3 second fade
        });
        
        // 6. Stop cue targeting the video cue
        const stopCue = this.cueManager.addCue('stop', {
            targetCueId: videoCue.id
        });
        
        // 7. GoTo cue targeting the wait cue
        const gotoWaitCue = this.cueManager.addCue('goto', {
            targetCueId: waitCue.id
        });
        
        // 8. Group cue (no target needed)
        const groupCue = this.cueManager.addCue('group', {
            name: 'Lighting Sequence',
            mode: 'playlist'
        });
        
        // Set first cue as standing by
        if (this.cueManager.cues.length > 0) {
            this.cueManager.setStandByCue(this.cueManager.cues[0].id);
        }
        
        console.log(`✅ Demo content loaded: ${this.cueManager.cues.length} cues`);
        console.log(`📊 Broken cues: ${this.cueManager.cues.filter(c => c.isBroken).length}`);
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error);
        });

        // Promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason);
        });
        
        // Audio system failure handler
        window.addEventListener('audioSystemFailure', (event) => {
            console.error('Audio system failure:', event.detail);
            this.handleAudioSystemFailure(event.detail);
        });
        
        console.log('✅ Error handling set up');
    }

    handleError(error) {
        // Don't spam with too many error notifications
        if (this.lastErrorTime && Date.now() - this.lastErrorTime < 1000) {
            return;
        }
        this.lastErrorTime = Date.now();
        
        const errorMessage = error.message || error.toString();
        
        // Show error in UI if available
        if (this.uiManager && this.uiManager.showStatusMessage) {
            this.uiManager.showStatusMessage(`Error: ${errorMessage}`, 'error');
        }
    }

    handleAudioSystemFailure(detail) {
        const message = `Audio system failure: ${detail.reason}. Please restart the application.`;
        
        if (this.uiManager && this.uiManager.showStatusMessage) {
            this.uiManager.showStatusMessage(message, 'error');
        }
        
        // Show alert as backup
        alert(message);
    }

    showWelcomeMessage() {
        // Show welcome message with professional audio info
        setTimeout(() => {
            if (this.uiManager && this.uiManager.showStatusMessage) {
                this.uiManager.showStatusMessage('🎯 Professional Audio System Ready! Add audio files to cues to test playback.', 'success');
            }
        }, 1000);
    }

    showInitializationError(error) {
        const message = `Failed to initialize CueForge: ${error.message}`;
        console.error(message);
        
        // Show in UI if possible
        if (this.uiManager && this.uiManager.showStatusMessage) {
            this.uiManager.showStatusMessage(message, 'error');
        } else {
            alert(message);
        }
    }
}

// Create and start the application
window.addEventListener('DOMContentLoaded', () => {
    window.app = new CueForgeApp();
});
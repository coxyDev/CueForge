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
            console.log('🎬 Initializing CueForge with Targeting System...');
            
            // Initialize core systems
            this.initializeCoreComponents();
            
            // Set up global references for debugging and modal interactions
            this.setupGlobalReferences();
            
            // Load demo content
            this.loadDemoContent();
            
            // Set up error handling
            this.setupErrorHandling();
            
            this.initialized = true;
            console.log('✅ CueForge targeting system initialized successfully!');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Failed to initialize CueForge:', error);
            this.showInitializationError(error);
        }
    }

    initializeCoreComponents() {
        // Initialize Audio Engine (basic implementation)
        this.audioEngine = {
            stopAllCues: () => {
                console.log('Audio engine: Stopping all audio cues');
            },
            playAudio: (filePath) => {
                console.log(`Audio engine: Playing ${filePath}`);
            }
        };

        // Initialize Cue Manager with targeting system
        this.cueManager = new CueManager();
        
        // Initialize UI Manager with targeting support
        this.uiManager = new UIManager(this.cueManager, this.audioEngine);
        
        console.log('✅ Core components initialized');
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
        this.cueManager.showName = 'Demo Show - Targeting System';
        
        // Add demo cues that showcase the targeting system
        
        // 1. Audio cue (needs file target)
        const audioCue = this.cueManager.addCue('audio', {
            name: 'Background Music',
            duration: 30000 // 30 seconds
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
        
        // 8. Another audio cue (broken - no target)
        const brokenAudioCue = this.cueManager.addCue('audio', {
            name: 'Missing Audio File'
        });
        
        // 9. Start cue with no target (broken)
        const brokenStartCue = this.cueManager.addCue('start', {
            name: 'Broken Start Cue'
        });
        
        // 10. Group cue (no target needed)
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

    showWelcomeMessage() {
        // Show welcome message with targeting system info
        setTimeout(() => {
            if (this.uiManager && this.uiManager.showStatusMessage) {
                this.uiManager.showStatusMessage('🎯 Targeting System Ready! Click cue targets to edit them.', 'success');
            }
        }, 1000);
    }

    showInitializationError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #1a1a1a;
            color: #e0e0e0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        
        errorDiv.innerHTML = `
            <h1 style="color: #dc3545; margin-bottom: 20px;">❌ CueForge Initialization Error</h1>
            <p>The application failed to start properly.</p>
            <p style="margin-top: 10px; color: #888;">${error.message}</p>
            <button onclick="location.reload()" style="
                margin-top: 20px;
                background: #28a745;
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">Reload Page</button>
        `;
        
        document.body.appendChild(errorDiv);
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Add sample cues for testing the targeting system
     */
    addTargetingTestCues() {
        if (!this.initialized) {
            console.warn('App not initialized yet');
            return;
        }

        console.log('🧪 Adding targeting test cues...');
        
        // Clear existing cues
        this.cueManager.newShow();
        this.cueManager.showName = 'Targeting Test Show';
        
        // Audio cue to be targeted
        const targetAudio = this.cueManager.addCue('audio', {
            name: 'Target Audio',
            duration: 10000
        });
        
        // Video cue to be targeted  
        const targetVideo = this.cueManager.addCue('video', {
            name: 'Target Video',
            duration: 8000
        });
        
        // Wait cue
        const waitCue = this.cueManager.addCue('wait', {
            name: 'Intermission',
            duration: 3000
        });
        
        // Control cues targeting the above
        this.cueManager.addCue('start', { targetCueId: targetAudio.id });
        this.cueManager.addCue('fade', { targetCueId: targetAudio.id });
        this.cueManager.addCue('stop', { targetCueId: targetVideo.id });
        this.cueManager.addCue('goto', { targetCueId: waitCue.id });
        
        // Broken cues (no targets)
        this.cueManager.addCue('audio', { name: 'Broken Audio' });
        this.cueManager.addCue('start', { name: 'Broken Start' });
        
        // Set first cue as standing by
        if (this.cueManager.cues.length > 0) {
            this.cueManager.setStandByCue(this.cueManager.cues[0].id);
        }
        
        console.log('✅ Targeting test cues added');
    }

    /**
     * Get application statistics
     */
    getStats() {
        if (!this.initialized) {
            return { error: 'App not initialized' };
        }
        
        const cueStats = this.cueManager.getCueStats();
        
        return {
            initialized: this.initialized,
            showName: this.cueManager.showName,
            cues: cueStats,
            playback: {
                activeCues: this.cueManager.getActiveCues().length,
                isPaused: this.cueManager.isPaused,
                standByCue: this.cueManager.getStandByCue()?.number || null,
                selectedCue: this.cueManager.getSelectedCue()?.number || null
            },
            targeting: {
                cuesWithTargets: this.cueManager.cues.filter(c => c.target).length,
                brokenCues: this.cueManager.cues.filter(c => c.isBroken).length,
                fileTargets: this.cueManager.cues.filter(c => c.targetType === 'file').length,
                cueTargets: this.cueManager.cues.filter(c => c.targetType === 'cue').length
            }
        };
    }

    /**
     * Export show data (for debugging/testing)
     */
    exportShow() {
        if (!this.initialized) {
            console.warn('App not initialized yet');
            return null;
        }
        
        const showData = {
            version: '1.0.0',
            showName: this.cueManager.showName,
            cues: this.cueManager.cues.map(cue => ({
                ...cue,
                // Remove non-serializable properties
                target: cue.target,
                targetType: cue.targetType,
                targetCueId: cue.targetCueId,
                isBroken: cue.isBroken
            })),
            settings: {
                singleCueMode: this.cueManager.getSingleCueMode(),
                autoContinueEnabled: this.cueManager.getAutoContinueEnabled(),
                masterVolume: this.cueManager.getMasterVolume()
            },
            playhead: {
                standByCueId: this.cueManager.standByCueId,
                selectedCueId: this.cueManager.selectedCueId
            }
        };
        
        // Create downloadable blob
        const blob = new Blob([JSON.stringify(showData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.cueManager.showName || 'show'}.cueforge`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        console.log('✅ Show exported');
        return showData;
    }

    /**
     * Import show data (basic implementation)
     */
    importShow(showData) {
        if (!this.initialized) {
            console.warn('App not initialized yet');
            return false;
        }
        
        try {
            console.log('📥 Importing show data...');
            
            // Clear current show
            this.cueManager.newShow();
            
            // Import basic data
            this.cueManager.showName = showData.showName || 'Imported Show';
            
            // Import cues
            showData.cues.forEach(cueData => {
                const cue = this.cueManager.addCue(cueData.type, cueData);
            });
            
            // Restore settings
            if (showData.settings) {
                this.cueManager.setSingleCueMode(showData.settings.singleCueMode);
                this.cueManager.setAutoContinueEnabled(showData.settings.autoContinueEnabled);
                this.cueManager.setMasterVolume(showData.settings.masterVolume);
            }
            
            // Restore playhead
            if (showData.playhead && showData.playhead.standByCueId) {
                this.cueManager.setStandByCue(showData.playhead.standByCueId);
            }
            
            console.log('✅ Show imported successfully');
            
            if (this.uiManager) {
                this.uiManager.showStatusMessage('Show imported successfully', 'success');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Failed to import show:', error);
            
            if (this.uiManager) {
                this.uiManager.showStatusMessage('Failed to import show', 'error');
            }
            
            return false;
        }
    }

    /**
     * Reset to demo content
     */
    resetToDemo() {
        if (!this.initialized) {
            console.warn('App not initialized yet');
            return;
        }
        
        this.loadDemoContent();
        
        if (this.uiManager) {
            this.uiManager.showStatusMessage('Demo content loaded', 'success');
        }
    }
}

// Console utilities for debugging and testing
window.CueForgeDebug = {
    getStats: () => window.app?.getStats(),
    addTestCues: () => window.app?.addTargetingTestCues(),
    exportShow: () => window.app?.exportShow(),
    resetDemo: () => window.app?.resetToDemo(),
    
    // Targeting system utilities
    showBrokenCues: () => {
        if (!window.cueManager) return [];
        return window.cueManager.cues.filter(c => c.isBroken);
    },
    
    showTargetingInfo: () => {
        if (!window.cueManager) return {};
        const cues = window.cueManager.cues;
        return {
            total: cues.length,
            withTargets: cues.filter(c => c.target).length,
            broken: cues.filter(c => c.isBroken).length,
            fileTargets: cues.filter(c => c.targetType === 'file').length,
            cueTargets: cues.filter(c => c.targetType === 'cue').length,
            controlCues: cues.filter(c => ['start', 'stop', 'goto', 'fade'].includes(c.type)).length
        };
    },
    
    testControlCue: (cueNumber) => {
        if (!window.cueManager) return false;
        const cue = window.cueManager.cues.find(c => c.number === cueNumber);
        if (cue) {
            return window.cueManager.playCue(cue.id);
        }
        return false;
    }
};

// Initialize the application
const app = new CueForgeApp();

// Export for debugging
window.CueForgeApp = CueForgeApp;
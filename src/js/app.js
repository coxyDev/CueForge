/**
 * CueForge Application Initialization
 * Sets up the complete targeting system and all components
 */

class CueForgeApp {
    constructor() {
        console.log('🎬 Initializing CueForge with Professional Audio System...');
        
        // Initialize core components in correct order
        this.initializeCoreComponents();
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
        try {
            // 1. Initialize Cue Manager first
            console.log('Initializing Cue Manager...');
            this.cueManager = new CueManager();
            
            // 2. Check for required dependencies before creating audio engine
            this.checkDependencies();
            
            // 3. Initialize Professional Audio Engine
            console.log('Initializing Professional Audio Engine...');
            this.audioEngine = new ProfessionalAudioEngine();
            await this.audioEngine.initializeAudioContext();
            
            // 4. Initialize UI Manager
            console.log('Initializing UI Manager...');
            this.uiManager = new UIManager(this.cueManager, this.audioEngine);
            
            // 5. Setup app-level event handlers
            this.setupEventHandlers();
            
            // 6. Initialize performance monitoring UI updates
            this.startPerformanceMonitoring();
            
            console.log('✅ CueForge initialized successfully');
            this.showStatusMessage('CueForge ready', 'success');
            
        } catch (error) {
            console.error('❌ Failed to initialize CueForge:', error);
            this.showInitializationError(error.message);
        }
    }

    setupAudioPlayback() {
        // Update file target method to create audio cue
        const originalSetFileTarget = this.cueManager.setFileTarget.bind(this.cueManager);

        this.cueManager.setFileTarget = async (cueId, filePath, fileName) => {
            // Call original method
            const result = originalSetFileTarget(cueId, filePath, fileName);
            
            if (result) {
                const cue = this.cueManager.getCue(cueId);
                if (cue && cue.type === 'audio') {
                    try {
                        // Create audio cue with the file
                        const audioCue = await this.audioEngine.createAudioCue(cueId, filePath);
                        
                        // Update inspector to show matrix
                        if (this.uiManager && this.cueManager.selectedCue?.id === cueId) {
                            this.uiManager.updateInspector(cue);
                        }
                    } catch (error) {
                        console.error('Failed to create audio cue:', error);
                    }
                }
            }
            
            return result;
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

     checkDependencies() {
        const requiredClasses = [
            'AudioPerformanceMonitor',
            'AudioDropoutDetector', 
            'MemoryLeakMonitor',
            'AudioRecoveryManager',
            'MatrixMixer',
            'AudioPatchManager'
        ];
        
        const missingDeps = [];
        
        requiredClasses.forEach(className => {
            if (typeof window[className] === 'undefined') {
                missingDeps.push(className);
            }
        });
        
        if (missingDeps.length > 0) {
            console.warn('⚠️ Missing dependencies:', missingDeps);
            // Continue with degraded functionality rather than failing completely
        } else {
            console.log('✅ All dependencies available');
        }
    }
    
    setupEventHandlers() {
        // Transport controls
        const stopAllBtn = document.getElementById('stop-all-btn');
        const panicBtn = document.getElementById('panic-btn');
        const goBtn = document.getElementById('go-btn');
        
        if (stopAllBtn) {
            stopAllBtn.addEventListener('click', () => {
                this.audioEngine.stopAllCues();
                this.showStatusMessage('All cues stopped', 'info');
            });
        }
        
        if (panicBtn) {
            panicBtn.addEventListener('click', () => {
                this.handlePanic();
            });
        }
        
        if (goBtn) {
            goBtn.addEventListener('click', () => {
                this.handleGo();
            });
        }
        
        // Master volume control
        const masterVolumeSlider = document.getElementById('master-volume');
        const masterVolumeValue = document.getElementById('master-volume-value');
        
        if (masterVolumeSlider) {
            masterVolumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                this.audioEngine.setMasterVolume(volume);
                if (masterVolumeValue) {
                    masterVolumeValue.textContent = Math.round(volume * 100) + '%';
                }
            });
        }
        
        // Professional Audio Settings button
        const proAudioBtn = document.getElementById('professional-audio-btn');
        if (proAudioBtn) {
            proAudioBtn.addEventListener('click', () => {
                this.showProfessionalAudioModal();
            });
        }
        
        // Critical audio error handling
        window.addEventListener('criticalAudioError', (event) => {
            this.handleCriticalAudioError(event.detail.message);
        });
        
        // Audio system failure handling
        window.addEventListener('audioSystemFailure', (event) => {
            this.handleAudioSystemFailure(event.detail);
        });
    }
    
    startPerformanceMonitoring() {
        // Update performance stats every second
        setInterval(() => {
            this.updatePerformanceDisplay();
        }, 1000);
    }
    
    updatePerformanceDisplay() {
        const performanceElement = document.getElementById('audio-performance');
        if (!performanceElement || !this.audioEngine) return;
        
        try {
            const stats = this.audioEngine.getPerformanceStats();
            performanceElement.textContent = 
                `CPU: ${Math.round(stats.cpu)}% | Mem: ${Math.round(stats.memory)}MB | Dropouts: ${stats.dropouts}`;
        } catch (error) {
            // Silently handle performance monitoring errors
            performanceElement.textContent = 'Performance monitoring unavailable';
        }
    }
    
    handlePanic() {
        console.log('🚨 PANIC button pressed');
        
        try {
            // Stop all audio immediately
            this.audioEngine.stopAllCues();
            
            // Reset audio context if needed
            if (this.audioEngine.audioContext.state === 'suspended') {
                this.audioEngine.audioContext.resume();
            }
            
            // Clear any scheduled actions
            this.cueManager.clearAllScheduledActions();
            
            // Update UI
            this.showStatusMessage('PANIC: All audio stopped', 'warning');
            
            // Reset transport state
            this.resetTransportState();
            
        } catch (error) {
            console.error('Error during panic stop:', error);
            this.showStatusMessage('Panic failed - check console', 'error');
        }
    }
    
    handleGo() {
        console.log('▶️ GO button pressed');
        
        try {
            // Find the next cue to execute
            const nextCue = this.cueManager.getNextCue();
            
            if (nextCue) {
                this.cueManager.executeCue(nextCue.id);
                this.showStatusMessage(`Executed: ${nextCue.name}`, 'success');
            } else {
                this.showStatusMessage('No cue to execute', 'info');
            }
            
        } catch (error) {
            console.error('Error during GO:', error);
            this.showStatusMessage('GO failed - check console', 'error');
        }
    }
    
    resetTransportState() {
        // Reset any transport-related UI state
        const goBtn = document.getElementById('go-btn');
        if (goBtn) {
            goBtn.classList.remove('active');
        }
    }
    
    showProfessionalAudioModal() {
        const modal = document.getElementById('pro-audio-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.initializeProfessionalAudioModal();
        }
    }
    
    initializeProfessionalAudioModal() {
        // Setup tab switching
        const tabBtns = document.querySelectorAll('#pro-audio-modal .tab-btn');
        const tabContents = document.querySelectorAll('#pro-audio-modal .tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                
                // Update active tab button
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabName}-tab`) {
                        content.classList.add('active');
                    }
                });
            });
        });
        
        // Setup modal close handlers
        const closeBtn = document.getElementById('close-pro-audio-modal');
        const closeBtn2 = document.getElementById('close-pro-audio');
        
        [closeBtn, closeBtn2].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    document.getElementById('pro-audio-modal').style.display = 'none';
                });
            }
        });
        
        // Setup performance monitoring in modal
        this.updateModalPerformanceStats();
        setInterval(() => this.updateModalPerformanceStats(), 1000);
        
        // Setup VST controls
        this.setupVSTControls();
    }
    
    updateModalPerformanceStats() {
        if (!this.audioEngine) return;
        
        try {
            const stats = this.audioEngine.getPerformanceStats();
            
            const cpuElement = document.getElementById('cpu-usage');
            const memoryElement = document.getElementById('memory-usage');
            const dropoutElement = document.getElementById('dropout-count');
            
            if (cpuElement) cpuElement.textContent = `${Math.round(stats.cpu)}%`;
            if (memoryElement) memoryElement.textContent = `${Math.round(stats.memory)} MB`;
            if (dropoutElement) dropoutElement.textContent = stats.dropouts;
        } catch (error) {
            // Silently handle errors
        }
    }
    
    setupVSTControls() {
        const scanBtn = document.getElementById('scan-vst-btn');
        const clearCacheBtn = document.getElementById('clear-vst-cache-btn');
        const resetStatsBtn = document.getElementById('reset-stats-btn');
        const forceGcBtn = document.getElementById('force-gc-btn');
        
        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                this.scanVSTPlugins();
            });
        }
        
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearVSTCache();
            });
        }
        
        if (resetStatsBtn) {
            resetStatsBtn.addEventListener('click', () => {
                this.resetPerformanceStats();
            });
        }
        
        if (forceGcBtn) {
            forceGcBtn.addEventListener('click', () => {
                this.forceGarbageCollection();
            });
        }
    }
    
    scanVSTPlugins() {
        if (this.audioEngine.vstManager) {
            this.showStatusMessage('Scanning for VST plugins...', 'info');
            this.audioEngine.vstManager.scanForPlugins((progress) => {
                console.log(`VST Scan Progress: ${Math.round(progress.progress * 100)}%`);
            });
        } else {
            this.showStatusMessage('VST manager not available', 'warning');
        }
    }
    
    clearVSTCache() {
        if (this.audioEngine.vstManager) {
            this.audioEngine.vstManager.clearCache();
            this.showStatusMessage('VST cache cleared', 'success');
        }
    }
    
    resetPerformanceStats() {
        if (this.audioEngine.dropoutDetector) {
            this.audioEngine.dropoutDetector.resetCounter();
        }
        this.showStatusMessage('Performance statistics reset', 'success');
    }
    
    forceGarbageCollection() {
        if (this.audioEngine.memoryMonitor) {
            this.audioEngine.memoryMonitor.forceGarbageCollection();
            this.showStatusMessage('Garbage collection requested', 'info');
        }
    }
    
    handleCriticalAudioError(message) {
        console.error('🚨 Critical Audio Error:', message);
        
        // Show user-friendly error
        this.showStatusMessage('Critical audio error - check console', 'error');
        
        // Try to recover automatically
        if (this.audioEngine.recoveryManager) {
            this.audioEngine.recoveryManager.initiateRecovery('Critical error reported');
        }
    }
    
    handleAudioSystemFailure(details) {
        console.error('🚨 Audio System Failure:', details);
        
        // Show critical error to user
        const message = `Audio system has failed after ${details.attempts} recovery attempts.\n\nReason: ${details.reason}\n\nPlease save your work and restart the application.`;
        
        if (confirm(message + '\n\nWould you like to attempt manual recovery?')) {
            // Attempt manual recovery
            this.attemptManualRecovery();
        }
    }
    
    async attemptManualRecovery() {
        try {
            this.showStatusMessage('Attempting manual recovery...', 'info');
            
            // Destroy current audio engine
            if (this.audioEngine) {
                this.audioEngine.destroy();
            }
            
            // Create new audio engine
            this.audioEngine = new ProfessionalAudioEngine();
            await this.audioEngine.initializeAudioContext();
            
            // Reconnect UI
            if (this.uiManager) {
                this.uiManager.audioEngine = this.audioEngine;
            }
            
            this.showStatusMessage('Manual recovery successful', 'success');
            
        } catch (error) {
            console.error('Manual recovery failed:', error);
            this.showStatusMessage('Manual recovery failed - restart required', 'error');
        }
    }
    
    showStatusMessage(message, type = 'info') {
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-${type}`;
            
            // Clear message after 5 seconds for non-error messages
            if (type !== 'error') {
                setTimeout(() => {
                    statusElement.textContent = 'Ready';
                    statusElement.className = '';
                }, 5000);
            }
        }
        
        console.log(`Status: ${message} (${type})`);
    }
    
    showInitializationError(message) {
        console.error('Initialization Error:', message);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'initialization-error';
        errorDiv.innerHTML = `
            <h2>CueForge Initialization Failed</h2>
            <p><strong>Error:</strong> ${message}</p>
            <p>Please check the console for more details and ensure all dependencies are loaded correctly.</p>
            <button onclick="location.reload()">Reload Application</button>
        `;
        
        document.body.appendChild(errorDiv);
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing CueForge...');
    
    try {
        window.cueForgeApp = new CueForgeApp();
    } catch (error) {
        console.error('Failed to create CueForge app:', error);
        
        // Show basic error message
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; color: red;">
                <h1>CueForge Failed to Start</h1>
                <p>Error: ${error.message}</p>
                <p>Please check the browser console for more details.</p>
                <button onclick="location.reload()">Reload</button>
            </div>
        `;
    }
});
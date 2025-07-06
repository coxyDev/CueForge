class UIManager {
    constructor(cueManager, audioEngine) {
        this.cueManager = cueManager;
        this.audioEngine = audioEngine;
        this.elements = {};
        this.selectedCueElement = null;
        this.apiAvailable = false;
        
        // Audio enhancement components
        this.audioAnalyzer = new AudioAnalyzer();
        this.waveformRenderer = null;
        this.currentWaveformCue = null;
        
        // Check API availability first
        this.checkAPIAvailability();

        // Check if styles loaded
        this.ensureStylesLoaded();
        
        this.initializeElements();
        this.bindEvents();
        this.setupMenuHandlers();
        this.setupCloseHandlers();
        this.setupGlobalKeyHandler();
        
        this.ensureSettingsModalHidden();
        this.appSettings = null;
        this.updateUI();
        this.startTimeUpdater();
        this.setupMasterVolumeControl();

        this.videoTimelineUpdateInterval = null;
    }

    checkAPIAvailability() {
        console.log('Checking API availability...');
        
        const requiredAPIs = ['electronAPI', 'fs', 'qlabAPI'];
        const availableAPIs = {};
        let allAvailable = true;
        
        requiredAPIs.forEach(api => {
            const available = typeof window[api] !== 'undefined' && window[api] !== null;
            availableAPIs[api] = available;
            if (!available) {
                allAvailable = false;
                console.error(`${api} is not available`);
            } else {
                console.log(`${api} is available`);
            }
        });
        
        this.apiAvailable = allAvailable;
        
        if (!this.apiAvailable) {
            console.error('Some APIs are missing. This will prevent file operations.');
            console.log('Available APIs:', availableAPIs);
            
            // Show warning to user
            this.showAPIWarning();
        } else {
            console.log('All APIs are available');
        }
        
        return this.apiAvailable;
    }

    showAPIWarning() {
        // Create a warning banner
        const warningBanner = document.createElement('div');
        warningBanner.id = 'api-warning';
        warningBanner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #dc3545;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        warningBanner.innerHTML = `
            <strong>API Error:</strong> Preload script failed to load. 
            File operations will not work. 
            Check console for details. <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 2px 8px; cursor: pointer;">×</button>
        `;
        
        document.body.insertBefore(warningBanner, document.body.firstChild);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (warningBanner && warningBanner.parentElement) {
                warningBanner.remove();
            }
        }, 10000);
    }

    ensureStylesLoaded() {
        // Check if our main styles are loaded by testing for a specific CSS property
        const testElement = document.createElement('div');
        testElement.className = 'cue-item';
        testElement.style.visibility = 'hidden';
        testElement.style.position = 'absolute';
        document.body.appendChild(testElement);
        
        const computedStyle = window.getComputedStyle(testElement);
        const hasStyles = computedStyle.display === 'grid';
        
        document.body.removeChild(testElement);
        
        if (!hasStyles) {
            console.error('CSS styles not loaded properly. Check styles.css file.');
            this.showStylesError();
        }
    }

    showStylesError() {
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
            <h1 style="color: #dc3545; margin-bottom: 20px;">CueForge - Styles Loading Error</h1>
            <p>The main stylesheet (styles.css) failed to load properly.</p>
            <p style="margin-top: 10px;">Please check that the styles.css file exists and is accessible.</p>
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

    ensureSettingsModalHidden() {
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.style.display = 'none';
            settingsModal.classList.remove('show');
        }
    }

    setupGlobalKeyHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                console.log('ESC pressed - emergency stop');
                this.cueManager.stop();
                return;
            }
            
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }
            
            this.handleGlobalKeydown(e);
        }, true);
    }

    handleGlobalKeydown(e) {
        // Handle Space for GO
        if (e.code === 'Space') {
            e.preventDefault();
            console.log('Space pressed - GO');
            this.cueManager.go();
            return;
        }

        // Handle Stop
        if ((e.ctrlKey || e.metaKey) && e.code === 'Period') {
            e.preventDefault();
            console.log('Ctrl+. pressed - STOP');
            this.cueManager.stop();
            return;
        }

        // Handle Pause
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
            e.preventDefault();
            console.log('Ctrl+P pressed - PAUSE');
            this.cueManager.pause();
            return;
        }

        // NEW: Handle playhead movement (Shift + arrows)
        if (e.shiftKey && e.code === 'ArrowUp') {
            e.preventDefault();
            this.movePlayheadUp();
            return;
        }

        if (e.shiftKey && e.code === 'ArrowDown') {
            e.preventDefault();
            this.movePlayheadDown();
            return;
        }

        // NEW: Handle selection movement (arrows without shift)
        if (!e.shiftKey && e.code === 'ArrowUp') {
            e.preventDefault();
            this.selectPreviousCue();
            return;
        }

        if (!e.shiftKey && e.code === 'ArrowDown') {
            e.preventDefault();
            this.selectNextCue();
            return;
        }

        // NEW: Handle Enter to go to selected cue
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
            this.goToSelectedCue();
            return;
        }

        // NEW: Handle Ctrl+Number to go to cue by number
        if ((e.ctrlKey || e.metaKey) && e.code.startsWith('Digit')) {
            e.preventDefault();
            const cueNumber = e.code.replace('Digit', '');
            const finalNumber = cueNumber === '0' ? '10' : cueNumber;
            this.goToCueByNumber(finalNumber);
            return;
        }

        // Other shortcuts
        switch (e.code) {
            case 'Delete':
            case 'Backspace':
                if (!this.isInputFocused(e.target)) {
                    e.preventDefault();
                    this.deleteSelectedCue();
                }
                break;
            case 'KeyS':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.cueManager.saveShow();
                }
                break;
            case 'KeyN':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.cueManager.newShow();
                }
                break;
            case 'KeyO':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    // Trigger file open dialog
                    if (this.apiAvailable) {
                        window.qlabAPI.selectAudioFile(); // This will be handled by main process
                    }
                }
                break;
        }
    }

    // NEW: Playhead navigation methods
    movePlayheadUp() {
        const cues = this.cueManager.cues;
        if (cues.length === 0) return;
        
        const standByCue = this.cueManager.getStandByCue();
        let newIndex = 0;
        
        if (standByCue) {
            const currentIndex = this.cueManager.getCueIndex(standByCue.id);
            newIndex = Math.max(0, currentIndex - 1);
        }
        
        this.cueManager.setStandByCue(cues[newIndex].id);
    }

    movePlayheadDown() {
        const cues = this.cueManager.cues;
        if (cues.length === 0) return;
        
        const standByCue = this.cueManager.getStandByCue();
        let newIndex = 0;
        
        if (standByCue) {
            const currentIndex = this.cueManager.getCueIndex(standByCue.id);
            newIndex = Math.min(cues.length - 1, currentIndex + 1);
        }
        
        this.cueManager.setStandByCue(cues[newIndex].id);
    }

    goToSelectedCue() {
        const selectedCue = this.cueManager.getSelectedCue();
        if (selectedCue) {
            console.log(`Going to selected cue: ${selectedCue.number}`);
            this.cueManager.goToCue(selectedCue.id);
        }
    }

    goToCueByNumber(number) {
        const cue = this.cueManager.cues.find(c => c.number === number);
        if (cue) {
            console.log(`Going to cue ${number}`);
            this.cueManager.goToCue(cue.id);
        } else {
            console.log(`Cue ${number} not found`);
        }
    }

    // NEW: Enhanced playhead event handler
    onPlayheadChanged(data) {
        this.renderCueList(); // Re-render to update playhead indicator
        this.updateGoButtonText();
    }

    updateGoButtonText() {
        if (!this.elements.goBtn) return;
        
        const standByCue = this.cueManager.getStandByCue();
        if (standByCue) {
            this.elements.goBtn.title = `Go - Execute Cue ${standByCue.number}: ${standByCue.name}`;
            this.elements.goBtn.classList.add('has-standby-cue');
        } else {
            this.elements.goBtn.title = 'Go';
            this.elements.goBtn.classList.remove('has-standby-cue');
        }
    }

    // Helper to check if an input field is focused
    isInputFocused(target) {
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.contentEditable === 'true';
    }

    initializeElements() {
        this.elements = {
            showName: document.getElementById('show-name'),
            showStatus: document.getElementById('show-status'),
            goBtn: document.getElementById('go-btn'),
            stopBtn: document.getElementById('stop-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            cueList: document.getElementById('cue-list'),
            cueCount: document.getElementById('cue-count'),
            addAudioCue: document.getElementById('add-audio-cue'),
            addVideoCue: document.getElementById('add-video-cue'),
            addWaitCue: document.getElementById('add-wait-cue'),
            addGroupCue: document.getElementById('add-group-cue'),
            deleteCue: document.getElementById('delete-cue'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            inspectorContent: document.getElementById('inspector-content'),
            currentTime: document.getElementById('current-time'),
            displayRouting: document.getElementById('display-routing')
        };
    }

    bindEvents() {
        // Transport controls
        if (this.elements.goBtn) {
            this.elements.goBtn.addEventListener('click', () => this.cueManager.go());
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.cueManager.stop());
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.addEventListener('click', () => this.cueManager.pause());
        }

        // Cue management buttons
        if (this.elements.addAudioCue) {
            this.elements.addAudioCue.addEventListener('click', () => this.addCue('audio'));
        }
        if (this.elements.addVideoCue) {
            this.elements.addVideoCue.addEventListener('click', () => this.addCue('video'));
        }
        if (this.elements.addWaitCue) {
            this.elements.addWaitCue.addEventListener('click', () => this.addCue('wait'));
        }
        if (this.elements.addGroupCue) {
            this.elements.addGroupCue.addEventListener('click', () => this.addCue('group'));
        }
        if (this.elements.deleteCue) {
            this.elements.deleteCue.addEventListener('click', () => this.deleteSelectedCue());
        }

        // Settings
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // Cue manager events
        this.cueManager.on('cueAdded', () => this.updateUI());
        this.cueManager.on('cueRemoved', () => this.updateUI());
        this.cueManager.on('cueUpdated', () => this.updateUI());
        this.cueManager.on('selectionChanged', () => this.renderInspector());
        this.cueManager.on('playbackStateChanged', () => this.updateUI());
        this.cueManager.on('showChanged', () => this.updateUI());
        this.cueManager.on('playheadChanged', (data) => this.onPlayheadChanged(data));
    }

    setupMenuHandlers() {
        if (this.apiAvailable && window.qlabAPI) {
            window.qlabAPI.onMenuEvent((event, ...args) => {
                console.log('Menu event received:', event, args);
                
                switch (event) {
                    case 'menu-new-show':
                        this.newShow();
                        break;
                    case 'menu-open-show':
                        this.cueManager.loadShow(args[0]);
                        break;
                    case 'menu-save-show':
                        this.saveShow();
                        break;
                    case 'menu-save-show-as':
                        this.saveShowAs();
                        break;
                    case 'menu-add-cue':
                        this.addCue(args[0]);
                        break;
                    case 'menu-delete-cue':
                        this.deleteSelectedCue();
                        break;
                    case 'menu-copy-cue':
                        this.copyCue();
                        break;
                    case 'menu-cut-cue':
                        this.cutCue();
                        break;
                    case 'menu-paste-cue':
                        this.pasteCue();
                        break;
                    case 'menu-duplicate-cue':
                        this.duplicateCue();
                        break;
                    case 'menu-select-all':
                        this.selectAllCues();
                        break;
                    case 'menu-go':
                        this.cueManager.go();
                        break;
                    case 'menu-stop':
                        this.cueManager.stop();
                        break;
                    case 'menu-pause':
                        this.cueManager.pause();
                        break;
                    case 'menu-emergency-stop':
                        this.emergencyStopAll();
                        break;
                    case 'menu-show-settings':
                        this.openSettings();
                        break;
                }
            });
        } else {
            console.warn('Menu handlers not set up - API not available');
        }
    }

    setupCloseHandlers() {
        // Handle close confirmation from main process
        if (this.apiAvailable && window.electronAPI) {
            window.electronAPI.ipcRenderer.on('app-close-requested', async () => {
                console.log('App close requested, checking for unsaved changes');
                
                const hasUnsavedChanges = this.cueManager.unsavedChanges;
                console.log('Has unsaved changes:', hasUnsavedChanges);
                
                if (hasUnsavedChanges) {
                    // Show save dialog
                    const userChoice = confirm('You have unsaved changes. Do you want to save before closing?');
                    
                    if (userChoice) {
                        // Try to save
                        try {
                            await this.cueManager.saveShow();
                            console.log('Show saved successfully before close');
                        } catch (error) {
                            console.error('Failed to save before close:', error);
                            const forceClose = confirm('Failed to save. Close anyway?');
                            if (!forceClose) {
                                // Cancel close
                                window.electronAPI.ipcRenderer.send('app-close-response', false);
                                return;
                            }
                        }
                    }
                }
                
                // Allow close
                console.log('Allowing app to close');
                window.electronAPI.ipcRenderer.send('app-close-response', true);
            });

            window.electronAPI.ipcRenderer.on('app-save-before-close', async () => {
                console.log('Received save-before-close request');
                try {
                    await this.cueManager.saveShow();
                    console.log('Save completed before close');
                } catch (error) {
                    console.error('Save failed before close:', error);
                }
            });
        }
    }

    updateUI() {
        this.renderCueList();
        this.updateTransportButtons();
        this.updateShowInfo();
        this.updateCueCount();
        this.updateDisplayRouting();
    }

    renderCueList() {
        if (!this.elements.cueList) return;
        
        this.elements.cueList.innerHTML = '';
        
        this.cueManager.cues.forEach((cue, index) => {
            const cueElement = this.createCueElement(cue, index);
            this.elements.cueList.appendChild(cueElement);
        });
    }

    // ENHANCED: createCueElement with playhead indicator
    createCueElement(cue, index) {
        const element = document.createElement('div');
        element.className = 'cue-item';
        element.dataset.cueId = cue.id;
        
        // Apply state classes correctly
        if (index === this.cueManager.currentCueIndex) {
            element.classList.add('current');
        }
        
        if (cue.status === 'playing') {
            element.classList.add('playing');
        }
        
        if (cue.status === 'loading') {
            element.classList.add('loading');
        }
        
        if (this.cueManager.isCueCurrentlyExecuting && this.cueManager.isCueCurrentlyExecuting(cue.id)) {
            element.classList.add('executing');
        }
        
        if (cue.autoContinue) {
            element.classList.add('auto-continue');
        }

        // Check if cue is selected
        if (this.cueManager.selectedCueId === cue.id) {
            element.classList.add('selected');
        }
        
        // NEW: Add standing by class
        if (this.cueManager.standByCueId === cue.id) {
            element.classList.add('standing-by');
        }
        
        // Create the playhead indicator text
        const playheadIndicator = this.cueManager.standByCueId === cue.id ? '▶ ' : '';
        
        // Use proper HTML structure that matches our CSS
        element.innerHTML = `
            <div class="cue-number">${playheadIndicator}${cue.number}${cue.autoContinue ? ' →' : ''}</div>
            <div class="cue-name">${cue.name}</div>
            <div class="cue-type">${cue.type}</div>
            <div class="cue-duration">${this.formatDuration(cue.duration)}</div>
            <div class="cue-status ${cue.status}">${cue.status}</div>
        `;
        
        // Event handlers (keep existing logic)
        element.addEventListener('click', (e) => {
            if (e.shiftKey) {
                this.cueManager.setStandByCue(cue.id);
            } else {
                this.cueManager.selectCue(cue.id);
            }
        });
        
        element.addEventListener('dblclick', (e) => {
            this.cueManager.goToCue(cue.id);
        });
        
        // FIXED: Single context menu event listener
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Future: context menu implementation
        });
        
        return element;
    }

    selectNextCue() {
        const cues = this.cueManager.cues;
        if (cues.length === 0) return;
        
        const currentSelected = this.cueManager.getSelectedCue();
        let newIndex = 0;
        
        if (currentSelected) {
            const currentIndex = this.cueManager.getCueIndex(currentSelected.id);
            newIndex = Math.min(cues.length - 1, currentIndex + 1);
        }
        
        this.cueManager.selectCue(cues[newIndex].id);
    }

    selectPreviousCue() {
        const cues = this.cueManager.cues;
        if (cues.length === 0) return;
        
        const currentSelected = this.cueManager.getSelectedCue();
        let newIndex = cues.length - 1;
        
        if (currentSelected) {
            const currentIndex = this.cueManager.getCueIndex(currentSelected.id);
            newIndex = Math.max(0, currentIndex - 1);
        }
        
        this.cueManager.selectCue(cues[newIndex].id);
    }

    updateTransportButtons() {
        // Update button states based on playback status
        const isPlaying = this.cueManager.hasActiveCues();
        const isPaused = this.cueManager.isPaused;
        
        if (this.elements.goBtn) {
            this.elements.goBtn.disabled = false;
        }
        
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !isPlaying && !isPaused;
        }
        
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.disabled = !isPlaying;
            this.elements.pauseBtn.textContent = isPaused ? '▶' : '⏸';
        }
    }

    updateShowInfo() {
        if (this.elements.showName) {
            this.elements.showName.textContent = this.cueManager.showName || 'Untitled Show';
        }
        
        if (this.elements.showStatus) {
            const hasActiveCues = this.cueManager.hasActiveCues();
            const isPaused = this.cueManager.isPaused;
            
            let statusClass = 'stopped';
            if (hasActiveCues && !isPaused) {
                statusClass = 'playing';
            } else if (isPaused) {
                statusClass = 'paused';
            }
            
            this.elements.showStatus.className = `status-indicator ${statusClass}`;
        }
    }

    updateCueCount() {
        if (this.elements.cueCount) {
            const count = this.cueManager.cues.length;
            this.elements.cueCount.textContent = `${count} cue${count !== 1 ? 's' : ''}`;
        }
    }

    updateDisplayRouting() {
        if (this.elements.displayRouting && window.displayManager) {
            const routing = window.displayManager.getCurrentRouting();
            if (routing === 'preview') {
                this.elements.displayRouting.textContent = 'Video: Preview';
            } else {
                const displays = window.displayManager.getDisplays();
                const display = displays.find(d => d.id.toString() === routing.toString());
                this.elements.displayRouting.textContent = `Video: ${display ? display.name : 'External Display'}`;
            }
        }
    }

    startTimeUpdater() {
        setInterval(() => {
            if (this.elements.currentTime) {
                const now = new Date();
                this.elements.currentTime.textContent = now.toLocaleTimeString();
            }
        }, 1000);
    }

    renderInspector() {
        const selectedCue = this.cueManager.getSelectedCue();
        const inspectorContent = this.elements.inspectorContent;
        
        if (!selectedCue) {
            inspectorContent.innerHTML = '<div class="inspector-placeholder">Select a cue to view its properties</div>';
            this.currentWaveformCue = null;
            if (this.waveformRenderer) {
                this.waveformRenderer.destroy();
                this.waveformRenderer = null;
            }
            return;
        }

        // Check if we need to preserve the waveform
        const hadWaveform = this.currentWaveformCue && 
                           this.currentWaveformCue.id === selectedCue.id && 
                           this.waveformRenderer;

        inspectorContent.innerHTML = this.generateInspectorHTML(selectedCue);
        this.bindInspectorEvents(selectedCue);

        // Restore waveform if it existed
        if (hadWaveform && selectedCue.type === 'audio') {
            // Re-attach the waveform renderer to the new canvas
            const canvas = document.getElementById('audio-waveform');
            if (canvas && this.waveformRenderer) {
                this.waveformRenderer.canvas = canvas;
                this.waveformRenderer.ctx = canvas.getContext('2d');
                this.waveformRenderer.updateCanvasSize();
                this.waveformRenderer.render();
                console.log('Waveform restored after UI update');
            }
        }
    }

    generateInspectorHTML(selectedCue) {
        const commonFields = `
            <div class="inspector-group">
                <h3>Basic</h3>
                <div class="inspector-field">
                    <label>Number</label>
                    <input type="text" id="cue-number" value="${selectedCue.number}">
                </div>
                <div class="inspector-field">
                    <label>Name</label>
                    <input type="text" id="cue-name" value="${selectedCue.name}">
                </div>
                <div class="inspector-field">
                    <label>Status</label>
                    <input type="text" value="${selectedCue.status}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Type</label>
                    <input type="text" value="${selectedCue.type}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Duration</label>
                    <input type="text" value="${this.formatDuration(selectedCue.duration)}" readonly>
                </div>
            </div>
        `;

        let typeSpecificFields = '';

        switch (selectedCue.type) {
            case 'audio':
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3 class="audio-enhanced">Audio File</h3>
                        <div class="inspector-field">
                            <label>File</label>
                            <input type="text" id="audio-filepath" value="${selectedCue.filePath || ''}" readonly>
                            <button id="select-audio-file" ${!this.apiAvailable ? 'disabled title="API not available"' : ''}>Browse...</button>
                        </div>
                        ${selectedCue.filePath ? `
                            <div class="inspector-field">
                                <label>Waveform</label>
                                <div id="waveform-container" style="border: 1px solid #444; border-radius: 4px; background: #1a1a1a; position: relative;">
                                    <canvas id="audio-waveform" style="width: 100%; height: 120px; display: block;"></canvas>
                                    <div id="waveform-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #888; display: none;">
                                        Analyzing audio...
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        <div class="inspector-field">
                            <label>Volume</label>
                            <input type="range" id="audio-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1}">
                            <span id="volume-display">${Math.round((selectedCue.volume || 1) * 100)}%</span>
                        </div>
                        <div class="inspector-field">
                            <label>Fade In (ms)</label>
                            <input type="number" id="audio-fadein" min="0" step="100" value="${selectedCue.fadeIn || 0}">
                        </div>
                        <div class="inspector-field">
                            <label>Fade Out (ms)</label>
                            <input type="number" id="audio-fadeout" min="0" step="100" value="${selectedCue.fadeOut || 0}">
                        </div>
                        <div class="inspector-field">
                            <label>Start Time (ms)</label>
                            <input type="number" id="audio-starttime" min="0" step="100" value="${selectedCue.startTime || 0}">
                        </div>
                        <div class="inspector-field">
                            <label>End Time (ms)</label>
                            <input type="number" id="audio-endtime" min="0" step="100" value="${selectedCue.endTime || 0}" placeholder="Leave blank for full duration">
                        </div>
                        <div class="inspector-field">
                            <label>
                                <input type="checkbox" id="audio-loop" ${selectedCue.loop ? 'checked' : ''}>
                                Loop
                            </label>
                        </div>
                    </div>
                `;
                break;
                
            case 'video':
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3>Video File</h3>
                        <div class="inspector-field">
                            <label>File</label>
                            <input type="text" id="video-filepath" value="${selectedCue.filePath || ''}" readonly>
                            <button id="select-video-file" ${!this.apiAvailable ? 'disabled title="API not available"' : ''}>Browse...</button>
                        </div>
                        ${selectedCue.filePath ? `
                            <div class="inspector-field">
                                <label>Timeline</label>
                                <div id="video-timeline-container" style="border: 1px solid #444; border-radius: 4px; background: #1a1a1a;">
                                    <canvas id="video-timeline" style="width: 100%; height: 80px; display: block;"></canvas>
                                </div>
                            </div>
                        ` : ''}
                        <div class="inspector-field">
                            <label>Volume</label>
                            <input type="range" id="video-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1}">
                            <span id="video-volume-display">${Math.round((selectedCue.volume || 1) * 100)}%</span>
                        </div>
                        <div class="inspector-field">
                            <label>Aspect Ratio</label>
                            <select id="video-aspect">
                                <option value="auto" ${selectedCue.aspectRatio === 'auto' ? 'selected' : ''}>Auto</option>
                                <option value="16:9" ${selectedCue.aspectRatio === '16:9' ? 'selected' : ''}>16:9</option>
                                <option value="4:3" ${selectedCue.aspectRatio === '4:3' ? 'selected' : ''}>4:3</option>
                                <option value="stretch" ${selectedCue.aspectRatio === 'stretch' ? 'selected' : ''}>Stretch</option>
                            </select>
                        </div>
                        <div class="inspector-field">
                            <label>Fade In (ms)</label>
                            <input type="number" id="video-fadein" min="0" step="100" value="${selectedCue.fadeIn || 0}">
                        </div>
                        <div class="inspector-field">
                            <label>Fade Out (ms)</label>
                            <input type="number" id="video-fadeout" min="0" step="100" value="${selectedCue.fadeOut || 0}">
                        </div>
                        <div class="inspector-field">
                            <label>Opacity</label>
                            <input type="range" id="video-opacity" min="0" max="1" step="0.01" value="${selectedCue.opacity || 1}">
                            <span id="opacity-display">${Math.round((selectedCue.opacity || 1) * 100)}%</span>
                        </div>
                        <div class="inspector-field">
                            <label>
                                <input type="checkbox" id="video-fullscreen" ${selectedCue.fullscreen ? 'checked' : ''}>
                                Fullscreen
                            </label>
                        </div>
                        <div class="inspector-field">
                            <label>
                                <input type="checkbox" id="video-loop" ${selectedCue.loop ? 'checked' : ''}>
                                Loop
                            </label>
                        </div>
                    </div>
                `;
                break;
                
            case 'wait':
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3>Wait</h3>
                        <div class="inspector-field">
                            <label>Duration (ms)</label>
                            <input type="number" id="wait-duration" min="0" step="100" value="${selectedCue.duration || 1000}">
                        </div>
                    </div>
                `;
                break;
                
            case 'group':
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3>Group</h3>
                        <div class="inspector-field">
                            <label>Mode</label>
                            <select id="group-mode">
                                <option value="sequential" ${selectedCue.mode === 'sequential' ? 'selected' : ''}>Sequential</option>
                                <option value="timeline" ${selectedCue.mode === 'timeline' ? 'selected' : ''}>Timeline</option>
                                <option value="random" ${selectedCue.mode === 'random' ? 'selected' : ''}>Random</option>
                            </select>
                        </div>
                    </div>
                `;
                break;
        }

        const autoContinueFields = `
            <div class="inspector-group">
                <h3>Auto Continue</h3>
                <div class="inspector-field">
                    <label>
                        <input type="checkbox" id="auto-continue" ${selectedCue.autoContinue ? 'checked' : ''}>
                        Auto Continue
                    </label>
                </div>
                ${selectedCue.autoContinue ? `
                    <div class="inspector-field">
                        <label>Post Wait (ms)</label>
                        <input type="number" id="post-wait" min="0" step="100" value="${selectedCue.postWait || 0}">
                    </div>
                ` : ''}
            </div>
        `;

        return commonFields + typeSpecificFields + autoContinueFields;
    }

    bindInspectorEvents(selectedCue) {
        // Basic fields
        const numberInput = document.getElementById('cue-number');
        const nameInput = document.getElementById('cue-name');
        
        if (numberInput) {
            numberInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { number: numberInput.value });
            });
        }
        
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { name: nameInput.value });
            });
        }

        // Auto continue
        const autoContinueCheckbox = document.getElementById('auto-continue');
        if (autoContinueCheckbox) {
            autoContinueCheckbox.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { autoContinue: autoContinueCheckbox.checked });
                this.renderInspector(); // Re-render to show/hide post-wait field
            });
        }

        const postWaitInput = document.getElementById('post-wait');
        if (postWaitInput) {
            postWaitInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { postWait: parseInt(postWaitInput.value) || 0 });
            });
        }

        // Type-specific event binding
        switch (selectedCue.type) {
            case 'audio':
                this.bindAudioInspectorEvents(selectedCue);
                break;
            case 'video':
                this.bindVideoInspectorEvents(selectedCue);
                break;
            case 'wait':
                this.bindWaitInspectorEvents(selectedCue);
                break;
            case 'group':
                this.bindGroupInspectorEvents(selectedCue);
                break;
        }
    }

    bindAudioInspectorEvents(selectedCue) {
        // File selection
        const selectFileBtn = document.getElementById('select-audio-file');
        if (selectFileBtn && this.apiAvailable) {
            selectFileBtn.addEventListener('click', async () => {
                try {
                    const result = await window.qlabAPI.selectAudioFile();
                    if (result.success) {
                        this.cueManager.updateCue(selectedCue.id, { filePath: result.filePath });
                        this.renderInspector(); // Re-render to show new file info
                    }
                } catch (error) {
                    console.error('Failed to select audio file:', error);
                }
            });
        }

        // Volume control
        const volumeSlider = document.getElementById('audio-volume');
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', () => {
                const volume = parseFloat(volumeSlider.value);
                volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
                this.cueManager.updateCue(selectedCue.id, { volume: volume });
            });
        }

        // Other audio controls
        const fadeInInput = document.getElementById('audio-fadein');
        if (fadeInInput) {
            fadeInInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { fadeIn: parseInt(fadeInInput.value) || 0 });
            });
        }

        const fadeOutInput = document.getElementById('audio-fadeout');
        if (fadeOutInput) {
            fadeOutInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { fadeOut: parseInt(fadeOutInput.value) || 0 });
            });
        }

        const startTimeInput = document.getElementById('audio-starttime');
        if (startTimeInput) {
            startTimeInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { startTime: parseInt(startTimeInput.value) || 0 });
            });
        }

        const endTimeInput = document.getElementById('audio-endtime');
        if (endTimeInput) {
            endTimeInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { endTime: parseInt(endTimeInput.value) || 0 });
            });
        }

        const loopCheckbox = document.getElementById('audio-loop');
        if (loopCheckbox) {
            loopCheckbox.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { loop: loopCheckbox.checked });
            });
        }

        // Initialize waveform if file is present
        if (selectedCue.filePath) {
            this.initializeWaveform(selectedCue);
        }
    }

    bindVideoInspectorEvents(selectedCue) {
        // File selection
        const selectFileBtn = document.getElementById('select-video-file');
        if (selectFileBtn && this.apiAvailable) {
            selectFileBtn.addEventListener('click', async () => {
                try {
                    const result = await window.qlabAPI.selectVideoFile();
                    if (result.success) {
                        this.cueManager.updateCue(selectedCue.id, { filePath: result.filePath });
                        this.renderInspector(); // Re-render to show new file info
                    }
                } catch (error) {
                    console.error('Failed to select video file:', error);
                }
            });
        }

        // Volume control
        const volumeSlider = document.getElementById('video-volume');
        const volumeDisplay = document.getElementById('video-volume-display');
        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', () => {
                const volume = parseFloat(volumeSlider.value);
                volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
                this.cueManager.updateCue(selectedCue.id, { volume: volume });
            });
        }

        // Opacity control
        const opacitySlider = document.getElementById('video-opacity');
        const opacityDisplay = document.getElementById('opacity-display');
        if (opacitySlider && opacityDisplay) {
            opacitySlider.addEventListener('input', () => {
                const opacity = parseFloat(opacitySlider.value);
                opacityDisplay.textContent = `${Math.round(opacity * 100)}%`;
                this.cueManager.updateCue(selectedCue.id, { opacity: opacity });
            });
        }

        // Other video controls
        const aspectSelect = document.getElementById('video-aspect');
        if (aspectSelect) {
            aspectSelect.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { aspectRatio: aspectSelect.value });
            });
        }

        const fadeInInput = document.getElementById('video-fadein');
        if (fadeInInput) {
            fadeInInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { fadeIn: parseInt(fadeInInput.value) || 0 });
            });
        }

        const fadeOutInput = document.getElementById('video-fadeout');
        if (fadeOutInput) {
            fadeOutInput.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { fadeOut: parseInt(fadeOutInput.value) || 0 });
            });
        }

        const fullscreenCheckbox = document.getElementById('video-fullscreen');
        if (fullscreenCheckbox) {
            fullscreenCheckbox.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { fullscreen: fullscreenCheckbox.checked });
            });
        }

        const loopCheckbox = document.getElementById('video-loop');
        if (loopCheckbox) {
            loopCheckbox.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { loop: loopCheckbox.checked });
            });
        }

        // Initialize video timeline if file is present
        if (selectedCue.filePath && window.videoEngine) {
            this.initializeVideoTimeline(selectedCue);
        }
    }

    bindWaitInspectorEvents(selectedCue) {
        const durationInput = document.getElementById('wait-duration');
        if (durationInput) {
            durationInput.addEventListener('change', () => {
                const duration = parseInt(durationInput.value) || 1000;
                this.cueManager.updateCue(selectedCue.id, { duration: duration });
            });
        }
    }

    bindGroupInspectorEvents(selectedCue) {
        const modeSelect = document.getElementById('group-mode');
        if (modeSelect) {
            modeSelect.addEventListener('change', () => {
                this.cueManager.updateCue(selectedCue.id, { mode: modeSelect.value });
            });
        }
    }

    async initializeWaveform(cue) {
        if (!cue.filePath || !this.audioAnalyzer) {
            console.log('Cannot initialize waveform: missing file path or analyzer');
            return;
        }

        const canvas = document.getElementById('audio-waveform');
        const loadingDiv = document.getElementById('waveform-loading');
        
        if (!canvas) {
            console.log('Waveform canvas not found');
            return;
        }

        try {
            // Show loading state
            if (loadingDiv) {
                loadingDiv.style.display = 'block';
            }

            console.log('Initializing waveform for:', cue.filePath);

            // Initialize waveform renderer
            this.waveformRenderer = new WaveformRenderer(canvas, {
                backgroundColor: '#1a1a1a',
                waveformColor: '#0d7377',
                rmsColor: 'rgba(13, 115, 119, 0.3)',
                playheadColor: '#ffc107',
                showRMS: true,
                showGrid: true
            });

            // Generate waveform data
            const waveformData = await this.audioAnalyzer.generateWaveform(cue.filePath, {
                samples: 1000,
                channel: -1, // Mix stereo to mono
                peakDetection: true,
                rmsCalculation: true
            });

            // Set waveform data in renderer
            this.waveformRenderer.setWaveformData(waveformData);
            this.currentWaveformCue = cue;

            console.log('Waveform initialized successfully');

        } catch (error) {
            console.error('Failed to load waveform:', error);
            
            // Show error in waveform container
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#dc3545';
                ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Waveform analysis failed', canvas.width / 2, canvas.height / 2);
            }
        } finally {
            // Hide loading state
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
        }
    }

    initializeVideoTimeline(cue) {
        if (!cue.filePath || !window.VideoTimeline) {
            console.log('Cannot initialize video timeline: missing file path or VideoTimeline class');
            return;
        }

        const canvas = document.getElementById('video-timeline');
        if (!canvas) {
            console.log('Video timeline canvas not found');
            return;
        }

        try {
            console.log('Initializing video timeline for:', cue.filePath);

            // Create video timeline
            this.videoTimeline = new VideoTimeline(canvas, {
                backgroundColor: '#1a1a1a',
                timelineColor: '#404040',
                playheadColor: '#ffc107',
                frameColor: '#0d7377'
            });

            // If video engine has a preview video with this file, connect it
            if (window.videoEngine && window.videoEngine.videoPreview) {
                const videoPreview = window.videoEngine.videoPreview;
                if (videoPreview.src && videoPreview.src.includes(cue.filePath)) {
                    this.videoTimeline.setVideo(videoPreview);
                    
                    // Set up timeline event handlers
                    this.videoTimeline.on('seek', (time) => {
                        videoPreview.currentTime = time;
                    });
                    
                    this.videoTimeline.on('playToggle', () => {
                        if (videoPreview.paused) {
                            videoPreview.play();
                        } else {
                            videoPreview.pause();
                        }
                    });
                }
            }

            // Auto-preview the video
            if (window.videoEngine && window.videoEngine.previewVideoWithTimeline) {
                window.videoEngine.previewVideoWithTimeline(cue.filePath, canvas);
            }

            console.log('Video timeline initialized successfully');

        } catch (error) {
            console.error('Failed to initialize video timeline:', error);
        }
    }

    // File operations
    newShow() {
        if (this.cueManager.unsavedChanges) {
            const proceed = confirm('You have unsaved changes. Create new show anyway?');
            if (!proceed) return;
        }
        
        this.cueManager.newShow();
        this.showStatusMessage('New show created', 'success');
    }

    async saveShow() {
        if (!this.apiAvailable) {
            this.showStatusMessage('Cannot save: API not available', 'error');
            return;
        }

        try {
            await this.cueManager.saveShow();
            this.showStatusMessage('Show saved successfully', 'success');
        } catch (error) {
            console.error('Save failed:', error);
            this.showStatusMessage('Save failed: ' + error.message, 'error');
        }
    }

    async saveShowAs() {
        if (!this.apiAvailable) {
            this.showStatusMessage('Cannot save: API not available', 'error');
            return;
        }

        try {
            await this.cueManager.saveShowAs();
            this.showStatusMessage('Show saved successfully', 'success');
        } catch (error) {
            console.error('Save As failed:', error);
            this.showStatusMessage('Save As failed: ' + error.message, 'error');
        }
    }

    // Cue operations
    addCue(type) {
        const newCue = this.cueManager.addCue(type);
        this.cueManager.selectCue(newCue.id);
        this.showStatusMessage(`${type} cue added`, 'success');
    }

    deleteSelectedCue() {
        const selectedCue = this.cueManager.getSelectedCue();
        if (!selectedCue) {
            this.showStatusMessage('No cue selected', 'warning');
            return;
        }

        const confirmMessage = `Delete cue "${selectedCue.number} - ${selectedCue.name}"?`;
        if (confirm(confirmMessage)) {
            this.cueManager.removeCue(selectedCue.id);
            this.showStatusMessage('Cue deleted', 'success');
        }
    }

    copyCue() {
        const selectedCue = this.cueManager.getSelectedCue();
        if (!selectedCue) {
            this.showStatusMessage('No cue selected', 'warning');
            return;
        }

        // Store in clipboard (simplified implementation)
        this.clipboard = JSON.parse(JSON.stringify(selectedCue));
        this.showStatusMessage('Cue copied', 'success');
    }

    cutCue() {
        this.copyCue();
        this.deleteSelectedCue();
    }

    pasteCue() {
        if (!this.clipboard) {
            this.showStatusMessage('Nothing to paste', 'warning');
            return;
        }

        const newCue = this.cueManager.addCue(this.clipboard.type, {
            ...this.clipboard,
            id: undefined, // Will get new ID
            number: undefined // Will get new number
        });

        this.cueManager.selectCue(newCue.id);
        this.showStatusMessage('Cue pasted', 'success');
    }

    duplicateCue() {
        this.copyCue();
        this.pasteCue();
    }

    selectAllCues() {
        // Simple implementation - select first cue for now
        if (this.cueManager.cues.length > 0) {
            this.cueManager.selectCue(this.cueManager.cues[0].id);
        }
    }

    emergencyStopAll() {
        this.cueManager.stop();
        this.showStatusMessage('Emergency stop - all playback stopped', 'warning');
    }

    // Settings
    openSettings() {
        const modal = this.elements.settingsModal;
        if (modal) {
            modal.style.display = 'block';
            this.loadDisplaySettings();
            this.loadStartupPreferences();
        }
    }

    closeSettings() {
        const modal = this.elements.settingsModal;
        if (modal) {
            modal.style.display = 'none';
        }
    }

    setupMasterVolumeControl() {
        const existingControl = document.querySelector('.master-volume-control');
        if (existingControl) {
            existingControl.remove();
        }

        const masterVolumeHTML = `
            <div class="master-volume-control" style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                padding: 10px;
                border-radius: 6px;
                border: 1px solid #444;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: #ccc;
                z-index: 1000;
            ">
                <span>Master:</span>
                <input type="range" id="master-volume-slider" min="0" max="1" step="0.01" value="1" style="width: 80px;">
                <span id="master-volume-display">100%</span>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', masterVolumeHTML);

        const slider = document.getElementById('master-volume-slider');
        const display = document.getElementById('master-volume-display');

        if (slider && display) {
            slider.addEventListener('input', () => {
                const volume = parseFloat(slider.value);
                display.textContent = `${Math.round(volume * 100)}%`;
                
                if (this.audioEngine && this.audioEngine.setMasterVolume) {
                    this.audioEngine.setMasterVolume(volume);
                }
                
                if (window.videoEngine && window.videoEngine.setMasterVolume) {
                    window.videoEngine.setMasterVolume(volume);
                }
            });
        }
    }

    async loadDisplaySettings() {
        const displaysList = document.getElementById('displays-list');
        const videoRoutingSelect = document.getElementById('video-routing');

        if (!displaysList || !videoRoutingSelect) {
            console.warn('Display settings elements not found');
            return;
        }

        try {
            // Load displays
            let displays = [];
            if (window.displayManager && this.apiAvailable) {
                await window.displayManager.detectDisplays();
                displays = window.displayManager.getDisplays();
            }

            // Update displays list
            if (displays.length === 0) {
                displaysList.innerHTML = '<p>No external displays detected</p>';
            } else {
                displaysList.innerHTML = displays.map(display => `
                    <div class="display-item" style="padding: 8px; border: 1px solid #444; border-radius: 4px; margin: 4px 0;">
                        <strong>${display.name}</strong><br>
                        <small>Resolution: ${display.resolution} ${display.primary ? '(Primary)' : ''}</small>
                    </div>
                `).join('');
            }

            // Update video routing options
            const routingOptions = window.displayManager ? window.displayManager.getRoutingOptions() : [
                { id: 'preview', name: 'Preview Window', type: 'preview' }
            ];

            videoRoutingSelect.innerHTML = routingOptions.map(option => 
                `<option value="${option.id}">${option.name}</option>`
            ).join('');

            // Set current routing
            if (window.displayManager) {
                const currentRouting = window.displayManager.getCurrentRouting();
                videoRoutingSelect.value = currentRouting;
            }

            // Handle routing changes
            videoRoutingSelect.addEventListener('change', async () => {
                const selectedRouting = videoRoutingSelect.value;
                if (window.displayManager) {
                    const success = await window.displayManager.setVideoRouting(selectedRouting);
                    if (success) {
                        this.updateDisplayRouting();
                        this.showStatusMessage(`Video routing set to: ${videoRoutingSelect.selectedOptions[0].text}`, 'success');
                    } else {
                        this.showStatusMessage('Failed to set video routing', 'error');
                    }
                }
            });

        } catch (error) {
            console.error('Failed to load display settings:', error);
            displaysList.innerHTML = '<p style="color: #dc3545;">Failed to load display information</p>';
        }

        // Set up test pattern and clear buttons
        const testPatternBtn = document.getElementById('test-pattern-btn');
        const clearDisplaysBtn = document.getElementById('clear-displays-btn');
        const refreshDisplaysBtn = document.getElementById('refresh-displays');
        const applySettingsBtn = document.getElementById('apply-settings');

        // Test pattern button
        if (testPatternBtn && window.displayManager && this.apiAvailable) {
            testPatternBtn.addEventListener('click', async () => {
                const currentRouting = window.displayManager.getCurrentRouting();
                if (currentRouting !== 'preview') {
                    await window.displayManager.showTestPattern();
                } else {
                    alert('Test pattern is only available for external displays');
                }
            });
        }

        // Clear displays button
        if (clearDisplaysBtn && window.displayManager && this.apiAvailable) {
            clearDisplaysBtn.addEventListener('click', async () => {
                await window.displayManager.clearAllDisplays();
            });
        }

        // Refresh displays button
        if (refreshDisplaysBtn) {
            refreshDisplaysBtn.addEventListener('click', () => {
                this.loadDisplaySettings();
            });
        }

        // Apply settings button
        if (applySettingsBtn) {
            applySettingsBtn.addEventListener('click', async () => {
                await this.saveStartupPreferences();
                this.closeSettings();
            });
        }

        // Initial update of startup file controls
        this.updateStartupFileControls();
    }

    async loadStartupPreferences() {
        try {
            if (this.apiAvailable && window.qlabAPI) {
                this.appSettings = await window.qlabAPI.loadAppSettings();
                console.log('Loaded app settings:', this.appSettings);
            } else {
                console.warn('API not available for loading settings');
                this.appSettings = this.getDefaultSettings();
            }
        } catch (error) {
            console.error('Failed to load app settings:', error);
            this.appSettings = this.getDefaultSettings();
        }

        // Apply settings to UI
        const templateRadio = document.getElementById('startup-mode-template');
        const fileRadio = document.getElementById('startup-mode-file');
        const emptyRadio = document.getElementById('startup-mode-empty');
        const startupFileInput = document.getElementById('startup-file-path');
        const selectStartupFileBtn = document.getElementById('select-startup-file');

        if (templateRadio && fileRadio && emptyRadio) {
            // Set radio button based on settings
            switch (this.appSettings.startupMode) {
                case 'template':
                    templateRadio.checked = true;
                    break;
                case 'file':
                    fileRadio.checked = true;
                    break;
                case 'empty':
                    emptyRadio.checked = true;
                    break;
            }

            // Set up radio button change handlers
            templateRadio.addEventListener('change', () => this.updateStartupFileControls());
            fileRadio.addEventListener('change', () => this.updateStartupFileControls());
            emptyRadio.addEventListener('change', () => this.updateStartupFileControls());
        }

        // Set file path if available
        if (startupFileInput && this.appSettings.startupFilePath) {
            startupFileInput.value = this.appSettings.startupFilePath;
        }

        // Set up file selection button
        if (selectStartupFileBtn && this.apiAvailable) {
            selectStartupFileBtn.addEventListener('click', async () => {
                try {
                    const result = await window.qlabAPI.selectStartupFile();
                    if (result.success && !result.cancelled) {
                        startupFileInput.value = result.filePath;
                    }
                } catch (error) {
                    console.error('Failed to select startup file:', error);
                    this.showStatusMessage('Failed to select startup file', 'error');
                }
            });
        }

        // Enable/disable file selection based on radio selection
        this.updateStartupFileControls();
    }

    getDefaultSettings() {
        return {
            startupMode: 'template',
            startupFilePath: null,
            preferences: {
                singleCueMode: true,
                autoContinueEnabled: true,
                masterVolume: 1.0
            }
        };
    }

    updateStartupFileControls() {
        const fileRadio = document.getElementById('startup-mode-file');
        const startupFileInput = document.getElementById('startup-file-path');
        const startupFileButton = document.getElementById('select-startup-file');

        if (fileRadio && startupFileInput && startupFileButton) {
            const isFileMode = fileRadio.checked;
            startupFileInput.disabled = !isFileMode;
            startupFileButton.disabled = !isFileMode;

            if (isFileMode) {
                startupFileInput.style.opacity = '1';
                startupFileButton.style.opacity = '1';
            } else {
                startupFileInput.style.opacity = '0.5';
                startupFileButton.style.opacity = '0.5';
            }
        }
    }

    async saveStartupPreferences() {
        try {
            const templateRadio = document.getElementById('startup-mode-template');
            const fileRadio = document.getElementById('startup-mode-file');
            const emptyRadio = document.getElementById('startup-mode-empty');
            const startupFileInput = document.getElementById('startup-file-path');

            if (!templateRadio || !fileRadio || !emptyRadio) {
                console.warn('Startup preference controls not found');
                return;
            }

            // Determine selected mode
            let startupMode = 'template';
            if (fileRadio.checked) {
                startupMode = 'file';
            } else if (emptyRadio.checked) {
                startupMode = 'empty';
            }

            // Get file path if in file mode
            let startupFilePath = null;
            if (startupMode === 'file' && startupFileInput) {
                startupFilePath = startupFileInput.value || null;
            }

            // Update settings
            this.appSettings = {
                ...this.appSettings,
                startupMode: startupMode,
                startupFilePath: startupFilePath
            };

            // Save to file if API is available
            if (this.apiAvailable && window.qlabAPI) {
                const result = await window.qlabAPI.saveAppSettings(this.appSettings);
                if (result.success) {
                    console.log('Startup preferences saved successfully');
                    this.showStatusMessage('Settings saved successfully', 'success');
                } else {
                    console.error('Failed to save startup preferences');
                    this.showStatusMessage('Failed to save settings', 'error');
                }
            } else {
                console.log('Settings saved to memory (API not available)');
                this.showStatusMessage('Settings saved to memory', 'warning');
            }

        } catch (error) {
            console.error('Error saving startup preferences:', error);
            this.showStatusMessage('Error saving settings: ' + error.message, 'error');
        }
    }

    // Helper methods
    formatDuration(duration) {
        if (!duration || duration === 0) return '--';
        
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${remainingSeconds}s`;
        }
    }

    // Status message system
    showStatusMessage(message, type = 'info') {
        console.log(`Status [${type}]: ${message}`);
        
        // Remove existing status messages
        const existingStatus = document.querySelector('.status-message');
        if (existingStatus) {
            existingStatus.remove();
        }

        // Create status message element
        const statusElement = document.createElement('div');
        statusElement.className = `status-message status-${type}`;
        statusElement.textContent = message;
        statusElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            transition: all 0.3s ease;
            pointer-events: none;
        `;

        // Set colors based on type
        switch (type) {
            case 'success':
                statusElement.style.backgroundColor = '#28a745';
                break;
            case 'error':
                statusElement.style.backgroundColor = '#dc3545';
                break;
            case 'warning':
                statusElement.style.backgroundColor = '#ffc107';
                statusElement.style.color = '#000';
                break;
            case 'info':
            default:
                statusElement.style.backgroundColor = '#17a2b8';
                break;
        }

        document.body.appendChild(statusElement);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (statusElement.parentElement) {
                statusElement.style.opacity = '0';
                statusElement.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (statusElement.parentElement) {
                        statusElement.remove();
                    }
                }, 300);
            }
        }, 3000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
}
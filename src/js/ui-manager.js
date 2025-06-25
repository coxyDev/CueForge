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
        
        this.initializeElements();
        this.bindEvents();
        this.setupMenuHandlers();
        this.setupGlobalKeyHandler();
        
        this.ensureSettingsModalHidden();
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
            <strong>API Error:</strong> Preload script failed to load. File operations will not work. 
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
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                console.log('Space pressed - GO');
                this.cueManager.go();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.deleteSelectedCue();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectPreviousCue();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.selectNextCue();
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
            case 'Period':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    console.log('Ctrl+. pressed - STOP');
                    this.cueManager.stop();
                }
                break;
            case 'KeyP':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    console.log('Ctrl+P pressed - PAUSE');
                    this.cueManager.pause();
                }
                break;
        }
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

    setupMasterVolumeControl() {
        const existingControl = document.querySelector('.master-volume-control');
        if (existingControl) {
            existingControl.remove();
        }
        
        const volumeControl = document.createElement('div');
        volumeControl.className = 'master-volume-control';
        volumeControl.innerHTML = `
            <label for="master-volume">Master</label>
            <input type="range" id="master-volume" min="0" max="1" step="0.01" value="${this.cueManager.getMasterVolume()}">
            <span id="master-volume-display">${Math.round(this.cueManager.getMasterVolume() * 100)}%</span>
        `;
        
        const transportControls = document.querySelector('.transport-controls');
        if (transportControls) {
            transportControls.appendChild(volumeControl);
        }
        
        const volumeSlider = document.getElementById('master-volume');
        const volumeDisplay = document.getElementById('master-volume-display');
        
        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
            });
            
            volumeSlider.addEventListener('change', (e) => {
                const volume = parseFloat(e.target.value);
                this.cueManager.setMasterVolume(volume);
            });
        }
        
        this.cueManager.on('volumeChanged', (data) => {
            const slider = document.getElementById('master-volume');
            const display = document.getElementById('master-volume-display');
            if (slider && display) {
                slider.value = data.masterVolume;
                display.textContent = `${Math.round(data.masterVolume * 100)}%`;
            }
        });
    }

    bindEvents() {
        this.elements.goBtn.addEventListener('click', () => this.cueManager.go());
        this.elements.stopBtn.addEventListener('click', () => this.cueManager.stop());
        this.elements.pauseBtn.addEventListener('click', () => this.cueManager.pause());
        
        this.elements.addAudioCue.addEventListener('click', () => this.addCue('audio'));
        this.elements.addVideoCue.addEventListener('click', () => this.addCue('video'));
        this.elements.addWaitCue.addEventListener('click', () => this.addCue('wait'));
        this.elements.addGroupCue.addEventListener('click', () => this.addCue('group'));
        this.elements.deleteCue.addEventListener('click', () => this.deleteSelectedCue());
        
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });
        
        this.cueManager.on('cueAdded', (data) => this.onCueAdded(data));
        this.cueManager.on('cueRemoved', (data) => this.onCueRemoved(data));
        this.cueManager.on('cueUpdated', (data) => this.onCueUpdated(data));
        this.cueManager.on('selectionChanged', (data) => this.onSelectionChanged(data));
        this.cueManager.on('playbackStateChanged', (data) => this.onPlaybackStateChanged(data));
        this.cueManager.on('showChanged', (data) => this.onShowChanged(data));
        this.cueManager.on('settingsChanged', (data) => this.onSettingsChanged(data));
    }

    setupMenuHandlers() {
        // Set up menu event handler using the new secure API
        if (this.apiAvailable && window.qlabAPI && window.qlabAPI.onMenuEvent) {
            this.menuUnsubscriber = window.qlabAPI.onMenuEvent((channel, ...args) => {
                switch (channel) {
                    case 'menu-new-show':
                        this.cueManager.newShow();
                        break;
                    case 'menu-open-show':
                        this.cueManager.loadShow(args[0]);
                        break;
                    case 'menu-save-show':
                        this.cueManager.saveShow();
                        break;
                    case 'menu-add-cue':
                        this.addCue(args[0]);
                        break;
                    case 'menu-delete-cue':
                        this.deleteSelectedCue();
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
                }
            });
        } else {
            console.warn('Menu handlers not set up - API not available');
        }
    }

    addCue(type) {
        console.log(`Attempting to add ${type} cue...`);
        
        if (!this.apiAvailable) {
            console.error('Cannot add cue: APIs not available');
            alert('Cannot add cue: Preload script failed to load. Please restart the application.');
            return;
        }
        
        let options = {};
        
        if (type === 'audio') {
            console.log('Adding audio cue...');
            this.selectAudioFile().then((result) => {
                console.log('Audio file selection result:', result);
                if (result.success) {
                    options.filePath = result.filePath;
                    options.name = window.electronAPI.path.basename(result.filePath, window.electronAPI.path.extname(result.filePath));
                    
                    this.audioEngine.getAudioFileInfo(result.filePath).then((audioInfo) => {
                        if (audioInfo) {
                            options.duration = audioInfo.duration;
                        }
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                        console.log('Audio cue added successfully:', cue);
                    }).catch((error) => {
                        console.warn('Could not get audio file info:', error);
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                        console.log('Audio cue added without duration info:', cue);
                    });
                } else {
                    console.log('Audio file selection cancelled or failed');
                }
            }).catch((error) => {
                console.error('Error selecting audio file:', error);
                alert('Error selecting audio file: ' + error.message);
            });
        } else if (type === 'video') {
            console.log('Adding video cue...');
            this.selectVideoFile().then((result) => {
                console.log('Video file selection result:', result);
                if (result.success) {
                    options.filePath = result.filePath;
                    options.name = window.electronAPI.path.basename(result.filePath, window.electronAPI.path.extname(result.filePath));
                    
                    window.videoEngine.getVideoFileInfo(result.filePath).then((videoInfo) => {
                        if (videoInfo) {
                            options.duration = videoInfo.duration;
                        }
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                        window.videoEngine.previewVideoInInspector(result.filePath);
                        console.log('Video cue added successfully:', cue);
                    }).catch((error) => {
                        console.warn('Could not get video file info:', error);
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                        console.log('Video cue added without duration info:', cue);
                    });
                } else {
                    console.log('Video file selection cancelled or failed');
                }
            }).catch((error) => {
                console.error('Error selecting video file:', error);
                alert('Error selecting video file: ' + error.message);
            });
        } else {
            // For wait and group cues, no file selection needed
            console.log(`Adding ${type} cue (no file required)...`);
            const cue = this.cueManager.addCue(type, options);
            this.cueManager.selectCue(cue.id);
            console.log(`${type} cue added successfully:`, cue);
        }
    }

    async selectAudioFile() {
        if (!this.apiAvailable || !window.qlabAPI) {
            throw new Error('qlabAPI not available');
        }
        
        try {
            console.log('Calling qlabAPI.selectAudioFile()...');
            const result = await window.qlabAPI.selectAudioFile();
            console.log('selectAudioFile result:', result);
            return result;
        } catch (error) {
            console.error('Error in selectAudioFile:', error);
            throw error;
        }
    }

    async selectVideoFile() {
        if (!this.apiAvailable || !window.qlabAPI) {
            throw new Error('qlabAPI not available');
        }
        
        try {
            console.log('Calling qlabAPI.selectVideoFile()...');
            const result = await window.qlabAPI.selectVideoFile();
            console.log('selectVideoFile result:', result);
            return result;
        } catch (error) {
            console.error('Error in selectVideoFile:', error);
            throw error;
        }
    }

    deleteSelectedCue() {
        const selectedCue = this.cueManager.getSelectedCue();
        if (selectedCue) {
            if (selectedCue.status === 'playing' || selectedCue.status === 'loading') {
                console.log(`Stopping cue before deletion: ${selectedCue.name}`);
                this.cueManager.stopSpecificCue(selectedCue.id);
            }
            this.cueManager.removeCue(selectedCue.id);
        }
    }

    selectPreviousCue() {
        const cues = this.cueManager.cues;
        if (cues.length === 0) return;
        
        const currentIndex = this.cueManager.selectedCueId ? 
            this.cueManager.getCueIndex(this.cueManager.selectedCueId) : 0;
        const previousIndex = Math.max(0, currentIndex - 1);
        
        this.cueManager.selectCue(cues[previousIndex].id);
    }

    selectNextCue() {
        const cues = this.cueManager.cues;
        if (cues.length === 0) return;
        
        const currentIndex = this.cueManager.selectedCueId ? 
            this.cueManager.getCueIndex(this.cueManager.selectedCueId) : -1;
        const nextIndex = Math.min(cues.length - 1, currentIndex + 1);
        
        this.cueManager.selectCue(cues[nextIndex].id);
    }

    onCueAdded(data) {
        this.renderCueList();
        this.updateCueCount();
    }

    onCueRemoved(data) {
        this.renderCueList();
        this.updateCueCount();
    }

    onCueUpdated(data) {
        this.updateCueElement(data.cue);
        
        // If this is the selected cue, update inspector but preserve waveform
        if (data.cue.id === this.cueManager.selectedCueId) {
            const hadWaveform = this.currentWaveformCue && 
                               this.currentWaveformCue.id === data.cue.id && 
                               this.waveformRenderer;
            
            // Re-render inspector
            this.renderInspector();
            
            // If waveform was lost during update, reload it
            if (hadWaveform && data.cue.type === 'audio' && !this.waveformRenderer) {
                this.loadWaveformForCue(data.cue);
            }
        }
    }

    onSelectionChanged(data) {
        this.updateSelection();
        this.renderInspector();
    }

    onPlaybackStateChanged(data) {
        this.updateTransportControls();
        this.updateShowStatus();
        this.renderCueList();
        this.updateWaveformPlayback();
        
        if (window.app && window.app.getCueManager) {
            const debugInfo = window.app.getCueManager().getDebugInfo();
            console.log('Playback state changed:', debugInfo);
        }
    }

    onShowChanged(data) {
        this.updateShowName();
        if (data.loaded || data.reordered) {
            this.renderCueList();
        }
        this.updateCueCount();
    }

    onSettingsChanged(data) {
        console.log('Settings changed:', data);
        this.updateTransportControls();
        
        if (this.elements.settingsModal && this.elements.settingsModal.style.display === 'flex') {
            this.loadDisplaySettings();
        }
    }

    updateUI() {
        this.updateShowName();
        this.updateShowStatus();
        this.updateTransportControls();
        this.renderCueList();
        this.updateCueCount();
        this.renderInspector();
    }

    updateShowName() {
        const name = this.cueManager.showName + (this.cueManager.unsavedChanges ? ' *' : '');
        this.elements.showName.textContent = name;
        document.title = `${name} - QLab Clone`;
    }

    updateShowStatus() {
        const status = this.elements.showStatus;
        
        if (this.cueManager.isPlaying) {
            status.className = 'status-indicator playing';
        } else if (this.cueManager.isPaused) {
            status.className = 'status-indicator paused';
        } else {
            status.className = 'status-indicator stopped';
        }
    }

    updateTransportControls() {
        const { goBtn, stopBtn, pauseBtn } = this.elements;
        
        if (this.cueManager.isPlaying) {
            goBtn.textContent = 'GO';
            goBtn.disabled = this.cueManager.singleCueMode && this.cueManager.isAnyThingPlaying();
        } else if (this.cueManager.isPaused) {
            goBtn.textContent = 'RESUME';
            goBtn.disabled = false;
        } else {
            goBtn.textContent = 'GO';
            goBtn.disabled = this.cueManager.cues.length === 0;
        }
        
        if (this.cueManager.singleCueMode && this.cueManager.isAnyThingPlaying() && !this.cueManager.isPaused) {
            goBtn.classList.add('single-cue-blocked');
            goBtn.title = 'Single Cue Mode: Stop current cue or wait for completion';
        } else {
            goBtn.classList.remove('single-cue-blocked');
            goBtn.title = 'Go (Space)';
        }
        
        stopBtn.disabled = !this.cueManager.isPlaying && !this.cueManager.isPaused && !this.cueManager.isAnyThingPlaying();
        pauseBtn.disabled = !this.cueManager.isPlaying;
    }

    updateCueCount() {
        const stats = this.cueManager.getCueStats();
        let countText = `${stats.total} cue${stats.total !== 1 ? 's' : ''}`;
        
        if (stats.playing > 0) {
            countText += ` (${stats.playing} playing)`;
        }
        if (stats.executing > 0) {
            countText += ` (${stats.executing} executing)`;
        }
        
        this.elements.cueCount.textContent = countText;
    }

    renderCueList() {
        const cueList = this.elements.cueList;
        cueList.innerHTML = '';
        
        this.cueManager.cues.forEach((cue, index) => {
            const cueElement = this.createCueElement(cue, index);
            cueList.appendChild(cueElement);
        });
        
        this.updateSelection();
    }

    createCueElement(cue, index) {
        const element = document.createElement('div');
        element.className = 'cue-item';
        element.dataset.cueId = cue.id;
        
        if (index === this.cueManager.currentCueIndex) {
            element.classList.add('current');
        }
        
        if (cue.status === 'playing') {
            element.classList.add('playing');
        }
        
        if (cue.status === 'loading') {
            element.classList.add('loading');
        }
        
        if (this.cueManager.isCueCurrentlyExecuting(cue.id)) {
            element.classList.add('executing');
        }
        
        if (cue.autoContinue) {
            element.classList.add('auto-continue');
        }
        
        element.innerHTML = `
            <div class="cue-number">${cue.number}${cue.autoContinue ? ' →' : ''}</div>
            <div class="cue-name">${cue.name}</div>
            <div class="cue-type">${cue.type}</div>
            <div class="cue-duration">${this.formatDuration(cue.duration)}</div>
            <div class="cue-status ${cue.status}">${cue.status}</div>
        `;
        
        element.addEventListener('click', () => {
            this.cueManager.selectCue(cue.id);
        });
        
        element.addEventListener('dblclick', () => {
            if (!this.cueManager.singleCueMode || !this.cueManager.isAnyThingPlaying()) {
                this.cueManager.playCue(cue.id);
            } else {
                console.log('Single cue mode: Cannot start cue while another is playing');
            }
        });
        
        return element;
    }

    updateCueElement(cue) {
        const element = document.querySelector(`[data-cue-id="${cue.id}"]`);
        if (element) {
            element.querySelector('.cue-number').textContent = cue.number + (cue.autoContinue ? ' →' : '');
            element.querySelector('.cue-name').textContent = cue.name;
            element.querySelector('.cue-duration').textContent = this.formatDuration(cue.duration);
            
            const statusElement = element.querySelector('.cue-status');
            statusElement.textContent = cue.status;
            statusElement.className = `cue-status ${cue.status}`;
            
            element.classList.toggle('playing', cue.status === 'playing');
            element.classList.toggle('loading', cue.status === 'loading');
            element.classList.toggle('executing', this.cueManager.isCueCurrentlyExecuting(cue.id));
            element.classList.toggle('auto-continue', cue.autoContinue);
        }
    }

    updateSelection() {
        if (this.selectedCueElement) {
            this.selectedCueElement.classList.remove('selected');
        }
        
        if (this.cueManager.selectedCueId) {
            this.selectedCueElement = document.querySelector(`[data-cue-id="${this.cueManager.selectedCueId}"]`);
            if (this.selectedCueElement) {
                this.selectedCueElement.classList.add('selected');
            }
        } else {
            this.selectedCueElement = null;
        }
    }

    formatDuration(milliseconds) {
        if (!milliseconds || milliseconds === 0) return '00:00.000';
        
        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor(milliseconds % 1000);
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { hour12: false });
    }

    startTimeUpdater() {
        setInterval(() => {
            if (this.elements.currentTime) {
                this.elements.currentTime.textContent = this.formatTime(new Date());
            }
            this.updateWaveformPlayback();
        }, 100);
        
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(new Date());
        }
    }

    async openSettings() {
        this.elements.settingsModal.style.display = 'flex';
        this.elements.settingsModal.classList.add('show');
        await this.loadDisplaySettings();
    }

    closeSettings() {
        this.elements.settingsModal.style.display = 'none';
        this.elements.settingsModal.classList.remove('show');
    }

    async loadDisplaySettings() {
        try {
            const singleCueModeCheckbox = document.getElementById('single-cue-mode');
            const autoContinueCheckbox = document.getElementById('auto-continue-enabled');
            
            if (singleCueModeCheckbox) {
                singleCueModeCheckbox.checked = this.cueManager.getSingleCueMode();
            }
            if (autoContinueCheckbox) {
                autoContinueCheckbox.checked = this.cueManager.getAutoContinueEnabled();
            }
            
            if (this.apiAvailable && window.displayManager) {
                const displays = await window.qlabAPI.getDisplays();
                
                const displaysList = document.getElementById('displays-list');
                if (displaysList) {
                    if (displays.length === 0) {
                        displaysList.innerHTML = '<p>No external displays detected</p>';
                    } else {
                        displaysList.innerHTML = displays.map(display => `
                            <div class="display-item ${display.primary ? 'display-primary' : ''}">
                                <h4>${display.name}</h4>
                                <div class="display-info">
                                    Resolution: ${display.resolution}<br>
                                    ${display.primary ? 'Primary Display' : 'Secondary Display'}
                                </div>
                            </div>
                        `).join('');
                    }
                }
                
                const routingSelect = document.getElementById('video-routing');
                if (routingSelect && window.displayManager) {
                    const routingOptions = window.displayManager.getRoutingOptions();
                    const currentRouting = window.displayManager.getCurrentRouting();
                    
                    routingSelect.innerHTML = routingOptions.map(option => 
                        `<option value="${option.id}" ${option.id.toString() === currentRouting.toString() ? 'selected' : ''}>
                            ${option.name} ${option.resolution ? `(${option.resolution})` : ''}
                        </option>`
                    ).join('');
                    
                    const selectedOption = routingOptions.find(opt => opt.id.toString() === currentRouting.toString());
                    this.elements.displayRouting.textContent = `Video: ${selectedOption ? selectedOption.name : 'Unknown'}`;
                }
            } else {
                const displaysList = document.getElementById('displays-list');
                if (displaysList) {
                    displaysList.innerHTML = '<p>Display manager not available (API error)</p>';
                }
            }
            
            this.setupSettingsEventHandlers();
            
        } catch (error) {
            console.error('Failed to load display settings:', error);
        }
    }

    setupSettingsEventHandlers() {
        const singleCueModeCheckbox = document.getElementById('single-cue-mode');
        const autoContinueCheckbox = document.getElementById('auto-continue-enabled');
        const videoRoutingSelect = document.getElementById('video-routing');
        const testPatternBtn = document.getElementById('test-pattern-btn');
        const clearDisplaysBtn = document.getElementById('clear-displays-btn');
        const refreshDisplaysBtn = document.getElementById('refresh-displays');
        const applySettingsBtn = document.getElementById('apply-settings');
        
        // Remove existing event listeners by cloning elements
        if (singleCueModeCheckbox) {
            const newCheckbox = singleCueModeCheckbox.cloneNode(true);
            singleCueModeCheckbox.parentNode.replaceChild(newCheckbox, singleCueModeCheckbox);
            newCheckbox.addEventListener('change', (e) => {
                this.cueManager.setSingleCueMode(e.target.checked);
            });
        }
        
        if (autoContinueCheckbox) {
            const newCheckbox = autoContinueCheckbox.cloneNode(true);
            autoContinueCheckbox.parentNode.replaceChild(newCheckbox, autoContinueCheckbox);
            newCheckbox.addEventListener('change', (e) => {
                this.cueManager.setAutoContinueEnabled(e.target.checked);
            });
        }

        // Video routing
        if (videoRoutingSelect && window.displayManager && this.apiAvailable) {
            videoRoutingSelect.addEventListener('change', async (e) => {
                const success = await window.displayManager.setVideoRouting(e.target.value);
                if (success) {
                    const selectedOption = videoRoutingSelect.options[videoRoutingSelect.selectedIndex];
                    this.elements.displayRouting.textContent = `Video: ${selectedOption.text}`;
                }
            });
        }

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
            applySettingsBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }
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
                            <div class="waveform-container" title="Double-click to play/pause, drag edges to trim">
                                <canvas id="audio-waveform" class="waveform-canvas"></canvas>
                                <div class="waveform-loading" id="waveform-loading" style="display: none;">
                                    Analyzing audio...
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="inspector-group">
                        <h3 class="audio-enhanced">Audio Properties</h3>
                        <div class="inspector-field audio-control">
                            <label>Volume: <span id="audio-volume-display">${Math.round((selectedCue.volume || 1.0) * 100)}%</span></label>
                            <input type="range" id="audio-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1.0}">
                        </div>
                        <div class="inspector-field">
                            <label>Start Time (ms)</label>
                            <input type="number" id="audio-starttime" value="${selectedCue.startTime || 0}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>End Time (ms)</label>
                            <input type="number" id="audio-endtime" value="${selectedCue.endTime || ''}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade In (ms)</label>
                            <input type="number" id="audio-fadein" value="${selectedCue.fadeIn || 0}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade Out (ms)</label>
                            <input type="number" id="audio-fadeout" value="${selectedCue.fadeOut || 0}" min="0">
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
                    </div>
                    <div class="inspector-group">
                        <h3>Video Properties</h3>
                        <div class="inspector-field video-control">
                            <label>Volume: <span id="video-volume-display">${Math.round((selectedCue.volume || 1.0) * 100)}%</span></label>
                            <input type="range" id="video-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1.0}">
                        </div>
                        <div class="inspector-field">
                            <label>Start Time (ms)</label>
                            <input type="number" id="video-starttime" value="${selectedCue.startTime || 0}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>End Time (ms)</label>
                            <input type="number" id="video-endtime" value="${selectedCue.endTime || ''}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade In (ms)</label>
                            <input type="number" id="video-fadein" value="${selectedCue.fadeIn || 0}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade Out (ms)</label>
                            <input type="number" id="video-fadeout" value="${selectedCue.fadeOut || 0}" min="0">
                        </div>
                    </div>
                    <div class="inspector-group">
                        <h3>Display & Geometry</h3>
                        <div class="inspector-field">
                            <label>Aspect Ratio</label>
                            <select id="video-aspectratio">
                                <option value="auto" ${selectedCue.aspectRatio === 'auto' ? 'selected' : ''}>Auto</option>
                                <option value="16:9" ${selectedCue.aspectRatio === '16:9' ? 'selected' : ''}>16:9</option>
                                <option value="4:3" ${selectedCue.aspectRatio === '4:3' ? 'selected' : ''}>4:3</option>
                                <option value="stretch" ${selectedCue.aspectRatio === 'stretch' ? 'selected' : ''}>Stretch</option>
                            </select>
                        </div>
                        <div class="inspector-field">
                            <label>Opacity: <span id="video-opacity-display">${Math.round((selectedCue.opacity || 1.0) * 100)}%</span></label>
                            <input type="range" id="video-opacity" min="0" max="1" step="0.01" value="${selectedCue.opacity || 1.0}">
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
                        <h3>Wait Properties</h3>
                        <div class="inspector-field">
                            <label>Duration (ms)</label>
                            <input type="number" id="wait-duration" value="${selectedCue.duration || 5000}" min="0">
                        </div>
                    </div>
                `;
                break;

            case 'group':
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3>Group Properties</h3>
                        <div class="inspector-field">
                            <label>Mode</label>
                            <select id="group-mode">
                                <option value="sequential" ${selectedCue.mode === 'sequential' ? 'selected' : ''}>Sequential</option>
                                <option value="parallel" ${selectedCue.mode === 'parallel' ? 'selected' : ''}>Parallel</option>
                            </select>
                        </div>
                        <div class="inspector-field">
                            <label>Children</label>
                            <input type="text" value="${(selectedCue.children || []).length} child cues" readonly>
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
                <div class="inspector-field">
                    <label>Continue Delay (ms)</label>
                    <input type="number" id="continue-delay" value="${selectedCue.continueDelay || 0}" min="0" ${!selectedCue.autoContinue ? 'disabled' : ''}>
                </div>
            </div>
        `;

        return commonFields + typeSpecificFields + autoContinueFields;
    }

    bindInspectorEvents(selectedCue) {
        // Basic fields
        const cueNumber = document.getElementById('cue-number');
        const cueName = document.getElementById('cue-name');

        if (cueNumber) {
            cueNumber.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { number: e.target.value });
            });
        }

        if (cueName) {
            cueName.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { name: e.target.value });
            });
        }

        // Type-specific bindings
        if (selectedCue.type === 'audio') {
            this.bindAudioInspectorEvents(selectedCue);
        } else if (selectedCue.type === 'video') {
            this.bindVideoInspectorEvents(selectedCue);
        } else if (selectedCue.type === 'wait') {
            this.bindWaitInspectorEvents(selectedCue);
        } else if (selectedCue.type === 'group') {
            this.bindGroupInspectorEvents(selectedCue);
        }

        // Auto-continue bindings
        this.bindAutoContinueEvents(selectedCue);

        // Load waveform for audio cues if not already loaded
        if (selectedCue.type === 'audio' && selectedCue.filePath && 
            (!this.currentWaveformCue || this.currentWaveformCue.id !== selectedCue.id)) {
            this.loadWaveformForCue(selectedCue);
        }
    }

    bindAudioInspectorEvents(selectedCue) {
        const selectAudioFile = document.getElementById('select-audio-file');
        const audioVolume = document.getElementById('audio-volume');
        const audioVolumeDisplay = document.getElementById('audio-volume-display');
        const audioStartTime = document.getElementById('audio-starttime');
        const audioEndTime = document.getElementById('audio-endtime');
        const audioFadeIn = document.getElementById('audio-fadein');
        const audioFadeOut = document.getElementById('audio-fadeout');
        const audioLoop = document.getElementById('audio-loop');

        if (selectAudioFile && !selectAudioFile.disabled) {
            selectAudioFile.addEventListener('click', async () => {
                try {
                    const result = await this.selectAudioFile();
                    if (result.success) {
                        const updates = { filePath: result.filePath };
                        try {
                            const audioInfo = await this.audioEngine.getAudioFileInfo(result.filePath);
                            if (audioInfo) {
                                updates.duration = audioInfo.duration;
                            }
                        } catch (error) {
                            console.warn('Could not get audio file info:', error);
                        }
                        this.cueManager.updateCue(selectedCue.id, updates);
                    }
                } catch (error) {
                    console.error('Error selecting audio file:', error);
                    alert('Error selecting audio file: ' + error.message);
                }
            });
        }

        if (audioVolume && audioVolumeDisplay) {
            const updateVolumeDisplay = () => {
                audioVolumeDisplay.textContent = `${Math.round(audioVolume.value * 100)}%`;
            };

            audioVolume.addEventListener('input', updateVolumeDisplay);
            audioVolume.addEventListener('change', (e) => {
                const volume = parseFloat(e.target.value);
                this.cueManager.updateCue(selectedCue.id, { volume });
                
                // Update live volume if currently playing
                if (window.audioEngine && selectedCue.status === 'playing') {
                    window.audioEngine.setCueVolume(selectedCue.id, volume);
                }
            });
        }

        if (audioFadeIn) {
            audioFadeIn.addEventListener('change', (e) => {
                const fadeIn = Math.max(0, parseInt(e.target.value) || 0);
                this.cueManager.updateCue(selectedCue.id, { fadeIn });
                console.log(`Fade In updated for "${selectedCue.name}": ${fadeIn}ms`);
            });
        }

        if (audioFadeOut) {
            audioFadeOut.addEventListener('change', (e) => {
                const fadeOut = Math.max(0, parseInt(e.target.value) || 0);
                this.cueManager.updateCue(selectedCue.id, { fadeOut });
                console.log(`Fade Out updated for "${selectedCue.name}": ${fadeOut}ms`);
            });
        }

        if (audioStartTime) {
            audioStartTime.addEventListener('change', (e) => {
                const startTime = Math.max(0, parseInt(e.target.value) || 0);
                this.cueManager.updateCue(selectedCue.id, { startTime });
            });
        }

        if (audioEndTime) {
            audioEndTime.addEventListener('change', (e) => {
                const endTime = parseInt(e.target.value) || null;
                this.cueManager.updateCue(selectedCue.id, { endTime });
            });
        }

        if (audioLoop) {
            audioLoop.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { loop: e.target.checked });
            });
        }
    }

    bindVideoInspectorEvents(selectedCue) {
        const selectVideoFile = document.getElementById('select-video-file');
        const videoVolume = document.getElementById('video-volume');
        const videoVolumeDisplay = document.getElementById('video-volume-display');
        const videoAspectRatio = document.getElementById('video-aspectratio');
        const videoOpacity = document.getElementById('video-opacity');
        const videoOpacityDisplay = document.getElementById('video-opacity-display');
        const videoFullscreen = document.getElementById('video-fullscreen');
        const videoLoop = document.getElementById('video-loop');

        if (selectVideoFile && !selectVideoFile.disabled) {
            selectVideoFile.addEventListener('click', async () => {
                try {
                    const result = await this.selectVideoFile();
                    if (result.success) {
                        const updates = { filePath: result.filePath };
                        try {
                            const videoInfo = await window.videoEngine.getVideoFileInfo(result.filePath);
                            if (videoInfo) {
                                updates.duration = videoInfo.duration;
                            }
                        } catch (error) {
                            console.warn('Could not get video file info:', error);
                        }
                        this.cueManager.updateCue(selectedCue.id, updates);
                        window.videoEngine.previewVideoInInspector(result.filePath);
                    }
                } catch (error) {
                    console.error('Error selecting video file:', error);
                    alert('Error selecting video file: ' + error.message);
                }
            });
        }

        if (videoVolume && videoVolumeDisplay) {
            videoVolume.addEventListener('input', () => {
                videoVolumeDisplay.textContent = `${Math.round(videoVolume.value * 100)}%`;
            });
            
            videoVolume.addEventListener('change', (e) => {
                const volume = parseFloat(e.target.value);
                this.cueManager.updateCue(selectedCue.id, { volume });
                
                // Update live volume if currently playing
                if (window.videoEngine && selectedCue.status === 'playing') {
                    window.videoEngine.setCueVolume(selectedCue.id, volume);
                }
            });
        }

        if (videoAspectRatio) {
            videoAspectRatio.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { aspectRatio: e.target.value });
            });
        }

        if (videoOpacity && videoOpacityDisplay) {
            videoOpacity.addEventListener('input', () => {
                videoOpacityDisplay.textContent = `${Math.round(videoOpacity.value * 100)}%`;
            });
            
            videoOpacity.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { opacity: parseFloat(e.target.value) });
            });
        }

        if (videoFullscreen) {
            videoFullscreen.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { fullscreen: e.target.checked });
            });
        }

        if (videoLoop) {
            videoLoop.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { loop: e.target.checked });
            });
        }
    }

    bindWaitInspectorEvents(selectedCue) {
        const waitDuration = document.getElementById('wait-duration');

        if (waitDuration) {
            waitDuration.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { duration: parseInt(e.target.value) || 5000 });
            });
        }
    }

    bindGroupInspectorEvents(selectedCue) {
        const groupMode = document.getElementById('group-mode');

        if (groupMode) {
            groupMode.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { mode: e.target.value });
            });
        }
    }

    bindAutoContinueEvents(selectedCue) {
        const autoContinue = document.getElementById('auto-continue');
        const continueDelay = document.getElementById('continue-delay');

        if (autoContinue) {
            autoContinue.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                this.cueManager.updateCue(selectedCue.id, { autoContinue: enabled });
                
                if (continueDelay) {
                    continueDelay.disabled = !enabled;
                }
            });
        }

        if (continueDelay) {
            continueDelay.addEventListener('change', (e) => {
                this.cueManager.updateCue(selectedCue.id, { continueDelay: parseInt(e.target.value) || 0 });
            });
        }
    }

    // Waveform related methods
    updateWaveformPlayback() {
        if (this.waveformRenderer && this.currentWaveformCue) {
            const cue = this.currentWaveformCue;
            const isPlaying = this.cueManager.isPlaying && 
                            this.cueManager.getSelectedCue()?.id === cue.id && 
                            cue.status === 'playing';
            
            let currentTime = 0;
            if (isPlaying && window.audioEngine) {
                const playbackStatus = window.audioEngine.getPlaybackStatus();
                if (playbackStatus[cue.id]) {
                    currentTime = playbackStatus[cue.id].currentTime;
                }
            }
            
            this.waveformRenderer.updatePlayback(isPlaying, currentTime);
        }
    }

    async loadWaveformForCue(cue) {
        const canvas = document.getElementById('audio-waveform');
        const loadingDiv = document.getElementById('waveform-loading');
        
        if (!canvas || !cue.filePath) return;

        try {
            // Show loading state
            if (loadingDiv) {
                loadingDiv.style.display = 'flex';
            }

            console.log('Loading waveform for:', cue.name);
            
            // Generate waveform data
            const waveformData = await this.audioAnalyzer.generateWaveform(cue.filePath, {
                samples: Math.min(1000, canvas.offsetWidth * 2) // Responsive sample count
            });

            // Create or update waveform renderer
            if (this.waveformRenderer) {
                this.waveformRenderer.destroy();
            }

            this.waveformRenderer = new WaveformRenderer(canvas, {
                backgroundColor: '#1a1a1a',
                waveformColor: '#0d7377',
                rmsColor: 'rgba(13, 115, 119, 0.3)',
                playheadColor: '#ffc107',
                gridColor: 'rgba(255, 255, 255, 0.1)',
                textColor: '#b0b0b0'
            });

            // Set waveform data
            this.waveformRenderer.setWaveformData(waveformData);
            this.currentWaveformCue = cue;

            // Set up event listeners
            this.waveformRenderer.on('timeUpdate', (time) => {
                console.log('Waveform seek to:', time);
            });

            this.waveformRenderer.on('trimChange', (trimPoints) => {
                const trimInSeconds = this.waveformRenderer.getTrimPointsInSeconds();
                this.cueManager.updateCue(cue.id, {
                    startTime: Math.round(trimInSeconds.start * 1000),
                    endTime: Math.round(trimInSeconds.end * 1000)
                });
            });

            this.waveformRenderer.on('playToggle', () => {
                if (this.cueManager.isPlaying && this.cueManager.getSelectedCue()?.id === cue.id) {
                    this.cueManager.pause();
                } else {
                    this.cueManager.playCue(cue.id);
                }
            });

            console.log('Waveform loaded successfully');

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

    enhanceAudioEngineWithFades() {
        if (!window.audioEngine) {
            console.warn('Audio engine not available for enhancement');
            return;
        }
        
        console.log('Enhancing audio engine with fade support...');
        
        // Store original playCue method
        const originalPlayCue = window.audioEngine.playCue.bind(window.audioEngine);
        
        // Enhanced playCue with proper fade support
        window.audioEngine.playCue = async function(cue, onComplete, onError) {
            try {
                if (!cue.filePath) {
                    throw new Error('No audio file specified');
                }

                console.log(`Playing audio cue: ${cue.name}`);
                if (cue.fadeIn > 0 || cue.fadeOut > 0) {
                    console.log(`Fade settings - In: ${cue.fadeIn}ms, Out: ${cue.fadeOut}ms`);
                }

                // Get proper file URL
                const audioUrl = this.getFileUrl(cue.filePath);
                
                // Create HTML5 Audio element
                const audio = new Audio();
                
                // Calculate final volume (cue volume * master volume)
                const cueVolume = Math.max(0, Math.min(1, cue.volume || 1.0));
                const finalVolume = cueVolume * this.masterVolume;
                
                // Set initial volume based on fade in
                audio.volume = cue.fadeIn > 0 ? 0 : finalVolume;
                audio.loop = cue.loop || false;
                audio.preload = 'auto';
                
                // Store audio data with enhanced fade info
                const audioData = {
                    audio: audio,
                    cueVolume: cueVolume,
                    finalVolume: finalVolume,
                    fadeInInterval: null,
                    fadeOutInterval: null,
                    fadeInActive: false,
                    fadeOutActive: false,
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
                        
                        // Clear any running intervals
                        if (audioData.fadeInInterval) {
                            clearInterval(audioData.fadeInInterval);
                            audioData.fadeInInterval = null;
                        }
                        if (audioData.fadeOutInterval) {
                            clearInterval(audioData.fadeOutInterval);
                            audioData.fadeOutInterval = null;
                        }
                        
                        this.activeSounds.delete(cue.id);
                        console.log(`Audio cue completed: ${cue.name}`);
                        if (onComplete) onComplete();
                    }
                };
                
                audioData.onComplete = handleEnd;
                
                // Handle audio events
                audio.addEventListener('ended', handleEnd, { once: true });
                
                audio.addEventListener('error', (e) => {
                    const errorMsg = `Audio playback failed for: ${cue.name} - ${audio.error?.message || 'Unknown error'}`;
                    console.error(errorMsg, e);
                    if (onError) onError(new Error(errorMsg));
                });
                
                audio.addEventListener('canplay', () => {
                    console.log(`Audio ready to play: ${cue.name}`);
                    
                    // Start fade in effect when audio is ready
                    if (cue.fadeIn > 0 && !audioData.fadeInActive) {
                        console.log(`Starting fade in: ${cue.fadeIn}ms`);
                        audioData.fadeInActive = true;
                        
                        const fadeSteps = Math.max(20, Math.floor(cue.fadeIn / 25)); // Smooth fade, 25ms per step
                        const volumeStep = finalVolume / fadeSteps;
                        const timeStep = cue.fadeIn / fadeSteps;
                        let currentStep = 0;
                        
                        audioData.fadeInInterval = setInterval(() => {
                            if (audio.paused || completed) {
                                clearInterval(audioData.fadeInInterval);
                                return;
                            }
                            
                            currentStep++;
                            const newVolume = Math.min(finalVolume, volumeStep * currentStep);
                            audio.volume = newVolume;
                            
                            if (currentStep >= fadeSteps || newVolume >= finalVolume) {
                                clearInterval(audioData.fadeInInterval);
                                audioData.fadeInInterval = null;
                                audio.volume = finalVolume;
                                audioData.fadeInActive = false;
                                console.log(`Fade in complete: ${Math.round(finalVolume * 100)}%`);
                            }
                        }, timeStep);
                    }
                }, { once: true });
                
                // Handle end time and fade out
                if (cue.endTime && cue.endTime > 0) {
                    const endTimeSeconds = cue.endTime / 1000;
                    const fadeOutStartTime = cue.fadeOut > 0 ? 
                        Math.max(0, endTimeSeconds - (cue.fadeOut / 1000)) : endTimeSeconds;
                    
                    audio.addEventListener('timeupdate', () => {
                        if (completed) return;
                        
                        const currentTime = audio.currentTime;
                        
                        // Start fade out
                        if (cue.fadeOut > 0 && currentTime >= fadeOutStartTime && 
                            !audioData.fadeOutActive && !audioData.fadeOutInterval) {
                            
                            console.log(`Starting fade out: ${cue.fadeOut}ms at ${currentTime.toFixed(1)}s`);
                            audioData.fadeOutActive = true;
                            
                            const fadeSteps = Math.max(20, Math.floor(cue.fadeOut / 25));
                            const currentVolume = audio.volume;
                            const volumeStep = currentVolume / fadeSteps;
                            const timeStep = cue.fadeOut / fadeSteps;
                            let currentStep = 0;
                            
                            audioData.fadeOutInterval = setInterval(() => {
                                if (audio.paused || completed) {
                                    clearInterval(audioData.fadeOutInterval);
                                    return;
                                }
                                
                                currentStep++;
                                const newVolume = Math.max(0, currentVolume - (volumeStep * currentStep));
                                audio.volume = newVolume;
                                
                                if (currentStep >= fadeSteps || newVolume <= 0) {
                                    clearInterval(audioData.fadeOutInterval);
                                    audioData.fadeOutInterval = null;
                                    audio.volume = 0;
                                    audioData.fadeOutActive = false;
                                    console.log('Fade out complete');
                                }
                            }, timeStep);
                        }
                        
                        // Stop at end time
                        if (currentTime >= endTimeSeconds) {
                            audio.pause();
                            handleEnd();
                        }
                    });
                }
                
                // Store reference
                this.activeSounds.set(cue.id, audioData);
                
                // Set source and start playback
                audio.src = audioUrl;
                audio.load();
                
                try {
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                        await playPromise;
                    }
                    console.log(`Audio playback started successfully: ${cue.name}`);
                } catch (playError) {
                    console.error('Audio play() failed:', playError);
                    this.activeSounds.delete(cue.id);
                    if (onError) onError(playError);
                }
                
            } catch (error) {
                console.error('Audio cue execution error:', error);
                if (onError) onError(error);
            }
        };
        
        console.log('Audio engine enhanced with fade support');
    }

    // Cleanup method
    cleanup() {
        if (this.timelineUpdateInterval) {
            clearInterval(this.timelineUpdateInterval);
            this.timelineUpdateInterval = null;
        }
        
        if (this.videoTimelineUpdateInterval) {
            clearInterval(this.videoTimelineUpdateInterval);
            this.videoTimelineUpdateInterval = null;
        }

        // Cleanup menu event listener
        if (this.menuUnsubscriber) {
            this.menuUnsubscriber();
        }

        // Cleanup waveform renderer
        if (this.waveformRenderer) {
            this.waveformRenderer.destroy();
            this.waveformRenderer = null;
        }
    }

    // ADD these methods to your UIManager class and UPDATE setupMenuHandlers

    setupMenuHandlers() {
        // Set up menu event handler using the new secure API
        if (this.apiAvailable && window.qlabAPI && window.qlabAPI.onMenuEvent) {
            this.menuUnsubscriber = window.qlabAPI.onMenuEvent((channel, ...args) => {
                switch (channel) {
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

    // File operations
    newShow() {
        if (this.cueManager.unsavedChanges) {
            const proceed = confirm('You have unsaved changes. Create new show anyway?');
            if (!proceed) return;
        }
        
        this.cueManager.newShow();
        console.log('New show created');
    }

    saveShow() {
        this.cueManager.saveShow().then(success => {
            if (success) {
                this.showStatusMessage('Show saved successfully', 'success');
            } else {
                this.showStatusMessage('Failed to save show', 'error');
            }
        });
    }

    saveShowAs() {
        this.cueManager.saveShowAs().then(success => {
            if (success) {
                this.showStatusMessage('Show saved successfully', 'success');
            } else {
                this.showStatusMessage('Save cancelled or failed', 'warning');
            }
        });
    }

    // Clipboard operations
    copyCue() {
        const success = this.cueManager.copyCue();
        if (success) {
            this.showStatusMessage('Cue copied to clipboard', 'success');
        } else {
            this.showStatusMessage('No cue selected to copy', 'warning');
        }
    }

    cutCue() {
        const success = this.cueManager.cutCue();
        if (success) {
            this.showStatusMessage('Cue cut to clipboard', 'success');
        } else {
            this.showStatusMessage('No cue selected to cut', 'warning');
        }
    }

    pasteCue() {
        const newCue = this.cueManager.pasteCue();
        if (newCue) {
            this.showStatusMessage(`Pasted cue: ${newCue.name}`, 'success');
        } else {
            this.showStatusMessage('No cue in clipboard to paste', 'warning');
        }
    }

    duplicateCue() {
        const duplicatedCue = this.cueManager.duplicateCue();
        if (duplicatedCue) {
            this.showStatusMessage(`Duplicated cue: ${duplicatedCue.name}`, 'success');
        } else {
            this.showStatusMessage('No cue selected to duplicate', 'warning');
        }
    }

    selectAllCues() {
        this.cueManager.selectAllCues();
        this.showStatusMessage('All cues selected', 'info');
    }

    emergencyStopAll() {
        this.cueManager.emergencyStopAll();
        this.showStatusMessage('🚨 EMERGENCY STOP ALL 🚨', 'error');
    }

    // Enhanced keyboard shortcuts
    handleGlobalKeydown(e) {
        // Handle clipboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.code) {
                case 'KeyC':
                    if (!this.isInputFocused(e.target)) {
                        e.preventDefault();
                        this.copyCue();
                    }
                    break;
                case 'KeyX':
                    if (!this.isInputFocused(e.target)) {
                        e.preventDefault();
                        this.cutCue();
                    }
                    break;
                case 'KeyV':
                    if (!this.isInputFocused(e.target)) {
                        e.preventDefault();
                        this.pasteCue();
                    }
                    break;
                case 'KeyD':
                    if (!this.isInputFocused(e.target)) {
                        e.preventDefault();
                        this.duplicateCue();
                    }
                    break;
                case 'KeyA':
                    if (!this.isInputFocused(e.target)) {
                        e.preventDefault();
                        this.selectAllCues();
                    }
                    break;
                case 'KeyS':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.saveShowAs();
                    } else {
                        this.saveShow();
                    }
                    break;
                case 'KeyN':
                    e.preventDefault();
                    this.newShow();
                    break;
                case 'KeyO':
                    e.preventDefault();
                    // Trigger file open dialog
                    window.qlabAPI.selectAudioFile(); // This will be handled by main process
                    break;
            }
        }

        // Other shortcuts
        switch (e.code) {
            case 'Space':
                if (!this.isInputFocused(e.target)) {
                    e.preventDefault();
                    console.log('Space pressed - GO');
                    this.cueManager.go();
                }
                break;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                console.log('ESC pressed - emergency stop');
                this.emergencyStopAll();
                break;
            case 'Delete':
            case 'Backspace':
                if (!this.isInputFocused(e.target)) {
                    e.preventDefault();
                    this.deleteSelectedCue();
                }
                break;
            case 'ArrowUp':
                if (!this.isInputFocused(e.target)) {
                    e.preventDefault();
                    this.selectPreviousCue();
                }
                break;
            case 'ArrowDown':
                if (!this.isInputFocused(e.target)) {
                    e.preventDefault();
                    this.selectNextCue();
                }
                break;
            case 'Enter':
                if (!this.isInputFocused(e.target)) {
                    e.preventDefault();
                    console.log('Enter pressed - GO on selected cue');
                    this.cueManager.go();
                }
                break;
        }

        // Handle Ctrl+Period for stop
        if ((e.ctrlKey || e.metaKey) && e.code === 'Period') {
            e.preventDefault();
            console.log('Ctrl+. pressed - STOP');
            this.cueManager.stop();
        }

        // Handle Ctrl+P for pause
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
            e.preventDefault();
            console.log('Ctrl+P pressed - PAUSE');
            this.cueManager.pause();
        }
    }

    // Helper to check if an input field is focused
    isInputFocused(target) {
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.contentEditable === 'true';
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
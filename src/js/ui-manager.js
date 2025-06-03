class UIManager {
    constructor(cueManager, audioEngine) {
        this.cueManager = cueManager;
        this.audioEngine = audioEngine;
        this.elements = {};
        this.selectedCueElement = null;
        
        this.initializeElements();
        this.bindEvents();
        this.setupMenuHandlers();
        this.setupGlobalKeyHandler();
        
        // Hide settings modal on startup
        this.ensureSettingsModalHidden();
        
        this.updateUI();
        
        // Update time display
        this.startTimeUpdater();
        
        // Initialize master volume control
        this.setupMasterVolumeControl();
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
        const { ipcRenderer } = require('electron');
        
        ipcRenderer.on('menu-new-show', () => {
            this.cueManager.newShow();
        });
        
        ipcRenderer.on('menu-open-show', async (event, filePath) => {
            await this.cueManager.loadShow(filePath);
        });
        
        ipcRenderer.on('menu-save-show', async () => {
            await this.cueManager.saveShow();
        });
        
        ipcRenderer.on('menu-add-cue', (event, type) => {
            this.addCue(type);
        });
        
        ipcRenderer.on('menu-delete-cue', () => {
            this.deleteSelectedCue();
        });
        
        ipcRenderer.on('menu-go', () => {
            this.cueManager.go();
        });
        
        ipcRenderer.on('menu-stop', () => {
            this.cueManager.stop();
        });
        
        ipcRenderer.on('menu-pause', () => {
            this.cueManager.pause();
        });
    }

    async addCue(type) {
        let options = {};
        
        if (type === 'audio') {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('select-audio-file');
            
            if (result.success) {
                options.filePath = result.filePath;
                options.name = require('path').basename(result.filePath, require('path').extname(result.filePath));
                
                try {
                    const audioInfo = await this.audioEngine.getAudioFileInfo(result.filePath);
                    if (audioInfo) {
                        options.duration = audioInfo.duration;
                    }
                } catch (error) {
                    console.warn('Could not get audio file info:', error);
                }
            } else {
                return;
            }
        } else if (type === 'video') {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('select-video-file');
            
            if (result.success) {
                options.filePath = result.filePath;
                options.name = require('path').basename(result.filePath, require('path').extname(result.filePath));
                
                try {
                    const videoInfo = await window.videoEngine.getVideoFileInfo(result.filePath);
                    if (videoInfo) {
                        options.duration = videoInfo.duration;
                    }
                } catch (error) {
                    console.warn('Could not get video file info:', error);
                }
                
                window.videoEngine.previewVideoInInspector(result.filePath);
            } else {
                return;
            }
        }
        
        const cue = this.cueManager.addCue(type, options);
        this.cueManager.selectCue(cue.id);
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

    // Event handlers
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
        if (data.cue.id === this.cueManager.selectedCueId) {
            this.renderInspector();
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

    // UI update methods
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
        }, 1000);
        
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(new Date());
        }
    }

    // Settings management
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
            
            if (window.displayManager) {
                await window.displayManager.detectDisplays();
                const displays = window.displayManager.getDisplays();
                
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
                if (routingSelect) {
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
                    displaysList.innerHTML = '<p>Display manager not available</p>';
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
        
        // Handle display settings
        const routingSelect = document.getElementById('video-routing');
        if (routingSelect && window.displayManager) {
            const newSelect = routingSelect.cloneNode(true);
            routingSelect.parentNode.replaceChild(newSelect, routingSelect);
            newSelect.addEventListener('change', async (e) => {
                const success = await window.displayManager.setVideoRouting(e.target.value);
                if (success) {
                    const option = window.displayManager.getRoutingOptions().find(opt => opt.id.toString() === e.target.value);
                    this.elements.displayRouting.textContent = `Video: ${option ? option.name : 'Unknown'}`;
                }
            });
        }
        
        const testPatternBtn = document.getElementById('test-pattern-btn');
        if (testPatternBtn && window.displayManager) {
            const newBtn = testPatternBtn.cloneNode(true);
            testPatternBtn.parentNode.replaceChild(newBtn, testPatternBtn);
            newBtn.addEventListener('click', async () => {
                await window.displayManager.showTestPattern();
            });
        }
        
        const clearDisplaysBtn = document.getElementById('clear-displays-btn');
        if (clearDisplaysBtn && window.displayManager) {
            const newBtn = clearDisplaysBtn.cloneNode(true);
            clearDisplaysBtn.parentNode.replaceChild(newBtn, clearDisplaysBtn);
            newBtn.addEventListener('click', async () => {
                await window.displayManager.clearAllDisplays();
            });
        }
        
        const refreshDisplaysBtn = document.getElementById('refresh-displays');
        if (refreshDisplaysBtn) {
            const newBtn = refreshDisplaysBtn.cloneNode(true);
            refreshDisplaysBtn.parentNode.replaceChild(newBtn, refreshDisplaysBtn);
            newBtn.addEventListener('click', async () => {
                await this.loadDisplaySettings();
            });
        }
        
        const applySettingsBtn = document.getElementById('apply-settings');
        if (applySettingsBtn) {
            const newBtn = applySettingsBtn.cloneNode(true);
            applySettingsBtn.parentNode.replaceChild(newBtn, applySettingsBtn);
            newBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }
    }

    // Inspector methods
    renderInspector() {
        const selectedCue = this.cueManager.getSelectedCue();
        const inspectorContent = this.elements.inspectorContent;
        
        if (!selectedCue) {
            inspectorContent.innerHTML = '<div class="inspector-placeholder">Select a cue to view its properties</div>';
            return;
        }

        inspectorContent.innerHTML = this.generateInspectorHTML(selectedCue);
        this.bindInspectorEvents(selectedCue);
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
                        <h3>Audio</h3>
                        <div class="inspector-field">
                            <label>File</label>
                            <input type="text" id="audio-filepath" value="${selectedCue.filePath || ''}" readonly>
                            <button id="select-audio-file">Browse...</button>
                        </div>
                        <div class="inspector-field">
                            <label>Volume: <span id="audio-volume-display">${Math.round((selectedCue.volume || 1.0) * 100)}%</span></label>
                            <input type="range" id="audio-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1.0}">
                        </div>
                    </div>
                `;
                break;

            case 'video':
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3>Video</h3>
                        <div class="inspector-field">
                            <label>File</label>
                            <input type="text" id="video-filepath" value="${selectedCue.filePath || ''}" readonly>
                            <button id="select-video-file">Browse...</button>
                        </div>
                        <div class="inspector-field">
                            <label>Volume: <span id="video-volume-display">${Math.round((selectedCue.volume || 1.0) * 100)}%</span></label>
                            <input type="range" id="video-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1.0}">
                        </div>
                        <div class="inspector-field">
                            <label>Opacity: <span id="video-opacity-display">${Math.round((selectedCue.opacity || 1.0) * 100)}%</span></label>
                            <input type="range" id="video-opacity" min="0" max="1" step="0.01" value="${selectedCue.opacity || 1.0}">
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
                            <input type="number" id="wait-duration" value="${selectedCue.duration || 5000}" min="0">
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
                                <option value="sequential" ${(selectedCue.mode || 'sequential') === 'sequential' ? 'selected' : ''}>Sequential</option>
                                <option value="parallel" ${selectedCue.mode === 'parallel' ? 'selected' : ''}>Parallel</option>
                            </select>
                        </div>
                    </div>
                `;
                break;
        }

        const autoContinueFields = `
            <div class="inspector-group">
                <h3>Auto-Continue</h3>
                <div class="inspector-field">
                    <label>
                        <input type="checkbox" id="auto-continue" ${selectedCue.autoContinue ? 'checked' : ''}>
                        Auto-continue to next cue
                    </label>
                </div>
                <div class="inspector-field">
                    <label>Continue delay (ms)</label>
                    <input type="number" id="continue-delay" value="${selectedCue.continueDelay || 0}" min="0" ${!selectedCue.autoContinue ? 'disabled' : ''}>
                </div>
            </div>
        `;
        
        return commonFields + typeSpecificFields + autoContinueFields;
    }

    bindInspectorEvents(cue) {
        const numberInput = document.getElementById('cue-number');
        const nameInput = document.getElementById('cue-name');
        const autoContinueCheckbox = document.getElementById('auto-continue');
        const continueDelayInput = document.getElementById('continue-delay');

        if (numberInput) {
            numberInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { number: e.target.value || cue.number });
            });
        }

        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { name: e.target.value });
            });
        }

        if (autoContinueCheckbox) {
            autoContinueCheckbox.addEventListener('change', (e) => {
                const autoContinue = e.target.checked;
                this.cueManager.updateCue(cue.id, { autoContinue });
                
                if (continueDelayInput) {
                    continueDelayInput.disabled = !autoContinue;
                }
            });
        }

        if (continueDelayInput) {
            continueDelayInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { continueDelay: parseInt(e.target.value) || 0 });
            });
        }

        // Type-specific event binding
        if (cue.type === 'audio') {
            this.bindAudioInspectorEvents(cue);
        } else if (cue.type === 'video') {
            this.bindVideoInspectorEvents(cue);
        } else if (cue.type === 'wait') {
            this.bindWaitInspectorEvents(cue);
        } else if (cue.type === 'group') {
            this.bindGroupInspectorEvents(cue);
        }
    }

    bindAudioInspectorEvents(cue) {
        const selectFileBtn = document.getElementById('select-audio-file');
        const volumeSlider = document.getElementById('audio-volume');
        const volumeDisplay = document.getElementById('audio-volume-display');

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', async () => {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('select-audio-file');
                
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
                    
                    this.cueManager.updateCue(cue.id, updates);
                    this.renderInspector();
                }
            });
        }

        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
                
                if (window.audioEngine && window.audioEngine.setCueVolume(cue.id, volume)) {
                    console.log(`Live volume update for audio cue ${cue.number}: ${Math.round(volume * 100)}%`);
                }
            });
            
            volumeSlider.addEventListener('change', (e) => {
                const volume = parseFloat(e.target.value);
                this.cueManager.updateCue(cue.id, { volume });
                console.log(`Audio cue ${cue.number} volume saved: ${Math.round(volume * 100)}%`);
            });
        }
    }

    bindVideoInspectorEvents(cue) {
        const selectFileBtn = document.getElementById('select-video-file');
        const volumeSlider = document.getElementById('video-volume');
        const volumeDisplay = document.getElementById('video-volume-display');
        const opacitySlider = document.getElementById('video-opacity');
        const opacityDisplay = document.getElementById('video-opacity-display');

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', async () => {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('select-video-file');
                
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
                    
                    this.cueManager.updateCue(cue.id, updates);
                    this.renderInspector();
                    
                    window.videoEngine.previewVideoInInspector(result.filePath);
                }
            });
        }

        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
                
                if (window.videoEngine && window.videoEngine.setCueVolume(cue.id, volume)) {
                    console.log(`Live volume update for video cue ${cue.number}: ${Math.round(volume * 100)}%`);
                }
            });
            
            volumeSlider.addEventListener('change', (e) => {
                const volume = parseFloat(e.target.value);
                this.cueManager.updateCue(cue.id, { volume });
                console.log(`Video cue ${cue.number} volume saved: ${Math.round(volume * 100)}%`);
            });
        }

        if (opacitySlider && opacityDisplay) {
            opacitySlider.addEventListener('input', (e) => {
                const opacity = parseFloat(e.target.value);
                opacityDisplay.textContent = `${Math.round(opacity * 100)}%`;
            });
            
            opacitySlider.addEventListener('change', (e) => {
                const opacity = parseFloat(e.target.value);
                this.cueManager.updateCue(cue.id, { opacity });
            });
        }
    }

    bindWaitInspectorEvents(cue) {
        const durationInput = document.getElementById('wait-duration');
        
        if (durationInput) {
            durationInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { duration: parseInt(e.target.value) || 0 });
            });
        }
    }

    bindGroupInspectorEvents(cue) {
        const modeSelect = document.getElementById('group-mode');
        
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { mode: e.target.value });
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
}
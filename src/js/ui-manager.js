class UIManager {
    constructor(cueManager, audioEngine) {
        this.cueManager = cueManager;
        this.audioEngine = audioEngine;
        this.elements = {};
        this.selectedCueElement = null;
        
        // Audio enhancement components
        this.audioAnalyzer = new AudioAnalyzer();
        this.waveformRenderer = null;
        this.currentWaveformCue = null;
        
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
        
        ipcRenderer.on('menu-open-show', (event, filePath) => {
            this.cueManager.loadShow(filePath);
        });
        
        ipcRenderer.on('menu-save-show', () => {
            this.cueManager.saveShow();
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

    addCue(type) {
        let options = {};
        
        if (type === 'audio') {
            this.selectAudioFile().then((result) => {
                if (result.success) {
                    options.filePath = result.filePath;
                    options.name = require('path').basename(result.filePath, require('path').extname(result.filePath));
                    
                    this.audioEngine.getAudioFileInfo(result.filePath).then((audioInfo) => {
                        if (audioInfo) {
                            options.duration = audioInfo.duration;
                        }
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                    }).catch((error) => {
                        console.warn('Could not get audio file info:', error);
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                    });
                }
            });
        } else if (type === 'video') {
            this.selectVideoFile().then((result) => {
                if (result.success) {
                    options.filePath = result.filePath;
                    options.name = require('path').basename(result.filePath, require('path').extname(result.filePath));
                    
                    window.videoEngine.getVideoFileInfo(result.filePath).then((videoInfo) => {
                        if (videoInfo) {
                            options.duration = videoInfo.duration;
                        }
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                        window.videoEngine.previewVideoInInspector(result.filePath);
                    }).catch((error) => {
                        console.warn('Could not get video file info:', error);
                        const cue = this.cueManager.addCue(type, options);
                        this.cueManager.selectCue(cue.id);
                    });
                }
            });
        } else {
            const cue = this.cueManager.addCue(type, options);
            this.cueManager.selectCue(cue.id);
        }
    }

    selectAudioFile() {
        const { ipcRenderer } = require('electron');
        return ipcRenderer.invoke('select-audio-file');
    }

    selectVideoFile() {
        const { ipcRenderer } = require('electron');
        return ipcRenderer.invoke('select-video-file');
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

    openSettings() {
        this.elements.settingsModal.style.display = 'flex';
        this.elements.settingsModal.classList.add('show');
        this.loadDisplaySettings();
    }

    closeSettings() {
        this.elements.settingsModal.style.display = 'none';
        this.elements.settingsModal.classList.remove('show');
    }

    loadDisplaySettings() {
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
                window.displayManager.detectDisplays().then(() => {
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
                });
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

    // Add these handlers to your setupSettingsEventHandlers() method in UIManager

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
    if (videoRoutingSelect && window.displayManager) {
        videoRoutingSelect.addEventListener('change', async (e) => {
            const success = await window.displayManager.setVideoRouting(e.target.value);
            if (success) {
                const selectedOption = videoRoutingSelect.options[videoRoutingSelect.selectedIndex];
                this.elements.displayRouting.textContent = `Video: ${selectedOption.text}`;
            }
        });
    }

    // Test pattern button
    if (testPatternBtn && window.displayManager) {
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
    if (clearDisplaysBtn && window.displayManager) {
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
        // Add these methods to your UIManager class in src/js/ui-manager.js
// Place them at the end of the class, before the closing brace

    // Missing waveform-related methods
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

    // Complete the audio inspector rendering
    async renderAudioInspector(selectedCue) {
        if (selectedCue.filePath && selectedCue.filePath !== this.currentWaveformCue?.filePath) {
            await this.loadWaveformForCue(selectedCue);
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
                // Handle seek functionality if needed
                console.log('Waveform seek to:', time);
            });

            this.waveformRenderer.on('trimChange', (trimPoints) => {
                // Update cue start/end times based on trim
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

    // Complete the inspector HTML generation
    // UI Manager Video Timeline Integration
// Update your existing UIManager methods in src/js/ui-manager.js

// REPLACE your existing generateInspectorHTML method to include video timeline:
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
                        <button id="select-audio-file">Browse...</button>
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
            typeSpecificFields = this.generateVideoInspectorHTML(selectedCue);
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

// ADD this new method for video inspector HTML:
generateVideoInspectorHTML(selectedCue) {
    return `
        <div class="inspector-group">
            <h3 class="video-enhanced">Video File</h3>
            <div class="inspector-field">
                <label>File</label>
                <input type="text" id="video-filepath" value="${selectedCue.filePath || ''}" readonly>
                <button id="select-video-file">Browse...</button>
            </div>
            ${selectedCue.filePath ? `
            <div class="inspector-field">
                <label>Video Timeline</label>
                <div class="video-timeline-container" title="J/K/L for playback, I/O for trim points, ←/→ for frame stepping">
                    <canvas id="video-timeline" class="video-timeline-canvas"></canvas>
                    <div class="timeline-controls">
                        <button id="video-step-back" title="Step Frame Backward (←)">⏮</button>
                        <button id="video-play-pause" title="Play/Pause (K)">⏯</button>
                        <button id="video-step-forward" title="Step Frame Forward (→)">⏭</button>
                        <button id="video-go-start" title="Go to Start (Home)">⏪</button>
                        <button id="video-go-end" title="Go to End (End)">⏩</button>
                    </div>
                    <div class="timeline-info">
                        <span id="video-current-time">00:00:00:00</span>
                        <span id="video-frame-info">Frame: 1/1</span>
                        <span id="video-duration">00:00:00:00</span>
                    </div>
                    <div class="keyboard-hints">J/K/L • I/O • ←/→</div>
                </div>
            </div>
            ` : ''}
        </div>
        <div class="inspector-group">
            <h3 class="video-enhanced">Video Properties</h3>
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
            <h3 class="video-enhanced">Display & Geometry</h3>
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
}

// REPLACE your existing bindInspectorEvents to include video timeline:
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
        this.bindVideoInspectorEventsWithTimeline(selectedCue);
    } else if (selectedCue.type === 'wait') {
        this.bindWaitInspectorEvents(selectedCue);
    } else if (selectedCue.type === 'group') {
        this.bindGroupInspectorEvents(selectedCue);
    }

    // Auto-continue bindings
    this.bindAutoContinueEvents(selectedCue);

    // Load content for media cues
    if (selectedCue.type === 'audio' && selectedCue.filePath && 
        (!this.currentWaveformCue || this.currentWaveformCue.id !== selectedCue.id)) {
        this.loadWaveformForCue(selectedCue);
    } else if (selectedCue.type === 'video' && selectedCue.filePath) {
        this.loadVideoTimelineForCue(selectedCue);
    }
}

// ADD new method for video events with timeline:
bindVideoInspectorEventsWithTimeline(selectedCue) {
    // First bind the standard video events
    this.bindVideoInspectorEvents(selectedCue);
    
    // Then add timeline-specific events
    this.bindVideoTimelineControls(selectedCue);
}

// ADD new method to load video timeline:
async loadVideoTimelineForCue(cue) {
    const canvas = document.getElementById('video-timeline');
    if (!canvas || !cue.filePath) return;

    try {
        console.log('Loading video timeline for:', cue.name);
        
        // Show the video in preview with timeline
        window.videoEngine.previewVideoWithTimeline(cue.filePath, canvas);
        
        // Set up timeline event handlers
        if (window.videoEngine.videoTimeline) {
            // Handle trim changes from timeline
            window.videoEngine.videoTimeline.on('trimChange', (trimPoints) => {
                this.updateCueTrimPointsFromTimeline(cue.id, trimPoints);
            });
            
            // Update info display
            this.updateVideoTimelineInfoDisplay();
            
            // Apply existing trim points to timeline
            this.applyExistingTrimPoints(cue);
        }

        console.log('Video timeline loaded successfully');

    } catch (error) {
        console.error('Failed to load video timeline:', error);
    }
}

// ADD method to apply existing trim points:
applyExistingTrimPoints(cue) {
    if (!window.videoEngine.videoTimeline || !cue.filePath) return;
    
    const timeline = window.videoEngine.videoTimeline;
    
    // Wait for video to load before applying trim points
    const video = window.videoEngine.videoPreview;
    if (video && video.duration > 0) {
        const duration = video.duration;
        const startNormalized = (cue.startTime || 0) / 1000 / duration;
        const endNormalized = cue.endTime ? (cue.endTime / 1000 / duration) : 1;
        
        timeline.trimPoints = {
            start: Math.max(0, Math.min(1, startNormalized)),
            end: Math.max(0, Math.min(1, endNormalized))
        };
        
        timeline.render();
        console.log('Applied existing trim points to timeline');
    } else {
        // Retry after a short delay if video isn't loaded yet
        setTimeout(() => this.applyExistingTrimPoints(cue), 100);
    }
}

// ADD method to update timeline info:
updateVideoTimelineInfoDisplay() {
    if (!window.videoEngine.videoTimeline) return;
    
    const currentTimeEl = document.getElementById('video-current-time');
    const frameInfoEl = document.getElementById('video-frame-info');
    const durationEl = document.getElementById('video-duration');
    
    const updateInfo = () => {
        const timeline = window.videoEngine.videoTimeline;
        
        if (currentTimeEl) {
            currentTimeEl.textContent = timeline.formatTimecode(timeline.currentTime);
        }
        
        if (frameInfoEl) {
            frameInfoEl.textContent = `Frame: ${timeline.currentFrame + 1}/${timeline.totalFrames}`;
        }
        
        if (durationEl) {
            durationEl.textContent = timeline.formatTimecode(timeline.duration);
        }
    };
    
    // Update immediately and set up interval
    updateInfo();
    
    if (this.videoTimelineUpdateInterval) {
        clearInterval(this.videoTimelineUpdateInterval);
    }
    
    this.videoTimelineUpdateInterval = setInterval(updateInfo, 100);
}

// ADD method to handle trim changes from timeline:
updateCueTrimPointsFromTimeline(cueId, trimPoints) {
    const updates = {
        startTime: Math.round(trimPoints.start * 1000),
        endTime: Math.round(trimPoints.end * 1000)
    };
    
    this.cueManager.updateCue(cueId, updates);
    
    // Update the input fields to reflect the change
    const startTimeInput = document.getElementById('video-starttime');
    const endTimeInput = document.getElementById('video-endtime');
    
    if (startTimeInput) {
        startTimeInput.value = updates.startTime;
    }
    
    if (endTimeInput) {
        endTimeInput.value = updates.endTime;
    }
    
    console.log('Updated trim points from timeline:', updates);
}

    // Bind inspector events
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

    if (selectAudioFile) {
        selectAudioFile.addEventListener('click', async () => {
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

    // Enhanced fade controls with validation and logging
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

        if (selectVideoFile) {
            selectVideoFile.addEventListener('click', async () => {
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
    // ADD this new method to your UIManager class in src/js/ui-manager.js
// Place it at the end of the class, before the closing brace

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
// Enhanced Video Inspector Methods for UIManager
// Add these methods to your UIManager class in src/js/ui-manager.js

// Enhanced video inspector rendering with timeline
generateVideoInspectorHTML(selectedCue) {
    return `
        <div class="inspector-group">
            <h3>Video File</h3>
            <div class="inspector-field">
                <label>File</label>
                <input type="text" id="video-filepath" value="${selectedCue.filePath || ''}" readonly>
                <button id="select-video-file">Browse...</button>
            </div>
            ${selectedCue.filePath ? `
            <div class="inspector-field">
                <label>Video Timeline</label>
                <div class="video-timeline-container" title="Use J/K/L keys for playback control, I/O for trim points">
                    <canvas id="video-timeline" class="video-timeline-canvas"></canvas>
                    <div class="timeline-controls">
                        <button id="video-step-back" title="Step Frame Backward (←)">⏮</button>
                        <button id="video-play-pause" title="Play/Pause (K)">⏯</button>
                        <button id="video-step-forward" title="Step Frame Forward (→)">⏭</button>
                        <button id="video-go-start" title="Go to Start (Home)">⏪</button>
                        <button id="video-go-end" title="Go to End (End)">⏩</button>
                    </div>
                    <div class="timeline-info">
                        <span id="video-current-time">00:00:00:00</span>
                        <span id="video-frame-info">Frame: 1/1</span>
                        <span id="video-duration">00:00:00:00</span>
                    </div>
                </div>
            </div>
            ` : ''}
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
}

// Enhanced video inspector event binding
bindVideoInspectorEvents(selectedCue) {
    const selectVideoFile = document.getElementById('select-video-file');
    const videoVolume = document.getElementById('video-volume');
    const videoVolumeDisplay = document.getElementById('video-volume-display');
    const videoStartTime = document.getElementById('video-starttime');
    const videoEndTime = document.getElementById('video-endtime');
    const videoFadeIn = document.getElementById('video-fadein');
    const videoFadeOut = document.getElementById('video-fadeout');
    const videoAspectRatio = document.getElementById('video-aspectratio');
    const videoOpacity = document.getElementById('video-opacity');
    const videoOpacityDisplay = document.getElementById('video-opacity-display');
    const videoFullscreen = document.getElementById('video-fullscreen');
    const videoLoop = document.getElementById('video-loop');

    // File selection
    if (selectVideoFile) {
        selectVideoFile.addEventListener('click', async () => {
            const result = await this.selectVideoFile();
            if (result.success) {
                const updates = { filePath: result.filePath };
                try {
                    const videoInfo = await window.videoEngine.getDetailedVideoInfo(result.filePath);
                    if (videoInfo) {
                        updates.duration = videoInfo.duration;
                        console.log('Video info loaded:', videoInfo);
                    }
                } catch (error) {
                    console.warn('Could not get video file info:', error);
                }
                this.cueManager.updateCue(selectedCue.id, updates);
            }
        });
    }

    // Volume controls
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

    // Timing controls with frame-accurate updates
    if (videoStartTime) {
        videoStartTime.addEventListener('change', (e) => {
            const startTime = Math.max(0, parseInt(e.target.value) || 0);
            this.cueManager.updateCue(selectedCue.id, { startTime });
            this.updateVideoTimelineTrimPoints(selectedCue);
        });
    }

    if (videoEndTime) {
        videoEndTime.addEventListener('change', (e) => {
            const endTime = parseInt(e.target.value) || null;
            this.cueManager.updateCue(selectedCue.id, { endTime });
            this.updateVideoTimelineTrimPoints(selectedCue);
        });
    }

    // Fade controls
    if (videoFadeIn) {
        videoFadeIn.addEventListener('change', (e) => {
            const fadeIn = Math.max(0, parseInt(e.target.value) || 0);
            this.cueManager.updateCue(selectedCue.id, { fadeIn });
        });
    }

    if (videoFadeOut) {
        videoFadeOut.addEventListener('change', (e) => {
            const fadeOut = Math.max(0, parseInt(e.target.value) || 0);
            this.cueManager.updateCue(selectedCue.id, { fadeOut });
        });
    }

    // Display controls
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

    // Timeline controls
    this.bindVideoTimelineControls(selectedCue);

    // Load timeline for video cues
    if (selectedCue.type === 'video' && selectedCue.filePath) {
        this.loadVideoTimeline(selectedCue);
    }
}

// Bind video timeline control buttons
bindVideoTimelineControls(selectedCue) {
    const stepBack = document.getElementById('video-step-back');
    const playPause = document.getElementById('video-play-pause');
    const stepForward = document.getElementById('video-step-forward');
    const goStart = document.getElementById('video-go-start');
    const goEnd = document.getElementById('video-go-end');

    if (stepBack) {
        stepBack.addEventListener('click', () => {
            if (window.videoEngine.videoTimeline) {
                window.videoEngine.videoTimeline.stepFrame(-1);
            }
        });
    }

    if (playPause) {
        playPause.addEventListener('click', () => {
            if (window.videoEngine.videoTimeline) {
                window.videoEngine.videoTimeline.pause();
            }
        });
    }

    if (stepForward) {
        stepForward.addEventListener('click', () => {
            if (window.videoEngine.videoTimeline) {
                window.videoEngine.videoTimeline.stepFrame(1);
            }
        });
    }

    if (goStart) {
        goStart.addEventListener('click', () => {
            if (window.videoEngine.videoTimeline) {
                window.videoEngine.videoTimeline.seekToTime(0);
            }
        });
    }

    if (goEnd) {
        goEnd.addEventListener('click', () => {
            if (window.videoEngine.videoTimeline && window.videoEngine.videoTimeline.duration > 0) {
                window.videoEngine.videoTimeline.seekToTime(window.videoEngine.videoTimeline.duration);
            }
        });
    }
}

// Load video timeline
async loadVideoTimeline(cue) {
    const canvas = document.getElementById('video-timeline');
    if (!canvas || !cue.filePath) return;

    try {
        console.log('Loading video timeline for:', cue.name);
        
        // Preview the video with timeline
        window.videoEngine.previewVideoWithTimeline(cue.filePath, canvas);
        
        // Set up timeline update handlers
        if (window.videoEngine.videoTimeline) {
            window.videoEngine.videoTimeline.on('trimChange', (trimPoints) => {
                this.updateCueTrimPointsFromTimeline(cue.id, trimPoints);
            });
            
            // Update timeline info display
            this.updateTimelineInfoDisplay();
        }

        console.log('Video timeline loaded successfully');

    } catch (error) {
        console.error('Failed to load video timeline:', error);
        
        // Show error in timeline container
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#dc3545';
            ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Video timeline failed to load', canvas.width / 2, canvas.height / 2);
        }
    }
}

// Update timeline info display
updateTimelineInfoDisplay() {
    if (!window.videoEngine.videoTimeline) return;
    
    const currentTimeEl = document.getElementById('video-current-time');
    const frameInfoEl = document.getElementById('video-frame-info');
    const durationEl = document.getElementById('video-duration');
    
    const updateInfo = () => {
        const timeline = window.videoEngine.videoTimeline;
        
        if (currentTimeEl) {
            currentTimeEl.textContent = timeline.formatTimecode(timeline.currentTime);
        }
        
        if (frameInfoEl) {
            frameInfoEl.textContent = `Frame: ${timeline.currentFrame + 1}/${timeline.totalFrames}`;
        }
        
        if (durationEl) {
            durationEl.textContent = timeline.formatTimecode(timeline.duration);
        }
    };
    
    // Update immediately and set up interval
    updateInfo();
    
    if (this.timelineUpdateInterval) {
        clearInterval(this.timelineUpdateInterval);
    }
    
    this.timelineUpdateInterval = setInterval(updateInfo, 100);
}

// Update cue trim points from timeline
updateCueTrimPointsFromTimeline(cueId, trimPoints) {
    const updates = {
        startTime: Math.round(trimPoints.start * 1000),
        endTime: Math.round(trimPoints.end * 1000)
    };
    
    this.cueManager.updateCue(cueId, updates);
    
    // Update the input fields
    const startTimeInput = document.getElementById('video-starttime');
    const endTimeInput = document.getElementById('video-endtime');
    
    if (startTimeInput) {
        startTimeInput.value = updates.startTime;
    }
    
    if (endTimeInput) {
        endTimeInput.value = updates.endTime;
    }
    
    console.log('Updated trim points from timeline:', updates);
}

// Update timeline trim points from inputs
updateVideoTimelineTrimPoints(cue) {
    if (!window.videoEngine.videoTimeline || !cue.filePath) return;
    
    const timeline = window.videoEngine.videoTimeline;
    const duration = timeline.duration;
    
    if (duration > 0) {
        const startNormalized = (cue.startTime || 0) / 1000 / duration;
        const endNormalized = cue.endTime ? (cue.endTime / 1000 / duration) : 1;
        
        timeline.trimPoints = {
            start: Math.max(0, Math.min(1, startNormalized)),
            end: Math.max(0, Math.min(1, endNormalized))
        };
        
        timeline.render();
    }
}

// Add method to update cue trim points (called from timeline)
updateCueTrimPoints(cueId, trimPoints) {
    const updates = {
        startTime: Math.round(trimPoints.start * 1000),
        endTime: Math.round(trimPoints.end * 1000)
    };
    
    this.cueManager.updateCue(cueId, updates);
}

// Enhanced cleanup
cleanup() {
    if (this.timelineUpdateInterval) {
        clearInterval(this.timelineUpdateInterval);
        this.timelineUpdateInterval = null;
    }
}
// Horizontal Video Inspector Implementation
// Add these methods to your UIManager class in src/js/ui-manager.js

// Enhanced video inspector for horizontal layout
generateVideoInspectorHTMLHorizontal(selectedCue) {
    return `
        <div class="video-inspector-horizontal">
            <!-- Video Timeline Section (Top) -->
            <div class="video-timeline-section">
                <div class="section-header">
                    <h2>Video Timeline</h2>
                    <div class="timeline-controls-header">
                        <button id="video-layout-toggle" class="video-layout-toggle" title="Toggle Layout">
                            📺 Horizontal
                        </button>
                    </div>
                </div>
                
                ${selectedCue.filePath ? `
                <div class="video-timeline-horizontal">
                    <div class="video-preview-and-timeline">
                        <!-- Video Preview -->
                        <div class="video-preview-container-horizontal">
                            <video id="video-preview-horizontal" controls>
                                Your browser does not support the video tag.
                            </video>
                        </div>
                        
                        <!-- Timeline Container -->
                        <div class="video-timeline-container-horizontal">
                            <canvas id="video-timeline-horizontal" class="video-timeline-canvas-horizontal"></canvas>
                            <div class="timeline-ruler"></div>
                        </div>
                    </div>
                    
                    <!-- Timeline Controls -->
                    <div class="timeline-controls-horizontal">
                        <div class="control-group">
                            <button id="video-step-back" title="Step Frame Backward (←)">⏮</button>
                            <button id="video-play-pause" title="Play/Pause (K)">⏯</button>
                            <button id="video-step-forward" title="Step Frame Forward (→)">⏭</button>
                        </div>
                        
                        <div class="control-group">
                            <button id="video-go-start" title="Go to Start (Home)">⏪</button>
                            <button id="video-go-end" title="Go to End (End)">⏩</button>
                        </div>
                        
                        <div class="control-group">
                            <button id="video-set-in" title="Set In Point (I)">📍 In</button>
                            <button id="video-set-out" title="Set Out Point (O)">📍 Out</button>
                        </div>
                        
                        <div class="control-group">
                            <label>Zoom:</label>
                            <input type="range" id="timeline-zoom" min="0.1" max="5" step="0.1" value="1">
                        </div>
                    </div>
                    
                    <!-- Timeline Info -->
                    <div class="timeline-info-horizontal">
                        <div class="info-group">
                            <div class="info-item">
                                <span class="info-label">Current</span>
                                <span class="info-value current-time" id="video-current-time-h">00:00:00:00</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Frame</span>
                                <span class="info-value frame-info" id="video-frame-info-h">1/1</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Duration</span>
                                <span class="info-value duration" id="video-duration-h">00:00:00:00</span>
                            </div>
                        </div>
                        
                        <div class="info-group">
                            <div class="info-item">
                                <span class="info-label">In Point</span>
                                <span class="info-value" id="video-in-point">--:--:--:--</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Out Point</span>
                                <span class="info-value" id="video-out-point">--:--:--:--</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Selection</span>
                                <span class="info-value" id="video-selection-duration">--:--:--:--</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : `
                <div class="video-timeline-placeholder">
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <h3>No Video File Selected</h3>
                        <p>Select a video file below to see the timeline</p>
                    </div>
                </div>
                `}
            </div>
            
            <!-- Video Properties Section (Bottom) -->
            <div class="video-properties-section">
                <div class="video-properties-horizontal">
                    <!-- File Properties -->
                    <div class="property-group">
                        <h4>File</h4>
                        <div class="property-field">
                            <label>Video File</label>
                            <input type="text" id="video-filepath" value="${selectedCue.filePath || ''}" readonly>
                            <button id="select-video-file" style="margin-top: 4px; width: 100%;">Browse...</button>
                        </div>
                    </div>
                    
                    <!-- Timing Properties -->
                    <div class="property-group">
                        <h4>Timing</h4>
                        <div class="property-field">
                            <label>Start Time (ms)</label>
                            <input type="number" id="video-starttime" value="${selectedCue.startTime || 0}" min="0">
                        </div>
                        <div class="property-field">
                            <label>End Time (ms)</label>
                            <input type="number" id="video-endtime" value="${selectedCue.endTime || ''}" min="0">
                        </div>
                    </div>
                    
                    <!-- Audio Properties -->
                    <div class="property-group">
                        <h4>Audio</h4>
                        <div class="property-field">
                            <label>Volume: <span id="video-volume-display">${Math.round((selectedCue.volume || 1.0) * 100)}%</span></label>
                            <input type="range" id="video-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1.0}">
                        </div>
                        <div class="property-field">
                            <label>Fade In (ms)</label>
                            <input type="number" id="video-fadein" value="${selectedCue.fadeIn || 0}" min="0">
                        </div>
                        <div class="property-field">
                            <label>Fade Out (ms)</label>
                            <input type="number" id="video-fadeout" value="${selectedCue.fadeOut || 0}" min="0">
                        </div>
                    </div>
                    
                    <!-- Display Properties -->
                    <div class="property-group">
                        <h4>Display</h4>
                        <div class="property-field">
                            <label>Aspect Ratio</label>
                            <select id="video-aspectratio">
                                <option value="auto" ${selectedCue.aspectRatio === 'auto' ? 'selected' : ''}>Auto</option>
                                <option value="16:9" ${selectedCue.aspectRatio === '16:9' ? 'selected' : ''}>16:9</option>
                                <option value="4:3" ${selectedCue.aspectRatio === '4:3' ? 'selected' : ''}>4:3</option>
                                <option value="stretch" ${selectedCue.aspectRatio === 'stretch' ? 'selected' : ''}>Stretch</option>
                            </select>
                        </div>
                        <div class="property-field">
                            <label>Opacity: <span id="video-opacity-display">${Math.round((selectedCue.opacity || 1.0) * 100)}%</span></label>
                            <input type="range" id="video-opacity" min="0" max="1" step="0.01" value="${selectedCue.opacity || 1.0}">
                        </div>
                        <div class="property-field">
                            <label>
                                <input type="checkbox" id="video-fullscreen" ${selectedCue.fullscreen ? 'checked' : ''}>
                                Fullscreen
                            </label>
                        </div>
                        <div class="property-field">
                            <label>
                                <input type="checkbox" id="video-loop" ${selectedCue.loop ? 'checked' : ''}>
                                Loop
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Layout toggle functionality
toggleVideoLayout() {
    const mainContent = document.querySelector('.main-content');
    const toggleBtn = document.getElementById('video-layout-toggle');
    
    if (mainContent.classList.contains('video-focused')) {
        // Switch back to normal layout
        mainContent.classList.remove('video-focused');
        if (toggleBtn) {
            toggleBtn.textContent = '📺 Focus';
            toggleBtn.classList.remove('active');
        }
        this.isVideoFocused = false;
    } else {
        // Switch to video-focused layout
        mainContent.classList.add('video-focused');
        if (toggleBtn) {
            toggleBtn.textContent = '📋 Normal';
            toggleBtn.classList.add('active');
        }
        this.isVideoFocused = true;
    }
    
    // Re-render inspector with appropriate layout
    const selectedCue = this.cueManager.getSelectedCue();
    if (selectedCue && selectedCue.type === 'video') {
        this.renderInspector();
    }
}

// Enhanced video inspector binding for horizontal layout
bindVideoInspectorEventsHorizontal(selectedCue) {
    // Bind all the standard video events
    this.bindVideoInspectorEvents(selectedCue);
    
    // Add layout toggle
    const layoutToggle = document.getElementById('video-layout-toggle');
    if (layoutToggle) {
        layoutToggle.addEventListener('click', () => {
            this.toggleVideoLayout();
        });
    }
    
    // Enhanced timeline controls for horizontal layout
    this.bindHorizontalTimelineControls(selectedCue);
    
    // Timeline zoom control
    const zoomSlider = document.getElementById('timeline-zoom');
    if (zoomSlider) {
        zoomSlider.addEventListener('input', (e) => {
            const zoomLevel = parseFloat(e.target.value);
            if (window.videoEngine.videoTimeline) {
                window.videoEngine.videoTimeline.zoomLevel = zoomLevel;
                window.videoEngine.videoTimeline.render();
            }
        });
    }
}

// Horizontal timeline controls
bindHorizontalTimelineControls(selectedCue) {
    const setInBtn = document.getElementById('video-set-in');
    const setOutBtn = document.getElementById('video-set-out');
    
    if (setInBtn) {
        setInBtn.addEventListener('click', () => {
            if (window.videoEngine.videoTimeline) {
                const currentTime = window.videoEngine.videoTimeline.currentTime;
                const duration = window.videoEngine.videoTimeline.duration;
                const normalizedTime = duration > 0 ? currentTime / duration : 0;
                window.videoEngine.videoTimeline.setTrimStart(normalizedTime);
            }
        });
    }
    
    if (setOutBtn) {
        setOutBtn.addEventListener('click', () => {
            if (window.videoEngine.videoTimeline) {
                const currentTime = window.videoEngine.videoTimeline.currentTime;
                const duration = window.videoEngine.videoTimeline.duration;
                const normalizedTime = duration > 0 ? currentTime / duration : 0;
                window.videoEngine.videoTimeline.setTrimEnd(normalizedTime);
            }
        });
    }
}

// Enhanced timeline info update for horizontal layout
updateVideoTimelineInfoDisplayHorizontal() {
    if (!window.videoEngine.videoTimeline) return;
    
    const currentTimeEl = document.getElementById('video-current-time-h');
    const frameInfoEl = document.getElementById('video-frame-info-h');
    const durationEl = document.getElementById('video-duration-h');
    const inPointEl = document.getElementById('video-in-point');
    const outPointEl = document.getElementById('video-out-point');
    const selectionEl = document.getElementById('video-selection-duration');
    
    const updateInfo = () => {
        const timeline = window.videoEngine.videoTimeline;
        
        if (currentTimeEl) {
            currentTimeEl.textContent = timeline.formatTimecode(timeline.currentTime);
        }
        
        if (frameInfoEl) {
            frameInfoEl.textContent = `${timeline.currentFrame + 1}/${timeline.totalFrames}`;
        }
        
        if (durationEl) {
            durationEl.textContent = timeline.formatTimecode(timeline.duration);
        }
        
        // Update trim point displays
        const trimPoints = timeline.getTrimPointsInSeconds();
        if (inPointEl) {
            inPointEl.textContent = timeline.formatTimecode(trimPoints.start);
        }
        
        if (outPointEl) {
            outPointEl.textContent = timeline.formatTimecode(trimPoints.end);
        }
        
        if (selectionEl) {
            const selectionDuration = trimPoints.end - trimPoints.start;
            selectionEl.textContent = timeline.formatTimecode(selectionDuration);
        }
    };
    
    updateInfo();
    
    if (this.videoTimelineUpdateInterval) {
        clearInterval(this.videoTimelineUpdateInterval);
    }
    
    this.videoTimelineUpdateInterval = setInterval(updateInfo, 100);
}

// Modified inspector rendering to support layout choice
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

    // Check if we need to preserve the waveform/timeline
    const hadWaveform = this.currentWaveformCue && 
                       this.currentWaveformCue.id === selectedCue.id && 
                       this.waveformRenderer;

    // Choose layout based on cue type and current layout preference
    if (selectedCue.type === 'video' && (this.isVideoFocused || this.shouldUseHorizontalLayout(selectedCue))) {
        inspectorContent.innerHTML = this.generateVideoInspectorHTMLHorizontal(selectedCue);
        this.bindVideoInspectorEventsHorizontal(selectedCue);
    } else {
        inspectorContent.innerHTML = this.generateInspectorHTML(selectedCue);
        this.bindInspectorEvents(selectedCue);
    }

    // Restore media content if it existed
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

// Determine if horizontal layout should be used
shouldUseHorizontalLayout(cue) {
    // Use horizontal layout for video cues by default, or when explicitly set
    return cue.type === 'video' && (this.isVideoFocused !== false);
}

// Enhanced video timeline loading for horizontal layout
async loadVideoTimelineHorizontal(cue) {
    const canvas = document.getElementById('video-timeline-horizontal');
    const preview = document.getElementById('video-preview-horizontal');
    
    if (!canvas || !cue.filePath) return;

    try {
        console.log('Loading horizontal video timeline for:', cue.name);
        
        // Set up video preview
        if (preview) {
            const videoUrl = window.videoEngine.getFileUrl(cue.filePath);
            preview.src = videoUrl;
            
            // Initialize timeline when video metadata loads
            preview.addEventListener('loadedmetadata', () => {
                window.videoEngine.initializeVideoTimeline(preview, canvas);
                this.setupHorizontalTimelineEvents(cue);
                this.updateVideoTimelineInfoDisplayHorizontal();
                this.applyExistingTrimPoints(cue);
            }, { once: true });
        }

        console.log('Horizontal video timeline setup complete');

    } catch (error) {
        console.error('Failed to load horizontal video timeline:', error);
    }
}

// Setup events specific to horizontal timeline
setupHorizontalTimelineEvents(cue) {
    if (!window.videoEngine.videoTimeline) return;
    
    // Handle trim changes
    window.videoEngine.videoTimeline.on('trimChange', (trimPoints) => {
        this.updateCueTrimPointsFromTimeline(cue.id, trimPoints);
        
        // Update horizontal display
        const inPointEl = document.getElementById('video-in-point');
        const outPointEl = document.getElementById('video-out-point');
        const selectionEl = document.getElementById('video-selection-duration');
        
        if (inPointEl) {
            inPointEl.textContent = window.videoEngine.videoTimeline.formatTimecode(trimPoints.start);
        }
        
        if (outPointEl) {
            outPointEl.textContent = window.videoEngine.videoTimeline.formatTimecode(trimPoints.end);
        }
        
        if (selectionEl) {
            const duration = trimPoints.end - trimPoints.start;
            selectionEl.textContent = window.videoEngine.videoTimeline.formatTimecode(duration);
        }
    });
    
    // Sync preview video with timeline
    const preview = document.getElementById('video-preview-horizontal');
    if (preview) {
        window.videoEngine.videoTimeline.on('seek', (time) => {
            preview.currentTime = time;
        });
        
        preview.addEventListener('timeupdate', () => {
            window.videoEngine.videoTimeline.updatePlayback(!preview.paused, preview.currentTime);
        });
    }
}

// Auto-switch to horizontal layout for video cues
onSelectionChanged(data) {
    this.updateSelection();
    
    // Auto-switch to horizontal layout for video cues
    const selectedCue = this.cueManager.getSelectedCue();
    if (selectedCue && selectedCue.type === 'video' && !this.isVideoFocused) {
        console.log('Auto-switching to horizontal layout for video cue');
        this.toggleVideoLayout();
    }
    
    this.renderInspector();
}

// Enhanced cleanup for horizontal layout
cleanup() {
    if (this.timelineUpdateInterval) {
        clearInterval(this.timelineUpdateInterval);
        this.timelineUpdateInterval = null;
    }
    
    if (this.videoTimelineUpdateInterval) {
        clearInterval(this.videoTimelineUpdateInterval);
        this.videoTimelineUpdateInterval = null;
    }
    
    // Reset layout state
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.classList.remove('video-focused');
    }
    
    this.isVideoFocused = false;
}
}
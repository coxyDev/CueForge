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
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3>Video File</h3>
                        <div class="inspector-field">
                            <label>File</label>
                            <input type="text" id="video-filepath" value="${selectedCue.filePath || ''}" readonly>
                            <button id="select-video-file">Browse...</button>
                        </div>
                    </div>
                    <div class="inspector-group">
                        <h3>Video Properties</h3>
                        <div class="inspector-field">
                            <label>Volume: <span id="video-volume-display">${Math.round((selectedCue.volume || 1.0) * 100)}%</span></label>
                            <input type="range" id="video-volume" min="0" max="1" step="0.01" value="${selectedCue.volume || 1.0}">
                        </div>
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
}
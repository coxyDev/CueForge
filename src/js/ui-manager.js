class UIManager {
    constructor(cueManager, audioEngine) {
        this.cueManager = cueManager;
        this.audioEngine = audioEngine;
        this.elements = {};
        this.selectedCueElement = null;
        
        this.initializeElements();
        this.bindEvents();
        this.setupMenuHandlers();
        this.updateUI();
        
        // Update time display
        this.startTimeUpdater();
    }

    initializeElements() {
        // Cache frequently used elements
        this.elements = {
            // Header elements
            showName: document.getElementById('show-name'),
            showStatus: document.getElementById('show-status'),
            
            // Transport controls
            goBtn: document.getElementById('go-btn'),
            stopBtn: document.getElementById('stop-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            
            // Cue list elements
            cueList: document.getElementById('cue-list'),
            cueCount: document.getElementById('cue-count'),
            
            // Cue control buttons
            addAudioCue: document.getElementById('add-audio-cue'),
            addVideoCue: document.getElementById('add-video-cue'),
            addWaitCue: document.getElementById('add-wait-cue'),
            addGroupCue: document.getElementById('add-group-cue'),
            deleteCue: document.getElementById('delete-cue'),
            
            // Inspector
            inspectorContent: document.getElementById('inspector-content'),
            
            // Status bar
            currentTime: document.getElementById('current-time')
        };
    }

    bindEvents() {
        // Transport controls
        this.elements.goBtn.addEventListener('click', () => this.cueManager.go());
        this.elements.stopBtn.addEventListener('click', () => this.cueManager.stop());
        this.elements.pauseBtn.addEventListener('click', () => this.cueManager.pause());
        
        // Cue controls
        this.elements.addAudioCue.addEventListener('click', () => this.addCue('audio'));
        this.elements.addVideoCue.addEventListener('click', () => this.addCue('video'));
        this.elements.addWaitCue.addEventListener('click', () => this.addCue('wait'));
        this.elements.addGroupCue.addEventListener('click', () => this.addCue('group'));
        this.elements.deleteCue.addEventListener('click', () => this.deleteSelectedCue());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // CueManager events
        this.cueManager.on('cueAdded', (data) => this.onCueAdded(data));
        this.cueManager.on('cueRemoved', (data) => this.onCueRemoved(data));
        this.cueManager.on('cueUpdated', (data) => this.onCueUpdated(data));
        this.cueManager.on('selectionChanged', (data) => this.onSelectionChanged(data));
        this.cueManager.on('playbackStateChanged', (data) => this.onPlaybackStateChanged(data));
        this.cueManager.on('showChanged', (data) => this.onShowChanged(data));
    }

    setupMenuHandlers() {
        const { ipcRenderer } = require('electron');
        
        // Handle menu events from main process
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

    handleKeydown(e) {
        // Only handle shortcuts when not in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
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
        }
    }

    async addCue(type) {
        let options = {};
        
        if (type === 'audio') {
            // Open file dialog for audio cues
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('select-audio-file');
            
            if (result.success) {
                options.filePath = result.filePath;
                options.name = require('path').basename(result.filePath, require('path').extname(result.filePath));
                
                // Try to get audio file info
                try {
                    const audioInfo = await this.audioEngine.getAudioFileInfo(result.filePath);
                    if (audioInfo) {
                        options.duration = audioInfo.duration;
                    }
                } catch (error) {
                    console.warn('Could not get audio file info:', error);
                }
            } else {
                return; // User cancelled
            }
        } else if (type === 'video') {
            // Open file dialog for video cues
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('select-video-file');
            
            if (result.success) {
                options.filePath = result.filePath;
                options.name = require('path').basename(result.filePath, require('path').extname(result.filePath));
                
                // Try to get video file info
                try {
                    const videoInfo = await window.videoEngine.getVideoFileInfo(result.filePath);
                    if (videoInfo) {
                        options.duration = videoInfo.duration;
                    }
                } catch (error) {
                    console.warn('Could not get video file info:', error);
                }
                
                // Show video preview
                window.videoEngine.previewVideoInInspector(result.filePath);
            } else {
                return; // User cancelled
            }
        }
        
        const cue = this.cueManager.addCue(type, options);
        this.cueManager.selectCue(cue.id);
    }

    deleteSelectedCue() {
        const selectedCue = this.cueManager.getSelectedCue();
        if (selectedCue) {
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
        this.renderCueList(); // Update cue states
    }

    onShowChanged(data) {
        this.updateShowName();
        if (data.loaded || data.reordered) {
            this.renderCueList();
        }
        this.updateCueCount();
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
        
        // Update button states based on playback state
        if (this.cueManager.isPlaying) {
            goBtn.textContent = 'GO';
            goBtn.disabled = false;
        } else if (this.cueManager.isPaused) {
            goBtn.textContent = 'RESUME';
            goBtn.disabled = false;
        } else {
            goBtn.textContent = 'GO';
            goBtn.disabled = this.cueManager.cues.length === 0;
        }
        
        stopBtn.disabled = !this.cueManager.isPlaying && !this.cueManager.isPaused;
        pauseBtn.disabled = !this.cueManager.isPlaying;
    }

    updateCueCount() {
        const stats = this.cueManager.getCueStats();
        this.elements.cueCount.textContent = `${stats.total} cue${stats.total !== 1 ? 's' : ''}`;
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
        
        // Add current cue highlight
        if (index === this.cueManager.currentCueIndex) {
            element.classList.add('current');
        }
        
        // Add playing state
        if (cue.status === 'playing') {
            element.classList.add('playing');
        }
        
        element.innerHTML = `
            <div class="cue-number">${cue.number}</div>
            <div class="cue-name">${cue.name}</div>
            <div class="cue-type">${cue.type}</div>
            <div class="cue-duration">${this.formatDuration(cue.duration)}</div>
            <div class="cue-status ${cue.status}">${cue.status}</div>
        `;
        
        element.addEventListener('click', () => {
            this.cueManager.selectCue(cue.id);
        });
        
        element.addEventListener('dblclick', () => {
            this.cueManager.playCue(cue.id);
        });
        
        return element;
    }

    updateCueElement(cue) {
        const element = document.querySelector(`[data-cue-id="${cue.id}"]`);
        if (element) {
            element.querySelector('.cue-name').textContent = cue.name;
            element.querySelector('.cue-duration').textContent = this.formatDuration(cue.duration);
            
            const statusElement = element.querySelector('.cue-status');
            statusElement.textContent = cue.status;
            statusElement.className = `cue-status ${cue.status}`;
            
            // Update playing state
            element.classList.toggle('playing', cue.status === 'playing');
        }
    }

    updateSelection() {
        // Remove previous selection
        if (this.selectedCueElement) {
            this.selectedCueElement.classList.remove('selected');
        }
        
        // Add new selection
        if (this.cueManager.selectedCueId) {
            this.selectedCueElement = document.querySelector(`[data-cue-id="${this.cueManager.selectedCueId}"]`);
            if (this.selectedCueElement) {
                this.selectedCueElement.classList.add('selected');
            }
        } else {
            this.selectedCueElement = null;
        }
    }

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

    generateInspectorHTML(cue) {
        const commonFields = `
            <div class="inspector-group">
                <h3>Basic</h3>
                <div class="inspector-field">
                    <label>Number</label>
                    <input type="text" id="cue-number" value="${cue.number}">
                </div>
                <div class="inspector-field">
                    <label>Name</label>
                    <input type="text" id="cue-name" value="${cue.name}">
                </div>
                <div class="inspector-field">
                    <label>Pre-wait (ms)</label>
                    <input type="number" id="cue-prewait" value="${cue.preWait}" min="0">
                </div>
                <div class="inspector-field">
                    <label>Post-wait (ms)</label>
                    <input type="number" id="cue-postwait" value="${cue.postWait}" min="0">
                </div>
            </div>
        `;

        let typeSpecificFields = '';

        switch (cue.type) {
            case 'audio':
                typeSpecificFields = `
                    <div class="inspector-group">
                        <h3>Audio</h3>
                        <div class="inspector-field">
                            <label>File</label>
                            <input type="text" id="audio-filepath" value="${cue.filePath || ''}" readonly>
                            <button id="select-audio-file">Browse...</button>
                        </div>
                        <div class="inspector-field">
                            <label>Volume</label>
                            <input type="range" id="audio-volume" min="0" max="1" step="0.01" value="${cue.volume}">
                            <span id="volume-display">${Math.round(cue.volume * 100)}%</span>
                        </div>
                        <div class="inspector-field">
                            <label>Start Time (ms)</label>
                            <input type="number" id="audio-starttime" value="${cue.startTime}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>End Time (ms)</label>
                            <input type="number" id="audio-endtime" value="${cue.endTime || ''}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade In (ms)</label>
                            <input type="number" id="audio-fadein" value="${cue.fadeIn}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade Out (ms)</label>
                            <input type="number" id="audio-fadeout" value="${cue.fadeOut}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>
                                <input type="checkbox" id="audio-loop" ${cue.loop ? 'checked' : ''}>
                                Loop
                            </label>
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
                            <input type="text" id="video-filepath" value="${cue.filePath || ''}" readonly>
                            <button id="select-video-file">Browse...</button>
                        </div>
                        <div class="inspector-field">
                            <label>Volume</label>
                            <input type="range" id="video-volume" min="0" max="1" step="0.01" value="${cue.volume}">
                            <span id="video-volume-display">${Math.round(cue.volume * 100)}%</span>
                        </div>
                        <div class="inspector-field">
                            <label>Start Time (ms)</label>
                            <input type="number" id="video-starttime" value="${cue.startTime}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>End Time (ms)</label>
                            <input type="number" id="video-endtime" value="${cue.endTime || ''}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade In (ms)</label>
                            <input type="number" id="video-fadein" value="${cue.fadeIn}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Fade Out (ms)</label>
                            <input type="number" id="video-fadeout" value="${cue.fadeOut}" min="0">
                        </div>
                        <div class="inspector-field">
                            <label>Opacity</label>
                            <input type="range" id="video-opacity" min="0" max="1" step="0.01" value="${cue.opacity}">
                            <span id="opacity-display">${Math.round(cue.opacity * 100)}%</span>
                        </div>
                        <div class="inspector-field">
                            <label>Aspect Ratio</label>
                            <select id="video-aspect">
                                <option value="auto" ${cue.aspectRatio === 'auto' ? 'selected' : ''}>Auto</option>
                                <option value="16:9" ${cue.aspectRatio === '16:9' ? 'selected' : ''}>16:9</option>
                                <option value="4:3" ${cue.aspectRatio === '4:3' ? 'selected' : ''}>4:3</option>
                                <option value="stretch" ${cue.aspectRatio === 'stretch' ? 'selected' : ''}>Stretch</option>
                            </select>
                        </div>
                        <div class="inspector-field">
                            <label>
                                <input type="checkbox" id="video-fullscreen" ${cue.fullscreen ? 'checked' : ''}>
                                Fullscreen
                            </label>
                        </div>
                        <div class="inspector-field">
                            <label>
                                <input type="checkbox" id="video-loop" ${cue.loop ? 'checked' : ''}>
                                Loop
                            </label>
                        </div>
                        <div class="inspector-field">
                            <button id="preview-video">Preview Video</button>
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
                            <input type="number" id="wait-duration" value="${cue.duration}" min="0">
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
                                <option value="sequential" ${cue.mode === 'sequential' ? 'selected' : ''}>Sequential</option>
                                <option value="parallel" ${cue.mode === 'parallel' ? 'selected' : ''}>Parallel</option>
                            </select>
                        </div>
                        <div class="inspector-field">
                            <label>Children (${cue.children.length})</label>
                            <div id="group-children">
                                ${cue.children.map(childId => {
                                    const childCue = this.cueManager.getCue(childId);
                                    return childCue ? `<div class="child-cue">${childCue.number} - ${childCue.name}</div>` : '';
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
                break;
        }

        const infoFields = `
            <div class="inspector-group">
                <h3>Info</h3>
                <div class="inspector-field">
                    <label>Type</label>
                    <input type="text" value="${cue.type}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Status</label>
                    <input type="text" value="${cue.status}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Duration</label>
                    <input type="text" value="${this.formatDuration(cue.duration)}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Created</label>
                    <input type="text" value="${new Date(cue.created).toLocaleString()}" readonly>
                </div>
            </div>
        `;

        return commonFields + typeSpecificFields + infoFields;
    }

    bindInspectorEvents(cue) {
        // Basic fields
        const numberInput = document.getElementById('cue-number');
        const nameInput = document.getElementById('cue-name');
        const preWaitInput = document.getElementById('cue-prewait');
        const postWaitInput = document.getElementById('cue-postwait');

        if (numberInput) {
            numberInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { number: parseFloat(e.target.value) || cue.number });
            });
        }

        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { name: e.target.value });
            });
        }

        if (preWaitInput) {
            preWaitInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { preWait: parseInt(e.target.value) || 0 });
            });
        }

        if (postWaitInput) {
            postWaitInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { postWait: parseInt(e.target.value) || 0 });
            });
        }

        // Type-specific fields
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
        const volumeDisplay = document.getElementById('volume-display');
        const startTimeInput = document.getElementById('audio-starttime');
        const endTimeInput = document.getElementById('audio-endtime');
        const fadeInInput = document.getElementById('audio-fadein');
        const fadeOutInput = document.getElementById('audio-fadeout');
        const loopCheckbox = document.getElementById('audio-loop');

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', async () => {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('select-audio-file');
                
                if (result.success) {
                    const updates = { filePath: result.filePath };
                    
                    // Try to get audio file info
                    try {
                        const audioInfo = await this.audioEngine.getAudioFileInfo(result.filePath);
                        if (audioInfo) {
                            updates.duration = audioInfo.duration;
                        }
                    } catch (error) {
                        console.warn('Could not get audio file info:', error);
                    }
                    
                    this.cueManager.updateCue(cue.id, updates);
                    this.renderInspector(); // Refresh inspector
                }
            });
        }

        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
            });
            
            volumeSlider.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { volume: parseFloat(e.target.value) });
            });
        }

        if (startTimeInput) {
            startTimeInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { startTime: parseInt(e.target.value) || 0 });
            });
        }

        if (endTimeInput) {
            endTimeInput.addEventListener('change', (e) => {
                const value = e.target.value;
                this.cueManager.updateCue(cue.id, { endTime: value ? parseInt(value) : null });
            });
        }

        if (fadeInInput) {
            fadeInInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { fadeIn: parseInt(e.target.value) || 0 });
            });
        }

        if (fadeOutInput) {
            fadeOutInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { fadeOut: parseInt(e.target.value) || 0 });
            });
        }

        if (loopCheckbox) {
            loopCheckbox.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { loop: e.target.checked });
            });
        }
    }

    bindVideoInspectorEvents(cue) {
        const selectFileBtn = document.getElementById('select-video-file');
        const volumeSlider = document.getElementById('video-volume');
        const volumeDisplay = document.getElementById('video-volume-display');
        const startTimeInput = document.getElementById('video-starttime');
        const endTimeInput = document.getElementById('video-endtime');
        const fadeInInput = document.getElementById('video-fadein');
        const fadeOutInput = document.getElementById('video-fadeout');
        const opacitySlider = document.getElementById('video-opacity');
        const opacityDisplay = document.getElementById('opacity-display');
        const aspectSelect = document.getElementById('video-aspect');
        const fullscreenCheckbox = document.getElementById('video-fullscreen');
        const loopCheckbox = document.getElementById('video-loop');
        const previewBtn = document.getElementById('preview-video');

        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', async () => {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('select-video-file');
                
                if (result.success) {
                    const updates = { filePath: result.filePath };
                    
                    // Try to get video file info
                    try {
                        const videoInfo = await window.videoEngine.getVideoFileInfo(result.filePath);
                        if (videoInfo) {
                            updates.duration = videoInfo.duration;
                        }
                    } catch (error) {
                        console.warn('Could not get video file info:', error);
                    }
                    
                    this.cueManager.updateCue(cue.id, updates);
                    this.renderInspector(); // Refresh inspector
                    
                    // Show video preview
                    window.videoEngine.previewVideoInInspector(result.filePath);
                }
            });
        }

        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
            });
            
            volumeSlider.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { volume: parseFloat(e.target.value) });
            });
        }

        if (opacitySlider && opacityDisplay) {
            opacitySlider.addEventListener('input', (e) => {
                const opacity = parseFloat(e.target.value);
                opacityDisplay.textContent = `${Math.round(opacity * 100)}%`;
            });
            
            opacitySlider.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { opacity: parseFloat(e.target.value) });
            });
        }

        if (startTimeInput) {
            startTimeInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { startTime: parseInt(e.target.value) || 0 });
            });
        }

        if (endTimeInput) {
            endTimeInput.addEventListener('change', (e) => {
                const value = e.target.value;
                this.cueManager.updateCue(cue.id, { endTime: value ? parseInt(value) : null });
            });
        }

        if (fadeInInput) {
            fadeInInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { fadeIn: parseInt(e.target.value) || 0 });
            });
        }

        if (fadeOutInput) {
            fadeOutInput.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { fadeOut: parseInt(e.target.value) || 0 });
            });
        }

        if (aspectSelect) {
            aspectSelect.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { aspectRatio: e.target.value });
            });
        }

        if (fullscreenCheckbox) {
            fullscreenCheckbox.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { fullscreen: e.target.checked });
            });
        }

        if (loopCheckbox) {
            loopCheckbox.addEventListener('change', (e) => {
                this.cueManager.updateCue(cue.id, { loop: e.target.checked });
            });
        }

        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                if (cue.filePath) {
                    window.videoEngine.previewVideoInInspector(cue.filePath);
                }
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
            this.elements.currentTime.textContent = this.formatTime(new Date());
        }, 1000);
        
        // Initial update
        this.elements.currentTime.textContent = this.formatTime(new Date());
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
}
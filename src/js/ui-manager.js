/**
 * Enhanced UI Manager with Complete Targeting System
 * Handles all user interface interactions for professional cue targeting
 */

class UIManager {
    constructor(cueManager, audioEngine) {
        this.cueManager = cueManager;
        this.audioEngine = audioEngine;
        this.elements = {};
        this.clipboard = null;
        this.currentTargetEditCue = null; // For target editing modal
        this.selectedTargetCueId = null; // For target selection
        this.selectedFile = null; // For file target selection
        
        this.initializeElements();
        this.bindEvents();
        this.setupEventListeners();
        this.setupGlobalKeyHandler();
        this.setupTargetingSystem();
        this.ensureStylesLoaded();
        this.ensureSettingsModalHidden();
        
        // Check for File System Access API
        this.hasFileSystemAccess = 'showOpenFilePicker' in window;
        if (!this.hasFileSystemAccess) {
            this.showFileSystemWarning();
        }
        
        console.log('UIManager initialized with complete targeting system');
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
            brokenCueCount: document.getElementById('broken-cue-count'),
            
            // Media cue buttons
            addAudioCue: document.getElementById('add-audio-cue'),
            addVideoCue: document.getElementById('add-video-cue'),
            
            // Basic cue buttons
            addWaitCue: document.getElementById('add-wait-cue'),
            addGroupCue: document.getElementById('add-group-cue'),
            
            // Control cue buttons
            addStartCue: document.getElementById('add-start-cue'),
            addStopCue: document.getElementById('add-stop-cue'),
            addGoToCue: document.getElementById('add-goto-cue'),
            addFadeCue: document.getElementById('add-fade-cue'),
            
            deleteCue: document.getElementById('delete-cue'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            inspectorContent: document.getElementById('inspector-content'),
            clearTargetBtn: document.getElementById('clear-target-btn'),
            currentTime: document.getElementById('current-time'),
            displayRouting: document.getElementById('display-routing'),
            
            // Target selection modal
            targetModal: document.getElementById('target-modal'),
            targetModalTitle: document.getElementById('target-modal-title'),
            targetModalContent: document.getElementById('target-modal-content'),
            closeTargetModal: document.getElementById('close-target-modal'),
            cancelTarget: document.getElementById('cancel-target'),
            applyTarget: document.getElementById('apply-target'),
            
            // File target modal
            fileTargetModal: document.getElementById('file-target-modal'),
            closeFileTargetModal: document.getElementById('close-file-target-modal'),
            fileDropZone: document.getElementById('file-drop-zone'),
            fileInput: document.getElementById('file-input'),
            browseFileBtn: document.getElementById('browse-file-btn'),
            selectedFileInfo: document.getElementById('selected-file-info'),
            selectedFileName: document.getElementById('selected-file-name'),
            selectedFileSize: document.getElementById('selected-file-size'),
            selectedFilePath: document.getElementById('selected-file-path'),
            acceptedFormats: document.getElementById('accepted-formats'),
            cancelFileTarget: document.getElementById('cancel-file-target'),
            applyFileTarget: document.getElementById('apply-file-target')
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

        // Media cue buttons
        if (this.elements.addAudioCue) {
            this.elements.addAudioCue.addEventListener('click', () => this.addCue('audio'));
        }
        if (this.elements.addVideoCue) {
            this.elements.addVideoCue.addEventListener('click', () => this.addCue('video'));
        }
        
        // Basic cue buttons
        if (this.elements.addWaitCue) {
            this.elements.addWaitCue.addEventListener('click', () => this.addCue('wait'));
        }
        if (this.elements.addGroupCue) {
            this.elements.addGroupCue.addEventListener('click', () => this.addCue('group'));
        }
        
        // Control cue buttons
        if (this.elements.addStartCue) {
            this.elements.addStartCue.addEventListener('click', () => this.addControlCue('start'));
        }
        if (this.elements.addStopCue) {
            this.elements.addStopCue.addEventListener('click', () => this.addControlCue('stop'));
        }
        if (this.elements.addGoToCue) {
            this.elements.addGoToCue.addEventListener('click', () => this.addControlCue('goto'));
        }
        if (this.elements.addFadeCue) {
            this.elements.addFadeCue.addEventListener('click', () => this.addControlCue('fade'));
        }

        if (this.elements.deleteCue) {
            this.elements.deleteCue.addEventListener('click', () => this.deleteSelectedCue());
        }

        // Settings
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        }
        if (this.elements.closeSettings) {
            this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        }
        if (this.elements.settingsModal) {
            this.elements.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.settingsModal) {
                    this.closeSettings();
                }
            });
        }

        // Inspector controls
        if (this.elements.clearTargetBtn) {
            this.elements.clearTargetBtn.addEventListener('click', () => this.clearSelectedCueTarget());
        }
    }

    setupTargetingSystem() {
        // Target selection modal events
        if (this.elements.closeTargetModal) {
            this.elements.closeTargetModal.addEventListener('click', () => this.closeTargetModal());
        }
        if (this.elements.cancelTarget) {
            this.elements.cancelTarget.addEventListener('click', () => this.closeTargetModal());
        }
        if (this.elements.applyTarget) {
            this.elements.applyTarget.addEventListener('click', () => this.applySelectedTarget());
        }
        if (this.elements.targetModal) {
            this.elements.targetModal.addEventListener('click', (e) => {
                if (e.target === this.elements.targetModal) {
                    this.closeTargetModal();
                }
            });
        }

        // File target modal events
        if (this.elements.closeFileTargetModal) {
            this.elements.closeFileTargetModal.addEventListener('click', () => this.closeFileTargetModal());
        }
        if (this.elements.cancelFileTarget) {
            this.elements.cancelFileTarget.addEventListener('click', () => this.closeFileTargetModal());
        }
        if (this.elements.applyFileTarget) {
            this.elements.applyFileTarget.addEventListener('click', () => this.applySelectedFile());
        }
        if (this.elements.fileTargetModal) {
            this.elements.fileTargetModal.addEventListener('click', (e) => {
                if (e.target === this.elements.fileTargetModal) {
                    this.closeFileTargetModal();
                }
            });
        }

        // File selection events
        if (this.elements.browseFileBtn) {
            this.elements.browseFileBtn.addEventListener('click', () => {
                this.elements.fileInput.click();
            });
        }
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.selectFile(e.target.files[0]);
                }
            });
        }

        // File drop zone events
        if (this.elements.fileDropZone) {
            this.setupFileDropZone();
        }
    }

    setupFileDropZone() {
        const dropZone = this.elements.fileDropZone;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.selectFile(files[0]);
            }
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    setupEventListeners() {
        this.cueManager.on('cueAdded', (data) => this.onCueAdded(data));
        this.cueManager.on('cueRemoved', (data) => this.onCueRemoved(data));
        this.cueManager.on('cueUpdated', (data) => this.onCueUpdated(data));
        this.cueManager.on('selectionChanged', (data) => this.onSelectionChanged(data));
        this.cueManager.on('playbackStateChanged', (data) => this.onPlaybackStateChanged(data));
        this.cueManager.on('showChanged', (data) => this.onShowChanged(data));
        this.cueManager.on('playheadChanged', (data) => this.onPlayheadChanged(data));

        setInterval(() => this.updateCurrentTime(), 1000);
    }

    // ==================== EVENT HANDLERS ====================

    onCueAdded(data) {
        this.renderCueList();
        this.updateCueCount();
        this.updateTransportButtons();
    }

    onCueRemoved(data) {
        this.renderCueList();
        this.updateCueCount();
        this.updateTransportButtons();
    }

    onCueUpdated(data) {
        this.renderCueList();
        this.updateInspector();
        this.updateTransportButtons();
        this.updateCueCount(); // Update broken cue count
    }

    onSelectionChanged(data) {
        this.renderCueList();
        this.updateInspector();
        this.updateTransportButtons();
    }

    onPlaybackStateChanged(data) {
        this.updateShowInfo();
        this.updateTransportButtons();
        this.renderCueList();
    }

    onShowChanged(data) {
        this.updateShowInfo();
        this.updateCueCount();
    }

    onPlayheadChanged(data) {
        this.renderCueList();
        this.updateGoButtonText();
        this.updateTransportButtons();
    }

    // ==================== CUE LIST RENDERING WITH TARGET COLUMN ====================

    renderCueList() {
        if (!this.elements.cueList) return;

        this.elements.cueList.innerHTML = '';

        if (this.cueManager.cues.length === 0) {
            this.elements.cueList.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #888; font-style: italic; grid-column: 1 / -1;">
                    No cues in show<br>
                    <small>Click the + buttons above to add cues</small>
                </div>
            `;
            return;
        }

        this.cueManager.cues.forEach(cue => {
            const element = this.createCueElement(cue);
            this.elements.cueList.appendChild(element);
        });
    }

    createCueElement(cue) {
        const element = document.createElement('div');
        element.className = 'cue-item';
        element.dataset.cueId = cue.id;

        // Apply state classes
        const selectedCue = this.cueManager.getSelectedCue();
        const standByCue = this.cueManager.getStandByCue();
        
        if (selectedCue && selectedCue.id === cue.id) {
            element.classList.add('selected');
        }
        
        if (standByCue && standByCue.id === cue.id) {
            element.classList.add('standing-by');
        }
        
        if (cue.isBroken) {
            element.classList.add('broken');
        }
        
        if (cue.status === 'playing') {
            element.classList.add('playing');
        } else if (cue.status === 'paused') {
            element.classList.add('paused');
        } else if (cue.status === 'loading') {
            element.classList.add('loading');
        }
        
        if (cue.autoContinue) {
            element.classList.add('auto-continue');
        }

        // Enhanced playhead indicator
        const playheadIndicator = (standByCue && standByCue.id === cue.id) ? '▶ ' : '';
        
        // Get target display
        const targetDisplay = this.getTargetDisplayHTML(cue);
        
        // Get cue type styling
        const cueTypeClass = this.getCueTypeClass(cue.type);
        
        element.innerHTML = `
            <div class="cue-number">${playheadIndicator}${cue.number}${cue.autoContinue ? ' →' : ''}</div>
            <div class="cue-name">${cue.name}</div>
            <div class="cue-type ${cueTypeClass}">${cue.type}</div>
            <div class="cue-target">${targetDisplay}</div>
            <div class="cue-duration">${this.formatDuration(cue.duration)}</div>
            <div class="cue-status ${cue.status}">${cue.status}</div>
        `;
        
        // Enhanced event handlers
        element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.shiftKey) {
                this.cueManager.setStandByCue(cue.id);
                console.log(`Set cue ${cue.number} as standby`);
            } else if (e.ctrlKey || e.metaKey) {
                this.cueManager.goToCue(cue.id);
                console.log(`Going to cue ${cue.number} immediately`);
            } else {
                this.cueManager.selectCue(cue.id);
                console.log(`Selected cue ${cue.number}`);
            }
            
            setTimeout(() => this.renderCueList(), 0);
        });
        
        element.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cueManager.goToCue(cue.id);
            console.log(`Going to cue ${cue.number} via double-click`);
        });

        // Target click handler
        const targetElement = element.querySelector('.cue-target');
        if (targetElement && cue.requiresTarget) {
            targetElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editCueTarget(cue);
            });
        }
        
        return element;
    }

    getTargetDisplayHTML(cue) {
        if (!cue.requiresTarget) {
            return ''; // No target needed
        }

        const targetText = this.cueManager.getTargetDisplayText(cue);
        
        if (targetText === '?') {
            return '<span class="cue-target empty">?</span>';
        }
        
        if (targetText === '⚠ Missing') {
            return '<span class="cue-target missing">⚠ Missing</span>';
        }
        
        if (cue.targetType === 'file') {
            return `<span class="cue-target file-target" title="Click to change file">${targetText}</span>`;
        }
        
        if (cue.targetType === 'cue') {
            return `<span class="cue-target cue-target" title="Click to change target">${targetText}</span>`;
        }
        
        return targetText;
    }

    getCueTypeClass(type) {
        const controlCues = ['start', 'stop', 'pause', 'goto', 'fade', 'load', 'reset'];
        const mediaCues = ['audio', 'video'];
        
        if (controlCues.includes(type)) {
            return 'control-cue';
        }
        
        if (mediaCues.includes(type)) {
            return 'media-cue';
        }
        
        return '';
    }

    // ==================== TARGET EDITING SYSTEM ====================

    editCueTarget(cue) {
        this.currentTargetEditCue = cue;
        
        if (cue.targetType === 'file') {
            this.openFileTargetModal(cue);
        } else if (cue.targetType === 'cue') {
            this.openCueTargetModal(cue);
        }
    }

    openFileTargetModal(cue) {
        // Set accepted formats based on cue type
        const definition = this.cueManager.cueTypeDefinitions[cue.type];
        if (definition && definition.acceptedFormats) {
            const formats = definition.acceptedFormats.map(f => f.toUpperCase()).join(', ');
            this.elements.acceptedFormats.textContent = `Accepted formats: ${formats}`;
            
            const acceptString = definition.acceptedFormats.map(f => `.${f}`).join(',');
            this.elements.fileInput.accept = acceptString;
        }

        // Clear previous selection
        this.selectedFile = null;
        this.elements.selectedFileInfo.style.display = 'none';
        this.elements.applyFileTarget.disabled = true;

        // Show modal
        this.elements.fileTargetModal.style.display = 'flex';
    }

    openCueTargetModal(cue) {
        this.elements.targetModalTitle.textContent = `Select Target for ${cue.type} cue`;
        
        // Get compatible target cues
        const definition = this.cueManager.cueTypeDefinitions[cue.type];
        const acceptedTypes = definition.acceptedCueTypes;
        
        const compatibleCues = this.cueManager.cues.filter(targetCue => {
            // Can't target self
            if (targetCue.id === cue.id) return false;
            
            // Check type compatibility
            if (acceptedTypes.includes('any')) return true;
            return acceptedTypes.includes(targetCue.type);
        });

        // Render target cue list
        let content = '';
        if (compatibleCues.length === 0) {
            content = '<p style="text-align: center; color: #888; padding: 20px;">No compatible cues found</p>';
        } else {
            content = '<div class="target-cue-list">';
            compatibleCues.forEach(targetCue => {
                const isSelected = cue.targetCueId === targetCue.id;
                content += `
                    <div class="target-cue-item ${isSelected ? 'selected' : ''}" data-cue-id="${targetCue.id}">
                        <div class="target-cue-info">
                            <div class="target-cue-number">${targetCue.number}</div>
                            <div class="target-cue-name">${targetCue.name}</div>
                        </div>
                        <div class="target-cue-type">${targetCue.type}</div>
                    </div>
                `;
            });
            content += '</div>';
        }

        this.elements.targetModalContent.innerHTML = content;

        // Bind click events for target selection
        const targetItems = this.elements.targetModalContent.querySelectorAll('.target-cue-item');
        targetItems.forEach(item => {
            item.addEventListener('click', () => {
                // Clear previous selection
                targetItems.forEach(i => i.classList.remove('selected'));
                // Select clicked item
                item.classList.add('selected');
                this.selectedTargetCueId = item.dataset.cueId;
                this.elements.applyTarget.disabled = false;
            });
        });

        // Set initial state
        this.selectedTargetCueId = cue.targetCueId;
        this.elements.applyTarget.disabled = !this.selectedTargetCueId;

        // Show modal
        this.elements.targetModal.style.display = 'flex';
    }

    selectFile(file) {
        this.selectedFile = file;
        
        // Update file info display
        this.elements.selectedFileName.textContent = file.name;
        this.elements.selectedFileSize.textContent = this.formatFileSize(file.size);
        this.elements.selectedFilePath.textContent = file.name; // In browser, we only have the name
        
        // Show file info
        this.elements.selectedFileInfo.style.display = 'block';
        this.elements.applyFileTarget.disabled = false;
    }

    applySelectedTarget() {
        if (this.currentTargetEditCue && this.selectedTargetCueId) {
            this.cueManager.setCueTarget(this.currentTargetEditCue, this.selectedTargetCueId);
            this.showStatusMessage(`Target set for cue ${this.currentTargetEditCue.number}`, 'success');
        }
        this.closeTargetModal();
    }

    applySelectedFile() {
        if (this.currentTargetEditCue && this.selectedFile) {
            // In a real application, you would upload the file or get its path
            // For now, we'll use the file name as the path
            const filePath = this.selectedFile.name;
            const fileName = this.selectedFile.name;
            
            this.cueManager.setFileTarget(this.currentTargetEditCue.id, filePath, fileName);
            this.showStatusMessage(`File target set for cue ${this.currentTargetEditCue.number}`, 'success');
        }
        this.closeFileTargetModal();
    }

    closeTargetModal() {
        this.elements.targetModal.style.display = 'none';
        this.currentTargetEditCue = null;
        this.selectedTargetCueId = null;
    }

    closeFileTargetModal() {
        this.elements.fileTargetModal.style.display = 'none';
        this.currentTargetEditCue = null;
        this.selectedFile = null;
    }

    clearSelectedCueTarget() {
        const selectedCue = this.cueManager.getSelectedCue();
        if (!selectedCue) {
            this.showStatusMessage('No cue selected', 'warning');
            return;
        }

        if (!selectedCue.requiresTarget) {
            this.showStatusMessage('Selected cue does not require a target', 'info');
            return;
        }

        if (confirm(`Clear target for cue ${selectedCue.number}: ${selectedCue.name}?`)) {
            this.cueManager.clearTarget(selectedCue.id);
            this.showStatusMessage('Target cleared', 'success');
        }
    }

    // ==================== CUE MANAGEMENT ====================

    addCue(type) {
        const cue = this.cueManager.addCue(type);
        this.cueManager.selectCue(cue.id);
        this.showStatusMessage(`Added ${type} cue`, 'success');
    }

    addControlCue(type) {
        const selectedCue = this.cueManager.getSelectedCue();
        
        if (selectedCue) {
            // Create control cue targeting the selected cue
            const cue = this.cueManager.addCue(type, { targetCueId: selectedCue.id });
            this.cueManager.selectCue(cue.id);
            this.showStatusMessage(`Added ${type} cue targeting cue ${selectedCue.number}`, 'success');
        } else {
            // Create control cue without target
            const cue = this.cueManager.addCue(type);
            this.cueManager.selectCue(cue.id);
            this.showStatusMessage(`Added ${type} cue - click target to set`, 'info');
        }
    }

    deleteSelectedCue() {
        const selectedCue = this.cueManager.getSelectedCue();
        if (!selectedCue) {
            this.showStatusMessage('No cue selected', 'warning');
            return;
        }

        if (confirm(`Delete cue ${selectedCue.number}: ${selectedCue.name}?`)) {
            this.cueManager.removeCue(selectedCue.id);
            this.showStatusMessage('Cue deleted', 'success');
        }
    }

    // ==================== ENHANCED INSPECTOR ====================

    updateInspector() {
        const selectedCue = this.cueManager.getSelectedCue();
        
        if (!this.elements.inspectorContent) return;
        
        if (!selectedCue) {
            this.elements.inspectorContent.innerHTML = `
                <div class="inspector-placeholder">
                    Select a cue to view its properties
                </div>
            `;
            return;
        }

        // Enhanced inspector with target information
        let targetSection = '';
        if (selectedCue.requiresTarget) {
            const targetDisplay = this.cueManager.getTargetDisplayText(selectedCue);
            const targetClass = selectedCue.isBroken ? 'broken' : (targetDisplay === '?' ? 'empty' : '');
            
            targetSection = `
                <div class="inspector-group">
                    <h3>Target</h3>
                    <div class="inspector-field">
                        <label>Target ${selectedCue.targetType === 'file' ? 'File' : 'Cue'}</label>
                        <div class="target-field">
                            <div class="target-display ${targetClass}" onclick="window.uiManager.editCueTarget(window.cueManager.getCue('${selectedCue.id}'))">${targetDisplay}</div>
                            <div class="target-actions">
                                <button type="button" onclick="window.uiManager.editCueTarget(window.cueManager.getCue('${selectedCue.id}'))" class="btn-small">Edit</button>
                                <button type="button" onclick="window.uiManager.clearSelectedCueTarget()" class="btn-small">Clear</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        this.elements.inspectorContent.innerHTML = `
            <div class="inspector-group">
                <h3>Basic</h3>
                <div class="inspector-field">
                    <label>Number</label>
                    <input type="text" value="${selectedCue.number}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Name</label>
                    <input type="text" value="${selectedCue.name}" id="cue-name-input">
                </div>
                <div class="inspector-field">
                    <label>Type</label>
                    <input type="text" value="${selectedCue.type}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Status</label>
                    <input type="text" value="${selectedCue.status}" readonly>
                </div>
                ${selectedCue.isBroken ? '<div class="inspector-field"><label style="color: #dc3545;">⚠ Broken Cue</label><small>This cue is missing its required target</small></div>' : ''}
            </div>
            
            ${targetSection}
            
            <div class="inspector-group">
                <h3>Timing</h3>
                <div class="inspector-field">
                    <label>Duration</label>
                    <input type="text" value="${this.formatDuration(selectedCue.duration)}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Pre-wait</label>
                    <input type="number" value="${selectedCue.preWait || 0}" id="cue-pre-wait" min="0" step="0.1">
                </div>
                <div class="inspector-field">
                    <label>Post-wait</label>
                    <input type="number" value="${selectedCue.postWait || 0}" id="cue-post-wait" min="0" step="0.1">
                </div>
                <div class="inspector-field">
                    <label>Auto Continue</label>
                    <input type="checkbox" ${selectedCue.autoContinue ? 'checked' : ''} id="cue-auto-continue">
                </div>
            </div>
            
            <div class="inspector-group">
                <h3>Advanced</h3>
                <div class="inspector-field">
                    <label>Armed</label>
                    <input type="checkbox" ${selectedCue.armed ? 'checked' : ''} id="cue-armed">
                </div>
                <div class="inspector-field">
                    <label>Flagged</label>
                    <input type="checkbox" ${selectedCue.flagged ? 'checked' : ''} id="cue-flagged">
                </div>
                <div class="inspector-field">
                    <label>Notes</label>
                    <textarea id="cue-notes" rows="3" placeholder="Enter notes for this cue...">${selectedCue.notes || ''}</textarea>
                </div>
            </div>
        `;

        // Bind inspector events
        this.bindInspectorEvents(selectedCue);
    }

    bindInspectorEvents(cue) {
        const nameInput = document.getElementById('cue-name-input');
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                cue.name = e.target.value;
                this.cueManager.updateTargetingCueNames(cue);
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const preWaitInput = document.getElementById('cue-pre-wait');
        if (preWaitInput) {
            preWaitInput.addEventListener('change', (e) => {
                cue.preWait = parseFloat(e.target.value) * 1000; // Convert to ms
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const postWaitInput = document.getElementById('cue-post-wait');
        if (postWaitInput) {
            postWaitInput.addEventListener('change', (e) => {
                cue.postWait = parseFloat(e.target.value) * 1000; // Convert to ms
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const autoContinueCheck = document.getElementById('cue-auto-continue');
        if (autoContinueCheck) {
            autoContinueCheck.addEventListener('change', (e) => {
                cue.autoContinue = e.target.checked;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const armedCheck = document.getElementById('cue-armed');
        if (armedCheck) {
            armedCheck.addEventListener('change', (e) => {
                cue.armed = e.target.checked;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const flaggedCheck = document.getElementById('cue-flagged');
        if (flaggedCheck) {
            flaggedCheck.addEventListener('change', (e) => {
                cue.flagged = e.target.checked;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const notesTextarea = document.getElementById('cue-notes');
        if (notesTextarea) {
            notesTextarea.addEventListener('change', (e) => {
                cue.notes = e.target.value;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }
    }

    // ==================== TRANSPORT CONTROLS ====================

    updateTransportButtons() {
        const isPlaying = this.cueManager.hasActiveCues();
        const isPaused = this.cueManager.isPaused;
        
        if (this.elements.goBtn) {
            const standByCue = this.cueManager.getStandByCue();
            this.elements.goBtn.disabled = !standByCue && !isPaused;
        }
        
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !isPlaying && !isPaused;
        }
        
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.disabled = !isPlaying;
            this.elements.pauseBtn.innerHTML = isPaused ? '<span>▶</span>' : '<span>⏸</span>';
            this.elements.pauseBtn.title = isPaused ? 'Resume (Ctrl+P)' : 'Pause (Ctrl+P)';
        }
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

    // ==================== ENHANCED STATUS UPDATES ====================

    updateCueCount() {
        if (this.elements.cueCount) {
            const count = this.cueManager.cues.length;
            this.elements.cueCount.textContent = `${count} cue${count !== 1 ? 's' : ''}`;
        }

        if (this.elements.brokenCueCount) {
            const brokenCount = this.cueManager.cues.filter(cue => cue.isBroken).length;
            if (brokenCount > 0) {
                this.elements.brokenCueCount.textContent = `${brokenCount} broken`;
                this.elements.brokenCueCount.style.display = 'inline';
            } else {
                this.elements.brokenCueCount.style.display = 'none';
            }
        }
    }

    // ==================== KEYBOARD CONTROLS ====================

    setupGlobalKeyHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚨 ESC pressed - EMERGENCY STOP ALL');
                this.emergencyStopAll();
                this.closeSettings();
                this.closeTargetModal();
                this.closeFileTargetModal();
                return;
            }
            
            if (this.isInputFocused(e.target)) {
                return;
            }
            
            this.handleGlobalKeydown(e);
        }, true);
    }

    handleGlobalKeydown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            console.log('Space pressed - GO');
            this.cueManager.go();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.code === 'Period' || e.code === 'Slash')) {
            e.preventDefault();
            console.log('Ctrl+. pressed - STOP');
            this.cueManager.stop();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
            e.preventDefault();
            console.log('Ctrl+P pressed - PAUSE');
            this.cueManager.pause();
            return;
        }

        // Enhanced keyboard shortcuts for targeting
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyT') {
            e.preventDefault();
            const selectedCue = this.cueManager.getSelectedCue();
            if (selectedCue && selectedCue.requiresTarget) {
                this.editCueTarget(selectedCue);
            }
            return;
        }

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

        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
            this.goToSelectedCue();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.code.startsWith('Digit')) {
            e.preventDefault();
            const cueNumber = e.code.replace('Digit', '');
            const finalNumber = cueNumber === '0' ? 10 : parseInt(cueNumber);
            this.goToCueByNumber(finalNumber);
            return;
        }

        if (e.code === 'Delete' || e.code === 'Backspace') {
            e.preventDefault();
            this.deleteSelectedCue();
            return;
        }
    }

    // ==================== UTILITY METHODS ====================

    movePlayheadUp() {
        const standByCue = this.cueManager.getStandByCue();
        if (!standByCue) return;
        
        const currentIndex = this.cueManager.getCueIndex(standByCue.id);
        if (currentIndex > 0) {
            const newCue = this.cueManager.cues[currentIndex - 1];
            this.cueManager.setStandByCue(newCue.id);
        }
    }

    movePlayheadDown() {
        const standByCue = this.cueManager.getStandByCue();
        if (!standByCue) {
            if (this.cueManager.cues.length > 0) {
                this.cueManager.setStandByCue(this.cueManager.cues[0].id);
            }
            return;
        }
        
        const currentIndex = this.cueManager.getCueIndex(standByCue.id);
        if (currentIndex < this.cueManager.cues.length - 1) {
            const newCue = this.cueManager.cues[currentIndex + 1];
            this.cueManager.setStandByCue(newCue.id);
        }
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

    emergencyStopAll() {
        console.log('🚨 EMERGENCY STOP - All playback stopped');
        
        this.cueManager.stop();
        
        if (this.audioEngine && this.audioEngine.stopAllCues) {
            this.audioEngine.stopAllCues();
        }
        
        if (window.videoEngine && window.videoEngine.stopAllCues) {
            window.videoEngine.stopAllCues();
        }
        
        if (window.displayManager && window.displayManager.clearAllDisplays) {
            window.displayManager.clearAllDisplays();
        }
        
        this.updateTransportButtons();
        this.renderCueList();
        
        this.showStatusMessage('🚨 EMERGENCY STOP - All playback stopped', 'error');
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

    updateCurrentTime() {
        if (this.elements.currentTime) {
            const now = new Date();
            this.elements.currentTime.textContent = now.toLocaleTimeString();
        }
    }

    formatDuration(milliseconds) {
        if (!milliseconds || milliseconds === 0) return '00:00';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showStatusMessage(message, type = 'info') {
        console.log(`Status (${type}): ${message}`);
        
        const statusEl = document.createElement('div');
        statusEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#17a2b8'};
            color: ${type === 'warning' ? '#000' : '#fff'};
            padding: 12px 16px;
            border-radius: 4px;
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;
        statusEl.textContent = message;
        
        document.body.appendChild(statusEl);
        
        setTimeout(() => {
            if (statusEl.parentElement) {
                statusEl.remove();
            }
        }, 3000);
    }

    isInputFocused(target) {
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.contentEditable === 'true';
    }

    openSettings() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.style.display = 'flex';
            this.elements.settingsModal.classList.add('show');
            this.populateSettingsModal();
        }
    }

    closeSettings() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.style.display = 'none';
            this.elements.settingsModal.classList.remove('show');
            console.log('Settings modal closed');
        }
    }

    populateSettingsModal() {
        const singleCueModeCheck = document.getElementById('single-cue-mode');
        if (singleCueModeCheck) {
            singleCueModeCheck.checked = this.cueManager.getSingleCueMode();
        }

        const autoContinueCheck = document.getElementById('auto-continue-enabled');
        if (autoContinueCheck) {
            autoContinueCheck.checked = this.cueManager.getAutoContinueEnabled();
        }

        this.refreshDisplaysList();
    }

    refreshDisplaysList() {
        if (window.displayManager) {
            window.displayManager.refreshDisplays();
        }
    }

    showFileSystemWarning() {
        const warningBanner = document.createElement('div');
        warningBanner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(255, 193, 7, 0.9);
            color: #000;
            padding: 8px 16px;
            text-align: center;
            font-size: 12px;
            z-index: 9999;
        `;
        
        warningBanner.innerHTML = `
            ⚠ File operations may be limited in this browser. 
            For full functionality, use Chrome/Edge. 
            <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 2px 8px; cursor: pointer;">×</button>
        `;
        
        document.body.insertBefore(warningBanner, document.body.firstChild);
        
        setTimeout(() => {
            if (warningBanner && warningBanner.parentElement) {
                warningBanner.remove();
            }
        }, 10000);
    }

    ensureStylesLoaded() {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
    window.uiManager = null; // Will be set in app.js
}
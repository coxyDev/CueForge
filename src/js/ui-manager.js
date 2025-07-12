/**
 * Enhanced UI Manager with Multi-Selection, Grouping, and Drag & Drop
 * Supports professional workflows with advanced cue management
 */

class UIManager {
    constructor(cueManager, audioEngine) {
        this.cueManager = cueManager;
        this.audioEngine = audioEngine;
        this.elements = {};
        this.clipboard = null;
        this.currentTargetEditCue = null;
        this.selectedTargetCueId = null;
        this.selectedFile = null;
        
        // Multi-selection tracking
        this.lastClickedCueId = null;
        this.isSelecting = false;
        
        // Drag and drop state
        this.draggedCue = null;
        this.draggedCues = [];
        this.dropZones = [];
        this.isDragging = false;
        
        this.initializeElements();
        this.bindEvents();
        this.setupEventListeners();
        this.setupGlobalKeyHandler();
        this.setupTargetingSystem();
        this.setupDragAndDrop();
        this.ensureStylesLoaded();
        this.ensureSettingsModalHidden();
        
        // Check for File System Access API
        this.hasFileSystemAccess = 'showOpenFilePicker' in window;
        if (!this.hasFileSystemAccess) {
            this.showFileSystemWarning();
        }
        
        console.log('UIManager initialized with multi-selection and drag/drop');
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
        
        // Enhanced group cue button - handles creation from selection
        if (this.elements.addGroupCue) {
            this.elements.addGroupCue.addEventListener('click', () => this.handleGroupCueCreation());
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
            this.elements.deleteCue.addEventListener('click', () => this.deleteSelectedCues());
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

    setupDragAndDrop() {
        // Global drag and drop event handlers
        document.addEventListener('dragover', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                this.updateDropZones(e);
            }
        });

        document.addEventListener('drop', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                this.handleDrop(e);
            }
        });

        document.addEventListener('dragend', () => {
            this.cleanupDrag();
        });
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
        this.cueManager.on('cueMoved', (data) => this.onCueMoved(data));

        document.getElementById('add-load-cue')?.addEventListener('click', () => {
            this.addControlCue('load');
        });
        document.getElementById('add-reset-cue')?.addEventListener('click', () => {
            this.addControlCue('reset');
        });
        document.getElementById('add-target-cue')?.addEventListener('click', () => {
            this.addControlCue('target');
        });

        // Control Cues
        document.getElementById('add-arm-cue')?.addEventListener('click', () => {
            this.addControlCue('arm');
        });
        document.getElementById('add-disarm-cue')?.addEventListener('click', () => {
            this.addControlCue('disarm');
        });
        document.getElementById('add-devamp-cue')?.addEventListener('click', () => {
            this.addControlCue('devamp');
        });

        // Documentation Cues
        document.getElementById('add-memo-cue')?.addEventListener('click', () => {
            this.addCue('memo', { name: 'Memo' });
        });

        // Technical Cues
        document.getElementById('add-text-cue')?.addEventListener('click', () => {
            this.addCue('text', { name: 'Text Display' });
        });
        document.getElementById('add-network-cue')?.addEventListener('click', () => {
            this.addCue('network', { name: 'Network Message' });
        });
        document.getElementById('add-midi-cue')?.addEventListener('click', () => {
            this.addCue('midi', { name: 'MIDI Message' });
        });
        document.getElementById('add-light-cue')?.addEventListener('click', () => {
            this.addCue('light', { name: 'Lighting Cue' });
        });

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
        this.updateCueCount();
        this.updateCueVisualState();
    }

    onSelectionChanged(data) {
        this.renderCueList();
        this.updateInspector();
        this.updateTransportButtons();
        this.updateGroupButtonState();
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

    onCueMoved(data) {
        this.renderCueList();
        this.showStatusMessage('Cues reordered', 'success');
    }

    // ==================== ENHANCED CUE LIST RENDERING ====================

    renderCueList() {
        if (!this.elements.cueList) return;

        this.elements.cueList.innerHTML = '';

        // Use flattened cues for display (includes group children when expanded)
        const displayCues = this.cueManager.getFlattenedCues();

        if (displayCues.length === 0) {
            this.elements.cueList.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #888; font-style: italic; grid-column: 1 / -1;">
                    No cues in show<br>
                    <small>Click the + buttons above to add cues</small>
                </div>
            `;
            return;
        }

        displayCues.forEach((cue, index) => {
            const element = this.createCueElement(cue, index);
            this.elements.cueList.appendChild(element);
        });
    }

    createCueElement(cue, index) {
        const element = document.createElement('div');
        element.className = 'cue-item';
        element.dataset.cueId = cue.id;
        element.dataset.index = index;

        // Apply state classes
        const standByCue = this.cueManager.getStandByCue();
        const isSelected = this.cueManager.isCueSelected(cue.id);
        
        if (isSelected) {
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

        // Special styling for group children
        if (cue.isGroupChild) {
            element.classList.add('group-child');
        }

        // Make element draggable
        element.draggable = true;

        // Enhanced playhead indicator
        const playheadIndicator = (standByCue && standByCue.id === cue.id) ? '▶ ' : '';
        
        // Group expansion indicator
        let groupIndicator = '';
        if (cue.type === 'group') {
            const isExpanded = this.cueManager.isGroupExpanded(cue.id);
            const childCount = cue.children ? cue.children.length : 0;
            groupIndicator = `<span class="group-toggle" data-group-id="${cue.id}">${isExpanded ? '▼' : '▶'} (${childCount})</span>`;
        }
        
        // Display number (includes group child numbering like "2.1")
        const displayNumber = cue.displayNumber || cue.number;
        
        // Get target display
        const targetDisplay = this.getTargetDisplayHTML(cue);
        
        // Get cue type styling
        const cueTypeClass = this.getCueTypeClass(cue.type);
        
        // Indentation for group children
        const indentClass = cue.isGroupChild ? 'group-child-indent' : '';
        
        element.innerHTML = `
            <div class="cue-number ${indentClass}">${playheadIndicator}${displayNumber}${cue.autoContinue ? ' →' : ''} ${groupIndicator}</div>
            <div class="cue-name">${cue.name}</div>
            <div class="cue-type ${cueTypeClass}">${cue.type}</div>
            <div class="cue-target">${targetDisplay}</div>
            <div class="cue-duration">${this.formatDuration(cue.duration)}</div>
            <div class="cue-status ${cue.status}">${cue.status}</div>
        `;
        
        // Bind event handlers
        this.bindCueElementEvents(element, cue);
        
        return element;
    }

    updateCueVisualState() {
    // Update all cue elements with current state
    document.querySelectorAll('.cue-item').forEach(element => {
        const cueId = element.dataset.cueId;
        const cue = this.cueManager.getCue(cueId);
        
        if (!cue) return;
        
        // Remove all status classes
        element.classList.remove('playing', 'paused', 'loading', 'waiting', 'fade-active');
        
        // Add current status class
        if (cue.status) {
            element.classList.add(cue.status);
        }
        
        // Special handling for fade cues
        if (cue.type === 'fade' && cue.status === 'playing') {
            element.classList.add('fade-active');
        }
    });
}

    bindCueElementEvents(element, cue) {
        // Enhanced click handler for multi-selection
        element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.shiftKey && this.lastClickedCueId) {
                // Shift+click = range selection
                this.cueManager.selectRange(this.lastClickedCueId, cue.id);
                console.log(`Range selected from ${this.lastClickedCueId} to ${cue.id}`);
            } else if (e.ctrlKey || e.metaKey) {
                if (e.altKey) {
                    // Ctrl+Alt+click = go to immediately
                    this.cueManager.goToCue(cue.id);
                    console.log(`Going to cue ${cue.number} immediately`);
                } else {
                    // Ctrl+click = toggle selection
                    this.cueManager.toggleSelection(cue.id);
                    console.log(`Toggled selection for cue ${cue.number}`);
                }
            } else if (e.altKey) {
                // Alt+click = set as standby
                this.cueManager.setStandByCue(cue.id);
                console.log(`Set cue ${cue.number} as standby`);
            } else {
                // Regular click = single selection
                this.cueManager.selectCue(cue.id);
                console.log(`Selected cue ${cue.number}`);
            }
            
            this.lastClickedCueId = cue.id;
            setTimeout(() => this.renderCueList(), 0);
        });
        
        // Double-click handler
        element.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cueManager.goToCue(cue.id);
            console.log(`Going to cue ${cue.number} via double-click`);
        });

        // Group expansion toggle
        const groupToggle = element.querySelector('.group-toggle');
        if (groupToggle) {
            groupToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const groupId = e.target.dataset.groupId;
                this.cueManager.toggleGroupExpansion(groupId);
            });
        }

        // Target click handler
        const targetElement = element.querySelector('.cue-target');
        if (targetElement && cue.requiresTarget) {
            targetElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editCueTarget(cue);
            });
        }

        // Drag and drop handlers
        element.addEventListener('dragstart', (e) => this.handleDragStart(e, cue));
        element.addEventListener('dragover', (e) => this.handleDragOver(e));
        element.addEventListener('drop', (e) => this.handleDrop(e));
    }

    /**
 * Enhanced fade cue inspector
 */
updateFadeCueInspector(cue) {
    // Get target cue info
    const targetCue = cue.targetCueId ? this.cueManager.getCue(cue.targetCueId) : null;
    const availableParameters = targetCue ? this.getAvailableFadeParameters(targetCue) : [];
    
    const fadeSection = `
        <div class="inspector-group">
            <h3>Fade Configuration</h3>
            <div class="inspector-field">
                <label>Fade Mode</label>
                <select id="fade-mode">
                    <option value="absolute" ${cue.fadeMode === 'absolute' ? 'selected' : ''}>Absolute</option>
                    <option value="relative" ${cue.fadeMode === 'relative' ? 'selected' : ''}>Relative</option>
                </select>
            </div>
            <div class="inspector-field">
                <label>Fade Curve</label>
                <select id="fade-curve">
                    <option value="linear" ${cue.fadeCurve === 'linear' ? 'selected' : ''}>Linear</option>
                    <option value="exponential" ${cue.fadeCurve === 'exponential' ? 'selected' : ''}>Exponential</option>
                    <option value="logarithmic" ${cue.fadeCurve === 'logarithmic' ? 'selected' : ''}>Logarithmic</option>
                    <option value="scurve" ${cue.fadeCurve === 'scurve' ? 'selected' : ''}>S-Curve</option>
                    <option value="sharp" ${cue.fadeCurve === 'sharp' ? 'selected' : ''}>Sharp</option>
                    <option value="reverse_sharp" ${cue.fadeCurve === 'reverse_sharp' ? 'selected' : ''}>Reverse Sharp</option>
                </select>
            </div>
            <div class="inspector-field">
                <label>Fade Duration</label>
                <input type="number" id="fade-duration" value="${(cue.duration || 2000) / 1000}" min="0.1" step="0.1"> seconds
            </div>
        </div>
        
        <div class="inspector-group">
            <h3>Parameters to Fade</h3>
            ${targetCue ? this.renderFadeParametersUI(cue, targetCue, availableParameters) : 
                '<div class="inspector-field"><em>Select a target cue to configure fade parameters</em></div>'}
        </div>
    `;
    
    return fadeSection;
}

/**
 * Get available parameters for a cue type
 */
getAvailableFadeParameters(targetCue) {
    const parameters = [];
    
    switch (targetCue.type) {
        case 'audio':
            parameters.push(
                { name: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01, unit: '', default: targetCue.volume || 1.0 }
            );
            break;
            
        case 'video':
            parameters.push(
                { name: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, unit: '', default: targetCue.opacity || 1.0 },
                { name: 'position_x', label: 'Position X', min: -1000, max: 1000, step: 1, unit: 'px', default: targetCue.position?.x || 0 },
                { name: 'position_y', label: 'Position Y', min: -1000, max: 1000, step: 1, unit: 'px', default: targetCue.position?.y || 0 },
                { name: 'scale_x', label: 'Scale X', min: 0, max: 5, step: 0.01, unit: '', default: targetCue.scale?.x || 1.0 },
                { name: 'scale_y', label: 'Scale Y', min: 0, max: 5, step: 0.01, unit: '', default: targetCue.scale?.y || 1.0 }
            );
            break;
            
        case 'group':
            parameters.push(
                { name: 'volume', label: 'Group Volume', min: 0, max: 1, step: 0.01, unit: '', default: targetCue.volume || 1.0 }
            );
            break;
    }
    
    return parameters;
}

/**
 * Render fade parameters UI
 */
renderFadeParametersUI(fadeCue, targetCue, availableParameters) {
    const fadeParams = fadeCue.fadeParameters || [];
    
    let html = `
        <div class="fade-parameters-list">
            <div class="fade-parameters-header">
                <span>Parameter</span>
                <span>Start Value</span>
                <span>End Value</span>
                <span>Actions</span>
            </div>
    `;
    
    // Render existing parameters
    fadeParams.forEach((param, index) => {
        const paramDef = availableParameters.find(p => p.name === param.name);
        if (paramDef) {
            html += `
                <div class="fade-parameter-row" data-param-index="${index}">
                    <span class="param-name">${paramDef.label}</span>
                    <input type="number" 
                           class="param-start-value" 
                           value="${param.startValue}" 
                           min="${paramDef.min}" 
                           max="${paramDef.max}" 
                           step="${paramDef.step}">
                    <input type="number" 
                           class="param-end-value" 
                           value="${param.endValue}" 
                           min="${paramDef.min}" 
                           max="${paramDef.max}" 
                           step="${paramDef.step}">
                    <button type="button" class="btn-small btn-danger remove-param" data-param-index="${index}">Remove</button>
                </div>
            `;
        }
    });
    
    html += `
        </div>
        <div class="add-parameter-section">
            <select id="add-parameter-select">
                <option value="">Add Parameter...</option>
    `;
    
    // Add available parameters that aren't already being faded
    availableParameters.forEach(param => {
        if (!fadeParams.find(fp => fp.name === param.name)) {
            html += `<option value="${param.name}">${param.label}</option>`;
        }
    });
    
    html += `
            </select>
            <button type="button" id="add-parameter-btn" class="btn-small">Add Parameter</button>
        </div>
        
        <div class="fade-parameter-presets">
            <button type="button" class="btn-small" onclick="window.uiManager.applyFadePreset('${fadeCue.id}', 'fadeOut')">Fade Out</button>
            <button type="button" class="btn-small" onclick="window.uiManager.applyFadePreset('${fadeCue.id}', 'fadeIn')">Fade In</button>
        </div>
    `;
    
    return html;
}

/**
 * Bind fade cue inspector events
 */
bindFadeCueEvents(cue) {
    // Fade mode change
    const fadeModeSelect = document.getElementById('fade-mode');
    if (fadeModeSelect) {
        fadeModeSelect.addEventListener('change', (e) => {
            cue.fadeMode = e.target.value;
            this.cueManager.emit('cueUpdated', { cue });
        });
    }
    
    // Fade curve change
    const fadeCurveSelect = document.getElementById('fade-curve');
    if (fadeCurveSelect) {
        fadeCurveSelect.addEventListener('change', (e) => {
            cue.fadeCurve = e.target.value;
            this.cueManager.emit('cueUpdated', { cue });
        });
    }
    
    // Fade duration change
    const fadeDurationInput = document.getElementById('fade-duration');
    if (fadeDurationInput) {
        fadeDurationInput.addEventListener('change', (e) => {
            cue.duration = parseFloat(e.target.value) * 1000;
            this.cueManager.emit('cueUpdated', { cue });
        });
    }
    
    // Parameter value changes
    document.querySelectorAll('.param-start-value, .param-end-value').forEach(input => {
        input.addEventListener('change', () => {
            this.updateFadeParameters(cue);
        });
    });
    
    // Remove parameter buttons
    document.querySelectorAll('.remove-param').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const paramIndex = parseInt(e.target.dataset.paramIndex);
            cue.fadeParameters.splice(paramIndex, 1);
            this.updateInspector(); // Refresh the UI
            this.cueManager.emit('cueUpdated', { cue });
        });
    });
    
    // Add parameter button
    const addParamBtn = document.getElementById('add-parameter-btn');
    if (addParamBtn) {
        addParamBtn.addEventListener('click', () => {
            this.addFadeParameter(cue);
        });
    }
}

/**
 * Update fade parameters from UI
 */
updateFadeParameters(cue) {
    if (!cue.fadeParameters) cue.fadeParameters = [];
    
    document.querySelectorAll('.fade-parameter-row').forEach((row, index) => {
        if (cue.fadeParameters[index]) {
            const startValue = parseFloat(row.querySelector('.param-start-value').value);
            const endValue = parseFloat(row.querySelector('.param-end-value').value);
            
            cue.fadeParameters[index].startValue = startValue;
            cue.fadeParameters[index].endValue = endValue;
        }
    });
    
    this.cueManager.emit('cueUpdated', { cue });
}

/**
 * Add a new fade parameter
 */
addFadeParameter(cue) {
    const select = document.getElementById('add-parameter-select');
    const paramName = select.value;
    
    if (!paramName) return;
    
    const targetCue = this.cueManager.getCue(cue.targetCueId);
    if (!targetCue) return;
    
    const availableParams = this.getAvailableFadeParameters(targetCue);
    const paramDef = availableParams.find(p => p.name === paramName);
    
    if (!paramDef) return;
    
    if (!cue.fadeParameters) cue.fadeParameters = [];
    
    // Add new parameter with default values
    cue.fadeParameters.push({
        name: paramName,
        startValue: paramDef.default,
        endValue: paramName.includes('volume') || paramName.includes('opacity') ? 0 : paramDef.default
    });
    
    // Refresh UI
    this.updateInspector();
    this.cueManager.emit('cueUpdated', { cue });
}

/**
 * Apply fade presets
 */
applyFadePreset(cueId, presetType) {
    const cue = this.cueManager.getCue(cueId);
    const targetCue = cue.targetCueId ? this.cueManager.getCue(cue.targetCueId) : null;
    
    if (!cue || !targetCue) return;
    
    cue.fadeParameters = [];
    
    switch (presetType) {
        case 'fadeOut':
            if (targetCue.type === 'audio') {
                cue.fadeParameters.push({ name: 'volume', startValue: 1.0, endValue: 0.0 });
            } else if (targetCue.type === 'video') {
                cue.fadeParameters.push({ name: 'opacity', startValue: 1.0, endValue: 0.0 });
            }
            break;
            
        case 'fadeIn':
            if (targetCue.type === 'audio') {
                cue.fadeParameters.push({ name: 'volume', startValue: 0.0, endValue: 1.0 });
            } else if (targetCue.type === 'video') {
                cue.fadeParameters.push({ name: 'opacity', startValue: 0.0, endValue: 1.0 });
            }
            break;
    }
    
    this.updateInspector();
    this.cueManager.emit('cueUpdated', { cue });
}

    // ==================== DRAG AND DROP SYSTEM ====================
    handleDrop(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    
    try {
        const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (dragData.type !== 'cue-reorder') return;
        
        const dropTarget = e.target.closest('.cue-item');
        if (!dropTarget) return;
        
        const targetCueId = dropTarget.dataset.cueId;
        const targetCue = this.cueManager.getCue(targetCueId);
        
        // Don't drop on self
        if (dragData.cueIds.includes(targetCueId)) return;
        
        // Check if dropping onto a group cue
        if (targetCue && targetCue.type === 'group') {
            // Dropping onto a group - add cues to the group
            this.handleDropIntoGroup(targetCueId, dragData.cueIds);
        } else {
            // Regular reordering
            this.handleDropForReordering(e, dropTarget, dragData);
        }
        
    } catch (error) {
        console.error('Error handling drop:', error);
    }
    
    this.cleanupDrag();
}
    handleDragStart(e, cue) {
        this.isDragging = true;
        
        // If the dragged cue is not selected, select it
        if (!this.cueManager.isCueSelected(cue.id)) {
            this.cueManager.selectCue(cue.id);
        }
        
        // Get all selected cues for multi-drag
        this.draggedCues = this.cueManager.getSelectedCues();
        this.draggedCue = cue;
        
        // Set drag data
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            cueIds: this.draggedCues.map(c => c.id),
            type: 'cue-reorder'
        }));
        
        // Visual feedback
        e.target.style.opacity = '0.5';
        
        console.log(`Started dragging ${this.draggedCues.length} cue(s)`);
    }

    handleDragOver(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const cueItem = e.target.closest('.cue-item');
    if (!cueItem) return;
    
    // Remove previous indicators
    document.querySelectorAll('.drop-indicator, .group-drop-highlight').forEach(el => el.remove());
    
    const targetCueId = cueItem.dataset.cueId;
    const targetCue = this.cueManager.getCue(targetCueId);
    
    if (targetCue && targetCue.type === 'group') {
        // Highlight the group for dropping into it
        cueItem.classList.add('group-drop-target');
        
        // Add visual feedback for group drop
        const groupHighlight = document.createElement('div');
        groupHighlight.className = 'group-drop-highlight';
        groupHighlight.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            background: rgba(13, 115, 119, 0.2);
            border: 2px dashed #0d7377;
            pointer-events: none;
            z-index: 999;
        `;
        
        const rect = cueItem.getBoundingClientRect();
        groupHighlight.style.top = `${rect.top}px`;
        groupHighlight.style.left = `${rect.left}px`;
        groupHighlight.style.width = `${rect.width}px`;
        groupHighlight.style.height = `${rect.height}px`;
        
        document.body.appendChild(groupHighlight);
    } else {
        // Regular drop indicator for reordering
        cueItem.classList.remove('group-drop-target');
        
        const rect = cueItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midpoint;
        
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: #0d7377;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 0 4px rgba(13, 115, 119, 0.6);
        `;
        
        if (insertBefore) {
            indicator.style.top = `${rect.top - 1}px`;
        } else {
            indicator.style.top = `${rect.bottom - 1}px`;
        }
        
        document.body.appendChild(indicator);
    }
}
    /**
 * Handle group cue creation - either empty group or from selection
 */
handleGroupCueCreation() {
    const selectedCues = this.cueManager.getSelectedCues();
    
    if (selectedCues.length >= 2) {
        // Create group from selection with default name
        const defaultGroupName = `Group ${this.cueManager.getNextCueNumber()}`;
        
        // Show custom group name dialog
        this.showGroupNameDialog(defaultGroupName, (groupName) => {
            if (groupName && groupName.trim()) {
                const group = this.cueManager.createGroupFromSelection({
                    name: groupName.trim(),
                    mode: 'playlist' // Default mode
                });
                
                if (group) {
                    this.showStatusMessage(`Created group "${groupName}" with ${selectedCues.length} cues`, 'success');
                }
            }
        });
    } else {
        // Create empty group with default name
        const defaultGroupName = `Group ${this.cueManager.getNextCueNumber()}`;
        this.addCue('group', { name: defaultGroupName });
        this.showStatusMessage(`Created empty group "${defaultGroupName}"`, 'success');
    }
}

/**
 * Show custom group name dialog (replaces prompt())
 */
showGroupNameDialog(defaultName, callback) {
    // Remove any existing dialog
    const existingDialog = document.getElementById('group-name-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.id = 'group-name-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: #2a2a2a;
            color: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            min-width: 300px;
            max-width: 500px;
        ">
            <h3 style="margin: 0 0 16px 0; color: #0d7377;">Create Group</h3>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-size: 14px;">Group Name:</label>
                <input type="text" id="group-name-input" value="${defaultName}" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #555;
                    border-radius: 4px;
                    background: #1a1a1a;
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                ">
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="group-dialog-cancel" style="
                    padding: 8px 16px;
                    border: 1px solid #555;
                    border-radius: 4px;
                    background: transparent;
                    color: white;
                    cursor: pointer;
                ">Cancel</button>
                <button id="group-dialog-create" style="
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: #0d7377;
                    color: white;
                    cursor: pointer;
                ">Create Group</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    const input = document.getElementById('group-name-input');
    const cancelBtn = document.getElementById('group-dialog-cancel');
    const createBtn = document.getElementById('group-dialog-create');
    
    // Focus and select text
    input.focus();
    input.select();
    
    // Handle create
    const handleCreate = () => {
        const groupName = input.value.trim();
        if (groupName) {
            callback(groupName);
        }
        dialog.remove();
    };
    
    // Handle cancel
    const handleCancel = () => {
        dialog.remove();
    };
    
    // Event listeners
    createBtn.addEventListener('click', handleCreate);
    cancelBtn.addEventListener('click', handleCancel);
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    });
    
    // Click outside to cancel
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            handleCancel();
        }
    });
}

    cleanupDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.draggedCue = null;
    this.draggedCues = [];
    
    // Remove visual indicators
    document.querySelectorAll('.drop-indicator, .group-drop-highlight, .drag-count-indicator').forEach(el => el.remove());
    
    // Reset opacity and classes
    document.querySelectorAll('.cue-item').forEach(el => {
        el.style.opacity = '';
        el.classList.remove('dragging', 'group-drop-target');
    });
    
    console.log('Drag operation cleaned up');
}

handleDropIntoGroup(groupId, draggedCueIds) {
    const group = this.cueManager.getCue(groupId);
    if (!group || group.type !== 'group') {
        console.error('Invalid group target');
        return;
    }
    
    // Don't add group to itself
    if (draggedCueIds.includes(groupId)) {
        this.showStatusMessage('Cannot add group to itself', 'warning');
        return;
    }
    
    const draggedCues = draggedCueIds.map(id => this.cueManager.getCue(id)).filter(Boolean);
    
    if (draggedCues.length === 0) {
        this.showStatusMessage('No valid cues to add to group', 'warning');
        return;
    }
    
    // Add cues to the group
    const success = this.cueManager.addCuesToGroup(groupId, draggedCues);
    
    if (success) {
        // Expand the group to show the new cues
        if (!this.cueManager.isGroupExpanded(groupId)) {
            this.cueManager.toggleGroupExpansion(groupId);
        }
        
        this.showStatusMessage(`Added ${draggedCues.length} cue(s) to group "${group.name}"`, 'success');
    } else {
        this.showStatusMessage('Failed to add cues to group', 'error');
    }
}

    // ==================== GROUP MANAGEMENT ====================

handleGroupCueCreation() {
    const selectedCues = this.cueManager.getSelectedCues();
    
    if (selectedCues.length >= 2) {
        // Create group from selection with default name
        const defaultGroupName = `Group ${this.cueManager.getNextCueNumber()}`;
        
        // Show custom group name dialog
        this.showGroupNameDialog(defaultGroupName, (groupName) => {
            if (groupName && groupName.trim()) {
                const group = this.cueManager.createGroupFromSelection({
                    name: groupName.trim(),
                    mode: 'playlist' // Default mode
                });
                
                if (group) {
                    this.showStatusMessage(`Created group "${groupName}" with ${selectedCues.length} cues`, 'success');
                }
            }
        });
    } else {
        // Create empty group with default name
        const defaultGroupName = `Group ${this.cueManager.getNextCueNumber()}`;
        this.addCue('group', { name: defaultGroupName });
        this.showStatusMessage(`Created empty group "${defaultGroupName}"`, 'success');
    }
}

/**
 * Show custom group name dialog (replaces prompt())
 */
showGroupNameDialog(defaultName, callback) {
    // Remove any existing dialog
    const existingDialog = document.getElementById('group-name-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.id = 'group-name-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: #2a2a2a;
            color: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            min-width: 300px;
            max-width: 500px;
        ">
            <h3 style="margin: 0 0 16px 0; color: #0d7377;">Create Group</h3>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-size: 14px;">Group Name:</label>
                <input type="text" id="group-name-input" value="${defaultName}" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #555;
                    border-radius: 4px;
                    background: #1a1a1a;
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                ">
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="group-dialog-cancel" style="
                    padding: 8px 16px;
                    border: 1px solid #555;
                    border-radius: 4px;
                    background: transparent;
                    color: white;
                    cursor: pointer;
                ">Cancel</button>
                <button id="group-dialog-create" style="
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: #0d7377;
                    color: white;
                    cursor: pointer;
                ">Create Group</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    const input = document.getElementById('group-name-input');
    const cancelBtn = document.getElementById('group-dialog-cancel');
    const createBtn = document.getElementById('group-dialog-create');
    
    // Focus and select text
    input.focus();
    input.select();
    
    // Handle create
    const handleCreate = () => {
        const groupName = input.value.trim();
        if (groupName) {
            callback(groupName);
        }
        dialog.remove();
    };
    
    // Handle cancel
    const handleCancel = () => {
        dialog.remove();
    };
    
    // Event listeners
    createBtn.addEventListener('click', handleCreate);
    cancelBtn.addEventListener('click', handleCancel);
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    });
    
    // Click outside to cancel
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            handleCancel();
        }
    });
}

    /**
     * Update group button state based on selection
     */
    updateGroupButtonState() {
        const selectedCues = this.cueManager.getSelectedCues();
        
        if (this.elements.addGroupCue) {
            if (selectedCues.length >= 2) {
                this.elements.addGroupCue.textContent = `📁 Group (${selectedCues.length})`;
                this.elements.addGroupCue.title = `Create group from ${selectedCues.length} selected cues`;
            } else {
                this.elements.addGroupCue.textContent = '📁 Group';
                this.elements.addGroupCue.title = 'Add Group Cue';
            }
        }
    }

    handleDropForReordering(e, dropTarget, dragData) {
    const targetIndex = parseInt(dropTarget.dataset.index);
    
    // Calculate drop position
    const rect = dropTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;
    
    let newIndex = targetIndex;
    if (!insertBefore) {
        newIndex = targetIndex + 1;
    }
    
    // Perform the move
    if (this.draggedCues.length === 1) {
        this.cueManager.moveCue(this.draggedCues[0].id, newIndex);
    } else {
        this.cueManager.moveSelectedCues(newIndex);
    }
    
    console.log(`Dropped ${this.draggedCues.length} cue(s) at index ${newIndex}`);
}

    // ==================== ENHANCED INSPECTOR ====================

    updateInspector() {
        const selectedCues = this.cueManager.getSelectedCues();
        
        if (!this.elements.inspectorContent) return;
        
        if (selectedCues.length === 0) {
            this.elements.inspectorContent.innerHTML = `
                <div class="inspector-placeholder">
                    Select a cue to view its properties
                </div>
            `;
            return;
        }

        if (selectedCues.length === 1) {
            // Single cue selection - show detailed inspector
            this.updateSingleCueInspector(selectedCues[0]);
        } else {
            // Multiple cue selection - show multi-cue inspector
            this.updateMultiCueInspector(selectedCues);
        }
    }

    updateSingleCueInspector(cue) {
        // Enhanced inspector for single cue (same as before but with group info)
        let targetSection = '';
        if (cue.requiresTarget) {
            const targetDisplay = this.cueManager.getTargetDisplayText(cue);
            const targetClass = cue.isBroken ? 'broken' : (targetDisplay === '?' ? 'empty' : '');
            
            targetSection = `
                <div class="inspector-group">
                    <h3>Target</h3>
                    <div class="inspector-field">
                        <label>Target ${cue.targetType === 'file' ? 'File' : 'Cue'}</label>
                        <div class="target-field">
                            <div class="target-display ${targetClass}" onclick="window.uiManager.editCueTarget(window.cueManager.getCue('${cue.id}'))">${targetDisplay}</div>
                            <div class="target-actions">
                                <button type="button" onclick="window.uiManager.editCueTarget(window.cueManager.getCue('${cue.id}'))" class="btn-small">Edit</button>
                                <button type="button" onclick="window.uiManager.clearSelectedCueTarget()" class="btn-small">Clear</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        let fadeSection = '';
        if (cue.type === 'fade') {
            fadeSection = this.updateFadeCueInspector(cue);
        }

        let groupSection = '';
        if (cue.type === 'group') {
            const childCount = cue.children ? cue.children.length : 0;
            groupSection = `
                <div class="inspector-group">
                    <h3>Group Settings</h3>
                    <div class="inspector-field">
                        <label>Mode</label>
                        <select id="group-mode">
                            <option value="playlist" ${cue.mode === 'playlist' ? 'selected' : ''}>Playlist</option>
                            <option value="start_first" ${cue.mode === 'start_first' ? 'selected' : ''}>Start First</option>
                            <option value="start_random" ${cue.mode === 'start_random' ? 'selected' : ''}>Start Random</option>
                        </select>
                    </div>
                    <div class="inspector-field">
                        <label>Children</label>
                        <input type="text" value="${childCount} cues" readonly>
                    </div>
                    <div class="inspector-field">
                        <label>Crossfade</label>
                        <input type="checkbox" ${cue.crossfade ? 'checked' : ''} id="group-crossfade">
                    </div>
                    <div class="inspector-field">
                        <label>Loop</label>
                        <input type="checkbox" ${cue.loop ? 'checked' : ''} id="group-loop">
                    </div>
                    <div class="inspector-field">
                        <button type="button" onclick="window.uiManager.ungroupCues('${cue.id}')" class="btn-small">Ungroup Cues</button>
                    </div>
                </div>
            `;
        }

        let enhancedSection = '';
        
        if (cue.type === 'target') {
            enhancedSection += `
                <div class="inspector-group">
                    <h3>Target Settings</h3>
                    <div class="inspector-field">
                        <label>Host Cue</label>
                        <input type="text" id="cue-target-host" value="${cue.targetCueId || ''}" placeholder="Cue to retarget">
                    </div>
                    <div class="inspector-field">
                        <label>New Target</label>
                        <input type="text" id="cue-new-target" value="${cue.newTargetCueId || ''}" placeholder="New target cue">
                    </div>
                </div>
            `;
        }

        if (cue.type === 'load') {
            enhancedSection += `
                <div class="inspector-group">
                    <h3>Load Settings</h3>
                    <div class="inspector-field">
                        <label>Load to Time (ms)</label>
                        <input type="number" id="cue-load-time" value="${cue.loadToTime || 0}" min="0">
                    </div>
                </div>
            `;
        }

        if (cue.type === 'fade') {
            enhancedSection += `
                <div class="inspector-group">
                    <h3>Fade Settings</h3>
                    <div class="inspector-field">
                        <label>Fade Curve</label>
                        <select id="cue-fade-curve">
                            <option value="linear" ${cue.fadeCurve === 'linear' ? 'selected' : ''}>Linear</option>
                            <option value="exponential" ${cue.fadeCurve === 'exponential' ? 'selected' : ''}>Exponential</option>
                            <option value="logarithmic" ${cue.fadeCurve === 'logarithmic' ? 'selected' : ''}>Logarithmic</option>
                            <option value="sCurve" ${cue.fadeCurve === 'sCurve' ? 'selected' : ''}>S-Curve</option>
                        </select>
                    </div>
                    <div class="inspector-field">
                        <label>Fade Direction</label>
                        <select id="cue-fade-direction">
                            <option value="out" ${cue.fadeDirection === 'out' ? 'selected' : ''}>Fade Out</option>
                            <option value="in" ${cue.fadeDirection === 'in' ? 'selected' : ''}>Fade In</option>
                            <option value="custom" ${cue.fadeDirection === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="inspector-field">
                        <label>Stop Target When Done</label>
                        <input type="checkbox" id="cue-stop-target" ${cue.stopTargetWhenDone ? 'checked' : ''}>
                    </div>
                </div>
            `;
        }

        // Add Auto-Follow to timing section for all cue types
        let autoFollowField = `
            <div class="inspector-field">
                <label>Auto-Follow</label>
                <input type="checkbox" ${cue.autoFollow ? 'checked' : ''} id="cue-auto-follow">
            </div>
        `;

        this.elements.inspectorContent.innerHTML = `
            <div class="inspector-group">
                <h3>Basic</h3>
                <div class="inspector-field">
                    <label>Number</label>
                    <input type="text" value="${cue.number}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Name</label>
                    <input type="text" value="${cue.name}" id="cue-name-input">
                </div>
                <div class="inspector-field">
                    <label>Type</label>
                    <input type="text" value="${cue.type}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Status</label>
                    <input type="text" value="${cue.status}" readonly>
                </div>
                ${cue.isBroken ? '<div class="inspector-field"><label style="color: #dc3545;">⚠ Broken Cue</label><small>This cue is missing its required target</small></div>' : ''}
            </div>
            
            ${targetSection}
            ${groupSection}
            ${fadeSection}
            ${enhancedSection}
            
            <div class="inspector-group">
                <h3>Timing</h3>
                <div class="inspector-field">
                    <label>Duration</label>
                    <input type="text" value="${this.formatDuration(cue.duration)}" readonly>
                </div>
                <div class="inspector-field">
                    <label>Pre-wait</label>
                    <input type="number" value="${(cue.preWait || 0) / 1000}" id="cue-pre-wait" min="0" step="0.1">
                </div>
                <div class="inspector-field">
                    <label>Post-wait</label>
                    <input type="number" value="${(cue.postWait || 0) / 1000}" id="cue-post-wait" min="0" step="0.1">
                </div>
                <div class="inspector-field">
                    <label>Auto Continue</label>
                    <input type="checkbox" ${cue.autoContinue ? 'checked' : ''} id="cue-auto-continue">
                </div>
                ${autoFollowField}
            </div>
            
            <div class="inspector-group">
                <h3>Advanced</h3>
                <div class="inspector-field">
                    <label>Armed</label>
                    <input type="checkbox" ${cue.armed ? 'checked' : ''} id="cue-armed">
                </div>
                <div class="inspector-field">
                    <label>Flagged</label>
                    <input type="checkbox" ${cue.flagged ? 'checked' : ''} id="cue-flagged">
                </div>
                <div class="inspector-field">
                    <label>Notes</label>
                    <textarea id="cue-notes" rows="3" placeholder="Enter notes for this cue...">${cue.notes || ''}</textarea>
                </div>
            </div>
        `;

        this.bindInspectorEvents(cue);
    }

    updateMultiCueInspector(selectedCues) {
        const cueCount = selectedCues.length;
        const cueTypes = [...new Set(selectedCues.map(c => c.type))];
        const brokenCount = selectedCues.filter(c => c.isBroken).length;
        
        this.elements.inspectorContent.innerHTML = `
            <div class="inspector-group">
                <h3>Multiple Selection</h3>
                <div class="inspector-field">
                    <label>Selected Cues</label>
                    <input type="text" value="${cueCount} cues" readonly>
                </div>
                <div class="inspector-field">
                    <label>Types</label>
                    <input type="text" value="${cueTypes.join(', ')}" readonly>
                </div>
                ${brokenCount > 0 ? `
                <div class="inspector-field">
                    <label style="color: #dc3545;">Broken Cues</label>
                    <input type="text" value="${brokenCount} broken" readonly>
                </div>
                ` : ''}
            </div>
            
            <div class="inspector-group">
                <h3>Bulk Actions</h3>
                <div class="inspector-field">
                    <button type="button" onclick="window.uiManager.handleGroupCueCreation()" class="btn-primary">Create Group from Selection</button>
                </div>
                <div class="inspector-field">
                    <button type="button" onclick="window.uiManager.deleteSelectedCues()" class="btn-danger">Delete Selected Cues</button>
                </div>
                <div class="inspector-field">
                    <button type="button" onclick="window.uiManager.clearSelection()" class="btn-small">Clear Selection</button>
                </div>
            </div>
            
            <div class="inspector-group">
                <h3>Bulk Properties</h3>
                <div class="inspector-field">
                    <label>Armed</label>
                    <input type="checkbox" id="bulk-armed" indeterminate>
                    <button type="button" onclick="window.uiManager.setBulkProperty('armed', document.getElementById('bulk-armed').checked)" class="btn-small">Apply</button>
                </div>
                <div class="inspector-field">
                    <label>Auto Continue</label>
                    <input type="checkbox" id="bulk-auto-continue" indeterminate>
                    <button type="button" onclick="window.uiManager.setBulkProperty('autoContinue', document.getElementById('bulk-auto-continue').checked)" class="btn-small">Apply</button>
                </div>
            </div>
        `;
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
                cue.preWait = parseFloat(e.target.value) * 1000;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const postWaitInput = document.getElementById('cue-post-wait');
        if (postWaitInput) {
            postWaitInput.addEventListener('change', (e) => {
                cue.postWait = parseFloat(e.target.value) * 1000;
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

        // Group-specific events
        const groupModeSelect = document.getElementById('group-mode');
        if (groupModeSelect) {
            groupModeSelect.addEventListener('change', (e) => {
                cue.mode = e.target.value;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const groupCrossfadeCheck = document.getElementById('group-crossfade');
        if (groupCrossfadeCheck) {
            groupCrossfadeCheck.addEventListener('change', (e) => {
                cue.crossfade = e.target.checked;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        const groupLoopCheck = document.getElementById('group-loop');
        if (groupLoopCheck) {
            groupLoopCheck.addEventListener('change', (e) => {
                cue.loop = e.target.checked;
                this.cueManager.emit('cueUpdated', { cue });
            });
        }

        if (cue.type === 'fade') {
            this.bindFadeCueEvents(cue);
        }
    }

    // ==================== BULK OPERATIONS ====================

    setBulkProperty(property, value) {
        const selectedCues = this.cueManager.getSelectedCues();
        
        selectedCues.forEach(cue => {
            cue[property] = value;
            this.cueManager.emit('cueUpdated', { cue });
        });
        
        this.showStatusMessage(`Updated ${property} for ${selectedCues.length} cues`, 'success');
    }

    clearSelection() {
        this.cueManager.clearSelection();
    }

    deleteSelectedCues() {
        const selectedCues = this.cueManager.getSelectedCues();
        
        if (selectedCues.length === 0) {
            this.showStatusMessage('No cues selected', 'warning');
            return;
        }

        const cueNumbers = selectedCues.map(c => c.number).join(', ');
        if (confirm(`Delete ${selectedCues.length} selected cues (${cueNumbers})?`)) {
            selectedCues.forEach(cue => {
                this.cueManager.removeCue(cue.id);
            });
            this.showStatusMessage(`Deleted ${selectedCues.length} cues`, 'success');
        }
    }

    ungroupCues(groupId) {
        if (confirm('Ungroup this group cue? The cues inside will be moved back to the main list.')) {
            this.cueManager.ungroupCues(groupId);
            this.showStatusMessage('Group ungrouped', 'success');
        }
    }

    // ==================== TARGET EDITING (Preserved from previous) ====================

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
        const selectedCues = this.cueManager.getSelectedCues();
        if (selectedCues.length === 0) {
            this.showStatusMessage('No cue selected', 'warning');
            return;
        }

        const primaryCue = selectedCues[0];
        if (!primaryCue.requiresTarget) {
            this.showStatusMessage('Selected cue does not require a target', 'info');
            return;
        }

        if (confirm(`Clear target for cue ${primaryCue.number}: ${primaryCue.name}?`)) {
            this.cueManager.clearTarget(primaryCue.id);
            this.showStatusMessage('Target cleared', 'success');
        }
    }

    // ==================== UTILITY METHODS (Preserved) ====================

    getTargetDisplayHTML(cue) {
        if (!cue.requiresTarget) {
            return '';
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

    addCue(type, options = {}) {
    try {
        const cue = this.cueManager.addCue(type, options);
        if (cue) {
            this.showStatusMessage(`Added ${type} cue: ${cue.name}`, 'success');
            // Select the new cue
            this.cueManager.selectCue(cue.id);
        }
        return cue;
    } catch (error) {
        console.error('Error adding cue:', error);
        this.showStatusMessage(`Failed to add ${type} cue`, 'error');
        return null;
    }
}

    addControlCue(type) {
    // Check if we have a selected cue to target
    const selectedCues = this.cueManager.getSelectedCues();
    
    if (selectedCues.length === 1) {
        // Create control cue targeting the selected cue
        const targetCue = selectedCues[0];
        const controlCue = this.addCue(type, {
            name: `${type} ${targetCue.number}`,
            targetCueId: targetCue.id,
            target: {
                type: 'cue',
                cueId: targetCue.id,
                cueNumber: targetCue.number
            },
            isBroken: false // Has a target, so not broken
        });
        
        if (controlCue) {
            this.showStatusMessage(`Created ${type} cue targeting cue ${targetCue.number}`, 'success');
        }
    } else {
        // Create control cue without target (user will need to set target later)
        const controlCue = this.addCue(type, {
            name: `${type} cue`
        });
        
        if (controlCue) {
            this.showStatusMessage(`Created ${type} cue - set target in inspector`, 'info');
        }
    }
}

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

            if (e.code === 'Enter' || e.code === 'NumpadEnter') {
                e.preventDefault();
                this.goToSelectedCue();  // <- This line should call the new method
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

        // Enhanced keyboard shortcuts
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyT') {
            e.preventDefault();
            const selectedCues = this.cueManager.getSelectedCues();
            if (selectedCues.length === 1 && selectedCues[0].requiresTarget) {
                this.editCueTarget(selectedCues[0]);
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
            e.preventDefault();
            this.cueManager.selectAll();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyG') {
            e.preventDefault();
            this.handleGroupCueCreation();
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

        if (e.code === 'Delete' || e.code === 'Backspace') {
            e.preventDefault();
            this.deleteSelectedCues();
            return;
        }
    }

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
        
        const selectedCues = this.cueManager.getSelectedCues();
        const primaryCue = selectedCues[0];
        let newIndex = 0;
        
        if (primaryCue) {
            const currentIndex = this.cueManager.getCueIndex(primaryCue.id);
            newIndex = Math.min(cues.length - 1, currentIndex + 1);
        }
        
        this.cueManager.selectCue(cues[newIndex].id);
        this.lastClickedCueId = cues[newIndex].id;
    }

    selectPreviousCue() {
        const cues = this.cueManager.cues;
        if (cues.length === 0) return;
        
        const selectedCues = this.cueManager.getSelectedCues();
        const primaryCue = selectedCues[0];
        let newIndex = cues.length - 1;
        
        if (primaryCue) {
            const currentIndex = this.cueManager.getCueIndex(primaryCue.id);
            newIndex = Math.max(0, currentIndex - 1);
        }
        
        this.cueManager.selectCue(cues[newIndex].id);
        this.lastClickedCueId = cues[newIndex].id;
    }

    goToSelectedCue() {
        const selectedCues = this.cueManager.getSelectedCues();
        if (selectedCues.length > 0) {
            const primaryCue = selectedCues[0];
            console.log(`Going to selected cue: ${primaryCue.number}`);
            this.cueManager.goToCue(primaryCue.id);
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

    setupDragAndDrop() {
    // Global drag event handlers for cleanup
    document.addEventListener('dragend', () => {
        this.cleanupDrag();
    });
    
    document.addEventListener('dragstart', (e) => {
        // Only handle our cue drag events
        if (!e.target.closest('.cue-item')) {
            e.preventDefault();
        }
    });
    
    console.log('✅ Drag and drop system initialized');
}

/**
 * Enhanced visual feedback for drag operations
 */
showDragFeedback(cues) {
    const count = cues.length;
    
    // Add visual feedback to all selected cues
    cues.forEach(cue => {
        const element = document.querySelector(`[data-cue-id="${cue.id}"]`);
        if (element) {
            element.classList.add('dragging');
        }
    });
    
    // Show drag count if multiple cues
    if (count > 1) {
        const dragIndicator = document.createElement('div');
        dragIndicator.className = 'drag-count-indicator';
        dragIndicator.textContent = `${count} cues`;
        dragIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0d7377;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            z-index: 2000;
            pointer-events: none;
        `;
        document.body.appendChild(dragIndicator);
        
        // Auto-remove after a delay
        setTimeout(() => {
            if (document.body.contains(dragIndicator)) {
                document.body.removeChild(dragIndicator);
            }
        }, 3000);
    }
}

/**
 * Enhanced cleanup for drag operations
 */
cleanupDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.draggedCue = null;
    this.draggedCues = [];
    
    // Remove visual indicators
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.drag-count-indicator').forEach(el => el.remove());
    
    // Reset opacity and classes
    document.querySelectorAll('.cue-item').forEach(el => {
        el.style.opacity = '';
        el.classList.remove('dragging');
    });
    
    console.log('Drag operation cleaned up');
}

/**
 * Show status messages to user
 */
showStatusMessage(message, type = 'info', duration = 3000) {
    // Remove any existing status messages
    const existing = document.querySelector('.status-message');
    if (existing) {
        existing.remove();
    }
    
    const statusElement = document.createElement('div');
    statusElement.className = `status-message status-${type}`;
    statusElement.textContent = message;
    statusElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: ${type === 'warning' ? '#212529' : 'white'};
        padding: 12px 20px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        z-index: 2000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInDown 0.3s ease-out;
    `;
    
    document.body.appendChild(statusElement);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (document.body.contains(statusElement)) {
            statusElement.style.animation = 'slideOutUp 0.3s ease-in';
            setTimeout(() => {
                if (document.body.contains(statusElement)) {
                    document.body.removeChild(statusElement);
                }
            }, 300);
        }
    }, duration);
}

/**
 * Complete the selectPreviousCue method
 */
selectPreviousCue() {
    const cues = this.cueManager.cues;
    if (cues.length === 0) return;
    
    const selectedCues = this.cueManager.getSelectedCues();
    const primaryCue = selectedCues[0];
    let newIndex = cues.length - 1; // Default to last cue
    
    if (primaryCue) {
        const currentIndex = this.cueManager.getCueIndex(primaryCue.id);
        newIndex = Math.max(0, currentIndex - 1);
    }
    
    this.cueManager.selectCue(cues[newIndex].id);
    this.lastClickedCueId = cues[newIndex].id;
}

/**
 * Go to selected cue (for Enter key)
 */
goToSelectedCue() {
    const selectedCues = this.cueManager.getSelectedCues();
    if (selectedCues.length === 1) {
        this.cueManager.goToCue(selectedCues[0].id);
    } else if (selectedCues.length === 0) {
        // No selection, use GO button behavior
        this.cueManager.go();
    }
}

/**
 * Enhanced updateGroupButtonState with visual feedback
 */
updateGroupButtonState() {
    const selectedCues = this.cueManager.getSelectedCues();
    
    if (this.elements.addGroupCue) {
        if (selectedCues.length >= 2) {
            this.elements.addGroupCue.textContent = `📁 Group (${selectedCues.length})`;
            this.elements.addGroupCue.title = `Create group from ${selectedCues.length} selected cues`;
            this.elements.addGroupCue.classList.add('group-from-selection');
        } else {
            this.elements.addGroupCue.textContent = '📁 Group';
            this.elements.addGroupCue.title = 'Add Group Cue';
            this.elements.addGroupCue.classList.remove('group-from-selection');
        }
    }
}

/**
 * Update cue count display with broken cue information
 */
updateCueCount() {
    const totalCues = this.cueManager.cues.length;
    const brokenCues = this.cueManager.getBrokenCueCount();
    
    if (this.elements.cueCount) {
        this.elements.cueCount.textContent = `${totalCues} cue${totalCues !== 1 ? 's' : ''}`;
    }
    
    if (this.elements.brokenCueCount) {
        if (brokenCues > 0) {
            this.elements.brokenCueCount.textContent = `${brokenCues} broken`;
            this.elements.brokenCueCount.style.display = 'block';
            this.elements.brokenCueCount.style.color = '#dc3545';
        } else {
            this.elements.brokenCueCount.style.display = 'none';
        }
    }
}

getFadeTargetDisplayText(fadeCue) {
    if (!fadeCue.targetCueId) return '?';
    
    const targetCue = this.cueManager.getCue(fadeCue.targetCueId);
    if (!targetCue) return '? (broken)';
    
    const paramCount = fadeCue.fadeParameters ? fadeCue.fadeParameters.length : 0;
    const paramText = paramCount > 0 ? ` (${paramCount} param${paramCount !== 1 ? 's' : ''})` : '';
    
    return `${targetCue.number}${paramText}`;
}

/**
 * Enhanced createCueElement with complete group support
 */
createCueElement(cue, index) {
    const element = document.createElement('div');
    element.className = 'cue-item';
    element.dataset.cueId = cue.id;
    element.dataset.index = index;
    element.setAttribute('data-cue-type', cue.type);

    // Apply state classes
    const standByCue = this.cueManager.getStandByCue();
    const isSelected = this.cueManager.isCueSelected(cue.id);
    
    if (isSelected) {
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

    // Special styling for group children
    if (cue.isGroupChild) {
        element.classList.add('group-child');
    }

    if (cue.type === 'fade' && cue.status === 'playing') {
        element.classList.add('fade-active');
    }

    // Make element draggable
    element.draggable = true;

    // Enhanced playhead indicator
    const playheadIndicator = (standByCue && standByCue.id === cue.id) ? '▶ ' : '';
    
    // Group expansion indicator and child count
    let groupIndicator = '';
    if (cue.type === 'group') {
        const isExpanded = this.cueManager.isGroupExpanded(cue.id);
        const childCount = cue.children ? cue.children.length : 0;
        const expandIcon = isExpanded ? '▼' : '▶';
        groupIndicator = `<span class="group-toggle" data-group-id="${cue.id}" title="${isExpanded ? 'Collapse' : 'Expand'} group (${childCount} cues)">${expandIcon} [${childCount}]</span>`;
    }
    
    // Target display
    const targetDisplay = cue.requiresTarget ? 
        (this.cueManager.getTargetDisplayText ? this.cueManager.getTargetDisplayText(cue) : '?') : 
        '';
    
    // Display number (could be nested like "3.1" for group children)
    const displayNumber = cue.displayNumber || cue.number;
    
    // Type icon mapping
    const typeIcons = {
        'audio': '🔊',
        'video': '📹',
        'wait': '⏱',
        'group': '📁',
        'start': '▶',
        'stop': '⏹',
        'fade': '📉',
        'goto': '🎯',
        'load': '📥',
        'reset': '🔄',
        'target': '🎯',
        'arm': '🔓',
        'disarm': '🔒',
        'devamp': '📤',
        'memo': '📝',
        'text': '📄',
        'network': '🌐',
        'midi': '🎹',
        'light': '💡',
        'timecode': '⏱️'
    };
    
    const typeIcon = typeIcons[cue.type] || '❓';
    const cueTypeClass = cue.isBroken ? 'broken' : '';
    const indentClass = cue.isGroupChild ? 'group-child-indent' : '';
    
    element.innerHTML = `
        <div class="cue-number ${indentClass}">${playheadIndicator}${displayNumber}${cue.autoContinue ? ' →' : ''} ${groupIndicator}</div>
        <div class="cue-name">${cue.name}</div>
        <div class="cue-type ${cueTypeClass}" title="${cue.type}">${typeIcon}</div>
        <div class="cue-target">${targetDisplay}</div>
        <div class="cue-duration">${this.formatDuration(cue.duration)}</div>
        <div class="cue-status ${cue.status}">${cue.status}</div>
    `;
    
    // Bind event handlers
    this.bindCueElementEvents(element, cue);
    
    return element;
}

/**
 * Format duration for display
 */
formatDuration(duration) {
    if (!duration || duration === 0) return '--:--';
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
    window.uiManager = null; // Will be set in app.js
}
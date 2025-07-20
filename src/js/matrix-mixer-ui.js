/**
 * Advanced Matrix Mixer UI Component
 * Professional audio routing interface similar to QLab's matrix mixer
 */

class MatrixMixerUI {
    constructor(container, matrixMixer, options = {}) {
        this.container = container;
        this.matrix = matrixMixer;
        this.options = {
            showMeters: true,
            showLabels: true,
            cellSize: 50,
            fontSize: 12,
            colorScheme: 'dark',
            enableDragRouting: true,
            showGangs: true,
            precision: 1, // decimal places for dB values
            ...options
        };
        
        // UI state
        this.selectedCells = new Set();
        this.dragMode = null; // 'select', 'route', 'level'
        this.gangs = new Map(); // gang letter -> Set of cell coordinates
        this.gangMode = false;
        this.clipboardData = null;
        
        // Visual elements
        this.gridContainer = null;
        this.levelMeters = new Map();
        this.crosspoints = new Map(); // "input,output" -> element
        
        // Event handling
        this.isDragging = false;
        this.dragStart = null;
        this.lastHoverCell = null;
        
        this.initialize();
        this.bindEvents();
    }
    
    initialize() {
        this.createMatrixStructure();
        this.renderMatrix();
        this.updateAllCrosspoints();
        
        if (this.options.showMeters) {
            this.initializeLevelMeters();
        }
    }
    
    createMatrixStructure() {
        this.container.className = `matrix-mixer ${this.options.colorScheme}`;
        this.container.innerHTML = `
            <div class="matrix-header">
                <div class="matrix-title">Audio Matrix Mixer</div>
                <div class="matrix-controls">
                    <button class="matrix-btn gang-btn" data-action="toggle-gangs">
                        <span class="gang-indicator">G</span> Gangs
                    </button>
                    <button class="matrix-btn" data-action="select-all">Select All</button>
                    <button class="matrix-btn" data-action="clear-selection">Clear</button>
                    <button class="matrix-btn" data-action="copy">Copy</button>
                    <button class="matrix-btn" data-action="paste">Paste</button>
                    <div class="matrix-info">
                        <span class="selected-count">0 selected</span>
                    </div>
                </div>
            </div>
            <div class="matrix-grid-container">
                <div class="matrix-grid" id="matrix-grid"></div>
                <div class="matrix-labels">
                    <div class="input-labels"></div>
                    <div class="output-labels"></div>
                </div>
            </div>
            <div class="matrix-footer">
                <div class="matrix-status">
                    Matrix: ${this.matrix.numInputs} inputs × ${this.matrix.numOutputs} outputs
                </div>
                <div class="level-display">
                    <span class="level-readout">-∞ dB</span>
                </div>
            </div>
        `;
        
        this.gridContainer = this.container.querySelector('#matrix-grid');
    }
    
    renderMatrix() {
        const numInputs = this.matrix.numInputs + 1; // +1 for main level row
        const numOutputs = this.matrix.numOutputs;
        
        // Create CSS Grid
        this.gridContainer.style.gridTemplateColumns = `60px repeat(${numOutputs}, ${this.options.cellSize}px)`;
        this.gridContainer.style.gridTemplateRows = `40px repeat(${numInputs}, ${this.options.cellSize}px)`;
        
        let html = '';
        
        // Header row (output labels)
        html += '<div class="matrix-cell header-cell corner-cell">Main</div>';
        for (let output = 0; output < numOutputs; output++) {
            html += `
                <div class="matrix-cell header-cell output-header" data-output="${output}">
                    <div class="output-label">Out ${output + 1}</div>
                    <div class="output-meter-container">
                        <div class="output-meter" data-output="${output}"></div>
                    </div>
                </div>
            `;
        }
        
        // Main level row (row 0)
        html += `
            <div class="matrix-cell input-label main-label">
                <span>Main</span>
                <div class="input-controls">
                    <button class="level-btn" data-action="mute-main">M</button>
                    <button class="level-btn" data-action="solo-main">S</button>
                </div>
            </div>
        `;
        
        for (let output = 0; output < numOutputs; output++) {
            const level = this.matrix.outputLevels[output] || 0;
            html += this.createCrosspointHTML('main', output, level, true);
        }
        
        // Input rows
        for (let input = 0; input < this.matrix.numInputs; input++) {
            // Input label
            html += `
                <div class="matrix-cell input-label" data-input="${input}">
                    <span class="input-name" data-input="${input}">In ${input + 1}</span>
                    <div class="input-controls">
                        <button class="level-btn" data-action="mute" data-input="${input}">M</button>
                        <button class="level-btn" data-action="solo" data-input="${input}">S</button>
                    </div>
                    <div class="input-level">
                        <input type="range" 
                               class="input-level-slider" 
                               data-input="${input}"
                               min="-60" 
                               max="12" 
                               step="0.1" 
                               value="${this.matrix.inputLevels[input] || 0}">
                        <span class="input-level-value">${this.formatLevel(this.matrix.inputLevels[input] || 0)}</span>
                    </div>
                </div>
            `;
            
            // Crosspoints for this input
            for (let output = 0; output < numOutputs; output++) {
                const level = this.matrix.getCrosspoint(input, output);
                html += this.createCrosspointHTML(input, output, level, false);
            }
        }
        
        this.gridContainer.innerHTML = html;
        this.cacheCrosspointElements();
    }
    
    createCrosspointHTML(input, output, level, isMainRow) {
        const key = `${input},${output}`;
        const hasLevel = level !== null;
        const displayLevel = hasLevel ? this.formatLevel(level) : '';
        const cellClass = `matrix-cell crosspoint ${hasLevel ? 'active' : 'inactive'} ${isMainRow ? 'main-row' : ''}`;
        
        return `
            <div class="${cellClass}" 
                 data-input="${input}" 
                 data-output="${output}"
                 data-key="${key}">
                <div class="crosspoint-content">
                    <div class="level-display">${displayLevel}</div>
                    <div class="crosspoint-meter">
                        <div class="meter-bar" data-key="${key}"></div>
                    </div>
                    <div class="gang-indicator" style="display: none;"></div>
                </div>
            </div>
        `;
    }
    
    cacheCrosspointElements() {
        this.crosspoints.clear();
        this.gridContainer.querySelectorAll('.crosspoint').forEach(element => {
            const key = element.dataset.key;
            this.crosspoints.set(key, element);
        });
    }
    
    bindEvents() {
        // Matrix grid events
        this.gridContainer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.gridContainer.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.gridContainer.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.gridContainer.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.gridContainer.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        
        // Control button events
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                this.handleControlAction(action, e.target);
            }
        });
        
        // Input level slider events
        this.container.addEventListener('input', (e) => {
            if (e.target.classList.contains('input-level-slider')) {
                this.handleInputLevelChange(e.target);
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Prevent text selection during drag
        this.gridContainer.addEventListener('selectstart', (e) => e.preventDefault());
        
        // Context menu for gangs and options
        this.createContextMenu();
    }
    
    handleMouseDown(e) {
        const crosspoint = e.target.closest('.crosspoint');
        if (!crosspoint) return;
        
        e.preventDefault();
        this.isDragging = true;
        this.dragStart = crosspoint;
        
        const input = crosspoint.dataset.input;
        const output = crosspoint.dataset.output;
        const key = `${input},${output}`;
        
        if (e.shiftKey) {
            // Multi-select mode
            this.toggleCellSelection(key);
        } else if (e.ctrlKey || e.metaKey) {
            // Add to selection
            this.addCellSelection(key);
        } else {
            // Single select
            this.clearSelection();
            this.addCellSelection(key);
            
            // Start level editing
            this.startLevelEdit(crosspoint, e);
        }
        
        this.updateSelectionDisplay();
    }
    
    handleMouseMove(e) {
        const crosspoint = e.target.closest('.crosspoint');
        
        if (this.isDragging && crosspoint && crosspoint !== this.lastHoverCell) {
            this.lastHoverCell = crosspoint;
            
            if (this.dragMode === 'select') {
                // Drag selection
                this.updateDragSelection(crosspoint);
            } else if (this.dragMode === 'route') {
                // Drag routing
                this.updateDragRouting(crosspoint);
            }
        }
        
        // Update level display on hover
        if (crosspoint) {
            this.updateLevelDisplay(crosspoint);
        }
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        this.dragStart = null;
        this.dragMode = null;
        this.lastHoverCell = null;
    }
    
    handleDoubleClick(e) {
        const crosspoint = e.target.closest('.crosspoint');
        if (!crosspoint) return;
        
        const input = crosspoint.dataset.input;
        const output = crosspoint.dataset.output;
        
        // Double-click to toggle between unity (0dB) and silence
        const currentLevel = this.matrix.getCrosspoint(input, output);
        const newLevel = currentLevel === 0 ? null : 0;
        
        this.matrix.setCrosspoint(input, output, newLevel);
        this.updateCrosspoint(input, output);
    }
    
    handleContextMenu(e) {
        e.preventDefault();
        
        const crosspoint = e.target.closest('.crosspoint');
        if (crosspoint) {
            this.showContextMenu(e.clientX, e.clientY, crosspoint);
        }
    }
    
    startLevelEdit(crosspoint, e) {
        const rect = crosspoint.getBoundingClientRect();
        const input = crosspoint.dataset.input;
        const output = crosspoint.dataset.output;
        const currentLevel = this.matrix.getCrosspoint(input, output) || 0;
        
        // Create floating level editor
        const editor = document.createElement('div');
        editor.className = 'level-editor';
        editor.style.position = 'fixed';
        editor.style.left = `${rect.left}px`;
        editor.style.top = `${rect.top - 60}px`;
        editor.style.zIndex = '10000';
        
        editor.innerHTML = `
            <div class="level-editor-content">
                <input type="number" 
                       class="level-input" 
                       value="${currentLevel.toFixed(this.options.precision)}" 
                       step="0.1" 
                       min="-60" 
                       max="12">
                <span>dB</span>
                <button class="level-btn-small" data-action="unity">0dB</button>
                <button class="level-btn-small" data-action="silence">-∞</button>
            </div>
        `;
        
        document.body.appendChild(editor);
        
        const input_field = editor.querySelector('.level-input');
        input_field.focus();
        input_field.select();
        
        // Handle level editor events
        const handleLevelChange = () => {
            const value = parseFloat(input_field.value);
            if (!isNaN(value)) {
                this.matrix.setCrosspoint(input, output, value);
                this.updateCrosspoint(input, output);
            }
        };
        
        const closeLevelEditor = () => {
            document.body.removeChild(editor);
        };
        
        input_field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleLevelChange();
                closeLevelEditor();
            } else if (e.key === 'Escape') {
                closeLevelEditor();
            }
        });
        
        input_field.addEventListener('blur', () => {
            handleLevelChange();
            closeLevelEditor();
        });
        
        editor.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'unity') {
                this.matrix.setCrosspoint(input, output, 0);
                this.updateCrosspoint(input, output);
                closeLevelEditor();
            } else if (action === 'silence') {
                this.matrix.setCrosspoint(input, output, null);
                this.updateCrosspoint(input, output);
                closeLevelEditor();
            }
        });
        
        // Auto-close after 5 seconds
        setTimeout(closeLevelEditor, 5000);
    }
    
    handleControlAction(action, button) {
        switch (action) {
            case 'toggle-gangs':
                this.toggleGangMode();
                break;
                
            case 'select-all':
                this.selectAllCrosspoints();
                break;
                
            case 'clear-selection':
                this.clearSelection();
                break;
                
            case 'copy':
                this.copySelection();
                break;
                
            case 'paste':
                this.pasteSelection();
                break;
                
            case 'mute':
                this.toggleInputMute(parseInt(button.dataset.input));
                break;
                
            case 'solo':
                this.toggleInputSolo(parseInt(button.dataset.input));
                break;
                
            case 'mute-main':
                this.toggleMainMute();
                break;
                
            case 'solo-main':
                this.toggleMainSolo();
                break;
        }
    }
    
    handleInputLevelChange(slider) {
        const input = parseInt(slider.dataset.input);
        const level = parseFloat(slider.value);
        
        this.matrix.setInputLevel(input, level);
        
        // Update display
        const valueDisplay = slider.parentElement.querySelector('.input-level-value');
        if (valueDisplay) {
            valueDisplay.textContent = this.formatLevel(level);
        }
    }
    
    handleKeyDown(e) {
        if (!this.container.contains(document.activeElement)) return;
        
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                this.clearSelectedCrosspoints();
                break;
                
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    this.copySelection();
                }
                break;
                
            case 'v':
                if (e.ctrlKey || e.metaKey) {
                    this.pasteSelection();
                }
                break;
                
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.selectAllCrosspoints();
                }
                break;
                
            case 'Escape':
                this.clearSelection();
                break;
        }
    }
    
    // Selection management
    toggleCellSelection(key) {
        if (this.selectedCells.has(key)) {
            this.selectedCells.delete(key);
        } else {
            this.selectedCells.add(key);
        }
        this.updateCellVisualState(key);
    }
    
    addCellSelection(key) {
        this.selectedCells.add(key);
        this.updateCellVisualState(key);
    }
    
    clearSelection() {
        this.selectedCells.forEach(key => {
            this.updateCellVisualState(key);
        });
        this.selectedCells.clear();
        this.updateSelectionDisplay();
    }
    
    selectAllCrosspoints() {
        this.clearSelection();
        
        for (let input = 0; input < this.matrix.numInputs; input++) {
            for (let output = 0; output < this.matrix.numOutputs; output++) {
                this.addCellSelection(`${input},${output}`);
            }
        }
        
        this.updateSelectionDisplay();
    }
    
    updateCellVisualState(key) {
        const element = this.crosspoints.get(key);
        if (element) {
            element.classList.toggle('selected', this.selectedCells.has(key));
        }
    }
    
    updateSelectionDisplay() {
        const countDisplay = this.container.querySelector('.selected-count');
        if (countDisplay) {
            countDisplay.textContent = `${this.selectedCells.size} selected`;
        }
    }
    
    // Gang management
    toggleGangMode() {
        this.gangMode = !this.gangMode;
        
        const gangBtn = this.container.querySelector('.gang-btn');
        gangBtn.classList.toggle('active', this.gangMode);
        
        // Show/hide gang indicators
        this.container.querySelectorAll('.gang-indicator').forEach(indicator => {
            indicator.style.display = this.gangMode ? 'block' : 'none';
        });
        
        if (this.gangMode) {
            this.showGangAssignmentDialog();
        }
    }
    
    showGangAssignmentDialog() {
        if (this.selectedCells.size === 0) {
            alert('Select crosspoints first, then assign them to a gang.');
            return;
        }
        
        const gangLetter = prompt('Assign selected crosspoints to gang (A-Z):');
        if (gangLetter && /^[A-Z]$/i.test(gangLetter)) {
            this.assignToGang(gangLetter.toUpperCase());
        }
    }
    
    assignToGang(gangLetter) {
        if (!this.gangs.has(gangLetter)) {
            this.gangs.set(gangLetter, new Set());
        }
        
        const gang = this.gangs.get(gangLetter);
        this.selectedCells.forEach(key => {
            gang.add(key);
            
            // Update visual indicator
            const element = this.crosspoints.get(key);
            if (element) {
                const indicator = element.querySelector('.gang-indicator');
                if (indicator) {
                    indicator.textContent = gangLetter;
                    indicator.style.backgroundColor = this.getGangColor(gangLetter);
                }
            }
        });
        
        console.log(`Assigned ${this.selectedCells.size} crosspoints to gang ${gangLetter}`);
    }
    
    getGangColor(gangLetter) {
        const colors = {
            'A': '#ff6b6b', 'B': '#4ecdc4', 'C': '#45b7d1', 'D': '#96ceb4',
            'E': '#feca57', 'F': '#ff9ff3', 'G': '#54a0ff', 'H': '#5f27cd'
        };
        return colors[gangLetter] || '#888';
    }
    
    // Copy/paste operations
    copySelection() {
        if (this.selectedCells.size === 0) return;
        
        const data = [];
        this.selectedCells.forEach(key => {
            const [input, output] = key.split(',');
            const level = this.matrix.getCrosspoint(input, output);
            data.push({ input, output, level });
        });
        
        this.clipboardData = data;
        console.log(`Copied ${data.length} crosspoint levels`);
    }
    
    pasteSelection() {
        if (!this.clipboardData || this.selectedCells.size === 0) return;
        
        // Apply clipboard data to selected cells
        const selectedArray = Array.from(this.selectedCells);
        const clipboardArray = this.clipboardData;
        
        for (let i = 0; i < Math.min(selectedArray.length, clipboardArray.length); i++) {
            const [input, output] = selectedArray[i].split(',');
            const { level } = clipboardArray[i];
            
            this.matrix.setCrosspoint(input, output, level);
            this.updateCrosspoint(input, output);
        }
        
        console.log(`Pasted ${Math.min(selectedArray.length, clipboardArray.length)} crosspoint levels`);
    }
    
    clearSelectedCrosspoints() {
        this.selectedCells.forEach(key => {
            const [input, output] = key.split(',');
            this.matrix.setCrosspoint(input, output, null);
            this.updateCrosspoint(input, output);
        });
    }
    
    // Visual updates
    updateCrosspoint(input, output) {
        const key = `${input},${output}`;
        const element = this.crosspoints.get(key);
        if (!element) return;
        
        const level = this.matrix.getCrosspoint(input, output);
        const hasLevel = level !== null;
        
        element.classList.toggle('active', hasLevel);
        element.classList.toggle('inactive', !hasLevel);
        
        const display = element.querySelector('.level-display');
        if (display) {
            display.textContent = hasLevel ? this.formatLevel(level) : '';
        }
    }
    
    updateAllCrosspoints() {
        for (let input = 0; input < this.matrix.numInputs; input++) {
            for (let output = 0; output < this.matrix.numOutputs; output++) {
                this.updateCrosspoint(input, output);
            }
        }
        
        // Update main row
        for (let output = 0; output < this.matrix.numOutputs; output++) {
            this.updateCrosspoint('main', output);
        }
    }
    
    updateLevelDisplay(crosspoint) {
        const input = crosspoint.dataset.input;
        const output = crosspoint.dataset.output;
        const level = this.matrix.getCrosspoint(input, output);
        
        const levelDisplay = this.container.querySelector('.level-readout');
        if (levelDisplay) {
            if (level !== null) {
                levelDisplay.textContent = this.formatLevel(level);
            } else {
                levelDisplay.textContent = '-∞ dB';
            }
        }
    }
    
    formatLevel(level) {
        if (level === null || level === -Infinity) {
            return '-∞';
        }
        
        const formatted = level.toFixed(this.options.precision);
        return level >= 0 ? `+${formatted}` : formatted;
    }
    
    // Level meters
    initializeLevelMeters() {
        // Real-time level metering would require audio analysis
        // For now, create visual meter elements
        
        this.container.querySelectorAll('.output-meter, .meter-bar').forEach(meter => {
            meter.style.height = '4px';
            meter.style.background = 'linear-gradient(to right, #00ff00 0%, #ffff00 70%, #ff0000 100%)';
            meter.style.width = '0%';
            meter.style.transition = 'width 0.1s ease';
        });
        
        // Start meter animation (mock data)
        this.startMeterAnimation();
    }
    
    startMeterAnimation() {
        setInterval(() => {
            this.container.querySelectorAll('.output-meter, .meter-bar').forEach(meter => {
                // Mock meter activity
                const level = Math.random() * 100;
                meter.style.width = `${level}%`;
                
                // Color coding based on level
                if (level > 85) {
                    meter.style.filter = 'hue-rotate(0deg)'; // Red
                } else if (level > 70) {
                    meter.style.filter = 'hue-rotate(60deg)'; // Yellow  
                } else {
                    meter.style.filter = 'hue-rotate(120deg)'; // Green
                }
            });
        }, 100);
    }
    
    // Context menu
    createContextMenu() {
        const menu = document.createElement('div');
        menu.className = 'matrix-context-menu';
        menu.style.display = 'none';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="set-unity">Set to Unity (0dB)</div>
            <div class="context-menu-item" data-action="set-silence">Set to Silence</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="copy-level">Copy Level</div>
            <div class="context-menu-item" data-action="paste-level">Paste Level</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="assign-gang">Assign to Gang...</div>
            <div class="context-menu-item" data-action="remove-gang">Remove from Gang</div>
        `;
        
        document.body.appendChild(menu);
        this.contextMenu = menu;
        
        // Handle context menu clicks
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                this.handleContextMenuAction(action);
            }
            this.hideContextMenu();
        });
        
        // Hide menu on outside click
        document.addEventListener('click', () => this.hideContextMenu());
    }
    
    showContextMenu(x, y, crosspoint) {
        this.contextMenuTarget = crosspoint;
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
    }
    
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
    }
    
    handleContextMenuAction(action) {
        if (!this.contextMenuTarget) return;
        
        const input = this.contextMenuTarget.dataset.input;
        const output = this.contextMenuTarget.dataset.output;
        
        switch (action) {
            case 'set-unity':
                this.matrix.setCrosspoint(input, output, 0);
                this.updateCrosspoint(input, output);
                break;
                
            case 'set-silence':
                this.matrix.setCrosspoint(input, output, null);
                this.updateCrosspoint(input, output);
                break;
                
            case 'copy-level':
                this.copiedLevel = this.matrix.getCrosspoint(input, output);
                break;
                
            case 'paste-level':
                if (this.copiedLevel !== undefined) {
                    this.matrix.setCrosspoint(input, output, this.copiedLevel);
                    this.updateCrosspoint(input, output);
                }
                break;
                
            case 'assign-gang':
                this.selectedCells.clear();
                this.addCellSelection(`${input},${output}`);
                this.showGangAssignmentDialog();
                break;
        }
    }
    
    // Public API
    refresh() {
        this.updateAllCrosspoints();
    }
    
    setMatrix(newMatrix) {
        this.matrix = newMatrix;
        this.renderMatrix();
        this.updateAllCrosspoints();
    }
    
    destroy() {
        // Clean up event listeners and DOM elements
        if (this.contextMenu) {
            document.body.removeChild(this.contextMenu);
        }
        
        // Stop meter animation
        clearInterval(this.meterInterval);
        
        this.container.innerHTML = '';
    }
}

// CSS styles for the matrix mixer (add to your CSS file)
const MATRIX_MIXER_CSS = `
.matrix-mixer {
    background: #1a1a1a;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    border-radius: 8px;
    overflow: hidden;
}

.matrix-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #333;
    border-bottom: 1px solid #555;
}

.matrix-title {
    font-size: 16px;
    font-weight: bold;
}

.matrix-controls {
    display: flex;
    gap: 8px;
    align-items: center;
}

.matrix-btn {
    padding: 6px 12px;
    background: #555;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.matrix-btn:hover {
    background: #666;
}

.matrix-btn.active {
    background: #0d6efd;
}

.gang-btn .gang-indicator {
    display: inline-block;
    width: 16px;
    height: 16px;
    line-height: 16px;
    text-align: center;
    background: #777;
    border-radius: 50%;
    font-size: 10px;
    margin-right: 4px;
}

.matrix-grid-container {
    position: relative;
    overflow: auto;
    max-height: 600px;
    background: #2a2a2a;
}

.matrix-grid {
    display: grid;
    gap: 1px;
    padding: 1px;
    background: #555;
}

.matrix-cell {
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    min-height: 50px;
    cursor: pointer;
    transition: all 0.2s;
}

.matrix-cell:hover {
    background: #444;
}

.matrix-cell.selected {
    background: #0d6efd;
}

.header-cell {
    background: #444;
    font-size: 12px;
    font-weight: bold;
    cursor: default;
}

.corner-cell {
    background: #555;
}

.input-label {
    background: #444;
    flex-direction: column;
    font-size: 12px;
    padding: 4px;
}

.input-controls {
    display: flex;
    gap: 2px;
    margin-top: 4px;
}

.level-btn {
    width: 20px;
    height: 16px;
    font-size: 10px;
    background: #666;
    border: none;
    border-radius: 2px;
    color: white;
    cursor: pointer;
}

.level-btn:hover {
    background: #777;
}

.level-btn.active {
    background: #dc3545;
}

.input-level {
    margin-top: 4px;
    text-align: center;
}

.input-level-slider {
    width: 40px;
    height: 4px;
    -webkit-appearance: none;
    background: #555;
    border-radius: 2px;
    outline: none;
}

.input-level-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: #0d6efd;
    border-radius: 50%;
    cursor: pointer;
}

.input-level-value {
    display: block;
    font-size: 10px;
    margin-top: 2px;
    color: #ccc;
}

.crosspoint {
    border: 2px solid transparent;
    transition: all 0.15s;
}

.crosspoint.active {
    background: #0d6efd;
    color: white;
}

.crosspoint.inactive {
    background: #333;
    color: #666;
}

.crosspoint.selected {
    border-color: #ffd700;
}

.crosspoint-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    justify-content: center;
    position: relative;
}

.level-display {
    font-size: 11px;
    font-weight: bold;
    text-align: center;
}

.crosspoint-meter {
    width: 30px;
    height: 3px;
    background: #555;
    border-radius: 1px;
    margin-top: 2px;
    overflow: hidden;
}

.meter-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(to right, #00ff00, #ffff00, #ff0000);
    transition: width 0.1s ease;
}

.gang-indicator {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #777;
    font-size: 8px;
    line-height: 12px;
    text-align: center;
    color: white;
}

.output-header {
    flex-direction: column;
    padding: 4px;
}

.output-label {
    font-size: 11px;
    margin-bottom: 4px;
}

.output-meter-container {
    width: 30px;
    height: 4px;
    background: #555;
    border-radius: 1px;
    overflow: hidden;
}

.output-meter {
    height: 100%;
    width: 0%;
    background: linear-gradient(to right, #00ff00, #ffff00, #ff0000);
    transition: width 0.1s ease;
}

.matrix-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #333;
    border-top: 1px solid #555;
    font-size: 12px;
}

.level-readout {
    font-family: monospace;
    font-weight: bold;
    color: #0d6efd;
}

.level-editor {
    background: #444;
    border: 1px solid #666;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.level-editor-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 12px;
}

.level-input {
    width: 60px;
    padding: 4px;
    background: #333;
    border: 1px solid #555;
    border-radius: 2px;
    color: white;
    text-align: center;
}

.level-btn-small {
    padding: 2px 6px;
    background: #555;
    border: none;
    border-radius: 2px;
    color: white;
    font-size: 10px;
    cursor: pointer;
}

.level-btn-small:hover {
    background: #666;
}

.matrix-context-menu {
    background: #444;
    border: 1px solid #666;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    position: fixed;
}

.context-menu-item {
    padding: 8px 16px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
}

.context-menu-item:hover {
    background: #555;
}

.context-menu-separator {
    height: 1px;
    background: #666;
    margin: 4px 0;
}
`;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MatrixMixerUI;
} else {
    window.MatrixMixerUI = MatrixMixerUI;
    
    // Inject CSS if not already present
    if (!document.querySelector('#matrix-mixer-styles')) {
        const style = document.createElement('style');
        style.id = 'matrix-mixer-styles';
        style.textContent = MATRIX_MIXER_CSS;
        document.head.appendChild(style);
    }
}
/**
 * Matrix Mixer UI Component
 * Visual interface for professional audio matrix routing
 * NOTE: This file provides ONLY the UI component - MatrixMixer class comes from matrix-mixer-enhanced.js
 */

class MatrixMixerUI {
    constructor(container, matrixMixer, options = {}) {
        if (!container || !matrixMixer) {
            throw new Error('MatrixMixerUI requires container and matrixMixer');
        }
        
        this.container = container;
        this.matrix = matrixMixer;
        this.options = {
            showMeters: true,
            enableVSTSupport: false,
            enableGangs: true,
            colorScheme: 'professional',
            cellSize: 60,
            ...options
        };
        
        // UI state
        this.selectedCells = new Set();
        this.dragMode = null;
        this.levelMeterIntervals = new Map();
        
        // Event listeners
        this.changeHandler = this.handleMatrixChange.bind(this);
        this.matrix.onChange(this.changeHandler);
        
        console.log('Matrix Mixer UI initialized');
        this.render();
    }
    
    render() {
        this.container.innerHTML = this.generateHTML();
        this.setupEventListeners();
        this.updateAllCells();
        
        if (this.options.showMeters) {
            this.startLevelMetering();
        }
    }
    
    generateHTML() {
        const { numInputs, numOutputs } = this.matrix;
        const { cellSize } = this.options;
        
        return `
            <div class="matrix-mixer-ui" data-color-scheme="${this.options.colorScheme}">
                <div class="matrix-header">
                    <div class="matrix-title">
                        <h3>${this.matrix.name || 'Matrix Mixer'}</h3>
                        <span class="matrix-size">${numInputs}×${numOutputs}</span>
                    </div>
                    <div class="matrix-controls">
                        <button class="matrix-btn" data-action="clear">Clear All</button>
                        <button class="matrix-btn" data-action="unity">Unity</button>
                        ${this.options.enableGangs ? '<button class="matrix-btn" data-action="gang">Gang</button>' : ''}
                        <button class="matrix-btn" data-action="preset">Presets</button>
                    </div>
                </div>
                
                <div class="matrix-grid-container">
                    <div class="matrix-grid" style="
                        grid-template-columns: 80px repeat(${numOutputs}, ${cellSize}px);
                        grid-template-rows: 40px repeat(${numInputs}, ${cellSize}px);
                    ">
                        <!-- Top-left corner (Main Level) -->
                        <div class="matrix-cell matrix-main-level">
                            <label>Main</label>
                            <input type="number" 
                                   class="level-input main-level" 
                                   data-type="main" 
                                   value="${this.matrix.mainLevel}" 
                                   step="0.1" 
                                   min="-60" 
                                   max="12">
                        </div>
                        
                        <!-- Output headers and levels -->
                        ${this.generateOutputHeaders()}
                        
                        <!-- Input rows -->
                        ${this.generateInputRows()}
                    </div>
                </div>
                
                ${this.options.showMeters ? '<div class="level-meters"></div>' : ''}
            </div>
        `;
    }
    
    generateOutputHeaders() {
        const { numOutputs } = this.matrix;
        let html = '';
        
        for (let output = 0; output < numOutputs; output++) {
            html += `
                <div class="matrix-cell matrix-output-header" data-output="${output}">
                    <div class="output-label">Out ${output + 1}</div>
                    <input type="number" 
                           class="level-input output-level" 
                           data-type="output" 
                           data-index="${output}"
                           value="${this.matrix.outputLevels[output]}" 
                           step="0.1" 
                           min="-60" 
                           max="12">
                    <div class="mute-solo-controls">
                        <button class="mute-btn ${this.matrix.outputMutes[output] ? 'active' : ''}" 
                                data-type="output-mute" 
                                data-index="${output}">M</button>
                        <button class="solo-btn ${this.matrix.outputSolos[output] ? 'active' : ''}" 
                                data-type="output-solo" 
                                data-index="${output}">S</button>
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    generateInputRows() {
        const { numInputs, numOutputs } = this.matrix;
        let html = '';
        
        for (let input = 0; input < numInputs; input++) {
            // Input header
            html += `
                <div class="matrix-cell matrix-input-header" data-input="${input}">
                    <div class="input-label">In ${input + 1}</div>
                    <input type="number" 
                           class="level-input input-level" 
                           data-type="input" 
                           data-index="${input}"
                           value="${this.matrix.inputLevels[input]}" 
                           step="0.1" 
                           min="-60" 
                           max="12">
                    <div class="mute-solo-controls">
                        <button class="mute-btn ${this.matrix.inputMutes[input] ? 'active' : ''}" 
                                data-type="input-mute" 
                                data-index="${input}">M</button>
                        <button class="solo-btn ${this.matrix.inputSolos[input] ? 'active' : ''}" 
                                data-type="input-solo" 
                                data-index="${input}">S</button>
                    </div>
                </div>
            `;
            
            // Crosspoint cells
            for (let output = 0; output < numOutputs; output++) {
                const crosspointValue = this.matrix.crosspoints[input][output];
                const hasConnection = crosspointValue !== null;
                const displayValue = hasConnection ? crosspointValue.toFixed(1) : '';
                
                html += `
                    <div class="matrix-cell matrix-crosspoint ${hasConnection ? 'active' : ''}" 
                         data-input="${input}" 
                         data-output="${output}">
                        <input type="number" 
                               class="level-input crosspoint-level" 
                               data-type="crosspoint" 
                               data-input="${input}" 
                               data-output="${output}"
                               value="${displayValue}" 
                               placeholder="−∞"
                               step="0.1" 
                               min="-60" 
                               max="12">
                        ${this.options.showMeters ? '<div class="crosspoint-meter"></div>' : ''}
                    </div>
                `;
            }
        }
        
        return html;
    }
    
    setupEventListeners() {
        // Level input changes
        this.container.addEventListener('input', (e) => {
            if (e.target.classList.contains('level-input')) {
                this.handleLevelChange(e);
            }
        });
        
        // Crosspoint clicks
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('matrix-crosspoint') || 
                e.target.closest('.matrix-crosspoint')) {
                this.handleCrosspointClick(e);
            }
        });
        
        // Button actions
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('matrix-btn')) {
                this.handleButtonAction(e.target.dataset.action);
                e.preventDefault();
            }
            
            if (e.target.classList.contains('mute-btn') || e.target.classList.contains('solo-btn')) {
                this.handleMuteSolo(e);
                e.preventDefault();
            }
        });
        
        // Drag operations for multiple cell selection
        this.container.addEventListener('mousedown', (e) => {
            if (e.target.closest('.matrix-crosspoint')) {
                this.startDragSelection(e);
            }
        });
    }
    
    handleLevelChange(event) {
        const input = event.target;
        const value = parseFloat(input.value) || 0;
        const type = input.dataset.type;
        
        switch (type) {
            case 'main':
                this.matrix.setMainLevel(value);
                break;
                
            case 'input':
                const inputIndex = parseInt(input.dataset.index);
                this.matrix.setInputLevel(inputIndex, value);
                break;
                
            case 'output':
                const outputIndex = parseInt(input.dataset.index);
                this.matrix.setOutputLevel(outputIndex, value);
                break;
                
            case 'crosspoint':
                const inputIdx = parseInt(input.dataset.input);
                const outputIdx = parseInt(input.dataset.output);
                const crosspointValue = input.value === '' ? null : value;
                this.matrix.setCrosspoint(inputIdx, outputIdx, crosspointValue);
                break;
        }
    }
    
    handleCrosspointClick(event) {
        const cell = event.target.closest('.matrix-crosspoint');
        if (!cell) return;
        
        const input = parseInt(cell.dataset.input);
        const output = parseInt(cell.dataset.output);
        const currentValue = this.matrix.getCrosspoint(input, output);
        
        // Toggle between connected (0dB) and disconnected (null)
        if (currentValue === null) {
            this.matrix.setCrosspoint(input, output, 0);
        } else {
            this.matrix.setCrosspoint(input, output, null);
        }
    }
    
    handleMuteSolo(event) {
        const button = event.target;
        const type = button.dataset.type;
        const index = parseInt(button.dataset.index);
        const isActive = button.classList.contains('active');
        
        switch (type) {
            case 'input-mute':
                this.matrix.setInputMute(index, !isActive);
                break;
            case 'input-solo':
                this.matrix.setInputSolo(index, !isActive);
                break;
            case 'output-mute':
                this.matrix.setOutputMute(index, !isActive);
                break;
            case 'output-solo':
                this.matrix.setOutputSolo(index, !isActive);
                break;
        }
    }
    
    handleButtonAction(action) {
        switch (action) {
            case 'clear':
                if (confirm('Clear all routing? This cannot be undone.')) {
                    this.matrix.clear();
                }
                break;
                
            case 'unity':
                this.matrix.setUnity();
                break;
                
            case 'gang':
                this.showGangDialog();
                break;
                
            case 'preset':
                this.showPresetDialog();
                break;
        }
    }
    
    handleMatrixChange(changeInfo) {
        // Update UI when matrix changes
        switch (changeInfo.type) {
            case 'crosspoint':
                this.updateCrosspointCell(changeInfo.input, changeInfo.output);
                break;
                
            case 'main':
                this.updateMainLevel();
                break;
                
            case 'input':
                this.updateInputLevel(changeInfo.input);
                break;
                
            case 'output':
                this.updateOutputLevel(changeInfo.output);
                break;
                
            case 'clear':
            case 'state':
                this.updateAllCells();
                break;
        }
    }
    
    updateCrosspointCell(input, output) {
        const cell = this.container.querySelector(`[data-input="${input}"][data-output="${output}"]`);
        if (!cell) return;
        
        const levelInput = cell.querySelector('.crosspoint-level');
        const value = this.matrix.getCrosspoint(input, output);
        
        if (value === null) {
            levelInput.value = '';
            cell.classList.remove('active');
        } else {
            levelInput.value = value.toFixed(1);
            cell.classList.add('active');
        }
    }
    
    updateMainLevel() {
        const input = this.container.querySelector('.main-level');
        if (input) {
            input.value = this.matrix.mainLevel.toFixed(1);
        }
    }
    
    updateInputLevel(inputIndex) {
        const input = this.container.querySelector(`[data-type="input"][data-index="${inputIndex}"]`);
        if (input) {
            input.value = this.matrix.inputLevels[inputIndex].toFixed(1);
        }
        
        // Update mute/solo buttons
        this.updateMuteSoloButtons('input', inputIndex);
    }
    
    updateOutputLevel(outputIndex) {
        const input = this.container.querySelector(`[data-type="output"][data-index="${outputIndex}"]`);
        if (input) {
            input.value = this.matrix.outputLevels[outputIndex].toFixed(1);
        }
        
        // Update mute/solo buttons
        this.updateMuteSoloButtons('output', outputIndex);
    }
    
    updateMuteSoloButtons(type, index) {
        const muteBtn = this.container.querySelector(`[data-type="${type}-mute"][data-index="${index}"]`);
        const soloBtn = this.container.querySelector(`[data-type="${type}-solo"][data-index="${index}"]`);
        
        if (muteBtn) {
            const isMuted = type === 'input' ? 
                this.matrix.inputMutes[index] : this.matrix.outputMutes[index];
            muteBtn.classList.toggle('active', isMuted);
        }
        
        if (soloBtn) {
            const isSoloed = type === 'input' ? 
                this.matrix.inputSolos[index] : this.matrix.outputSolos[index];
            soloBtn.classList.toggle('active', isSoloed);
        }
    }
    
    updateAllCells() {
        // Update all crosspoints
        for (let input = 0; input < this.matrix.numInputs; input++) {
            for (let output = 0; output < this.matrix.numOutputs; output++) {
                this.updateCrosspointCell(input, output);
            }
        }
        
        // Update levels
        this.updateMainLevel();
        
        for (let i = 0; i < this.matrix.numInputs; i++) {
            this.updateInputLevel(i);
        }
        
        for (let o = 0; o < this.matrix.numOutputs; o++) {
            this.updateOutputLevel(o);
        }
    }
    
    startLevelMetering() {
        // This would integrate with actual audio level monitoring
        // For now, it's a placeholder for future implementation
        console.log('Level metering started (placeholder)');
    }
    
    showGangDialog() {
        // Placeholder for gang management dialog
        alert('Gang management not yet implemented');
    }
    
    showPresetDialog() {
        // Placeholder for preset management dialog
        alert('Preset management not yet implemented');
    }
    
    startDragSelection(event) {
        // Placeholder for drag selection functionality
        // This would allow selecting multiple crosspoints for batch operations
    }
    
    destroy() {
        // Clean up event listeners and intervals
        this.levelMeterIntervals.forEach(interval => clearInterval(interval));
        this.levelMeterIntervals.clear();
        
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        console.log('Matrix Mixer UI destroyed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MatrixMixerUI;
} else {
    window.MatrixMixerUI = MatrixMixerUI;
}
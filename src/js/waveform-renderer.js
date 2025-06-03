class WaveformRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.waveformData = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        
        // Visual options
        this.options = {
            backgroundColor: '#1a1a1a',
            waveformColor: '#0d7377',
            rmsColor: 'rgba(13, 115, 119, 0.3)',
            playheadColor: '#ffc107',
            selectionColor: 'rgba(255, 193, 7, 0.2)',
            clippingColor: '#dc3545',
            gridColor: 'rgba(255, 255, 255, 0.1)',
            textColor: '#b0b0b0',
            
            showRMS: true,
            showGrid: true,
            showTimeLabels: true,
            showClipping: true,
            waveformHeight: 0.8, // Percentage of canvas height
            
            ...options
        };
        
        // Interaction state
        this.isDragging = false;
        this.dragStart = 0;
        this.selection = { start: 0, end: 0 };
        this.trimPoints = { start: 0, end: 1 }; // Normalized 0-1
        
        // Event listeners
        this.listeners = {
            timeUpdate: [],
            selectionChange: [],
            trimChange: []
        };
        
        this.setupEventListeners();
        this.setupResizeObserver();
    }

    setupEventListeners() {
        // Mouse events for interaction
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Double-click to play/pause
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    }

    setupResizeObserver() {
        // Handle canvas resize
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                this.updateCanvasSize();
                this.render();
            });
            resizeObserver.observe(this.canvas.parentElement);
        }
        
        // Initial size setup
        this.updateCanvasSize();
    }

    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set actual size in memory (scaled for DPI)
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        // Scale the drawing context back down
        this.ctx.scale(dpr, dpr);
        
        // Set display size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    // Set waveform data
    setWaveformData(waveformData) {
        this.waveformData = waveformData;
        this.duration = waveformData ? waveformData.duration : 0;
        this.render();
    }

    // Update playback state
    updatePlayback(isPlaying, currentTime) {
        this.isPlaying = isPlaying;
        this.currentTime = currentTime;
        this.render();
    }

    // Set trim points (normalized 0-1)
    setTrimPoints(start, end) {
        this.trimPoints.start = Math.max(0, Math.min(1, start));
        this.trimPoints.end = Math.max(this.trimPoints.start, Math.min(1, end));
        this.emit('trimChange', this.trimPoints);
        this.render();
    }

    // Get trim points in seconds
    getTrimPointsInSeconds() {
        return {
            start: this.trimPoints.start * this.duration,
            end: this.trimPoints.end * this.duration
        };
    }

    // Main render function
    render() {
        if (!this.ctx) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        // Clear canvas
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        
        if (!this.waveformData) {
            this.renderPlaceholder(width, height);
            return;
        }
        
        // Render components
        if (this.options.showGrid) {
            this.renderGrid(width, height);
        }
        
        this.renderWaveform(width, height);
        
        if (this.options.showClipping) {
            this.renderClipping(width, height);
        }
        
        this.renderTrimRegion(width, height);
        this.renderPlayhead(width, height);
        
        if (this.options.showTimeLabels) {
            this.renderTimeLabels(width, height);
        }
    }

    renderPlaceholder(width, height) {
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('No audio file loaded', width / 2, height / 2);
    }

    renderGrid(width, height) {
        const centerY = height / 2;
        const waveHeight = height * this.options.waveformHeight;
        
        this.ctx.strokeStyle = this.options.gridColor;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 4]);
        
        // Horizontal center line
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(width, centerY);
        this.ctx.stroke();
        
        // Horizontal amplitude lines
        const quarterHeight = waveHeight / 4;
        for (let i = 1; i <= 2; i++) {
            const y1 = centerY - quarterHeight * i;
            const y2 = centerY + quarterHeight * i;
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, y1);
            this.ctx.lineTo(width, y1);
            this.ctx.moveTo(0, y2);
            this.ctx.lineTo(width, y2);
            this.ctx.stroke();
        }
        
        // Vertical time lines (every 10 seconds)
        if (this.duration > 0) {
            const secondsPerPixel = this.duration / width;
            const timeStep = this.getTimeStep(secondsPerPixel * 100); // Grid every ~100px
            
            for (let time = timeStep; time < this.duration; time += timeStep) {
                const x = (time / this.duration) * width;
                
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, height);
                this.ctx.stroke();
            }
        }
        
        this.ctx.setLineDash([]);
    }

    getTimeStep(minStep) {
        const steps = [0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
        return steps.find(step => step >= minStep) || 600;
    }

    renderWaveform(width, height) {
        if (!this.waveformData.peaks) return;
        
        const centerY = height / 2;
        const waveHeight = height * this.options.waveformHeight;
        const halfWaveHeight = waveHeight / 2;
        
        const peaks = this.waveformData.peaks;
        const rms = this.waveformData.rms;
        const samplesPerPixel = peaks.length / width;
        
        // Render RMS first (background)
        if (this.options.showRMS && rms) {
            this.ctx.fillStyle = this.options.rmsColor;
            this.ctx.beginPath();
            
            for (let x = 0; x < width; x++) {
                const sampleIndex = Math.floor(x * samplesPerPixel);
                if (sampleIndex < rms.length) {
                    const rmsValue = rms[sampleIndex];
                    const rmsHeight = rmsValue * halfWaveHeight;
                    
                    this.ctx.rect(x, centerY - rmsHeight, 1, rmsHeight * 2);
                }
            }
            
            this.ctx.fill();
        }
        
        // Render peak waveform
        this.ctx.strokeStyle = this.options.waveformColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        let lastY = centerY;
        
        for (let x = 0; x < width; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            
            if (sampleIndex < peaks.length) {
                const peak = peaks[sampleIndex];
                const y = centerY - (peak * halfWaveHeight);
                
                if (x === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
                
                lastY = y;
            }
        }
        
        this.ctx.stroke();
        
        // Render negative waveform (mirror)
        this.ctx.beginPath();
        
        for (let x = 0; x < width; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            
            if (sampleIndex < peaks.length) {
                const peak = peaks[sampleIndex];
                const y = centerY + (peak * halfWaveHeight);
                
                if (x === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        }
        
        this.ctx.stroke();
    }

    renderClipping(width, height) {
        if (!this.waveformData.clippingPoints || this.waveformData.clippingPoints.length === 0) {
            return;
        }
        
        this.ctx.fillStyle = this.options.clippingColor;
        
        this.waveformData.clippingPoints.forEach(clip => {
            const x = (clip.time / this.duration) * width;
            this.ctx.fillRect(x, 0, 2, height);
        });
    }

    renderTrimRegion(width, height) {
        const startX = this.trimPoints.start * width;
        const endX = this.trimPoints.end * width;
        
        // Darken areas outside trim region
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        
        // Left trim area
        if (startX > 0) {
            this.ctx.fillRect(0, 0, startX, height);
        }
        
        // Right trim area
        if (endX < width) {
            this.ctx.fillRect(endX, 0, width - endX, height);
        }
        
        // Trim handles
        this.ctx.fillStyle = this.options.playheadColor;
        this.ctx.fillRect(startX - 2, 0, 4, height);
        this.ctx.fillRect(endX - 2, 0, 4, height);
        
        // Trim region outline
        this.ctx.strokeStyle = this.options.playheadColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX, 0, endX - startX, height);
    }

    renderPlayhead(width, height) {
        if (!this.isPlaying || this.duration === 0) return;
        
        const x = (this.currentTime / this.duration) * width;
        
        this.ctx.strokeStyle = this.options.playheadColor;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
        
        // Playhead triangle at top
        this.ctx.fillStyle = this.options.playheadColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x - 6, 12);
        this.ctx.lineTo(x + 6, 12);
        this.ctx.closePath();
        this.ctx.fill();
    }

    renderTimeLabels(width, height) {
        if (this.duration === 0) return;
        
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        
        const secondsPerPixel = this.duration / width;
        const timeStep = this.getTimeStep(secondsPerPixel * 80); // Label every ~80px
        
        for (let time = 0; time <= this.duration; time += timeStep) {
            const x = (time / this.duration) * width;
            const timeStr = this.formatTime(time);
            
            this.ctx.fillText(timeStr, x, height - 2);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${mins}:${secs.padStart(4, '0')}`;
    }

    // Mouse interaction handlers
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        this.isDragging = true;
        this.dragStart = x;
        
        // Check if clicking near trim handles
        const startX = this.trimPoints.start * width;
        const endX = this.trimPoints.end * width;
        
        if (Math.abs(x - startX) < 10) {
            this.dragMode = 'trimStart';
        } else if (Math.abs(x - endX) < 10) {
            this.dragMode = 'trimEnd';
        } else {
            this.dragMode = 'seek';
            // Seek to clicked position
            const normalizedX = x / width;
            this.emit('timeUpdate', normalizedX * this.duration);
        }
    }

    onMouseMove(e) {
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const normalizedX = Math.max(0, Math.min(1, x / width));
        
        if (this.dragMode === 'trimStart') {
            this.setTrimPoints(normalizedX, this.trimPoints.end);
        } else if (this.dragMode === 'trimEnd') {
            this.setTrimPoints(this.trimPoints.start, normalizedX);
        } else if (this.dragMode === 'seek') {
            this.emit('timeUpdate', normalizedX * this.duration);
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.dragMode = null;
    }

    onDoubleClick(e) {
        this.emit('playToggle');
    }

    // Event system
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    // Cleanup
    destroy() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseleave', this.onMouseUp);
        this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.removeEventListener('dblclick', this.onDoubleClick);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WaveformRenderer;
} else {
    window.WaveformRenderer = WaveformRenderer;
}
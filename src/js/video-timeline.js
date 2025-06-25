// Simplified Video Timeline Implementation
// This provides basic timeline functionality without complex dependencies

class VideoTimeline {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.video = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.frameRate = 30;
        this.totalFrames = 0;
        this.currentFrame = 0;
        
        // Visual options
        this.options = {
            backgroundColor: '#1a1a1a',
            timelineColor: '#404040',
            playheadColor: '#ffc107',
            frameColor: '#0d7377',
            trimColor: '#28a745',
            hoverColor: '#6c757d',
            textColor: '#b0b0b0',
            tickColor: 'rgba(255, 255, 255, 0.2)',
            ...options
        };
        
        // Interaction state
        this.isDragging = false;
        this.dragMode = null;
        this.trimPoints = { start: 0, end: 1 };
        this.hoverTime = -1;
        this.zoomLevel = 1;
        this.scrollOffset = 0;
        
        // Event listeners
        this.listeners = {
            timeUpdate: [],
            seek: [],
            trimChange: [],
            frameStep: [],
            playToggle: []
        };
        
        this.setupEventListeners();
        this.setupResizeObserver();
        this.updateCanvasSize();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setupResizeObserver() {
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                this.updateCanvasSize();
                this.render();
            });
            resizeObserver.observe(this.canvas.parentElement);
        }
    }

    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    // Set video source
    setVideo(video) {
        this.video = video;
        
        if (video) {
            this.duration = video.duration;
            this.frameRate = 30; // Default frame rate
            this.totalFrames = Math.floor(this.duration * this.frameRate);
            this.updateCurrentFrame();
            
            console.log(`Video timeline loaded: ${this.duration.toFixed(2)}s, ${this.frameRate}fps, ${this.totalFrames} frames`);
        }
        
        this.render();
    }

    updateCurrentFrame() {
        if (this.video && this.frameRate > 0) {
            this.currentFrame = Math.floor(this.currentTime * this.frameRate);
        }
    }

    // Playback control
    updatePlayback(isPlaying, currentTime) {
        this.isPlaying = isPlaying;
        this.currentTime = currentTime;
        this.updateCurrentFrame();
        this.render();
    }

    seekToTime(time) {
        const clampedTime = Math.max(0, Math.min(this.duration, time));
        this.currentTime = clampedTime;
        this.updateCurrentFrame();
        this.emit('seek', clampedTime);
        this.render();
    }

    seekToFrame(frameNumber) {
        const clampedFrame = Math.max(0, Math.min(this.totalFrames - 1, frameNumber));
        const time = clampedFrame / this.frameRate;
        this.seekToTime(time);
    }

    stepFrame(direction) {
        const newFrame = this.currentFrame + direction;
        this.seekToFrame(newFrame);
        this.emit('frameStep', { frame: newFrame, direction });
    }

    // Professional video controls
    pause() {
        this.emit('playToggle', { direction: 0 });
    }

    // Trim point controls
    setTrimStart(normalizedTime) {
        this.trimPoints.start = Math.max(0, Math.min(this.trimPoints.end - 0.001, normalizedTime));
        this.emit('trimChange', this.getTrimPointsInSeconds());
        this.render();
    }

    setTrimEnd(normalizedTime) {
        this.trimPoints.end = Math.max(this.trimPoints.start + 0.001, Math.min(1, normalizedTime));
        this.emit('trimChange', this.getTrimPointsInSeconds());
        this.render();
    }

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
        
        if (!this.video || this.duration === 0) {
            this.renderPlaceholder(width, height);
            return;
        }
        
        // Render components
        this.renderTimeline(width, height);
        this.renderTrimRegions(width, height);
        this.renderPlayhead(width, height);
        this.renderHover(width, height);
        this.renderTimecode(width, height);
    }

    renderPlaceholder(width, height) {
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('No video loaded', width / 2, height / 2);
    }

    renderTimeline(width, height) {
        const timelineY = 20;
        const timelineHeight = 20;
        
        // Timeline background
        this.ctx.fillStyle = this.options.timelineColor;
        this.ctx.fillRect(0, timelineY, width, timelineHeight);
        
        // Time ticks
        this.renderTimeTicks(width, timelineY, timelineHeight);
    }

    renderTimeTicks(width, timelineY, timelineHeight) {
        const pixelsPerSecond = width / this.duration;
        let tickInterval = 1; // Start with 1 second intervals
        
        // Adjust tick interval based on zoom
        if (pixelsPerSecond < 20) tickInterval = 10;
        else if (pixelsPerSecond < 50) tickInterval = 5;
        else if (pixelsPerSecond > 200) tickInterval = 0.1;
        
        this.ctx.strokeStyle = this.options.tickColor;
        this.ctx.lineWidth = 1;
        
        for (let time = 0; time <= this.duration; time += tickInterval) {
            const x = (time / this.duration) * width;
            const tickHeight = time % (tickInterval * 5) === 0 ? timelineHeight : timelineHeight / 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, timelineY);
            this.ctx.lineTo(x, timelineY + tickHeight);
            this.ctx.stroke();
        }
    }

    renderTrimRegions(width, height) {
        const startX = this.trimPoints.start * width;
        const endX = this.trimPoints.end * width;
        
        // Dimmed regions outside trim points
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
        this.ctx.fillStyle = this.options.trimColor;
        this.ctx.fillRect(startX - 3, 0, 6, height);
        this.ctx.fillRect(endX - 3, 0, 6, height);
        
        // Trim region border
        this.ctx.strokeStyle = this.options.trimColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX, 0, endX - startX, height);
    }

    renderPlayhead(width, height) {
        if (this.duration === 0) return;
        
        const x = (this.currentTime / this.duration) * width;
        
        // Playhead line
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
        this.ctx.lineTo(x - 8, 16);
        this.ctx.lineTo(x + 8, 16);
        this.ctx.closePath();
        this.ctx.fill();
    }

    renderHover(width, height) {
        if (this.hoverTime < 0 || this.duration === 0) return;
        
        const x = (this.hoverTime / this.duration) * width;
        
        // Hover line
        this.ctx.strokeStyle = this.options.hoverColor;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // Hover time tooltip
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(x - 30, 5, 60, 20);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.formatTimecode(this.hoverTime), x, 18);
    }

    renderTimecode(width, height) {
        const y = height - 10;
        
        // Current time
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Time: ${this.formatTimecode(this.currentTime)}`, 10, y);
        
        // Frame number
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Frame: ${this.currentFrame + 1}/${this.totalFrames}`, width / 2, y);
        
        // Duration
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Duration: ${this.formatTimecode(this.duration)}`, width - 10, y);
    }

    // Mouse event handlers
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        this.isDragging = true;
        
        // Check if clicking near trim handles
        const startX = this.trimPoints.start * width;
        const endX = this.trimPoints.end * width;
        
        if (Math.abs(x - startX) < 10) {
            this.dragMode = 'trimStart';
        } else if (Math.abs(x - endX) < 10) {
            this.dragMode = 'trimEnd';
        } else {
            this.dragMode = 'scrub';
            // Seek to clicked position
            const normalizedX = x / width;
            const time = normalizedX * this.duration;
            this.seekToTime(time);
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const normalizedX = Math.max(0, Math.min(1, x / width));
        
        // Update hover time
        this.hoverTime = normalizedX * this.duration;
        
        if (this.isDragging) {
            switch (this.dragMode) {
                case 'trimStart':
                    this.setTrimStart(normalizedX);
                    break;
                case 'trimEnd':
                    this.setTrimEnd(normalizedX);
                    break;
                case 'scrub':
                    const time = normalizedX * this.duration;
                    this.seekToTime(time);
                    break;
            }
        }
        
        this.render();
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.dragMode = null;
    }

    onMouseLeave(e) {
        this.hoverTime = -1;
        this.onMouseUp(e);
        this.render();
    }

    onDoubleClick(e) {
        this.emit('playToggle', { direction: this.isPlaying ? 0 : 1 });
    }

    // Utility functions
    formatTimecode(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor((seconds % 1) * this.frameRate);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
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
        this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
        this.canvas.removeEventListener('dblclick', this.onDoubleClick);
        this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoTimeline;
} else {
    window.VideoTimeline = VideoTimeline;
}
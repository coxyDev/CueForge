const { v4: uuidv4 } = require('uuid');

class CueManager {
    constructor() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showPath = null;
        this.unsavedChanges = false;
        
        this.listeners = {
            cueAdded: [],
            cueRemoved: [],
            cueUpdated: [],
            selectionChanged: [],
            playbackStateChanged: [],
            showChanged: []
        };
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

    // Cue creation methods
    createCue(type, options = {}) {
        const cue = {
            id: uuidv4(),
            type: type,
            number: this.getNextCueNumber(),
            name: options.name || `${this.capitalizeFirst(type)} ${this.cues.length + 1}`,
            duration: options.duration || 0,
            preWait: 0,
            postWait: 0,
            status: 'ready',
            created: new Date().toISOString(),
            ...this.getTypeSpecificDefaults(type),
            ...options
        };

        return cue;
    }

    getTypeSpecificDefaults(type) {
        switch (type) {
            case 'audio':
                return {
                    filePath: null,
                    volume: 1.0,
                    fadeIn: 0,
                    fadeOut: 0,
                    startTime: 0,
                    endTime: null,
                    loop: false
                };
            case 'video':
                return {
                    filePath: null,
                    volume: 1.0,
                    fadeIn: 0,
                    fadeOut: 0,
                    startTime: 0,
                    endTime: null,
                    loop: false,
                    fullscreen: false,
                    aspectRatio: 'auto', // 'auto', '16:9', '4:3', 'stretch'
                    opacity: 1.0
                };
            case 'wait':
                return {
                    duration: 5000 // 5 seconds default
                };
            case 'group':
                return {
                    children: [],
                    mode: 'sequential' // or 'parallel'
                };
            default:
                return {};
        }
    }

    getNextCueNumber() {
        if (this.cues.length === 0) return 1;
        const numbers = this.cues.map(cue => parseFloat(cue.number)).filter(n => !isNaN(n));
        return numbers.length > 0 ? Math.max(...numbers) + 1 : this.cues.length + 1;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Cue management
    addCue(type, options = {}, index = -1) {
        const cue = this.createCue(type, options);
        
        if (index === -1) {
            this.cues.push(cue);
        } else {
            this.cues.splice(index, 0, cue);
        }

        this.markUnsaved();
        this.emit('cueAdded', { cue, index: index === -1 ? this.cues.length - 1 : index });
        return cue;
    }

    removeCue(cueId) {
        const index = this.cues.findIndex(cue => cue.id === cueId);
        if (index === -1) return false;

        const cue = this.cues[index];
        this.cues.splice(index, 1);

        // Adjust current cue index if necessary
        if (index <= this.currentCueIndex) {
            this.currentCueIndex = Math.max(-1, this.currentCueIndex - 1);
        }

        // Clear selection if removed cue was selected
        if (this.selectedCueId === cueId) {
            this.selectCue(null);
        }

        this.markUnsaved();
        this.emit('cueRemoved', { cue, index });
        return true;
    }

    updateCue(cueId, updates) {
        const cue = this.getCue(cueId);
        if (!cue) return false;

        Object.assign(cue, updates);
        this.markUnsaved();
        this.emit('cueUpdated', { cue, updates });
        return true;
    }

    getCue(cueId) {
        return this.cues.find(cue => cue.id === cueId);
    }

    getCueByIndex(index) {
        return this.cues[index] || null;
    }

    getCueIndex(cueId) {
        return this.cues.findIndex(cue => cue.id === cueId);
    }

    // Selection management
    selectCue(cueId) {
        this.selectedCueId = cueId;
        this.emit('selectionChanged', { selectedCueId: cueId });
    }

    getSelectedCue() {
        return this.selectedCueId ? this.getCue(this.selectedCueId) : null;
    }

    // Playback control
    go() {
        if (this.isPaused) {
            this.resume();
            return;
        }

        const nextCue = this.getNextCue();
        if (nextCue) {
            this.playCue(nextCue.id);
        }
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        
        // Stop all currently playing cues
        this.cues.forEach(cue => {
            if (cue.status === 'playing') {
                cue.status = 'ready';
            }
        });

        this.emit('playbackStateChanged', { 
            isPlaying: false, 
            isPaused: false,
            currentCueIndex: this.currentCueIndex 
        });
    }

    pause() {
        if (this.isPlaying) {
            this.isPaused = true;
            this.isPlaying = false;
            
            this.emit('playbackStateChanged', { 
                isPlaying: false, 
                isPaused: true,
                currentCueIndex: this.currentCueIndex 
            });
        }
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.isPlaying = true;
            
            this.emit('playbackStateChanged', { 
                isPlaying: true, 
                isPaused: false,
                currentCueIndex: this.currentCueIndex 
            });
        }
    }

    async playCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) return false;

        const cueIndex = this.getCueIndex(cueId);
        this.currentCueIndex = cueIndex;
        this.isPlaying = true;
        this.isPaused = false;

        cue.status = 'playing';
        
        this.emit('playbackStateChanged', { 
            isPlaying: true, 
            isPaused: false,
            currentCueIndex: this.currentCueIndex,
            currentCue: cue
        });

        try {
            await this.executeCue(cue);
            this.onCueFinished(cue);
        } catch (error) {
            this.onCueError(cue, error);
        }

        return true;
    }

    async executeCue(cue) {
        // Pre-wait
        if (cue.preWait > 0) {
            await this.wait(cue.preWait);
        }

        // Execute cue based on type
        switch (cue.type) {
            case 'audio':
                await this.executeAudioCue(cue);
                break;
            case 'video':
                await this.executeVideoCue(cue);
                break;
            case 'wait':
                await this.executeWaitCue(cue);
                break;
            case 'group':
                await this.executeGroupCue(cue);
                break;
            default:
                console.warn(`Unknown cue type: ${cue.type}`);
        }

        // Post-wait
        if (cue.postWait > 0) {
            await this.wait(cue.postWait);
        }
    }

    async executeAudioCue(cue) {
        if (!cue.filePath) {
            throw new Error('No audio file specified');
        }
        
        // This will be handled by the AudioEngine
        return new Promise((resolve, reject) => {
            window.audioEngine.playCue(cue, resolve, reject);
        });
    }

    async executeVideoCue(cue) {
        if (!cue.filePath) {
            throw new Error('No video file specified');
        }
        
        // This will be handled by the VideoEngine
        return new Promise((resolve, reject) => {
            window.videoEngine.playCue(cue, resolve, reject);
        });
    }

    async executeWaitCue(cue) {
        return this.wait(cue.duration);
    }

    async executeGroupCue(cue) {
        if (cue.mode === 'parallel') {
            // Execute all children simultaneously
            const promises = cue.children.map(childId => {
                const childCue = this.getCue(childId);
                return childCue ? this.executeCue(childCue) : Promise.resolve();
            });
            await Promise.all(promises);
        } else {
            // Execute children sequentially
            for (const childId of cue.children) {
                const childCue = this.getCue(childId);
                if (childCue) {
                    await this.executeCue(childCue);
                }
            }
        }
    }

    wait(milliseconds) {
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }

    onCueFinished(cue) {
        cue.status = 'ready';
        this.emit('cueUpdated', { cue });

        // Auto-advance to next cue if in sequential playback mode
        this.advanceToNextCue();
    }

    onCueError(cue, error) {
        cue.status = 'error';
        console.error(`Cue ${cue.number} error:`, error);
        this.emit('cueUpdated', { cue, error });
        
        this.isPlaying = false;
        this.emit('playbackStateChanged', { 
            isPlaying: false, 
            isPaused: false,
            currentCueIndex: this.currentCueIndex,
            error: error.message
        });
    }

    getNextCue() {
        const nextIndex = this.currentCueIndex + 1;
        return nextIndex < this.cues.length ? this.cues[nextIndex] : null;
    }

    advanceToNextCue() {
        // For now, just stop. Later we can add auto-advance options
        this.isPlaying = false;
        this.emit('playbackStateChanged', { 
            isPlaying: false, 
            isPaused: false,
            currentCueIndex: this.currentCueIndex 
        });
    }

    // Show management
    newShow() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showPath = null;
        this.unsavedChanges = false;

        this.emit('showChanged', { showName: this.showName });
    }

    async saveShow(filePath = null) {
        const showData = {
            name: this.showName,
            version: '1.0',
            created: new Date().toISOString(),
            cues: this.cues,
            settings: {
                currentCueIndex: this.currentCueIndex
            }
        };

        if (filePath) {
            this.showPath = filePath;
        }

        if (this.showPath) {
            try {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('save-show-dialog', showData);
                
                if (result.success) {
                    this.showPath = result.filePath;
                    this.showName = require('path').basename(this.showPath, '.qlab');
                    this.unsavedChanges = false;
                    this.emit('showChanged', { showName: this.showName, saved: true });
                    return true;
                }
            } catch (error) {
                console.error('Save error:', error);
                return false;
            }
        }

        return false;
    }

    async loadShow(filePath) {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('load-show-file', filePath);
            
            if (result.success) {
                const showData = result.data;
                
                this.cues = showData.cues || [];
                this.currentCueIndex = showData.settings?.currentCueIndex || -1;
                this.showName = showData.name || require('path').basename(filePath, '.qlab');
                this.showPath = filePath;
                this.selectedCueId = null;
                this.isPlaying = false;
                this.isPaused = false;
                this.unsavedChanges = false;

                this.emit('showChanged', { 
                    showName: this.showName, 
                    loaded: true,
                    cues: this.cues
                });
                return true;
            }
        } catch (error) {
            console.error('Load error:', error);
            return false;
        }

        return false;
    }

    markUnsaved() {
        this.unsavedChanges = true;
        this.emit('showChanged', { showName: this.showName, unsaved: true });
    }

    // Utility methods
    getCueStats() {
        return {
            total: this.cues.length,
            byType: this.cues.reduce((stats, cue) => {
                stats[cue.type] = (stats[cue.type] || 0) + 1;
                return stats;
            }, {}),
            ready: this.cues.filter(cue => cue.status === 'ready').length,
            playing: this.cues.filter(cue => cue.status === 'playing').length,
            error: this.cues.filter(cue => cue.status === 'error').length
        };
    }

    reorderCue(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.cues.length || 
            toIndex < 0 || toIndex >= this.cues.length) {
            return false;
        }

        const [cue] = this.cues.splice(fromIndex, 1);
        this.cues.splice(toIndex, 0, cue);

        // Update current cue index if necessary
        if (this.currentCueIndex === fromIndex) {
            this.currentCueIndex = toIndex;
        } else if (fromIndex < this.currentCueIndex && toIndex >= this.currentCueIndex) {
            this.currentCueIndex--;
        } else if (fromIndex > this.currentCueIndex && toIndex <= this.currentCueIndex) {
            this.currentCueIndex++;
        }

        this.markUnsaved();
        this.emit('showChanged', { reordered: true });
        return true;
    }

    duplicateCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) return null;

        const index = this.getCueIndex(cueId);
        const duplicatedCue = {
            ...cue,
            id: uuidv4(),
            number: this.getNextCueNumber(),
            name: `${cue.name} Copy`,
            created: new Date().toISOString()
        };

        this.cues.splice(index + 1, 0, duplicatedCue);
        this.markUnsaved();
        this.emit('cueAdded', { cue: duplicatedCue, index: index + 1 });
        return duplicatedCue;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CueManager;
} else {
    window.CueManager = CueManager;
}
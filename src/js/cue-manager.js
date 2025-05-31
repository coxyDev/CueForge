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
        this.masterVolume = 1.0;
        this.autoContinueEnabled = true; // Global auto-continue setting
        this.singleCueMode = true; // NEW: Prevent multiple cues from playing simultaneously
        
        this.listeners = {
            cueAdded: [],
            cueRemoved: [],
            cueUpdated: [],
            selectionChanged: [],
            playbackStateChanged: [],
            showChanged: [],
            volumeChanged: [],
            settingsChanged: []
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

    // Master Volume Control
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        // Update audio engine master volume
        if (window.audioEngine) {
            window.audioEngine.setMasterVolume(this.masterVolume);
        }
        
        this.emit('volumeChanged', { masterVolume: this.masterVolume });
        console.log(`Master volume set to: ${Math.round(this.masterVolume * 100)}%`);
    }

    getMasterVolume() {
        return this.masterVolume;
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
            
            // Auto-continue properties
            autoContinue: false, // Whether this cue should auto-advance to next
            autoFollowTarget: null, // Specific cue ID to follow to (null = next in sequence)
            continueDelay: 0, // Delay before auto-continue (milliseconds)
            
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
                    aspectRatio: 'auto',
                    opacity: 1.0
                };
            case 'wait':
                return {
                    duration: 5000,
                    autoContinue: true // Wait cues should auto-continue by default
                };
            case 'group':
                return {
                    children: [],
                    mode: 'sequential'
                };
            default:
                return {};
        }
    }

    getNextCueNumber() {
        if (this.cues.length === 0) return '1';
        
        // Extract numeric parts and find the highest
        const numbers = this.cues.map(cue => {
            const num = parseFloat(cue.number);
            return isNaN(num) ? 0 : num;
        });
        
        const maxNumber = Math.max(...numbers, 0);
        return String(Math.floor(maxNumber) + 1);
    }

    // Enhanced cue numbering system (QLab-style)
    insertCueBetween(afterCueId, newCueType, options = {}) {
        const afterIndex = afterCueId ? this.getCueIndex(afterCueId) : -1;
        const afterCue = afterIndex >= 0 ? this.cues[afterIndex] : null;
        const nextCue = afterIndex + 1 < this.cues.length ? this.cues[afterIndex + 1] : null;
        
        let newNumber;
        if (!afterCue) {
            newNumber = '1';
        } else if (!nextCue) {
            // Adding after last cue
            const afterNum = parseFloat(afterCue.number);
            newNumber = String(Math.floor(afterNum) + 1);
        } else {
            // Adding between two cues
            const afterNum = parseFloat(afterCue.number);
            const nextNum = parseFloat(nextCue.number);
            
            if (Math.floor(afterNum) === Math.floor(nextNum)) {
                // Same integer part, add decimal
                newNumber = `${Math.floor(afterNum)}.${Math.floor((afterNum % 1 + nextNum % 1) * 10 / 2)}`;
            } else {
                // Different integer parts
                newNumber = `${Math.floor(afterNum)}.5`;
            }
        }
        
        options.number = newNumber;
        const cue = this.addCue(newCueType, options, afterIndex + 1);
        return cue;
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

        // Update any auto-follow targets that pointed to this cue
        this.cues.forEach(c => {
            if (c.autoFollowTarget === cueId) {
                c.autoFollowTarget = null;
                c.autoContinue = false;
            }
        });

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

    // Enhanced Playback control
    go() {
        console.log('Go button pressed');
        
        if (this.isPaused) {
            console.log('Resuming playback');
            this.resume();
            return;
        }

        const nextCue = this.getNextCue();
        if (nextCue) {
            console.log(`Playing next cue: ${nextCue.name} (${nextCue.type})`);
            this.playCue(nextCue.id);
        } else {
            console.log('No more cues to play');
            
            // If we're at the end, start from the beginning
            if (this.cues.length > 0) {
                this.currentCueIndex = -1;
                const firstCue = this.cues[0];
                console.log(`Starting from beginning: ${firstCue.name}`);
                this.playCue(firstCue.id);
            }
        }
    }

    stop() {
        console.log('Stop button pressed');
        this.isPlaying = false;
        this.isPaused = false;
        
        // Clear any pending auto-continue timeouts
        this.clearAllAutoContinueTimeouts();
        
        // Stop all currently playing cues
        this.cues.forEach(cue => {
            if (cue.status === 'playing') {
                cue.status = 'ready';
                
                // Stop audio/video engines
                if (window.audioEngine && cue.type === 'audio') {
                    window.audioEngine.stopCue(cue.id);
                }
                if (window.videoEngine && cue.type === 'video') {
                    window.videoEngine.stopCue(cue.id);
                }
            }
        });

        // Stop all engines
        if (window.audioEngine) {
            window.audioEngine.stopAllCues();
        }
        if (window.videoEngine) {
            window.videoEngine.stopAllCues();
        }

        this.emit('playbackStateChanged', { 
            isPlaying: false, 
            isPaused: false,
            currentCueIndex: this.currentCueIndex 
        });
    }

    pause() {
        console.log('Pause button pressed');
        if (this.isPlaying) {
            this.isPaused = true;
            this.isPlaying = false;
            
            // Clear any pending auto-continue timeouts
            this.clearAllAutoContinueTimeouts();
            
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

    // Auto-continue timeout management
    autoContinueTimeouts = new Map();

    clearAllAutoContinueTimeouts() {
        this.autoContinueTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.autoContinueTimeouts.clear();
    }

    scheduleAutoContinue(cue) {
        if (!this.autoContinueEnabled || !cue.autoContinue) {
            return;
        }

        const delay = cue.continueDelay || 0;
        console.log(`Scheduling auto-continue for cue ${cue.number} after ${delay}ms`);

        const timeoutId = setTimeout(() => {
            this.autoContinueTimeouts.delete(cue.id);
            this.performAutoContinue(cue);
        }, delay);

        this.autoContinueTimeouts.set(cue.id, timeoutId);
    }

    performAutoContinue(fromCue) {
        if (!this.autoContinueEnabled || this.isPaused) {
            return;
        }

        console.log(`Auto-continuing from cue ${fromCue.number}`);

        let targetCue = null;

        if (fromCue.autoFollowTarget) {
            // Follow to specific cue
            targetCue = this.getCue(fromCue.autoFollowTarget);
            if (!targetCue) {
                console.warn(`Auto-follow target not found: ${fromCue.autoFollowTarget}`);
                return;
            }
        } else {
            // Follow to next cue in sequence
            const currentIndex = this.getCueIndex(fromCue.id);
            if (currentIndex + 1 < this.cues.length) {
                targetCue = this.cues[currentIndex + 1];
            }
        }

        if (targetCue) {
            console.log(`Auto-continuing to cue: ${targetCue.name}`);
            this.playCue(targetCue.id);
        } else {
            console.log('No target cue for auto-continue, stopping playback');
            this.isPlaying = false;
            this.emit('playbackStateChanged', { 
                isPlaying: false, 
                isPaused: false,
                currentCueIndex: this.currentCueIndex 
            });
        }
    }

    async playCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) {
            console.error(`Cue not found: ${cueId}`);
            return false;
        }

        console.log(`Playing cue: ${cue.name} (${cue.type})`);

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
        console.log(`Executing cue: ${cue.name} (${cue.type})`);
        
        // Pre-wait
        if (cue.preWait > 0) {
            console.log(`Pre-wait: ${cue.preWait}ms`);
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
            console.log(`Post-wait: ${cue.postWait}ms`);
            await this.wait(cue.postWait);
        }
    }

    async executeAudioCue(cue) {
        if (!cue.filePath) {
            throw new Error('No audio file specified');
        }
        
        console.log(`Executing audio cue: ${cue.name} with file: ${cue.filePath}`);
        
        if (!window.audioEngine) {
            throw new Error('Audio engine not available');
        }
        
        return new Promise((resolve, reject) => {
            window.audioEngine.playCue(cue, resolve, reject);
        });
    }

    async executeVideoCue(cue) {
        if (!cue.filePath) {
            throw new Error('No video file specified');
        }
        
        console.log(`Executing video cue: ${cue.name} with file: ${cue.filePath}`);
        
        // Use display manager if available and not set to preview
        if (window.displayManager && window.displayManager.getCurrentRouting() !== 'preview') {
            console.log('Playing video on external display');
            const success = await window.displayManager.playVideoOnOutput(cue);
            if (success) {
                // For external display, we consider it immediately successful
                await this.wait(cue.duration || 1000);
                return Promise.resolve();
            }
        }
        
        // Fallback to preview window
        console.log('Playing video in preview');
        if (!window.videoEngine) {
            throw new Error('Video engine not available');
        }
        
        return new Promise((resolve, reject) => {
            window.videoEngine.playCue(cue, resolve, reject);
        });
    }

    async executeWaitCue(cue) {
        console.log(`Executing wait cue: ${cue.name} for ${cue.duration}ms`);
        return this.wait(cue.duration);
    }

    async executeGroupCue(cue) {
        console.log(`Executing group cue: ${cue.name} (${cue.mode})`);
        
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
        console.log(`Waiting for ${milliseconds}ms`);
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }

    onCueFinished(cue) {
        console.log(`Cue finished: ${cue.name}`);
        cue.status = 'ready';
        this.emit('cueUpdated', { cue });

        // Check for auto-continue
        if (cue.autoContinue && this.autoContinueEnabled && !this.isPaused) {
            this.scheduleAutoContinue(cue);
        } else {
            // Manual advance mode - stop playback
            this.isPlaying = false;
            this.emit('playbackStateChanged', { 
                isPlaying: false, 
                isPaused: false,
                currentCueIndex: this.currentCueIndex 
            });
        }
    }

    onCueError(cue, error) {
        console.error(`Cue ${cue.number} error:`, error);
        cue.status = 'error';
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
        if (nextIndex < this.cues.length) {
            return this.cues[nextIndex];
        }
        return null;
    }

    // Show management with master volume
    newShow() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showPath = null;
        this.unsavedChanges = false;
        this.masterVolume = 1.0;
        this.clearAllAutoContinueTimeouts();

        this.emit('showChanged', { showName: this.showName });
        this.emit('volumeChanged', { masterVolume: this.masterVolume });
    }

    async saveShow(filePath = null) {
        const showData = {
            name: this.showName,
            version: '1.2', // Updated version for new settings
            created: new Date().toISOString(),
            cues: this.cues,
            settings: {
                currentCueIndex: this.currentCueIndex,
                masterVolume: this.masterVolume,
                autoContinueEnabled: this.autoContinueEnabled,
                singleCueMode: this.singleCueMode
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
                this.masterVolume = showData.settings?.masterVolume || 1.0;
                this.autoContinueEnabled = showData.settings?.autoContinueEnabled !== false;
                this.singleCueMode = showData.settings?.singleCueMode !== false; // Default to true for safety
                this.showName = showData.name || require('path').basename(filePath, '.qlab');
                this.showPath = filePath;
                this.selectedCueId = null;
                this.isPlaying = false;
                this.isPaused = false;
                this.unsavedChanges = false;
                this.clearAllAutoContinueTimeouts();

                // Apply master volume
                this.setMasterVolume(this.masterVolume);

                this.emit('showChanged', { 
                    showName: this.showName, 
                    loaded: true,
                    cues: this.cues
                });
                
                this.emit('settingsChanged', {
                    singleCueMode: this.singleCueMode,
                    autoContinueEnabled: this.autoContinueEnabled
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
            error: this.cues.filter(cue => cue.status === 'error').length,
            autoContinue: this.cues.filter(cue => cue.autoContinue).length
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
            created: new Date().toISOString(),
            autoContinue: false, // Reset auto-continue for copy
            autoFollowTarget: null
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
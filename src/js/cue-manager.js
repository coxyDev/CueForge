class CueManager {
    constructor() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.standByCueId = null; // NEW: Which cue is ready for GO button
        this.lastGoTime = 0;
        this.goDebounceMs = 200;
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showFilePath = null;
        this.unsavedChanges = false;
        this.activeCues = new Map(); // cueId -> execution data
        this.singleCueMode = true;
        this.autoContinueEnabled = true;
        this.masterVolume = 1.0;
        
        this.listeners = {
            cueAdded: [],
            cueRemoved: [],
            cueUpdated: [],
            selectionChanged: [],
            playbackStateChanged: [],
            showChanged: [],
            volumeChanged: [],
            settingsChanged: [],
            playheadChanged: []  // NEW: playhead change events
        };
    }

    // ==================== PLAYHEAD MANAGEMENT ====================

    /**
     * Set which cue is "standing by" (ready for GO)
     * This is separate from selection
     */
    setStandByCue(cueId) {
        const oldStandBy = this.standByCueId;
        this.standByCueId = cueId;
        
        console.log(`Playhead moved to: ${cueId ? this.getCue(cueId)?.number : 'none'}`);
        
        // Emit playhead change event
        this.emit('playheadChanged', { 
            standByCueId: this.standByCueId,
            previousStandByCueId: oldStandBy
        });
    }

    /**
     * Get the cue that's currently "standing by"
     */
    getStandByCue() {
        return this.standByCueId ? this.getCue(this.standByCueId) : null;
    }

    /**
     * Move playhead to next cue in sequence
     */
    advancePlayhead() {
        const currentCue = this.getStandByCue();
        let nextCueId = null;
        
        if (currentCue) {
            const currentIndex = this.getCueIndex(currentCue.id);
            if (currentIndex + 1 < this.cues.length) {
                nextCueId = this.cues[currentIndex + 1].id;
            }
        } else if (this.cues.length > 0) {
            // No standby cue, start at beginning
            nextCueId = this.cues[0].id;
        }
        
        this.setStandByCue(nextCueId);
    }

    /**
     * QLab-style "Go To" cue functionality
     */
    goToCue(cueId) {
        const targetCue = this.getCue(cueId);
        if (!targetCue) {
            console.error(`Cannot go to cue: ${cueId} not found`);
            return false;
        }
        
        console.log(`Going to cue: ${targetCue.number} - ${targetCue.name}`);
        
        // Stop current playback if in single cue mode
        if (this.singleCueMode && this.isAnyThingPlaying()) {
            this.stop();
        }
        
        // Set as standing by and execute immediately
        this.setStandByCue(cueId);
        return this.go();
    }

    // ==================== ENHANCED GO METHOD ====================

    go() {
        const now = Date.now();
        
        // Debounce GO button
        if (now - this.lastGoTime < this.goDebounceMs) {
            console.log(`GO button debounced (${now - this.lastGoTime}ms since last press)`);
            return false;
        }
        this.lastGoTime = now;
        
        console.log('GO button pressed');
        
        // Handle resume
        if (this.isPaused) {
            console.log('Resuming playback');
            this.resume();
            return true;
        }

        // In single cue mode, if something is playing, stop it first
        if (this.singleCueMode && this.isAnyThingPlaying()) {
            console.log('Single cue mode: Stopping current playback');
            this.stop();
        }

        // Get the cue that's standing by, or find next cue
        let targetCue = this.getStandByCue();
        
        if (!targetCue) {
            // No cue standing by - use current logic to find next cue
            const nextCue = this.getNextCue();
            if (nextCue) {
                this.setStandByCue(nextCue.id);
                targetCue = nextCue;
            }
        }
        
        if (!targetCue) {
            console.log('No cue available to play');
            return false;
        }

        // Protection against double-execution
        if (this.isCueCurrentlyExecuting(targetCue.id)) {
            console.log(`Cue ${targetCue.number} is already executing, ignoring GO`);
            return false;
        }

        console.log(`Starting standing by cue: ${targetCue.number} - ${targetCue.name}`);
        
        // Execute the standing by cue
        const success = this.playCue(targetCue.id);
        
        if (success) {
            // Advance playhead to next cue for future GO presses
            this.advancePlayhead();
        }
        
        return success;
    }

    // ==================== ENHANCED CUE MANAGEMENT ====================

    addCue(type, options = {}, index = -1) {
        const cue = this.createCue(type, options);
        
        if (index === -1) {
            this.cues.push(cue);
        } else {
            this.cues.splice(index, 0, cue);
        }

        // If this is the first cue and nothing is standing by, make it stand by
        if (this.cues.length === 1 && !this.standByCueId) {
            this.setStandByCue(cue.id);
        }

        this.markUnsaved();
        this.emit('cueAdded', { cue, index: index === -1 ? this.cues.length - 1 : index });
        return cue;
    }

    removeCue(cueId) {
        const index = this.cues.findIndex(cue => cue.id === cueId);
        if (index === -1) return false;

        const cue = this.cues[index];
        
        // Stop the cue if it's currently playing
        this.stopSpecificCue(cueId, false);
        
        this.cues.splice(index, 1);

        // Update any auto-follow targets that pointed to this cue
        this.cues.forEach(c => {
            if (c.autoFollowTarget === cueId) {
                c.autoFollowTarget = null;
                c.autoContinue = false;
            }
        });

        // Clear playhead if removed cue was standing by
        if (this.standByCueId === cueId) {
            // Move to next cue or clear
            if (index < this.cues.length) {
                this.setStandByCue(this.cues[index].id);
            } else if (index > 0) {
                this.setStandByCue(this.cues[index - 1].id);
            } else {
                this.setStandByCue(null);
            }
        }

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

    // ==================== EXISTING METHODS (Fixed semicolons) ====================

    createCue(type, options = {}) {
        const id = generateUUID();
        const number = this.getNextCueNumber();
        
        const baseCue = {
            id: id,
            number: number,
            name: options.name || `${type} ${number}`,
            type: type,
            status: 'loaded',
            duration: 0,
            volume: 1.0,
            autoContinue: false,
            postWait: 0,
            ...options
        };

        // Type-specific defaults
        switch (type) {
            case 'audio':
                baseCue.duration = 0; // Will be set when file is loaded
                baseCue.fadeIn = 0;
                baseCue.fadeOut = 0;
                baseCue.startTime = 0;
                baseCue.endTime = 0;
                baseCue.loop = false;
                baseCue.filePath = '';
                break;
                
            case 'video':
                baseCue.duration = 0; // Will be set when file is loaded
                baseCue.fadeIn = 0;
                baseCue.fadeOut = 0;
                baseCue.opacity = 1.0;
                baseCue.aspectRatio = 'auto';
                baseCue.fullscreen = false;
                baseCue.loop = false;
                baseCue.filePath = '';
                break;
                
            case 'wait':
                baseCue.duration = options.duration || 5000; // 5 seconds default
                break;
                
            case 'group':
                baseCue.mode = options.mode || 'sequential';
                baseCue.children = [];
                break;
        }

        return baseCue;
    }

    getNextCueNumber() {
        if (this.cues.length === 0) return '1';
        
        // Find the highest numeric cue number
        let highestNumber = 0;
        this.cues.forEach(cue => {
            const num = parseFloat(cue.number);
            if (!isNaN(num) && num > highestNumber) {
                highestNumber = num;
            }
        });
        
        return (highestNumber + 1).toString();
    }

    getCue(cueId) {
        return this.cues.find(cue => cue.id === cueId);
    }

    getCueIndex(cueId) {
        return this.cues.findIndex(cue => cue.id === cueId);
    }

    updateCue(cueId, updates) {
        const cue = this.getCue(cueId);
        if (!cue) return false;
        
        Object.assign(cue, updates);
        this.markUnsaved();
        this.emit('cueUpdated', { cue, updates });
        return true;
    }

    selectCue(cueId) {
        if (this.selectedCueId !== cueId) {
            this.selectedCueId = cueId;
            this.emit('selectionChanged', { selectedCueId: cueId });
        }
    }

    getSelectedCue() {
        return this.selectedCueId ? this.getCue(this.selectedCueId) : null;
    }

    playCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) {
            console.error(`Cannot play cue: ${cueId} not found`);
            return false;
        }

        console.log(`Playing cue: ${cue.number} - ${cue.name}`);
        
        // Mark cue as executing
        cue.status = 'loading';
        this.emit('cueUpdated', { cue });

        // Execute based on cue type
        switch (cue.type) {
            case 'audio':
                this.executeAudioCue(cue);
                break;
            case 'video':
                this.executeVideoCue(cue);
                break;
            case 'wait':
                this.executeWaitCue(cue);
                break;
            case 'group':
                this.executeGroupCue(cue);
                break;
            default:
                console.warn(`Unknown cue type: ${cue.type}`);
                return false;
        }

        this.currentCueIndex = this.getCueIndex(cueId);
        this.emit('playbackStateChanged', { activeCues: this.getActiveCues() });
        return true;
    }

    executeAudioCue(cue) {
        cue.status = 'playing';
        
        const executionData = {
            startTime: Date.now(),
            type: 'audio'
        };
        
        this.activeCues.set(cue.id, executionData);
        
        // Simulate audio playback
        setTimeout(() => {
            this.completeCue(cue.id);
        }, cue.duration || 5000);
        
        this.emit('cueUpdated', { cue });
    }

    executeVideoCue(cue) {
        cue.status = 'playing';
        
        const executionData = {
            startTime: Date.now(),
            type: 'video'
        };
        
        this.activeCues.set(cue.id, executionData);
        
        // Simulate video playback
        setTimeout(() => {
            this.completeCue(cue.id);
        }, cue.duration || 10000);
        
        this.emit('cueUpdated', { cue });
    }

    executeWaitCue(cue) {
        cue.status = 'playing';
        
        const executionData = {
            startTime: Date.now(),
            type: 'wait'
        };
        
        this.activeCues.set(cue.id, executionData);
        
        // Wait for specified duration
        setTimeout(() => {
            this.completeCue(cue.id);
        }, cue.duration);
        
        this.emit('cueUpdated', { cue });
    }

    executeGroupCue(cue) {
        cue.status = 'playing';
        
        const executionData = {
            startTime: Date.now(),
            type: 'group'
        };
        
        this.activeCues.set(cue.id, executionData);
        
        // For now, just mark as complete immediately
        // Real implementation would handle child cues
        setTimeout(() => {
            this.completeCue(cue.id);
        }, 1000);
        
        this.emit('cueUpdated', { cue });
    }

    completeCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) return;

        cue.status = 'loaded';
        this.activeCues.delete(cueId);
        
        console.log(`Cue completed: ${cue.number} - ${cue.name}`);
        
        // Handle auto-continue
        if (cue.autoContinue && this.autoContinueEnabled) {
            const nextCue = this.getNextCue(cueId);
            if (nextCue) {
                console.log(`Auto-continuing to cue: ${nextCue.number}`);
                setTimeout(() => {
                    this.playCue(nextCue.id);
                }, cue.postWait || 0);
            }
        }
        
        this.emit('cueUpdated', { cue });
        this.emit('playbackStateChanged', { activeCues: this.getActiveCues() });
    }

    getNextCue(fromCueId = null) {
        if (fromCueId) {
            const currentIndex = this.getCueIndex(fromCueId);
            if (currentIndex >= 0 && currentIndex < this.cues.length - 1) {
                return this.cues[currentIndex + 1];
            }
        } else if (this.currentCueIndex < this.cues.length - 1) {
            return this.cues[this.currentCueIndex + 1];
        }
        return null;
    }

    stop() {
        console.log('Stopping all cues');
        
        // Stop all active cues
        for (const cueId of this.activeCues.keys()) {
            this.stopSpecificCue(cueId);
        }
        
        this.isPaused = false;
        this.emit('playbackStateChanged', { activeCues: this.getActiveCues() });
    }

    stopSpecificCue(cueId, updatePlaybackState = true) {
        const cue = this.getCue(cueId);
        if (!cue) return false;

        console.log(`Stopping cue: ${cue.number} - ${cue.name}`);
        
        cue.status = 'loaded';
        this.activeCues.delete(cueId);
        
        this.emit('cueUpdated', { cue });
        
        if (updatePlaybackState) {
            this.emit('playbackStateChanged', { activeCues: this.getActiveCues() });
        }
        
        return true;
    }

    pause() {
        console.log('Pausing playback');
        this.isPaused = !this.isPaused;
        
        // Update status of all active cues
        for (const cueId of this.activeCues.keys()) {
            const cue = this.getCue(cueId);
            if (cue) {
                cue.status = this.isPaused ? 'paused' : 'playing';
                this.emit('cueUpdated', { cue });
            }
        }
        
        this.emit('playbackStateChanged', { 
            activeCues: this.getActiveCues(),
            isPaused: this.isPaused 
        });
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            
            // Update status of all paused cues
            for (const cueId of this.activeCues.keys()) {
                const cue = this.getCue(cueId);
                if (cue && cue.status === 'paused') {
                    cue.status = 'playing';
                    this.emit('cueUpdated', { cue });
                }
            }
            
            this.emit('playbackStateChanged', { 
                activeCues: this.getActiveCues(),
                isPaused: this.isPaused 
            });
        }
    }

    isCueCurrentlyExecuting(cueId) {
        return this.activeCues.has(cueId);
    }

    isAnyThingPlaying() {
        return this.activeCues.size > 0;
    }

    hasActiveCues() {
        return this.activeCues.size > 0;
    }

    getActiveCues() {
        return Array.from(this.activeCues.keys());
    }

    // Settings management
    setSingleCueMode(enabled) {
        this.singleCueMode = enabled;
        this.emit('settingsChanged', { singleCueMode: enabled });
    }

    getSingleCueMode() {
        return this.singleCueMode;
    }

    setAutoContinueEnabled(enabled) {
        this.autoContinueEnabled = enabled;
        this.emit('settingsChanged', { autoContinueEnabled: enabled });
    }

    getAutoContinueEnabled() {
        return this.autoContinueEnabled;
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.emit('volumeChanged', { masterVolume: this.masterVolume });
    }

    getMasterVolume() {
        return this.masterVolume;
    }

    // File operations
    newShow() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.standByCueId = null; // Clear playhead
        this.activeCues.clear();
        this.showName = 'Untitled Show';
        this.showFilePath = null;
        this.unsavedChanges = false;
        this.isPaused = false;
        
        this.emit('showChanged', { showName: this.showName });
        this.emit('playbackStateChanged', { activeCues: [] });
    }

    async saveShow() {
        if (!this.showFilePath) {
            return await this.saveShowAs();
        }
        
        try {
            const showData = this.exportShowData();
            
            if (window.fs && window.fs.writeFile) {
                await window.fs.writeFile(this.showFilePath, JSON.stringify(showData, null, 2));
                this.unsavedChanges = false;
                console.log(`Show saved: ${this.showFilePath}`);
                return true;
            } else {
                throw new Error('File system not available');
            }
        } catch (error) {
            console.error('Failed to save show:', error);
            throw error;
        }
    }

    async saveShowAs() {
        try {
            if (!window.qlabAPI || !window.qlabAPI.saveShow) {
                throw new Error('Save API not available');
            }
            
            const showData = this.exportShowData();
            const result = await window.qlabAPI.saveShow(showData);
            
            if (result.success) {
                this.showFilePath = result.filePath;
                this.showName = window.electronAPI.path.basename(result.filePath, '.crfg');
                this.unsavedChanges = false;
                
                this.emit('showChanged', { showName: this.showName });
                console.log(`Show saved as: ${result.filePath}`);
                return true;
            } else {
                throw new Error(result.error || 'Save failed');
            }
        } catch (error) {
            console.error('Failed to save show as:', error);
            throw error;
        }
    }

    async loadShow(filePath) {
        try {
            if (!window.qlabAPI || !window.qlabAPI.loadShow) {
                throw new Error('Load API not available');
            }
            
            const result = await window.qlabAPI.loadShow(filePath);
            
            if (result.success) {
                this.importShowData(result.data);
                this.showFilePath = filePath;
                this.showName = window.electronAPI.path.basename(filePath, '.crfg');
                this.unsavedChanges = false;
                
                // Set first cue as standing by if none set
                if (this.cues.length > 0 && !this.standByCueId) {
                    this.setStandByCue(this.cues[0].id);
                }
                
                this.emit('showChanged', { showName: this.showName });
                console.log(`Show loaded: ${filePath}`);
                return true;
            } else {
                throw new Error(result.error || 'Load failed');
            }
        } catch (error) {
            console.error('Failed to load show:', error);
            throw error;
        }
    }

    exportShowData() {
        return {
            version: '1.0',
            name: this.showName,
            created: new Date().toISOString(),
            cues: this.cues,
            settings: {
                singleCueMode: this.singleCueMode,
                autoContinueEnabled: this.autoContinueEnabled,
                masterVolume: this.masterVolume,
                currentCueIndex: this.currentCueIndex,
                standByCueId: this.standByCueId // Save playhead position
            }
        };
    }

    importShowData(data) {
        this.cues = data.cues || [];
        this.singleCueMode = data.settings?.singleCueMode ?? true;
        this.autoContinueEnabled = data.settings?.autoContinueEnabled ?? true;
        this.masterVolume = data.settings?.masterVolume ?? 1.0;
        this.currentCueIndex = data.settings?.currentCueIndex ?? -1;
        this.standByCueId = data.settings?.standByCueId || null; // Restore playhead position
        this.selectedCueId = null;
        this.activeCues.clear();
        this.isPaused = false;
        
        // Validate standby cue exists
        if (this.standByCueId && !this.getCue(this.standByCueId)) {
            this.standByCueId = null;
        }
    }

    markUnsaved() {
        if (!this.unsavedChanges) {
            this.unsavedChanges = true;
            this.emit('showChanged', { showName: this.showName, unsavedChanges: true });
        }
    }

    // Event system
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Statistics
    getCueStats() {
        const stats = {
            total: this.cues.length,
            active: this.activeCues.size,
            types: {}
        };
        
        this.cues.forEach(cue => {
            stats.types[cue.type] = (stats.types[cue.type] || 0) + 1;
        });
        
        return stats;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CueManager;
} else {
    window.CueManager = CueManager;
}
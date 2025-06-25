// UUID v4 generator function - replaces the require('uuid') dependency
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

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
        this.autoContinueEnabled = true;
        this.singleCueMode = true; // Prevent multiple cues from playing simultaneously
        
        // Track what's currently executing to prevent double-triggers
        this.executingCues = new Set(); // Set of cue IDs currently being executed
        this.lastGoTime = 0; // Timestamp of last GO button press
        this.goDebounceMs = 250; // Minimum time between GO presses
        
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

    // Settings getters and setters
    getSingleCueMode() {
        return this.singleCueMode;
    }

    setSingleCueMode(enabled) {
        this.singleCueMode = enabled;
        this.emit('settingsChanged', { singleCueMode: this.singleCueMode });
        console.log(`Single cue mode: ${enabled ? 'enabled' : 'disabled'}`);
        
        // If enabling single cue mode and multiple cues are playing, stop all but the most recent
        if (enabled && this.getPlayingCues().length > 1) {
            console.log('Single cue mode enabled - stopping overlapping cues');
            this.stopOverlappingCues();
        }
    }

    getAutoContinueEnabled() {
        return this.autoContinueEnabled;
    }

    setAutoContinueEnabled(enabled) {
        this.autoContinueEnabled = enabled;
        this.emit('settingsChanged', { autoContinueEnabled: this.autoContinueEnabled });
        console.log(`Auto-continue: ${enabled ? 'enabled' : 'disabled'}`);
        
        // If disabling auto-continue, clear any pending timeouts
        if (!enabled) {
            this.clearAllAutoContinueTimeouts();
        }
    }

    // Master Volume Control
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        if (window.audioEngine) {
            window.audioEngine.setMasterVolume(this.masterVolume);
        }
        
        this.emit('volumeChanged', { masterVolume: this.masterVolume });
        console.log(`Master volume set to: ${Math.round(this.masterVolume * 100)}%`);
    }

    getMasterVolume() {
        return this.masterVolume;
    }

    // Helper methods for playback state management
    getPlayingCues() {
        return this.cues.filter(cue => cue.status === 'playing');
    }

    getExecutingCues() {
        return Array.from(this.executingCues);
    }

    isAnyThingPlaying() {
        return this.getPlayingCues().length > 0 || this.executingCues.size > 0;
    }

    isCueCurrentlyExecuting(cueId) {
        return this.executingCues.has(cueId);
    }

    // Enhanced GO button with debouncing and single cue mode protection
    go() {
        const now = Date.now();
        
        // Debounce GO button to prevent accidental double-presses
        if (now - this.lastGoTime < this.goDebounceMs) {
            console.log(`GO button debounced (${now - this.lastGoTime}ms since last press)`);
            return;
        }
        this.lastGoTime = now;
        
        console.log('GO button pressed');
        
        if (this.isPaused) {
            console.log('Resuming playback');
            this.resume();
            return;
        }

        // In single cue mode, if something is already playing, don't start another cue
        if (this.singleCueMode && this.isAnyThingPlaying()) {
            console.log('Single cue mode: Something is already playing, ignoring GO');
            return;
        }

        const nextCue = this.getNextCue();
        if (nextCue) {
            // Additional protection: don't start a cue that's already executing
            if (this.isCueCurrentlyExecuting(nextCue.id)) {
                console.log(`Cue ${nextCue.number} is already executing, ignoring GO`);
                return;
            }
            
            console.log(`Playing next cue: ${nextCue.name} (${nextCue.type})`);
            this.playCue(nextCue.id);
        } else {
            console.log('No more cues to play');
            
            // If we're at the end, start from the beginning
            if (this.cues.length > 0) {
                this.currentCueIndex = -1;
                const firstCue = this.cues[0];
                
                // Don't restart if the first cue is already executing
                if (this.isCueCurrentlyExecuting(firstCue.id)) {
                    console.log(`First cue ${firstCue.number} is already executing, not restarting`);
                    return;
                }
                
                console.log(`Starting from beginning: ${firstCue.name}`);
                this.playCue(firstCue.id);
            }
        }
    }

    // Enhanced STOP functionality - stops EVERYTHING
    stop() {
        console.log('STOP button pressed - stopping ALL cues');
        
        this.isPlaying = false;
        this.isPaused = false;
        
        // Clear any pending auto-continue timeouts
        this.clearAllAutoContinueTimeouts();
        
        // Clear executing cues set
        this.executingCues.clear();
        
        // Stop all cues regardless of their current state
        this.cues.forEach(cue => {
            if (cue.status === 'playing' || cue.status === 'loading') {
                cue.status = 'ready';
                console.log(`Stopping cue: ${cue.number} - ${cue.name}`);
                
                // Stop engines for this specific cue
                if (window.audioEngine && cue.type === 'audio') {
                    window.audioEngine.stopCue(cue.id);
                }
                if (window.videoEngine && cue.type === 'video') {
                    window.videoEngine.stopCue(cue.id);
                }
                if (window.displayManager && cue.type === 'video') {
                    window.displayManager.stopVideoOnOutput(cue.id);
                }
            }
        });

        // Global stop on all engines (belt and suspenders approach)
        if (window.audioEngine) {
            window.audioEngine.stopAllCues();
        }
        if (window.videoEngine) {
            window.videoEngine.stopAllCues();
        }
        if (window.displayManager) {
            window.displayManager.clearAllDisplays();
        }

        console.log('All cues stopped');
        this.emit('playbackStateChanged', { 
            isPlaying: false, 
            isPaused: false,
            currentCueIndex: this.currentCueIndex,
            stoppedAll: true
        });
    }

    // Stop overlapping cues when single cue mode is enabled
    stopOverlappingCues() {
        const playingCues = this.getPlayingCues();
        
        if (playingCues.length <= 1) return;
        
        // Keep the most recently started cue, stop the others
        const sortedByStart = playingCues.sort((a, b) => {
            // If we don't have start times, keep the one with the higher current index
            const aIndex = this.getCueIndex(a.id);
            const bIndex = this.getCueIndex(b.id);
            return bIndex - aIndex; // Reverse order - higher index first
        });
        
        // Stop all but the first (most recent)
        for (let i = 1; i < sortedByStart.length; i++) {
            const cue = sortedByStart[i];
            console.log(`Stopping overlapping cue: ${cue.number} - ${cue.name}`);
            this.stopSpecificCue(cue.id, false); // Don't emit global stop event
        }
    }

    // Stop a specific cue without affecting others
    stopSpecificCue(cueId, emitEvent = true) {
        const cue = this.getCue(cueId);
        if (!cue) return;
        
        console.log(`Stopping specific cue: ${cue.number} - ${cue.name}`);
        
        // Remove from executing set
        this.executingCues.delete(cueId);
        
        // Update cue status
        if (cue.status === 'playing' || cue.status === 'loading') {
            cue.status = 'ready';
            
            // Stop engines for this specific cue
            if (window.audioEngine && cue.type === 'audio') {
                window.audioEngine.stopCue(cue.id);
            }
            if (window.videoEngine && cue.type === 'video') {
                window.videoEngine.stopCue(cue.id);
            }
            if (window.displayManager && cue.type === 'video') {
                window.displayManager.stopVideoOnOutput(cue.id);
            }
            
            if (emitEvent) {
                this.emit('cueUpdated', { cue });
            }
        }
    }

    pause() {
        console.log('Pause button pressed');
        if (this.isPlaying) {
            this.isPaused = true;
            this.isPlaying = false;
            
            // Clear any pending auto-continue timeouts
            this.clearAllAutoContinueTimeouts();
            
            // Pause all currently playing cues
            this.cues.forEach(cue => {
                if (cue.status === 'playing') {
                    if (window.audioEngine && cue.type === 'audio') {
                        window.audioEngine.pauseCue(cue.id);
                    }
                    if (window.videoEngine && cue.type === 'video') {
                        window.videoEngine.pauseCue(cue.id);
                    }
                }
            });
            
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
            
            // Resume all paused cues
            this.cues.forEach(cue => {
                if (cue.status === 'playing') {
                    if (window.audioEngine && cue.type === 'audio') {
                        window.audioEngine.resumeCue(cue.id);
                    }
                    if (window.videoEngine && cue.type === 'video') {
                        window.videoEngine.resumeCue(cue.id);
                    }
                }
            });
            
            this.emit('playbackStateChanged', { 
                isPlaying: true, 
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

        // Protection against double-execution
        if (this.isCueCurrentlyExecuting(cueId)) {
            console.log(`Cue ${cue.number} is already executing, ignoring play request`);
            return false;
        }

        // In single cue mode, check if we should stop other cues
        if (this.singleCueMode) {
            const playingCues = this.getPlayingCues();
            if (playingCues.length > 0) {
                console.log('Single cue mode: Stopping currently playing cues');
                playingCues.forEach(playingCue => {
                    if (playingCue.id !== cueId) {
                        this.stopSpecificCue(playingCue.id, false);
                    }
                });
            }
        }

        console.log(`Playing cue: ${cue.name} (${cue.type})`);

        // Add to executing set immediately
        this.executingCues.add(cueId);

        const cueIndex = this.getCueIndex(cueId);
        this.currentCueIndex = cueIndex;
        this.isPlaying = true;
        this.isPaused = false;

        cue.status = 'loading'; // Set to loading first
        
        this.emit('playbackStateChanged', { 
            isPlaying: true, 
            isPaused: false,
            currentCueIndex: this.currentCueIndex,
            currentCue: cue
        });

        try {
            cue.status = 'playing';
            this.emit('cueUpdated', { cue });
            
            await this.executeCue(cue);
            this.onCueFinished(cue);
        } catch (error) {
            this.onCueError(cue, error);
        } finally {
            // Always remove from executing set when done
            this.executingCues.delete(cueId);
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
        this.executingCues.delete(cue.id);
        this.emit('cueUpdated', { cue });

        // Check for auto-continue
        if (cue.autoContinue && this.autoContinueEnabled && !this.isPaused) {
            this.scheduleAutoContinue(cue);
        } else {
            // Check if any other cues are still playing
            const stillPlaying = this.getPlayingCues().length > 0 || this.executingCues.size > 0;
            
            if (!stillPlaying) {
                // Nothing else playing - stop playback
                this.isPlaying = false;
                this.emit('playbackStateChanged', { 
                    isPlaying: false, 
                    isPaused: false,
                    currentCueIndex: this.currentCueIndex 
                });
            }
        }
    }

    onCueError(cue, error) {
        console.error(`Cue ${cue.number} error:`, error);
        cue.status = 'error';
        this.executingCues.delete(cue.id);
        this.emit('cueUpdated', { cue, error });
        
        // Check if any other cues are still playing
        const stillPlaying = this.getPlayingCues().length > 0 || this.executingCues.size > 0;
        
        if (!stillPlaying) {
            this.isPlaying = false;
            this.emit('playbackStateChanged', { 
                isPlaying: false, 
                isPaused: false,
                currentCueIndex: this.currentCueIndex,
                error: error.message
            });
        }
    }

    getNextCue() {
        const nextIndex = this.currentCueIndex + 1;
        if (nextIndex < this.cues.length) {
            return this.cues[nextIndex];
        }
        return null;
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
            // Check if target cue is already executing
            if (this.isCueCurrentlyExecuting(targetCue.id)) {
                console.log(`Auto-continue target ${targetCue.number} is already executing, skipping`);
                return;
            }
            
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

    // Rest of the CueManager methods (creation, management, etc.)
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
            autoContinue: false,
            autoFollowTarget: null,
            continueDelay: 0,
            
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
                    autoContinue: true
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
        
        const numbers = this.cues.map(cue => {
            const num = parseFloat(cue.number);
            return isNaN(num) ? 0 : num;
        });
        
        const maxNumber = Math.max(...numbers, 0);
        return String(Math.floor(maxNumber) + 1);
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
        
        // Stop the cue if it's currently playing or executing
        this.stopSpecificCue(cueId, false);
        
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

    // Show management
    newShow() {
        // Stop everything first
        this.stop();
        
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showPath = null;
        this.unsavedChanges = false;
        this.masterVolume = 1.0;
        this.executingCues.clear();
        this.clearAllAutoContinueTimeouts();

        this.emit('showChanged', { showName: this.showName });
        this.emit('volumeChanged', { masterVolume: this.masterVolume });
    }

    async saveShow(filePath = null) {
        const showData = {
            name: this.showName,
            version: '1.2',
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
                const result = await window.qlabAPI.saveShow(showData);
                
                if (result.success) {
                    this.showPath = result.filePath;
                    this.showName = window.electronAPI.path.basename(this.showPath, '.qlab');
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
            // Stop everything first
            this.stop();
            
            const result = await window.qlabAPI.loadShow(filePath);
            
            if (result.success) {
                const showData = result.data;
                
                this.cues = showData.cues || [];
                this.currentCueIndex = showData.settings?.currentCueIndex || -1;
                this.masterVolume = showData.settings?.masterVolume || 1.0;
                this.autoContinueEnabled = showData.settings?.autoContinueEnabled !== false;
                this.singleCueMode = showData.settings?.singleCueMode !== false;
                this.showName = showData.name || window.electronAPI.path.basename(filePath, '.qlab');
                this.showPath = filePath;
                this.selectedCueId = null;
                this.isPlaying = false;
                this.isPaused = false;
                this.unsavedChanges = false;
                this.executingCues.clear();
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
            loading: this.cues.filter(cue => cue.status === 'loading').length,
            error: this.cues.filter(cue => cue.status === 'error').length,
            autoContinue: this.cues.filter(cue => cue.autoContinue).length,
            executing: this.executingCues.size
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
            autoContinue: false,
            autoFollowTarget: null,
            status: 'ready' // Always start as ready
        };

        this.cues.splice(index + 1, 0, duplicatedCue);
        this.markUnsaved();
        this.emit('cueAdded', { cue: duplicatedCue, index: index + 1 });
        return duplicatedCue;
    }

    // Debug methods for monitoring state
    getDebugInfo() {
        return {
            playingCues: this.getPlayingCues().map(c => `${c.number}: ${c.name}`),
            executingCues: Array.from(this.executingCues),
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            singleCueMode: this.singleCueMode,
            autoContinueEnabled: this.autoContinueEnabled,
            currentCueIndex: this.currentCueIndex,
            lastGoTime: this.lastGoTime,
            autoContinueTimeouts: this.autoContinueTimeouts.size
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CueManager;
} else {
    window.CueManager = CueManager;
}
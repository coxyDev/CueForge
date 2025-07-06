/**
 * Enhanced Cue Manager with Complete Targeting System
 * Implements QLab-style cue targeting for professional show control
 */

class CueManager {
    constructor() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.standByCueId = null; // Which cue is ready for GO button
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
            playheadChanged: []
        };

        // 🎯 NEW: Cue type definitions with targeting requirements
        this.cueTypeDefinitions = {
            // No target required
            'wait': { requiresTarget: false, targetType: 'none', defaultName: 'wait' },
            'memo': { requiresTarget: false, targetType: 'none', defaultName: 'memo' },
            'group': { requiresTarget: false, targetType: 'none', defaultName: 'group' },
            
            // File targets
            'audio': { requiresTarget: true, targetType: 'file', acceptedFormats: ['mp3', 'wav', 'aiff', 'caf', 'm4a', 'aac'], defaultName: 'audio' },
            'video': { requiresTarget: true, targetType: 'file', acceptedFormats: ['mov', 'mp4', 'm4v', 'avi'], defaultName: 'video' },
            
            // Cue targets - Control cues
            'start': { requiresTarget: true, targetType: 'cue', acceptedCueTypes: ['any'], defaultName: 'start' },
            'stop': { requiresTarget: true, targetType: 'cue', acceptedCueTypes: ['any'], defaultName: 'stop' },
            'pause': { requiresTarget: true, targetType: 'cue', acceptedCueTypes: ['any'], defaultName: 'pause' },
            'goto': { requiresTarget: true, targetType: 'cue', acceptedCueTypes: ['any'], defaultName: 'go to' },
            'fade': { requiresTarget: true, targetType: 'cue', acceptedCueTypes: ['audio', 'video', 'group'], defaultName: 'fade' },
            'load': { requiresTarget: true, targetType: 'cue', acceptedCueTypes: ['any'], defaultName: 'load' },
            'reset': { requiresTarget: true, targetType: 'cue', acceptedCueTypes: ['any'], defaultName: 'reset' }
        };
    }

    // ==================== PLAYHEAD MANAGEMENT ====================

    /**
     * Set which cue is "standing by" (ready for GO)
     */
    setStandByCue(cueId) {
        const oldStandBy = this.standByCueId;
        this.standByCueId = cueId;
        
        console.log(`Playhead moved to: ${cueId ? this.getCue(cueId)?.number : 'none'}`);
        
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
        
        if (this.singleCueMode && this.isAnyThingPlaying()) {
            this.stop();
        }
        
        this.setStandByCue(cueId);
        return this.go();
    }

    // ==================== ENHANCED CUE CREATION WITH TARGETING ====================

    /**
     * Create a new cue with proper targeting support
     */
    createCue(type, options = {}) {
        const id = generateUUID();
        const number = this.getNextCueNumber();
        const definition = this.cueTypeDefinitions[type];
        
        if (!definition) {
            throw new Error(`Unknown cue type: ${type}`);
        }

        // Build default name based on type and target
        let defaultName = `${definition.defaultName} ${number}`;
        if (options.targetCueId && definition.targetType === 'cue') {
            const targetCue = this.getCue(options.targetCueId);
            if (targetCue) {
                defaultName = `${definition.defaultName} ${targetCue.number}`;
            }
        }
        
        const baseCue = {
            id: id,
            number: number,
            name: options.name || defaultName,
            type: type,
            status: 'loaded',
            duration: 0,
            volume: 1.0,
            autoContinue: false,
            postWait: 0,
            preWait: 0,
            
            // 🎯 NEW: Targeting properties
            target: null, // The actual target (file path, cue ID, etc.)
            targetType: definition.targetType, // 'file', 'cue', or 'none'
            requiresTarget: definition.requiresTarget,
            isBroken: definition.requiresTarget, // Broken until target is set
            
            // Additional properties
            notes: '',
            color: null,
            armed: true,
            flagged: false,
            
            ...options
        };

        // Type-specific defaults
        switch (type) {
            case 'audio':
                Object.assign(baseCue, {
                    duration: 0, // Will be set when file is loaded
                    fadeIn: 0,
                    fadeOut: 0,
                    startTime: 0,
                    endTime: 0,
                    loop: false,
                    targetFile: null
                });
                break;
                
            case 'video':
                Object.assign(baseCue, {
                    duration: 0, // Will be set when file is loaded
                    fadeIn: 0,
                    fadeOut: 0,
                    opacity: 1.0,
                    aspectRatio: 'auto',
                    fullscreen: false,
                    loop: false,
                    targetFile: null
                });
                break;
                
            case 'wait':
                Object.assign(baseCue, {
                    duration: 5000, // 5 seconds default
                    isBroken: false // Wait cues don't need targets
                });
                break;
                
            case 'group':
                Object.assign(baseCue, {
                    mode: 'playlist', // 'playlist', 'start_first', 'start_random'
                    children: [],
                    crossfade: false,
                    loop: false,
                    isBroken: false // Group cues don't need targets
                });
                break;

            case 'start':
            case 'stop':
            case 'pause':
            case 'goto':
            case 'load':
            case 'reset':
                Object.assign(baseCue, {
                    duration: 0, // Instantaneous action
                    targetCueId: options.targetCueId || null
                });
                break;

            case 'fade':
                Object.assign(baseCue, {
                    duration: 5000, // 5 second default fade
                    targetCueId: options.targetCueId || null,
                    fadeType: 'absolute', // 'absolute' or 'relative'
                    targetParameter: 'volume', // What to fade
                    targetValue: 0.0 // Target fade value
                });
                break;
        }

        // Set target if provided in options
        if (options.targetCueId && definition.targetType === 'cue') {
            this.setCueTarget(baseCue, options.targetCueId);
        }

        return baseCue;
    }

    // ==================== TARGET MANAGEMENT SYSTEM ====================

    /**
     * Set a file target for a cue (Audio, Video, etc.)
     */
    setFileTarget(cueId, filePath, fileName = null) {
        const cue = this.getCue(cueId);
        if (!cue) return false;

        const definition = this.cueTypeDefinitions[cue.type];
        if (!definition || definition.targetType !== 'file') {
            console.error(`Cue type ${cue.type} does not accept file targets`);
            return false;
        }

        // Validate file format
        const extension = filePath.split('.').pop().toLowerCase();
        if (!definition.acceptedFormats.includes(extension)) {
            console.error(`File format .${extension} not supported for ${cue.type} cues`);
            return false;
        }

        cue.target = filePath;
        cue.targetFile = filePath;
        cue.isBroken = false;

        // Update cue name if using default name
        if (fileName && this.isDefaultName(cue)) {
            cue.name = fileName;
        }

        console.log(`Set file target for cue ${cue.number}: ${filePath}`);
        this.markUnsaved();
        this.emit('cueUpdated', { cue });
        return true;
    }

    /**
     * Set a cue target for a cue (Start, Stop, Fade, etc.)
     */
    setCueTarget(cue, targetCueId) {
        if (typeof cue === 'string') {
            cue = this.getCue(cue);
        }
        if (!cue) return false;

        const definition = this.cueTypeDefinitions[cue.type];
        if (!definition || definition.targetType !== 'cue') {
            console.error(`Cue type ${cue.type} does not accept cue targets`);
            return false;
        }

        const targetCue = this.getCue(targetCueId);
        if (!targetCue) {
            console.error(`Target cue ${targetCueId} not found`);
            return false;
        }

        // Validate target cue type
        const acceptedTypes = definition.acceptedCueTypes;
        if (!acceptedTypes.includes('any') && !acceptedTypes.includes(targetCue.type)) {
            console.error(`Cue type ${cue.type} cannot target ${targetCue.type} cues`);
            return false;
        }

        cue.target = targetCueId;
        cue.targetCueId = targetCueId;
        cue.isBroken = false;

        // Update cue name if using default name
        if (this.isDefaultName(cue)) {
            const targetName = targetCue.number ? targetCue.number : targetCue.name;
            cue.name = `${definition.defaultName} ${targetName}`;
        }

        console.log(`Set cue target for cue ${cue.number}: ${targetCue.number}`);
        this.markUnsaved();
        this.emit('cueUpdated', { cue });
        return true;
    }

    /**
     * Clear the target for a cue
     */
    clearTarget(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) return false;

        cue.target = null;
        cue.targetFile = null;
        cue.targetCueId = null;
        cue.isBroken = cue.requiresTarget;

        // Reset to default name
        const definition = this.cueTypeDefinitions[cue.type];
        if (definition) {
            cue.name = `${definition.defaultName} ${cue.number}`;
        }

        console.log(`Cleared target for cue ${cue.number}`);
        this.markUnsaved();
        this.emit('cueUpdated', { cue });
        return true;
    }

    /**
     * Get target display text for UI
     */
    getTargetDisplayText(cue) {
        if (!cue.requiresTarget) {
            return ''; // No target needed
        }

        if (!cue.target) {
            return '?'; // Missing target
        }

        if (cue.targetType === 'file') {
            // Show filename for file targets
            const fileName = cue.target.split('/').pop().split('\\').pop();
            return fileName || cue.target;
        }

        if (cue.targetType === 'cue') {
            // Show target cue number or name
            const targetCue = this.getCue(cue.target);
            if (targetCue) {
                return targetCue.number ? targetCue.number.toString() : targetCue.name;
            } else {
                // Target cue was deleted
                cue.isBroken = true;
                return '⚠ Missing';
            }
        }

        return cue.target;
    }

    /**
     * Check if cue is using its default name
     */
    isDefaultName(cue) {
        const definition = this.cueTypeDefinitions[cue.type];
        if (!definition) return false;

        const defaultPattern = new RegExp(`^${definition.defaultName}\\s+(\\d+|.+)$`);
        return defaultPattern.test(cue.name);
    }

    /**
     * Update all cues that target a renamed cue
     */
    updateTargetingCueNames(updatedCue) {
        this.cues.forEach(cue => {
            if (cue.targetCueId === updatedCue.id && this.isDefaultName(cue)) {
                const definition = this.cueTypeDefinitions[cue.type];
                if (definition) {
                    const targetName = updatedCue.number ? updatedCue.number : updatedCue.name;
                    cue.name = `${definition.defaultName} ${targetName}`;
                    this.emit('cueUpdated', { cue });
                }
            }
        });
    }

    // ==================== ENHANCED GO METHOD ====================

    go() {
        const now = Date.now();
        
        if (now - this.lastGoTime < this.goDebounceMs) {
            console.log(`GO button debounced (${now - this.lastGoTime}ms since last press)`);
            return false;
        }
        this.lastGoTime = now;
        
        console.log('GO button pressed');
        
        if (this.isPaused) {
            console.log('Resuming playback');
            this.resume();
            return true;
        }

        if (this.singleCueMode && this.isAnyThingPlaying()) {
            console.log('Single cue mode: Stopping current playback');
            this.stop();
        }

        let targetCue = this.getStandByCue();
        
        if (!targetCue) {
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

        if (this.isCueCurrentlyExecuting(targetCue.id)) {
            console.log(`Cue ${targetCue.number} is already executing, ignoring GO`);
            return false;
        }

        console.log(`Starting standing by cue: ${targetCue.number} - ${targetCue.name}`);
        
        const success = this.playCue(targetCue.id);
        
        if (success) {
            this.advancePlayhead();
        }
        
        return success;
    }

    // ==================== ENHANCED CUE EXECUTION ====================

    playCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) {
            console.error(`Cannot play cue: ${cueId} not found`);
            return false;
        }

        // Check if cue is broken (missing target)
        if (cue.isBroken) {
            console.error(`Cannot play broken cue: ${cue.number} - missing target`);
            return false;
        }

        console.log(`Playing cue: ${cue.number} - ${cue.name}`);
        
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
            case 'start':
                this.executeStartCue(cue);
                break;
            case 'stop':
                this.executeStopCue(cue);
                break;
            case 'pause':
                this.executePauseCue(cue);
                break;
            case 'goto':
                this.executeGoToCue(cue);
                break;
            case 'fade':
                this.executeFadeCue(cue);
                break;
            default:
                console.warn(`Unknown cue type: ${cue.type}`);
                return false;
        }

        this.currentCueIndex = this.getCueIndex(cueId);
        this.emit('playbackStateChanged', { activeCues: this.getActiveCues() });
        return true;
    }

    // ==================== CONTROL CUE EXECUTION ====================

    executeStartCue(cue) {
        console.log(`Executing Start cue: ${cue.number}`);
        
        if (!cue.targetCueId) {
            console.error('Start cue has no target');
            return;
        }

        const targetCue = this.getCue(cue.targetCueId);
        if (!targetCue) {
            console.error(`Start cue target not found: ${cue.targetCueId}`);
            return;
        }

        // Execute the target cue
        this.playCue(cue.targetCueId);
        
        // Start cue completes immediately
        cue.status = 'loaded';
        this.emit('cueUpdated', { cue });
    }

    executeStopCue(cue) {
        console.log(`Executing Stop cue: ${cue.number}`);
        
        if (!cue.targetCueId) {
            console.error('Stop cue has no target');
            return;
        }

        // Stop the target cue
        this.stopSpecificCue(cue.targetCueId, false);
        
        // Stop cue completes immediately
        cue.status = 'loaded';
        this.emit('cueUpdated', { cue });
    }

    executePauseCue(cue) {
        console.log(`Executing Pause cue: ${cue.number}`);
        
        if (!cue.targetCueId) {
            console.error('Pause cue has no target');
            return;
        }

        const targetCue = this.getCue(cue.targetCueId);
        if (targetCue && targetCue.status === 'playing') {
            targetCue.status = 'paused';
            this.emit('cueUpdated', { cue: targetCue });
        }
        
        // Pause cue completes immediately
        cue.status = 'loaded';
        this.emit('cueUpdated', { cue });
    }

    executeGoToCue(cue) {
        console.log(`Executing GoTo cue: ${cue.number}`);
        
        if (!cue.targetCueId) {
            console.error('GoTo cue has no target');
            return;
        }

        // Move playhead to target cue
        this.setStandByCue(cue.targetCueId);
        
        // GoTo cue completes immediately
        cue.status = 'loaded';
        this.emit('cueUpdated', { cue });
    }

    executeFadeCue(cue) {
        console.log(`Executing Fade cue: ${cue.number}`);
        
        if (!cue.targetCueId) {
            console.error('Fade cue has no target');
            return;
        }

        cue.status = 'playing';
        
        const executionData = {
            startTime: Date.now(),
            type: 'fade',
            targetCueId: cue.targetCueId
        };
        
        this.activeCues.set(cue.id, executionData);
        
        // Simulate fade duration
        setTimeout(() => {
            this.completeCue(cue.id);
        }, cue.duration);
        
        this.emit('cueUpdated', { cue });
    }

    // ==================== EXISTING EXECUTION METHODS ====================

    executeAudioCue(cue) {
        cue.status = 'playing';
        
        const executionData = {
            startTime: Date.now(),
            type: 'audio'
        };
        
        this.activeCues.set(cue.id, executionData);
        
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
        
        setTimeout(() => {
            this.completeCue(cue.id);
        }, 1000);
        
        this.emit('cueUpdated', { cue });
    }

    // ==================== ENHANCED CUE MANAGEMENT ====================

    addCue(type, options = {}, index = -1) {
        const cue = this.createCue(type, options);
        
        if (index === -1) {
            this.cues.push(cue);
        } else {
            this.cues.splice(index, 0, cue);
        }

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
        
        this.stopSpecificCue(cueId, false);
        this.cues.splice(index, 1);

        // Update any cues that targeted this cue
        this.cues.forEach(c => {
            if (c.targetCueId === cueId) {
                c.target = null;
                c.targetCueId = null;
                c.isBroken = true;
                this.emit('cueUpdated', { cue: c });
            }
        });

        // Clear playhead if removed cue was standing by
        if (this.standByCueId === cueId) {
            if (index < this.cues.length) {
                this.setStandByCue(this.cues[index].id);
            } else if (index > 0) {
                this.setStandByCue(this.cues[index - 1].id);
            } else {
                this.setStandByCue(null);
            }
        }

        if (index <= this.currentCueIndex) {
            this.currentCueIndex = Math.max(-1, this.currentCueIndex - 1);
        }

        if (this.selectedCueId === cueId) {
            this.selectCue(null);
        }

        this.markUnsaved();
        this.emit('cueRemoved', { cue, index });
        return true;
    }

    // ==================== UTILITY METHODS ====================

    completeCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) return;

        cue.status = 'loaded';
        this.activeCues.delete(cueId);
        
        console.log(`Cue completed: ${cue.number} - ${cue.name}`);
        
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

    // ==================== EXISTING UTILITY METHODS ====================

    getCue(cueId) {
        return this.cues.find(cue => cue.id === cueId);
    }

    getCueIndex(cueId) {
        return this.cues.findIndex(cue => cue.id === cueId);
    }

    getNextCueNumber() {
        if (this.cues.length === 0) return 1;
        const lastCue = this.cues[this.cues.length - 1];
        return lastCue.number + 1;
    }

    getNextCue(fromCueId = null) {
        if (fromCueId) {
            const currentIndex = this.getCueIndex(fromCueId);
            return currentIndex + 1 < this.cues.length ? this.cues[currentIndex + 1] : null;
        }
        
        const standByCue = this.getStandByCue();
        if (standByCue) {
            const standByIndex = this.getCueIndex(standByCue.id);
            return standByIndex + 1 < this.cues.length ? this.cues[standByIndex + 1] : null;
        }
        
        return this.cues.length > 0 ? this.cues[0] : null;
    }

    selectCue(cueId) {
        const oldSelection = this.selectedCueId;
        this.selectedCueId = cueId;
        
        this.emit('selectionChanged', { 
            selectedCueId: this.selectedCueId,
            previousSelectionId: oldSelection
        });
    }

    getSelectedCue() {
        return this.selectedCueId ? this.getCue(this.selectedCueId) : null;
    }

    stop() {
        console.log('Stopping all cues');
        
        for (const cueId of this.activeCues.keys()) {
            this.stopSpecificCue(cueId, false);
        }
        
        this.isPaused = false;
        this.emit('playbackStateChanged', { 
            activeCues: this.getActiveCues(),
            isPaused: this.isPaused 
        });
    }

    stopSpecificCue(cueId, emitEvent = true) {
        const cue = this.getCue(cueId);
        if (!cue) return;

        if (this.activeCues.has(cueId)) {
            cue.status = 'loaded';
            this.activeCues.delete(cueId);
            console.log(`Stopped cue: ${cue.number} - ${cue.name}`);
            
            if (emitEvent) {
                this.emit('cueUpdated', { cue });
                this.emit('playbackStateChanged', { 
                    activeCues: this.getActiveCues(),
                    isPaused: this.isPaused 
                });
            }
        }
    }

    pause() {
        if (this.activeCues.size > 0) {
            this.isPaused = !this.isPaused;
            
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
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            
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

    newShow() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueId = null;
        this.standByCueId = null;
        this.activeCues.clear();
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showFilePath = null;
        this.unsavedChanges = false;
        
        this.emit('showChanged', { showName: this.showName, unsavedChanges: false });
        this.emit('playbackStateChanged', { activeCues: [], isPaused: false });
    }

    markUnsaved() {
        if (!this.unsavedChanges) {
            this.unsavedChanges = true;
            this.emit('showChanged', { showName: this.showName, unsavedChanges: true });
        }
    }

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

    getCueStats() {
        const stats = {
            total: this.cues.length,
            active: this.activeCues.size,
            broken: this.cues.filter(cue => cue.isBroken).length,
            types: {}
        };
        
        this.cues.forEach(cue => {
            stats.types[cue.type] = (stats.types[cue.type] || 0) + 1;
        });
        
        return stats;
    }
}

// Utility function for generating UUIDs
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CueManager;
} else {
    window.CueManager = CueManager;
}
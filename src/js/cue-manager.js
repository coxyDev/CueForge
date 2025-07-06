/**
 * Enhanced Cue Manager with Multi-Selection and Advanced Grouping
 * Supports professional workflows with group creation and cue reordering
 */

class CueManager {
    constructor() {
        this.cues = [];
        this.currentCueIndex = -1;
        this.selectedCueIds = new Set(); // Changed to support multi-selection
        this.standByCueId = null;
        this.lastGoTime = 0;
        this.goDebounceMs = 200;
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showFilePath = null;
        this.unsavedChanges = false;
        this.activeCues = new Map();
        this.singleCueMode = true;
        this.autoContinueEnabled = true;
        this.masterVolume = 1.0;
        
        // Group management
        this.expandedGroups = new Set(); // Track which groups are expanded
        
        this.listeners = {
            cueAdded: [],
            cueRemoved: [],
            cueUpdated: [],
            selectionChanged: [],
            playbackStateChanged: [],
            showChanged: [],
            volumeChanged: [],
            settingsChanged: [],
            playheadChanged: [],
            cueMoved: [] // New: for drag & drop
        };

        // Cue type definitions with targeting requirements
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

    // ==================== MULTI-SELECTION SYSTEM ====================

    /**
     * Select a single cue (clears other selections)
     */
    selectCue(cueId) {
        const oldSelection = new Set(this.selectedCueIds);
        this.selectedCueIds.clear();
        
        if (cueId) {
            this.selectedCueIds.add(cueId);
        }
        
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            previousSelection: Array.from(oldSelection),
            selectionType: 'single'
        });
    }

    /**
     * Add a cue to the selection (multi-select)
     */
    addToSelection(cueId) {
        if (!cueId) return;
        
        const oldSelection = new Set(this.selectedCueIds);
        this.selectedCueIds.add(cueId);
        
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            previousSelection: Array.from(oldSelection),
            selectionType: 'add'
        });
    }

    /**
     * Toggle a cue in the selection
     */
    toggleSelection(cueId) {
        if (!cueId) return;
        
        const oldSelection = new Set(this.selectedCueIds);
        
        if (this.selectedCueIds.has(cueId)) {
            this.selectedCueIds.delete(cueId);
        } else {
            this.selectedCueIds.add(cueId);
        }
        
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            previousSelection: Array.from(oldSelection),
            selectionType: 'toggle'
        });
    }

    /**
     * Select a range of cues (Shift+click behavior)
     */
    selectRange(fromCueId, toCueId) {
        const fromIndex = this.getCueIndex(fromCueId);
        const toIndex = this.getCueIndex(toCueId);
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        const oldSelection = new Set(this.selectedCueIds);
        const startIndex = Math.min(fromIndex, toIndex);
        const endIndex = Math.max(fromIndex, toIndex);
        
        // Clear current selection
        this.selectedCueIds.clear();
        
        // Select range
        for (let i = startIndex; i <= endIndex; i++) {
            this.selectedCueIds.add(this.cues[i].id);
        }
        
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            previousSelection: Array.from(oldSelection),
            selectionType: 'range'
        });
    }

    /**
     * Select all cues
     */
    selectAll() {
        const oldSelection = new Set(this.selectedCueIds);
        this.selectedCueIds.clear();
        
        this.cues.forEach(cue => {
            this.selectedCueIds.add(cue.id);
        });
        
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            previousSelection: Array.from(oldSelection),
            selectionType: 'all'
        });
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        const oldSelection = new Set(this.selectedCueIds);
        this.selectedCueIds.clear();
        
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            previousSelection: Array.from(oldSelection),
            selectionType: 'clear'
        });
    }

    /**
     * Get all selected cues
     */
    getSelectedCues() {
        return Array.from(this.selectedCueIds).map(id => this.getCue(id)).filter(Boolean);
    }

    /**
     * Get the primary selected cue (first in selection order)
     */
    getPrimarySelectedCue() {
        if (this.selectedCueIds.size === 0) return null;
        const firstId = Array.from(this.selectedCueIds)[0];
        return this.getCue(firstId);
    }

    /**
     * Check if a cue is selected
     */
    isCueSelected(cueId) {
        return this.selectedCueIds.has(cueId);
    }

    // ==================== GROUP MANAGEMENT SYSTEM ====================

    /**
     * Create a group cue from selected cues
     */
    createGroupFromSelection(groupOptions = {}) {
        const selectedCues = this.getSelectedCues();
        
        if (selectedCues.length < 2) {
            console.warn('Need at least 2 cues selected to create a group');
            return null;
        }

        // Sort selected cues by their current order in the cue list
        selectedCues.sort((a, b) => this.getCueIndex(a.id) - this.getCueIndex(b.id));
        
        // Find the position to insert the group (where the first selected cue is)
        const insertIndex = this.getCueIndex(selectedCues[0].id);
        
        // Create the group cue
        const groupCue = this.createCue('group', {
            name: groupOptions.name || `Group ${this.getNextCueNumber()}`,
            mode: groupOptions.mode || 'playlist',
            ...groupOptions
        });
        
        // Move selected cues into the group
        groupCue.children = selectedCues.map(cue => {
            // Remove from main cue list
            const index = this.cues.findIndex(c => c.id === cue.id);
            if (index !== -1) {
                this.cues.splice(index, 1);
            }
            
            // Reset cue numbers within the group (they'll be relative)
            return { ...cue };
        });
        
        // Renumber the children within the group
        this.renumberGroupChildren(groupCue);
        
        // Insert the group at the position of the first selected cue
        this.cues.splice(insertIndex, 0, groupCue);
        
        // Update cue numbers for the entire show
        this.renumberAllCues();
        
        // Select just the new group
        this.selectCue(groupCue.id);
        
        // Mark the group as expanded by default
        this.expandedGroups.add(groupCue.id);
        
        this.markUnsaved();
        this.emit('cueAdded', { cue: groupCue, index: insertIndex });
        
        console.log(`Created group with ${groupCue.children.length} cues`);
        return groupCue;
    }

    /**
     * Add selected cues to an existing group
     */
    addCuesToGroup(groupId, cuesToAdd = null) {
    const group = this.getCue(groupId);
    if (!group || group.type !== 'group') {
        console.error('Target is not a group cue');
        return false;
    }

    // Use provided cues or get selected cues
    const cues = cuesToAdd || this.getSelectedCues();
    if (cues.length === 0) {
        console.warn('No cues to add to group');
        return false;
    }

    // Initialize children array if it doesn't exist
    if (!group.children) {
        group.children = [];
    }

    // Filter out invalid cues (can't add group to itself, etc.)
    const validCues = cues.filter(cue => {
        if (cue.id === groupId) {
            console.warn('Cannot add group to itself');
            return false;
        }
        return true;
    });

    if (validCues.length === 0) {
        console.warn('No valid cues to add to group');
        return false;
    }

    // Remove cues from main list and add to group
    validCues.forEach(cue => {
        const index = this.cues.findIndex(c => c.id === cue.id);
        if (index !== -1) {
            // Remove from main cue list
            this.cues.splice(index, 1);
            
            // Add to group children
            group.children.push({...cue});
        }
    });

    // Renumber everything
    this.renumberGroupChildren(group);
    this.renumberAllCues();
    
    // Clear selection since cues are now in the group
    this.clearSelection();
    
    // Select the group instead
    this.selectCue(groupId);
    
    this.markUnsaved();
    this.emit('cueUpdated', { cue: group });
    this.emit('selectionChanged', { 
        selectedCueIds: [groupId],
        selectionType: 'group_modified'
    });
    
    console.log(`Added ${validCues.length} cues to group ${group.number}`);
    return true;
}

    /**
     * Remove cues from a group back to the main list
     */
    ungroupCues(groupId) {
        const group = this.getCue(groupId);
        if (!group || group.type !== 'group') {
            console.error('Target is not a group cue');
            return false;
        }

        if (!group.children || group.children.length === 0) {
            // Just remove the empty group
            this.removeCue(groupId);
            return true;
        }

        // Find group position
        const groupIndex = this.getCueIndex(groupId);
        
        // Insert children back into main list
        const children = [...group.children];
        this.cues.splice(groupIndex, 1); // Remove group first
        
        // Insert children at the group's former position
        children.forEach((child, index) => {
            this.cues.splice(groupIndex + index, 0, child);
        });
        
        // Clear the group expansion state
        this.expandedGroups.delete(groupId);
        
        // Renumber everything
        this.renumberAllCues();
        
        // Select the ungrouped cues
        this.selectedCueIds.clear();
        children.forEach(child => this.selectedCueIds.add(child.id));
        
        this.markUnsaved();
        this.emit('cueRemoved', { cue: group, index: groupIndex });
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            selectionType: 'ungroup'
        });
        
        console.log(`Ungrouped ${children.length} cues from group`);
        return true;
    }

    /**
     * Toggle group expansion state
     */
    toggleGroupExpansion(groupId) {
        if (this.expandedGroups.has(groupId)) {
            this.expandedGroups.delete(groupId);
        } else {
            this.expandedGroups.add(groupId);
        }
        
        this.emit('cueUpdated', { cue: this.getCue(groupId) });
    }

    /**
     * Check if a group is expanded
     */
    isGroupExpanded(groupId) {
        return this.expandedGroups.has(groupId);
    }

    /**
     * Get all cues including those in groups (flattened list for display)
     */
    getFlattenedCues() {
        const flattened = [];
        
        this.cues.forEach(cue => {
            flattened.push(cue);
            
            // If it's an expanded group, add its children
            if (cue.type === 'group' && this.isGroupExpanded(cue.id) && cue.children) {
                cue.children.forEach(child => {
                    flattened.push({
                        ...child,
                        isGroupChild: true,
                        parentGroupId: cue.id,
                        displayNumber: `${cue.number}.${child.number}`
                    });
                });
            }
        });
        
        return flattened;
    }

    // ==================== CUE REORDERING SYSTEM ====================

    /**
     * Move a cue to a new position
     */
    moveCue(cueId, newIndex) {
        const currentIndex = this.getCueIndex(cueId);
        if (currentIndex === -1 || newIndex < 0 || newIndex >= this.cues.length) {
            return false;
        }

        // Remove cue from current position
        const [cue] = this.cues.splice(currentIndex, 1);
        
        // Insert at new position
        this.cues.splice(newIndex, 0, cue);
        
        // Renumber all cues
        this.renumberAllCues();
        
        this.markUnsaved();
        this.emit('cueMoved', { 
            cue, 
            fromIndex: currentIndex, 
            toIndex: newIndex 
        });
        
        return true;
    }

    /**
     * Move multiple selected cues to a new position
     */
    moveSelectedCues(targetIndex) {
        const selectedCues = this.getSelectedCues();
        if (selectedCues.length === 0) return false;

        // Sort by current position (reverse order for removal)
        const sortedCues = selectedCues
            .map(cue => ({ cue, index: this.getCueIndex(cue.id) }))
            .sort((a, b) => b.index - a.index);

        // Remove all selected cues (in reverse order to maintain indices)
        sortedCues.forEach(({ cue, index }) => {
            this.cues.splice(index, 1);
        });

        // Insert at target position
        const cuesToInsert = sortedCues.reverse().map(item => item.cue);
        this.cues.splice(targetIndex, 0, ...cuesToInsert);

        // Renumber all cues
        this.renumberAllCues();

        this.markUnsaved();
        this.emit('cueMoved', { 
            cues: cuesToInsert,
            toIndex: targetIndex 
        });

        return true;
    }

    // ==================== NUMBERING SYSTEM ====================

    /**
     * Renumber all cues in the main list
     */
    renumberAllCues() {
        this.cues.forEach((cue, index) => {
            cue.number = index + 1;
            
            // If it's a group, renumber its children
            if (cue.type === 'group' && cue.children) {
                this.renumberGroupChildren(cue);
            }
        });
    }

    /**
     * Renumber children within a group
     */
    renumberGroupChildren(groupCue) {
        if (!groupCue.children) return;
        
        groupCue.children.forEach((child, index) => {
            child.number = index + 1;
        });
    }

    /**
     * Get the next available cue number
     */
    getNextCueNumber() {
        if (this.cues.length === 0) return 1;
        return Math.max(...this.cues.map(cue => cue.number)) + 1;
    }

    // ==================== ENHANCED CUE CREATION ====================

    createCue(type, options = {}) {
        const id = generateUUID();
        const number = options.number || this.getNextCueNumber();
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
            
            // Targeting properties
            target: null,
            targetType: definition.targetType,
            requiresTarget: definition.requiresTarget,
            isBroken: definition.requiresTarget,
            
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
                    duration: 0,
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
                    duration: 0,
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
                    duration: 5000,
                    isBroken: false
                });
                break;
                
            case 'group':
                Object.assign(baseCue, {
                    mode: options.mode || 'playlist',
                    children: [],
                    crossfade: false,
                    loop: false,
                    shuffle: false,
                    isBroken: false
                });
                break;

            case 'start':
            case 'stop':
            case 'pause':
            case 'goto':
            case 'load':
            case 'reset':
                Object.assign(baseCue, {
                    duration: 0,
                    targetCueId: options.targetCueId || null
                });
                break;

            case 'fade':
                Object.assign(baseCue, {
                    duration: 5000,
                    targetCueId: options.targetCueId || null,
                    fadeType: 'absolute',
                    targetParameter: 'volume',
                    targetValue: 0.0
                });
                break;
        }

        // Set target if provided in options
        if (options.targetCueId && definition.targetType === 'cue') {
            this.setCueTarget(baseCue, options.targetCueId);
        }

        return baseCue;
    }

    // ==================== TARGETING SYSTEM (Preserved from previous implementation) ====================

    setFileTarget(cueId, filePath, fileName = null) {
        const cue = this.getCue(cueId);
        if (!cue) return false;

        const definition = this.cueTypeDefinitions[cue.type];
        if (!definition || definition.targetType !== 'file') {
            console.error(`Cue type ${cue.type} does not accept file targets`);
            return false;
        }

        const extension = filePath.split('.').pop().toLowerCase();
        if (!definition.acceptedFormats.includes(extension)) {
            console.error(`File format .${extension} not supported for ${cue.type} cues`);
            return false;
        }

        cue.target = filePath;
        cue.targetFile = filePath;
        cue.isBroken = false;

        if (fileName && this.isDefaultName(cue)) {
            cue.name = fileName;
        }

        console.log(`Set file target for cue ${cue.number}: ${filePath}`);
        this.markUnsaved();
        this.emit('cueUpdated', { cue });
        return true;
    }

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

        const acceptedTypes = definition.acceptedCueTypes;
        if (!acceptedTypes.includes('any') && !acceptedTypes.includes(targetCue.type)) {
            console.error(`Cue type ${cue.type} cannot target ${targetCue.type} cues`);
            return false;
        }

        cue.target = targetCueId;
        cue.targetCueId = targetCueId;
        cue.isBroken = false;

        if (this.isDefaultName(cue)) {
            const targetName = targetCue.number ? targetCue.number : targetCue.name;
            cue.name = `${definition.defaultName} ${targetName}`;
        }

        console.log(`Set cue target for cue ${cue.number}: ${targetCue.number}`);
        this.markUnsaved();
        this.emit('cueUpdated', { cue });
        return true;
    }

    clearTarget(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) return false;

        cue.target = null;
        cue.targetFile = null;
        cue.targetCueId = null;
        cue.isBroken = cue.requiresTarget;

        const definition = this.cueTypeDefinitions[cue.type];
        if (definition) {
            cue.name = `${definition.defaultName} ${cue.number}`;
        }

        console.log(`Cleared target for cue ${cue.number}`);
        this.markUnsaved();
        this.emit('cueUpdated', { cue });
        return true;
    }

    getTargetDisplayText(cue) {
        if (!cue.requiresTarget) {
            return '';
        }

        if (!cue.target) {
            return '?';
        }

        if (cue.targetType === 'file') {
            const fileName = cue.target.split('/').pop().split('\\').pop();
            return fileName || cue.target;
        }

        if (cue.targetType === 'cue') {
            const targetCue = this.getCue(cue.target);
            if (targetCue) {
                return targetCue.number ? targetCue.number.toString() : targetCue.name;
            } else {
                cue.isBroken = true;
                return '⚠ Missing';
            }
        }

        return cue.target;
    }

    isDefaultName(cue) {
        const definition = this.cueTypeDefinitions[cue.type];
        if (!definition) return false;

        const defaultPattern = new RegExp(`^${definition.defaultName}\\s+(\\d+|.+)$`);
        return defaultPattern.test(cue.name);
    }

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

    // ==================== PLAYHEAD MANAGEMENT (Preserved) ====================

    setStandByCue(cueId) {
        const oldStandBy = this.standByCueId;
        this.standByCueId = cueId;
        
        console.log(`Playhead moved to: ${cueId ? this.getCue(cueId)?.number : 'none'}`);
        
        this.emit('playheadChanged', { 
            standByCueId: this.standByCueId,
            previousStandByCueId: oldStandBy
        });
    }

    getStandByCue() {
        return this.standByCueId ? this.getCue(this.standByCueId) : null;
    }

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

    // ==================== UTILITY METHODS ====================

    getCue(cueId) {
        // First check main cues
        let cue = this.cues.find(cue => cue.id === cueId);
        if (cue) return cue;
        
        // Then check within groups
        for (const mainCue of this.cues) {
            if (mainCue.type === 'group' && mainCue.children) {
                cue = mainCue.children.find(child => child.id === cueId);
                if (cue) return cue;
            }
        }
        
        return null;
    }

    getCueIndex(cueId) {
        return this.cues.findIndex(cue => cue.id === cueId);
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

    // Preserve all other methods from the previous implementation...
    // (go, playCue, execution methods, etc. - keeping them the same)

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

    playCue(cueId) {
        const cue = this.getCue(cueId);
        if (!cue) {
            console.error(`Cannot play cue: ${cueId} not found`);
            return false;
        }

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

    // All execution methods remain the same...
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

        this.playCue(cue.targetCueId);
        
        cue.status = 'loaded';
        this.emit('cueUpdated', { cue });
    }

    executeStopCue(cue) {
        console.log(`Executing Stop cue: ${cue.number}`);
        
        if (!cue.targetCueId) {
            console.error('Stop cue has no target');
            return;
        }

        this.stopSpecificCue(cue.targetCueId, false);
        
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
        
        cue.status = 'loaded';
        this.emit('cueUpdated', { cue });
    }

    executeGoToCue(cue) {
        console.log(`Executing GoTo cue: ${cue.number}`);
        
        if (!cue.targetCueId) {
            console.error('GoTo cue has no target');
            return;
        }

        this.setStandByCue(cue.targetCueId);
        
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
        
        setTimeout(() => {
            this.completeCue(cue.id);
        }, cue.duration);
        
        this.emit('cueUpdated', { cue });
    }

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
        
        // For basic implementation, just complete after 1 second
        // In a full implementation, this would manage child cue playback
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

    // Rest of methods remain the same (stop, pause, etc.)...
    addCue(type, options = {}, index = -1) {
        const cue = this.createCue(type, options);
        
        if (index === -1) {
            this.cues.push(cue);
        } else {
            this.cues.splice(index, 0, cue);
        }

        // Renumber cues after insertion
        this.renumberAllCues();

        if (this.cues.length === 1 && !this.standByCueId) {
            this.setStandByCue(cue.id);
        }

        this.markUnsaved();
        this.emit('cueAdded', { cue, index: index === -1 ? this.cues.length - 1 : index });
        return cue;
    }

    removeCue(cueId) {
        const index = this.getCueIndex(cueId);
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

        // Remove from selection
        this.selectedCueIds.delete(cueId);
        
        // Clear group expansion state
        this.expandedGroups.delete(cueId);

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

        // Renumber remaining cues
        this.renumberAllCues();

        this.markUnsaved();
        this.emit('cueRemoved', { cue, index });
        this.emit('selectionChanged', { 
            selectedCueIds: Array.from(this.selectedCueIds),
            selectionType: 'update'
        });
        return true;
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
        this.selectedCueIds.clear();
        this.standByCueId = null;
        this.activeCues.clear();
        this.isPaused = false;
        this.showName = 'Untitled Show';
        this.showFilePath = null;
        this.unsavedChanges = false;
        this.expandedGroups.clear();
        
        this.emit('showChanged', { showName: this.showName, unsavedChanges: false });
        this.emit('playbackStateChanged', { activeCues: [], isPaused: false });
        this.emit('selectionChanged', { 
            selectedCueIds: [],
            selectionType: 'clear'
        });
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
            groups: this.cues.filter(cue => cue.type === 'group').length,
            selected: this.selectedCueIds.size,
            types: {}
        };
        
        this.cues.forEach(cue => {
            stats.types[cue.type] = (stats.types[cue.type] || 0) + 1;
        });
        
        return stats;
    }
    
createGroupFromSelection(groupOptions = {}) {
    const selectedCues = this.getSelectedCues();
    
    if (selectedCues.length < 2) {
        console.warn('Need at least 2 cues selected to create a group');
        return null;
    }

    // Sort selected cues by their current order in the cue list
    selectedCues.sort((a, b) => this.getCueIndex(a.id) - this.getCueIndex(b.id));
    
    // Find the position to insert the group (where the first selected cue is)
    const insertIndex = this.getCueIndex(selectedCues[0].id);
    
    // Create the group cue
    const groupCue = this.createCue('group', {
        name: groupOptions.name || `Group ${this.getNextCueNumber()}`,
        mode: groupOptions.mode || 'playlist',
        children: []
    });
    
    // Remove selected cues from main list (in reverse order to maintain indices)
    const cueIndices = selectedCues
        .map(cue => ({ cue, index: this.getCueIndex(cue.id) }))
        .sort((a, b) => b.index - a.index);
    
    cueIndices.forEach(({ cue, index }) => {
        this.cues.splice(index, 1);
        // Renumber the child for group context
        cue.number = groupCue.children.length + 1;
        groupCue.children.push(cue);
    });
    
    // Insert group at the position of the first selected cue
    this.cues.splice(insertIndex, 0, groupCue);
    
    // Renumber all cues
    this.renumberAllCues();
    
    // Select the new group
    this.selectCue(groupCue.id);
    
    this.markUnsaved();
    this.emit('cueAdded', { cue: groupCue, index: insertIndex });
    this.emit('selectionChanged', { 
        selectedCueIds: [groupCue.id],
        selectionType: 'group_created'
    });
    
    console.log(`Created group ${groupCue.number} with ${groupCue.children.length} cues`);
    return groupCue;
}

/**
 * Get the next cue number for naming purposes
 */
getNextCueNumber() {
    if (this.cues.length === 0) return 1;
    const maxNumber = Math.max(...this.cues.map(c => parseInt(c.number) || 0));
    return maxNumber + 1;
}

/**
 * Enhanced removeCue method to handle group children
 */
removeCue(cueId) {
    const cue = this.getCue(cueId);
    if (!cue) return false;

    const index = this.getCueIndex(cueId);
    if (index === -1) return false;

    // If removing a group with children, ask what to do with children
    if (cue.type === 'group' && cue.children && cue.children.length > 0) {
        // In a real implementation, you might want to show a dialog
        // For now, we'll move children back to main list
        this.ungroupCues(cueId);
        return true;
    }

    // Remove from main cue list
    this.cues.splice(index, 1);
    
    // Remove from selection if selected
    this.selectedCueIds.delete(cueId);
    
    // Clear standby if this was the standby cue
    if (this.standByCueId === cueId) {
        this.standByCueId = null;
    }
    
    // Remove from expanded groups
    this.expandedGroups.delete(cueId);
    
    // Renumber remaining cues
    this.renumberAllCues();
    
    this.markUnsaved();
    this.emit('cueRemoved', { cue, index });
    this.emit('selectionChanged', { 
        selectedCueIds: Array.from(this.selectedCueIds),
        selectionType: 'removed'
    });
    
    return true;
}

/**
 * Check if cue list has any broken cues
 */
getBrokenCueCount() {
    return this.cues.filter(cue => cue.isBroken).length;
}

/**
 * Advanced cue finding methods
 */
findCuesByType(type) {
    return this.cues.filter(cue => cue.type === type);
}

findCuesByName(name) {
    return this.cues.filter(cue => 
        cue.name.toLowerCase().includes(name.toLowerCase())
    );
}

/**
 * Group utility methods
 */
getAllGroupCues() {
    return this.cues.filter(cue => cue.type === 'group');
}

getChildrenOfGroup(groupId) {
    const group = this.getCue(groupId);
    return group && group.type === 'group' ? group.children || [] : [];
}

/**
 * Selection utility methods
 */
getSelectedCueNumbers() {
    return this.getSelectedCues().map(cue => cue.number);
}

hasSelection() {
    return this.selectedCueIds.size > 0;
}

isMultipleSelection() {
    return this.selectedCueIds.size > 1;
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
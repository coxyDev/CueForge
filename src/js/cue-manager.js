// MINIMAL Enhancement to existing CueManager
// Add these methods to your existing src/js/cue-manager.js WITHOUT replacing the whole file

// Add these properties to the constructor (around line 15):
/*
In constructor, add:
    this.standByCueId = null; // NEW: Which cue is ready for GO button
*/

// Add these methods to your existing CueManager class:

// ==================== PLAYHEAD MANAGEMENT ====================

/**
 * Set which cue is "standing by" (ready for GO)
 * This is separate from selection
 */
setStandByCue(cueId) {
    const oldStandBy = this.standByCueId;
    this.standByCueId = cueId;
    
    console.log(`Playhead moved to: ${cueId ? this.getCue(cueId)?.number : 'none'}`);
    
    // Emit playhead change event (add this to your existing events)
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
// REPLACE your existing go() method with this enhanced version:

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

// ==================== ENHANCED ADD CUE ====================
// REPLACE your existing addCue method with this enhanced version:

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

// ==================== ENHANCED REMOVE CUE ====================
// REPLACE your existing removeCue method with this enhanced version:

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

// ==================== ADD TO LISTENERS ====================
// In constructor, add 'playheadChanged' to the listeners object:
/*
this.listeners = {
    cueAdded: [],
    cueRemoved: [],
    cueUpdated: [],
    selectionChanged: [],
    playbackStateChanged: [],
    showChanged: [],
    volumeChanged: [],
    settingsChanged: [],
    playheadChanged: []  // ADD THIS LINE
};
*/
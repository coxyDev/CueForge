// MINIMAL Enhancement to existing UIManager
// Add these modifications to your existing src/js/ui-manager.js

// ==================== ADD TO CONSTRUCTOR ====================
// In the bindEvents() method, add this line after the existing event listeners:

// this.cueManager.on('playheadChanged', (data) => this.onPlayheadChanged(data));

// ==================== ENHANCE EXISTING KEYBOARD SHORTCUTS ====================
// MODIFY your existing handleKeydown method by adding these cases:

handleKeydown(e) {
    // Ignore if typing in input fields
    if (this.isInputFocused(e.target)) {
        return;
    }

    // Handle Space for GO
    if (e.code === 'Space') {
        e.preventDefault();
        console.log('Space pressed - GO');
        this.cueManager.go();
        return;
    }

    // Handle Stop
    if ((e.ctrlKey || e.metaKey) && e.code === 'Period') {
        e.preventDefault();
        console.log('Ctrl+. pressed - STOP');
        this.cueManager.stop();
        return;
    }

    // Handle Pause
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
        e.preventDefault();
        console.log('Ctrl+P pressed - PAUSE');
        this.cueManager.pause();
        return;
    }

    // NEW: Handle playhead movement (Shift + arrows)
    if (e.shiftKey && e.code === 'ArrowUp') {
        e.preventDefault();
        this.movePlayheadUp();
        return;
    }

    if (e.shiftKey && e.code === 'ArrowDown') {
        e.preventDefault();
        this.movePlayheadDown();
        return;
    }

    // NEW: Handle selection movement (arrows without shift)
    if (!e.shiftKey && e.code === 'ArrowUp') {
        e.preventDefault();
        this.selectPreviousCue();
        return;
    }

    if (!e.shiftKey && e.code === 'ArrowDown') {
        e.preventDefault();
        this.selectNextCue();
        return;
    }

    // NEW: Handle Enter to go to selected cue
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        this.goToSelectedCue();
        return;
    }

    // NEW: Handle Ctrl+Number to go to cue by number
    if ((e.ctrlKey || e.metaKey) && e.code.startsWith('Digit')) {
        e.preventDefault();
        const cueNumber = e.code.replace('Digit', '');
        const finalNumber = cueNumber === '0' ? '10' : cueNumber;
        this.goToCueByNumber(finalNumber);
        return;
    }
}

// ==================== ADD NEW METHODS ====================
// Add these methods to your existing UIManager class:

// Playhead navigation
movePlayheadUp() {
    const cues = this.cueManager.cues;
    if (cues.length === 0) return;
    
    const standByCue = this.cueManager.getStandByCue();
    let newIndex = 0;
    
    if (standByCue) {
        const currentIndex = this.cueManager.getCueIndex(standByCue.id);
        newIndex = Math.max(0, currentIndex - 1);
    }
    
    this.cueManager.setStandByCue(cues[newIndex].id);
}

movePlayheadDown() {
    const cues = this.cueManager.cues;
    if (cues.length === 0) return;
    
    const standByCue = this.cueManager.getStandByCue();
    let newIndex = 0;
    
    if (standByCue) {
        const currentIndex = this.cueManager.getCueIndex(standByCue.id);
        newIndex = Math.min(cues.length - 1, currentIndex + 1);
    }
    
    this.cueManager.setStandByCue(cues[newIndex].id);
}

goToSelectedCue() {
    const selectedCue = this.cueManager.getSelectedCue();
    if (selectedCue) {
        console.log(`Going to selected cue: ${selectedCue.number}`);
        this.cueManager.goToCue(selectedCue.id);
    }
}

goToCueByNumber(number) {
    const cue = this.cueManager.cues.find(c => c.number === number);
    if (cue) {
        console.log(`Going to cue ${number}`);
        this.cueManager.goToCue(cue.id);
    } else {
        console.log(`Cue ${number} not found`);
    }
}

// New event handler
onPlayheadChanged(data) {
    this.renderCueList(); // Re-render to update playhead indicator
    this.updateGoButtonText();
}

updateGoButtonText() {
    if (!this.elements.goBtn) return;
    
    const standByCue = this.cueManager.getStandByCue();
    if (standByCue) {
        this.elements.goBtn.title = `Go - Execute Cue ${standByCue.number}: ${standByCue.name}`;
    } else {
        this.elements.goBtn.title = 'Go';
    }
}

// ==================== ENHANCE EXISTING createCueElement METHOD ====================
// MODIFY your existing createCueElement method to add playhead indicator:

createCueElement(cue, index) {
    const element = document.createElement('div');
    element.className = 'cue-item';
    element.dataset.cueId = cue.id;
    
    // Keep existing state classes
    if (index === this.cueManager.currentCueIndex) {
        element.classList.add('current');
    }
    
    if (cue.status === 'playing') {
        element.classList.add('playing');
    }
    
    if (cue.status === 'loading') {
        element.classList.add('loading');
    }
    
    if (this.cueManager.isCueCurrentlyExecuting(cue.id)) {
        element.classList.add('executing');
    }
    
    if (cue.autoContinue) {
        element.classList.add('auto-continue');
    }
    
    // NEW: Add standing by class
    if (this.cueManager.standByCueId === cue.id) {
        element.classList.add('standing-by');
    }
    
    // MODIFY the innerHTML to include playhead indicator:
    const playheadIndicator = this.cueManager.standByCueId === cue.id ? '▶ ' : '';
    
    element.innerHTML = `
        <div class="cue-number">${playheadIndicator}${cue.number}${cue.autoContinue ? ' →' : ''}</div>
        <div class="cue-name">${cue.name}</div>
        <div class="cue-type">${cue.type}</div>
        <div class="cue-duration">${this.formatDuration(cue.duration)}</div>
        <div class="cue-status ${cue.status}">${cue.status}</div>
    `;
    
    // ENHANCE existing click handlers:
    element.addEventListener('click', (e) => {
        if (e.shiftKey) {
            // Shift+click = set as standing by
            this.cueManager.setStandByCue(cue.id);
        } else {
            // Regular click = select
            this.cueManager.selectCue(cue.id);
        }
    });
    
    element.addEventListener('dblclick', (e) => {
        // Double-click = go to cue
        this.cueManager.goToCue(cue.id);
    });
    
    // Keep existing right-click for future context menu
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Future: context menu
    });
    
    return element;
}
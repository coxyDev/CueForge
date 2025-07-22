/**
 * Enhanced Matrix Mixer Implementation
 * Provides QLab-style matrix routing with crosspoints, gangs, and automation
 */

class MatrixMixer {
    constructor(numInputs, numOutputs, name = 'Matrix') {
        this.name = name;
        this.numInputs = numInputs;
        this.numOutputs = numOutputs;
        
        // Main level control (top-left corner)
        this.mainLevel = 0; // dB
        
        // Input level controls (left column)
        this.inputLevels = new Array(numInputs).fill(0);
        
        // Output level controls (top row)
        this.outputLevels = new Array(numOutputs).fill(0);
        
        // Crosspoint matrix [input][output] = level in dB
        // null = -Infinity (no connection)
        this.crosspoints = Array(numInputs).fill(null).map(() => 
            new Array(numOutputs).fill(null)
        );
        
        // Gang groups for linked control
        this.gangs = new Map(); // gangId -> Set of {type, index}
        this.nextGangId = 1;
        
        // Mute/solo states
        this.inputMutes = new Array(numInputs).fill(false);
        this.outputMutes = new Array(numOutputs).fill(false);
        this.inputSolos = new Array(numInputs).fill(false);
        this.outputSolos = new Array(numOutputs).fill(false);
        
        // Change callbacks
        this.changeCallbacks = [];
    }
    
    // === Level Controls ===
    
    setMainLevel(levelDb) {
        this.mainLevel = this.clampLevel(levelDb);
        this.notifyChange('main', null, null, this.mainLevel);
    }
    
    setInputLevel(input, levelDb) {
        if (input >= 0 && input < this.numInputs) {
            const clampedLevel = this.clampLevel(levelDb);
            const gang = this.findGang('input', input);
            
            if (gang) {
                this.setGangLevel(gang, clampedLevel, 'input', input);
            } else {
                this.inputLevels[input] = clampedLevel;
                this.notifyChange('input', input, null, clampedLevel);
            }
        }
    }
    
    setOutputLevel(output, levelDb) {
        if (output >= 0 && output < this.numOutputs) {
            const clampedLevel = this.clampLevel(levelDb);
            const gang = this.findGang('output', output);
            
            if (gang) {
                this.setGangLevel(gang, clampedLevel, 'output', output);
            } else {
                this.outputLevels[output] = clampedLevel;
                this.notifyChange('output', null, output, clampedLevel);
            }
        }
    }
    
    setCrosspoint(input, output, levelDb) {
        if (input >= 0 && input < this.numInputs && 
            output >= 0 && output < this.numOutputs) {
            const clampedLevel = levelDb === null ? null : this.clampLevel(levelDb);
            const gang = this.findGang('crosspoint', `${input},${output}`);
            
            if (gang) {
                this.setGangLevel(gang, clampedLevel, 'crosspoint', `${input},${output}`);
            } else {
                this.crosspoints[input][output] = clampedLevel;
                this.notifyChange('crosspoint', input, output, clampedLevel);
            }
        }
    }
    
    // === Gang Controls ===
    
    createGang(members) {
        const gangId = this.nextGangId++;
        const gang = new Set();
        
        members.forEach(member => {
            gang.add(member);
        });
        
        this.gangs.set(gangId, gang);
        return gangId;
    }
    
    findGang(type, index) {
        for (const [gangId, gang] of this.gangs) {
            for (const member of gang) {
                if (member.type === type && member.index === index) {
                    return gangId;
                }
            }
        }
        return null;
    }
    
    setGangLevel(gangId, levelDb, sourceType, sourceIndex) {
        const gang = this.gangs.get(gangId);
        if (!gang) return;
        
        // Find the current level of the source
        let currentLevel = 0;
        if (sourceType === 'input') {
            currentLevel = this.inputLevels[sourceIndex];
        } else if (sourceType === 'output') {
            currentLevel = this.outputLevels[sourceIndex];
        } else if (sourceType === 'crosspoint') {
            const [input, output] = sourceIndex.split(',').map(Number);
            currentLevel = this.crosspoints[input][output] || 0;
        }
        
        const delta = levelDb - currentLevel;
        
        // Apply delta to all gang members
        gang.forEach(member => {
            if (member.type === 'input') {
                const newLevel = this.clampLevel(this.inputLevels[member.index] + delta);
                this.inputLevels[member.index] = newLevel;
                this.notifyChange('input', member.index, null, newLevel);
            } else if (member.type === 'output') {
                const newLevel = this.clampLevel(this.outputLevels[member.index] + delta);
                this.outputLevels[member.index] = newLevel;
                this.notifyChange('output', null, member.index, newLevel);
            } else if (member.type === 'crosspoint') {
                const [input, output] = member.index.split(',').map(Number);
                const current = this.crosspoints[input][output];
                if (current !== null) {
                    const newLevel = this.clampLevel(current + delta);
                    this.crosspoints[input][output] = newLevel;
                    this.notifyChange('crosspoint', input, output, newLevel);
                }
            }
        });
    }
    
    // === Mute/Solo Controls ===
    
    setInputMute(input, muted) {
        if (input >= 0 && input < this.numInputs) {
            this.inputMutes[input] = muted;
            this.notifyChange('inputMute', input, null, muted);
        }
    }
    
    setOutputMute(output, muted) {
        if (output >= 0 && output < this.numOutputs) {
            this.outputMutes[output] = muted;
            this.notifyChange('outputMute', null, output, muted);
        }
    }
    
    setInputSolo(input, soloed) {
        if (input >= 0 && input < this.numInputs) {
            this.inputSolos[input] = soloed;
            this.notifyChange('inputSolo', input, null, soloed);
        }
    }
    
    setOutputSolo(output, soloed) {
        if (output >= 0 && output < this.numOutputs) {
            this.outputSolos[output] = soloed;
            this.notifyChange('outputSolo', null, output, soloed);
        }
    }
    
    // === Gain Calculations ===
    
    calculateGain(input, output) {
        // Check mute/solo states
        const anySoloedInputs = this.inputSolos.some(s => s);
        const anySoloedOutputs = this.outputSolos.some(s => s);
        
        if (this.inputMutes[input] || this.outputMutes[output]) {
            return 0;
        }
        
        if (anySoloedInputs && !this.inputSolos[input]) {
            return 0;
        }
        
        if (anySoloedOutputs && !this.outputSolos[output]) {
            return 0;
        }
        
        // Calculate total gain
        const crosspoint = this.crosspoints[input][output];
        if (crosspoint === null) return 0; // No connection
        
        const mainGain = this.dbToGain(this.mainLevel);
        const inputGain = this.dbToGain(this.inputLevels[input]);
        const outputGain = this.dbToGain(this.outputLevels[output]);
        const crosspointGain = this.dbToGain(crosspoint);
        
        return mainGain * inputGain * outputGain * crosspointGain;
    }
    
    // === Utility Methods ===
    
    dbToGain(db) {
        if (db === null || db === -Infinity || db <= -60) return 0;
        return Math.pow(10, db / 20);
    }
    
    gainToDb(gain) {
        if (gain <= 0) return -Infinity;
        return 20 * Math.log10(gain);
    }
    
    clampLevel(levelDb) {
        return Math.max(-60, Math.min(12, levelDb));
    }
    
    // === Preset Management ===
    
    getState() {
        return {
            name: this.name,
            mainLevel: this.mainLevel,
            inputLevels: [...this.inputLevels],
            outputLevels: [...this.outputLevels],
            crosspoints: this.crosspoints.map(row => [...row]),
            inputMutes: [...this.inputMutes],
            outputMutes: [...this.outputMutes],
            gangs: Array.from(this.gangs.entries()).map(([id, gang]) => ({
                id,
                members: Array.from(gang)
            }))
        };
    }
    
    setState(state) {
        this.name = state.name || this.name;
        this.mainLevel = state.mainLevel || 0;
        this.inputLevels = [...(state.inputLevels || [])];
        this.outputLevels = [...(state.outputLevels || [])];
        this.crosspoints = state.crosspoints ? 
            state.crosspoints.map(row => [...row]) : this.crosspoints;
        this.inputMutes = [...(state.inputMutes || [])];
        this.outputMutes = [...(state.outputMutes || [])];
        
        // Restore gangs
        if (state.gangs) {
            this.gangs.clear();
            state.gangs.forEach(gang => {
                this.gangs.set(gang.id, new Set(gang.members));
            });
        }
        
        this.notifyChange('state', null, null, state);
    }
    
    // === Change Notifications ===
    
    onChange(callback) {
        this.changeCallbacks.push(callback);
    }
    
    notifyChange(type, input, output, value) {
        this.changeCallbacks.forEach(callback => {
            callback({ type, input, output, value });
        });
    }
    
    // === Matrix Operations ===
    
    clear() {
        this.mainLevel = 0;
        this.inputLevels.fill(0);
        this.outputLevels.fill(0);
        this.crosspoints = Array(this.numInputs).fill(null).map(() => 
            new Array(this.numOutputs).fill(null)
        );
        this.inputMutes.fill(false);
        this.outputMutes.fill(false);
        this.inputSolos.fill(false);
        this.outputSolos.fill(false);
        this.gangs.clear();
        this.notifyChange('clear', null, null, null);
    }
    
    setSilent() {
        for (let i = 0; i < this.numInputs; i++) {
            for (let o = 0; o < this.numOutputs; o++) {
                this.crosspoints[i][o] = null;
            }
        }
        this.notifyChange('silent', null, null, null);
    }
    
    setUnity() {
        // Set diagonal crosspoints to 0dB
        const max = Math.min(this.numInputs, this.numOutputs);
        for (let i = 0; i < max; i++) {
            this.setCrosspoint(i, i, 0);
        }
    }
    
    // === Analysis ===
    
    getActiveRoutes() {
        const routes = [];
        for (let i = 0; i < this.numInputs; i++) {
            for (let o = 0; o < this.numOutputs; o++) {
                const gain = this.calculateGain(i, o);
                if (gain > 0) {
                    routes.push({
                        input: i,
                        output: o,
                        gain: gain,
                        gainDb: this.gainToDb(gain)
                    });
                }
            }
        }
        return routes;
    }
}

// Export for use
window.MatrixMixer = MatrixMixer;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MatrixMixer;
}
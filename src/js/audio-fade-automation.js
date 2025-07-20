/**
 * Fade Automation System - Matches QLab's fade capabilities
 * Handles real-time parameter automation for audio effects and routing
 */

class FadeAutomation {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.activeFades = new Map(); // fadeId -> fadeData
        this.fadeId = 0;
        this.updateInterval = null;
        this.startUpdateLoop();
    }
    
    /**
     * Create a fade for any audio parameter
     * @param {Object} target - The target object containing the parameter
     * @param {string} parameterPath - Dot notation path to parameter (e.g., 'effects.0.parameters.wetGain.value')
     * @param {number} startValue - Starting value
     * @param {number} endValue - Target value
     * @param {number} duration - Duration in seconds
     * @param {string} curve - Fade curve type ('linear', 'exponential', 'logarithmic', 'sCurve')
     * @param {Function} onComplete - Callback when fade completes
     * @returns {number} Fade ID for tracking/canceling
     */
    createFade(target, parameterPath, startValue, endValue, duration, curve = 'linear', onComplete = null) {
        const fadeId = ++this.fadeId;
        const startTime = this.audioContext.currentTime;
        
        const fadeData = {
            id: fadeId,
            target,
            parameterPath,
            startValue,
            endValue,
            duration,
            curve,
            startTime,
            onComplete,
            active: true
        };
        
        this.activeFades.set(fadeId, fadeData);
        
        // Set initial value
        this.setParameterValue(target, parameterPath, startValue);
        
        console.log(`Started fade ${fadeId}: ${parameterPath} from ${startValue} to ${endValue} over ${duration}s`);
        return fadeId;
    }
    
    /**
     * Cancel an active fade
     */
    cancelFade(fadeId) {
        const fade = this.activeFades.get(fadeId);
        if (fade) {
            fade.active = false;
            this.activeFades.delete(fadeId);
            console.log(`Cancelled fade ${fadeId}`);
        }
    }
    
    /**
     * Cancel all fades for a specific target
     */
    cancelFadesForTarget(target) {
        for (const [fadeId, fade] of this.activeFades) {
            if (fade.target === target) {
                this.cancelFade(fadeId);
            }
        }
    }
    
    /**
     * Update loop for processing active fades
     */
    startUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Update at ~60fps for smooth automation
        this.updateInterval = setInterval(() => {
            this.updateFades();
        }, 16);
    }
    
    updateFades() {
        const currentTime = this.audioContext.currentTime;
        const completedFades = [];
        
        for (const [fadeId, fade] of this.activeFades) {
            if (!fade.active) continue;
            
            const elapsed = currentTime - fade.startTime;
            const progress = Math.min(elapsed / fade.duration, 1.0);
            
            if (progress >= 1.0) {
                // Fade complete
                this.setParameterValue(fade.target, fade.parameterPath, fade.endValue);
                completedFades.push(fadeId);
                
                if (fade.onComplete) {
                    try {
                        fade.onComplete();
                    } catch (error) {
                        console.error('Fade completion callback error:', error);
                    }
                }
            } else {
                // Calculate intermediate value based on curve
                const curveProgress = this.applyCurve(progress, fade.curve);
                const currentValue = this.interpolate(fade.startValue, fade.endValue, curveProgress);
                this.setParameterValue(fade.target, fade.parameterPath, currentValue);
            }
        }
        
        // Clean up completed fades
        completedFades.forEach(fadeId => {
            this.activeFades.delete(fadeId);
        });
    }
    
    /**
     * Apply fade curve to linear progress
     */
    applyCurve(progress, curve) {
        switch (curve) {
            case 'exponential':
                return Math.pow(progress, 2);
                
            case 'logarithmic':
                return Math.sqrt(progress);
                
            case 'sCurve':
                // Smooth S-curve (ease in/out)
                return progress * progress * (3 - 2 * progress);
                
            case 'easeIn':
                return Math.pow(progress, 3);
                
            case 'easeOut':
                return 1 - Math.pow(1 - progress, 3);
                
            case 'linear':
            default:
                return progress;
        }
    }
    
    /**
     * Interpolate between two values
     */
    interpolate(start, end, progress) {
        return start + (end - start) * progress;
    }
    
    /**
     * Set parameter value using dot notation path
     */
    setParameterValue(target, parameterPath, value) {
        const parts = parameterPath.split('.');
        let current = target;
        
        // Navigate to the parent object
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (current[part] === undefined) {
                console.error(`Parameter path not found: ${parameterPath} at ${part}`);
                return false;
            }
            current = current[part];
        }
        
        // Set the final value
        const finalKey = parts[parts.length - 1];
        if (current[finalKey] !== undefined) {
            current[finalKey] = value;
            
            // If this is an effect parameter, call setParameter method
            if (parameterPath.includes('parameters') && current.setParameter) {
                const paramName = parts[parts.length - 2]; // Get parameter name
                current.setParameter(paramName, value);
            }
            
            return true;
        } else {
            console.error(`Parameter not found: ${parameterPath}`);
            return false;
        }
    }
    
    /**
     * Get current parameter value
     */
    getParameterValue(target, parameterPath) {
        const parts = parameterPath.split('.');
        let current = target;
        
        for (const part of parts) {
            if (current[part] === undefined) {
                return null;
            }
            current = current[part];
        }
        
        return current;
    }
    
    /**
     * Create complex fade sequences (like QLab's fade cues)
     */
    createFadeSequence(fadeSteps) {
        const sequence = {
            id: ++this.fadeId,
            steps: fadeSteps,
            currentStep: 0,
            active: true
        };
        
        this.executeNextFadeStep(sequence);
        return sequence.id;
    }
    
    executeNextFadeStep(sequence) {
        if (!sequence.active || sequence.currentStep >= sequence.steps.length) {
            return;
        }
        
        const step = sequence.steps[sequence.currentStep];
        const fadeId = this.createFade(
            step.target,
            step.parameterPath,
            step.startValue,
            step.endValue,
            step.duration,
            step.curve,
            () => {
                sequence.currentStep++;
                this.executeNextFadeStep(sequence);
            }
        );
        
        console.log(`Executing fade sequence step ${sequence.currentStep + 1}/${sequence.steps.length}`);
    }
    
    /**
     * Stop all fades and cleanup
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.activeFades.clear();
    }
}

/**
 * Enhanced Fade Cue implementation with audio effects support
 */
class FadeCue {
    constructor(id, audioEngine) {
        this.id = id;
        this.type = 'fade';
        this.name = `Fade ${id}`;
        this.audioEngine = audioEngine;
        this.fadeAutomation = audioEngine.fadeAutomation;
        
        // Fade configuration
        this.targetCueId = null;
        this.targetPatchId = null;
        this.duration = 3.0; // seconds
        this.curve = 'linear';
        this.stopTargetWhenDone = false;
        this.absoluteFade = true; // vs relative fade
        
        // Parameter fades to execute
        this.parameterFades = [];
        
        // Audio level fades (matrix mixer)
        this.levelFades = [];
        
        // Effect parameter fades
        this.effectFades = [];
        
        // Execution state
        this.isRunning = false;
        this.activeFadeIds = [];
        this.startTime = null;
    }
    
    /**
     * Set the target cue for this fade
     */
    setTargetCue(cueId) {
        this.targetCueId = cueId;
        this.targetPatchId = null;
    }
    
    /**
     * Set the target patch for this fade
     */
    setTargetPatch(patchId) {
        this.targetPatchId = patchId;
        this.targetCueId = null;
    }
    
    /**
     * Add a level fade (matrix mixer crosspoint)
     */
    addLevelFade(input, output, targetLevel) {
        this.levelFades.push({
            input,
            output,
            targetLevel,
            active: true
        });
    }
    
    /**
     * Add an effect parameter fade
     */
    addEffectFade(effectIndex, parameterName, targetValue) {
        this.effectFades.push({
            effectIndex,
            parameterName,
            targetValue,
            active: true
        });
    }
    
    /**
     * Add a custom parameter fade
     */
    addParameterFade(parameterPath, targetValue) {
        this.parameterFades.push({
            parameterPath,
            targetValue,
            active: true
        });
    }
    
    /**
     * Copy current levels from target (like QLab's "Set Levels from Target")
     */
    setLevelsFromTarget() {
        const targetCue = this.getTargetCue();
        if (!targetCue) return false;
        
        // Clear existing level fades
        this.levelFades = [];
        
        // Copy matrix levels
        if (targetCue.cueMatrix) {
            const matrix = targetCue.cueMatrix;
            for (let input = 0; input < matrix.numInputs; input++) {
                for (let output = 0; output < matrix.numOutputs; output++) {
                    const currentLevel = matrix.getCrosspoint(input, output);
                    if (currentLevel !== null) {
                        this.addLevelFade(input, output, currentLevel);
                    }
                }
            }
        }
        
        // Copy effect parameters
        if (targetCue.effectsChain) {
            this.effectFades = [];
            for (let i = 0; i < targetCue.effectsChain.getEffectCount(); i++) {
                const effect = targetCue.effectsChain.getEffect(i);
                for (const [paramName, param] of Object.entries(effect.parameters)) {
                    this.addEffectFade(i, paramName, param.value);
                }
            }
        }
        
        return true;
    }
    
    /**
     * Set all levels to silent
     */
    setAllSilentLevels() {
        this.levelFades.forEach(fade => {
            fade.targetLevel = -Infinity; // Silent
        });
        
        this.effectFades.forEach(fade => {
            if (fade.parameterName.includes('Gain') || fade.parameterName.includes('Level')) {
                fade.targetValue = -60; // Very quiet
            }
        });
    }
    
    /**
     * Execute the fade
     */
    async play() {
        if (this.isRunning) {
            console.warn(`Fade cue ${this.id} is already running`);
            return false;
        }
        
        const targetCue = this.getTargetCue();
        const targetPatch = this.getTargetPatch();
        
        if (!targetCue && !targetPatch) {
            console.error(`Fade cue ${this.id} has no valid target`);
            return false;
        }
        
        this.isRunning = true;
        this.startTime = this.audioEngine.audioContext.currentTime;
        this.activeFadeIds = [];
        
        console.log(`Starting fade cue ${this.id} (duration: ${this.duration}s)`);
        
        // Execute level fades
        if (targetCue && targetCue.cueMatrix) {
            this.executeLevelFades(targetCue.cueMatrix);
        }
        
        // Execute effect fades
        if (targetCue && targetCue.effectsChain) {
            this.executeEffectFades(targetCue.effectsChain);
        }
        
        // Execute custom parameter fades
        this.executeParameterFades(targetCue || targetPatch);
        
        // Set up completion callback
        setTimeout(() => {
            this.onFadeComplete(targetCue);
        }, this.duration * 1000);
        
        return true;
    }
    
    executeLevelFades(matrix) {
        this.levelFades.forEach(fade => {
            if (!fade.active) return;
            
            const currentLevel = matrix.getCrosspoint(fade.input, fade.output);
            if (currentLevel === null) return;
            
            const startValue = this.absoluteFade ? currentLevel : 0;
            const endValue = this.absoluteFade ? fade.targetLevel : startValue + fade.targetLevel;
            
            const fadeId = this.fadeAutomation.createFade(
                matrix,
                `crosspoints.${fade.input}.${fade.output}`,
                startValue,
                endValue,
                this.duration,
                this.curve
            );
            
            this.activeFadeIds.push(fadeId);
        });
    }
    
    executeEffectFades(effectsChain) {
        this.effectFades.forEach(fade => {
            if (!fade.active) return;
            
            const effect = effectsChain.getEffect(fade.effectIndex);
            if (!effect || !effect.parameters[fade.parameterName]) return;
            
            const currentValue = effect.parameters[fade.parameterName].value;
            const startValue = this.absoluteFade ? currentValue : 0;
            const endValue = this.absoluteFade ? fade.targetValue : startValue + fade.targetValue;
            
            const fadeId = this.fadeAutomation.createFade(
                effect,
                `parameters.${fade.parameterName}.value`,
                startValue,
                endValue,
                this.duration,
                this.curve
            );
            
            this.activeFadeIds.push(fadeId);
        });
    }
    
    executeParameterFades(target) {
        this.parameterFades.forEach(fade => {
            if (!fade.active) return;
            
            const currentValue = this.fadeAutomation.getParameterValue(target, fade.parameterPath);
            if (currentValue === null) return;
            
            const startValue = this.absoluteFade ? currentValue : 0;
            const endValue = this.absoluteFade ? fade.targetValue : startValue + fade.targetValue;
            
            const fadeId = this.fadeAutomation.createFade(
                target,
                fade.parameterPath,
                startValue,
                endValue,
                this.duration,
                this.curve
            );
            
            this.activeFadeIds.push(fadeId);
        });
    }
    
    /**
     * Stop the fade
     */
    stop() {
        if (!this.isRunning) return;
        
        console.log(`Stopping fade cue ${this.id}`);
        
        // Cancel all active fades
        this.activeFadeIds.forEach(fadeId => {
            this.fadeAutomation.cancelFade(fadeId);
        });
        
        this.isRunning = false;
        this.activeFadeIds = [];
    }
    
    onFadeComplete(targetCue) {
        console.log(`Fade cue ${this.id} completed`);
        
        this.isRunning = false;
        this.activeFadeIds = [];
        
        // Stop target if configured to do so
        if (this.stopTargetWhenDone && targetCue && targetCue.stop) {
            targetCue.stop();
        }
        
        // Emit completion event
        if (this.onComplete) {
            this.onComplete();
        }
    }
    
    getTargetCue() {
        if (!this.targetCueId || !this.audioEngine.cueManager) return null;
        return this.audioEngine.cueManager.getCue(this.targetCueId);
    }
    
    getTargetPatch() {
        if (!this.targetPatchId || !this.audioEngine) return null;
        return this.audioEngine.getOutputPatch(this.targetPatchId);
    }
    
    /**
     * Get fade configuration for UI display
     */
    getFadeConfiguration() {
        return {
            targetType: this.targetCueId ? 'cue' : 'patch',
            targetId: this.targetCueId || this.targetPatchId,
            duration: this.duration,
            curve: this.curve,
            absoluteFade: this.absoluteFade,
            stopTargetWhenDone: this.stopTargetWhenDone,
            levelFadeCount: this.levelFades.filter(f => f.active).length,
            effectFadeCount: this.effectFades.filter(f => f.active).length,
            parameterFadeCount: this.parameterFades.filter(f => f.active).length
        };
    }
}

/**
 * Integration with Professional Audio Engine
 */
class AudioEngineWithFades extends ProfessionalAudioEngine {
    constructor() {
        super();
        this.fadeAutomation = null;
        this.fadeCues = new Map();
        
        // Initialize fade system after audio context is ready
        this.audioContext.addEventListener('statechange', () => {
            if (this.audioContext.state === 'running' && !this.fadeAutomation) {
                this.fadeAutomation = new FadeAutomation(this.audioContext);
                console.log('✅ Fade automation system initialized');
            }
        });
    }
    
    /**
     * Create a fade cue
     */
    createFadeCue(id) {
        const fadeCue = new FadeCue(id, this);
        this.fadeCues.set(id, fadeCue);
        return fadeCue;
    }
    
    /**
     * Get fade cue
     */
    getFadeCue(id) {
        return this.fadeCues.get(id);
    }
    
    /**
     * Quick fade utility methods
     */
    fadeVolumeOut(cue, duration = 3.0) {
        if (!this.fadeAutomation || !cue.cueMatrix) return null;
        
        return this.fadeAutomation.createFade(
            cue.cueMatrix,
            'mainLevel',
            cue.cueMatrix.mainLevel,
            -60,
            duration,
            'exponential'
        );
    }
    
    fadeVolumeIn(cue, duration = 3.0, targetLevel = 0) {
        if (!this.fadeAutomation || !cue.cueMatrix) return null;
        
        return this.fadeAutomation.createFade(
            cue.cueMatrix,
            'mainLevel',
            cue.cueMatrix.mainLevel,
            targetLevel,
            duration,
            'logarithmic'
        );
    }
    
    crossfade(fromCue, toCue, duration = 3.0) {
        if (!this.fadeAutomation) return null;
        
        const fadeIds = [];
        
        // Fade out the first cue
        if (fromCue.cueMatrix) {
            fadeIds.push(this.fadeVolumeOut(fromCue, duration));
        }
        
        // Fade in the second cue
        if (toCue.cueMatrix) {
            fadeIds.push(this.fadeVolumeIn(toCue, duration));
        }
        
        return fadeIds;
    }
    
    /**
     * Enhanced cleanup
     */
    destroy() {
        if (this.fadeAutomation) {
            this.fadeAutomation.destroy();
        }
        super.destroy?.();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FadeAutomation,
        FadeCue,
        AudioEngineWithFades
    };
} else {
    window.FadeAutomation = FadeAutomation;
    window.FadeCue = FadeCue;
    window.AudioEngineWithFades = AudioEngineWithFades;
}
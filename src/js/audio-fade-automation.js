/**
 * Audio Fade Automation System
 * Provides QLab-style fade automation for audio parameters
 */

// Base Audio Engine class if not already defined
if (typeof AudioEngine === 'undefined') {
    class AudioEngine {
        constructor() {
            this.audioContext = null;
            this.cues = new Map();
            this.masterVolume = 1;
            this.masterGainNode = null;
            this.initialized = false;
        }
        
        async initializeAudioContext() {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGainNode = this.audioContext.createGain();
                this.masterGainNode.connect(this.audioContext.destination);
                this.initialized = true;
                console.log('Audio context initialized');
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
                throw error;
            }
        }
        
        getCue(id) {
            return this.cues.get(id);
        }
        
        stopAllCues() {
            this.cues.forEach(cue => {
                if (cue.stop) cue.stop();
            });
        }
    }
    
    window.AudioEngine = AudioEngine;
}

// Fade Automation System
class FadeAutomation {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.activeFades = new Map();
        this.fadeId = 0;
    }
    
    createFade(targetParam, startValue, endValue, duration, curve = 'linear') {
        const fadeId = this.fadeId++;
        const startTime = this.audioContext.currentTime;
        
        const fade = {
            id: fadeId,
            targetParam,
            startValue,
            endValue,
            duration,
            curve,
            startTime,
            endTime: startTime + duration / 1000, // Convert ms to seconds
            completed: false,
            cancelled: false
        };
        
        this.activeFades.set(fadeId, fade);
        this.scheduleFade(fade);
        
        return fadeId;
    }
    
    scheduleFade(fade) {
        const { targetParam, startValue, endValue, startTime, endTime, curve } = fade;
        
        // Cancel any existing automation
        targetParam.cancelScheduledValues(startTime);
        
        // Set initial value
        targetParam.setValueAtTime(startValue, startTime);
        
        // Apply the appropriate curve
        switch (curve) {
            case 'linear':
                targetParam.linearRampToValueAtTime(endValue, endTime);
                break;
                
            case 'exponential':
                // Exponential ramps can't use zero values
                const safeEndValue = endValue === 0 ? 0.00001 : endValue;
                const safeStartValue = startValue === 0 ? 0.00001 : startValue;
                targetParam.setValueAtTime(safeStartValue, startTime);
                targetParam.exponentialRampToValueAtTime(safeEndValue, endTime);
                break;
                
            case 'logarithmic':
                // Custom logarithmic curve using setValueCurveAtTime
                const steps = 100;
                const curveArray = new Float32Array(steps);
                for (let i = 0; i < steps; i++) {
                    const t = i / (steps - 1);
                    const logT = Math.log(1 + t * 9) / Math.log(10); // log10(1 to 10)
                    curveArray[i] = startValue + (endValue - startValue) * logT;
                }
                targetParam.setValueCurveAtTime(curveArray, startTime, endTime - startTime);
                break;
                
            case 's-curve':
                // S-curve (ease-in-out)
                const sCurveSteps = 100;
                const sCurveArray = new Float32Array(sCurveSteps);
                for (let i = 0; i < sCurveSteps; i++) {
                    const t = i / (sCurveSteps - 1);
                    const s = t * t * (3 - 2 * t); // Smoothstep function
                    sCurveArray[i] = startValue + (endValue - startValue) * s;
                }
                targetParam.setValueCurveAtTime(sCurveArray, startTime, endTime - startTime);
                break;
                
            default:
                targetParam.linearRampToValueAtTime(endValue, endTime);
        }
        
        // Schedule completion check
        const checkCompletion = () => {
            if (this.audioContext.currentTime >= endTime) {
                fade.completed = true;
                this.activeFades.delete(fade.id);
            } else if (!fade.cancelled) {
                requestAnimationFrame(checkCompletion);
            }
        };
        requestAnimationFrame(checkCompletion);
    }
    
    cancelFade(fadeId) {
        const fade = this.activeFades.get(fadeId);
        if (fade && !fade.completed) {
            fade.cancelled = true;
            fade.targetParam.cancelScheduledValues(this.audioContext.currentTime);
            this.activeFades.delete(fadeId);
            return true;
        }
        return false;
    }
    
    cancelAllFades() {
        this.activeFades.forEach(fade => {
            this.cancelFade(fade.id);
        });
    }
}

// Audio Engine with Fade Support
class AudioEngineWithFades extends AudioEngine {
    constructor() {
        super();
        this.fadeAutomation = null;
    }
    
    async initializeAudioContext() {
        await super.initializeAudioContext();
        this.fadeAutomation = new FadeAutomation(this.audioContext);
    }
    
    // Fade master volume
    fadeMasterVolume(targetVolume, duration, curve = 'logarithmic') {
        if (!this.masterGainNode) return null;
        
        const currentVolume = this.masterGainNode.gain.value;
        return this.fadeAutomation.createFade(
            this.masterGainNode.gain,
            currentVolume,
            targetVolume,
            duration,
            curve
        );
    }
    
    // Fade cue volume
    fadeCueVolume(cueId, targetVolume, duration, curve = 'logarithmic') {
        const cue = this.getCue(cueId);
        if (!cue || !cue.gainNode) return null;
        
        const currentVolume = cue.gainNode.gain.value;
        return this.fadeAutomation.createFade(
            cue.gainNode.gain,
            currentVolume,
            targetVolume,
            duration,
            curve
        );
    }
    
    // Fade cue to silence and stop
    fadeOutAndStop(cueId, duration = 1000) {
        const cue = this.getCue(cueId);
        if (!cue || !cue.isPlaying) return;
        
        const fadeId = this.fadeCueVolume(cueId, 0, duration);
        
        // Schedule stop after fade completes
        setTimeout(() => {
            if (cue.stop) cue.stop();
        }, duration);
        
        return fadeId;
    }
    
    // Cross-fade between two cues
    crossFade(fromCueId, toCueId, duration = 2000) {
        const fromCue = this.getCue(fromCueId);
        const toCue = this.getCue(toCueId);
        
        if (!fromCue || !toCue) return null;
        
        // Start the target cue at zero volume
        if (toCue.gainNode) {
            toCue.gainNode.gain.value = 0;
        }
        if (toCue.play && !toCue.isPlaying) {
            toCue.play();
        }
        
        // Fade out source and fade in target
        const fadeOutId = this.fadeCueVolume(fromCueId, 0, duration);
        const fadeInId = this.fadeCueVolume(toCueId, 1, duration);
        
        // Stop source cue after fade
        setTimeout(() => {
            if (fromCue.stop) fromCue.stop();
        }, duration);
        
        return { fadeOutId, fadeInId };
    }
}

// Export the class for use in audio-engine.js
window.AudioEngineWithFades = AudioEngineWithFades;

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FadeAutomation,
        AudioEngineWithFades
    };
}
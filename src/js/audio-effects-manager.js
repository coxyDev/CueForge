/**
 * Audio Effects Manager
 * Manages audio effects chains and processing for cues
 */

class EffectsChain {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.effects = [];
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.effectNodes = new Map();
        
        // Connect input directly to output initially
        this.inputNode.connect(this.outputNode);
    }
    
    addEffect(effect) {
        this.effects.push(effect);
        this.effectNodes.set(effect.name, effect);
        this.rebuildChain();
        return effect;
    }
    
    removeEffect(effectName) {
        const index = this.effects.findIndex(e => e.name === effectName);
        if (index !== -1) {
            const effect = this.effects[index];
            effect.disconnect();
            this.effects.splice(index, 1);
            this.effectNodes.delete(effectName);
            this.rebuildChain();
            return true;
        }
        return false;
    }
    
    rebuildChain() {
        // Disconnect everything
        this.inputNode.disconnect();
        this.effects.forEach(effect => effect.disconnect());
        
        if (this.effects.length === 0) {
            // No effects, connect input directly to output
            this.inputNode.connect(this.outputNode);
        } else {
            // Connect effects in series
            let previousNode = this.inputNode;
            
            for (const effect of this.effects) {
                if (!effect.bypassed) {
                    previousNode.connect(effect.inputNode);
                    previousNode = effect.outputNode;
                }
            }
            
            // Connect last effect to output
            previousNode.connect(this.outputNode);
        }
    }
    
    getEffect(effectName) {
        return this.effectNodes.get(effectName);
    }
    
    bypassEffect(effectName, bypass) {
        const effect = this.getEffect(effectName);
        if (effect) {
            effect.bypass(bypass);
            this.rebuildChain();
            return true;
        }
        return false;
    }
    
    getEffectCount() {
        return this.effects.length;
    }
    
    clear() {
        this.effects.forEach(effect => effect.disconnect());
        this.effects = [];
        this.effectNodes.clear();
        this.rebuildChain();
    }
    
    connect(destination) {
        this.outputNode.connect(destination);
    }
    
    disconnect() {
        this.outputNode.disconnect();
    }
}

class ProfessionalAudioManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.effectsChains = new Map();
        this.presets = new Map();
        
        // Initialize default presets
        this.initializePresets();
    }
    
    initializePresets() {
        // Vocal preset
        this.presets.set('vocal', {
            name: 'Vocal',
            effects: [
                { type: 'eq', settings: { lowMid: 3, highMid: 2, high: 1 } },
                { type: 'compressor', settings: { threshold: -20, ratio: 3 } },
                { type: 'reverb', settings: { wetMix: 0.15 } }
            ]
        });
        
        // Music preset
        this.presets.set('music', {
            name: 'Music',
            effects: [
                { type: 'eq', settings: { low: 2, high: 1 } },
                { type: 'compressor', settings: { threshold: -24, ratio: 2 } }
            ]
        });
        
        // SFX preset
        this.presets.set('sfx', {
            name: 'Sound Effects',
            effects: [
                { type: 'eq', settings: { lowMid: -2, highMid: 3 } },
                { type: 'delay', settings: { time: 0.1, feedback: 0.2, wetMix: 0.3 } }
            ]
        });
    }
    
    createEffectsChain(cueId) {
        if (!this.audioEngine.audioContext) {
            throw new Error('Audio context not initialized');
        }
        
        const chain = new EffectsChain(this.audioEngine.audioContext);
        this.effectsChains.set(cueId, chain);
        return chain;
    }
    
    getEffectsChain(cueId) {
        return this.effectsChains.get(cueId);
    }
    
    addEffectToCue(cueId, effectType, settings = {}) {
        let chain = this.getEffectsChain(cueId);
        if (!chain) {
            chain = this.createEffectsChain(cueId);
        }
        
        const effect = this.createEffect(effectType, settings);
        if (effect) {
            chain.addEffect(effect);
            return effect;
        }
        
        return null;
    }
    
    createEffect(type, settings = {}) {
        const audioContext = this.audioEngine.audioContext;
        let effect = null;
        
        switch (type.toLowerCase()) {
            case 'reverb':
                effect = new ReverbEffect(audioContext);
                if (settings.wetMix !== undefined) effect.setWetMix(settings.wetMix);
                break;
                
            case 'delay':
                effect = new DelayEffect(audioContext);
                if (settings.time !== undefined) effect.setDelayTime(settings.time);
                if (settings.feedback !== undefined) effect.setFeedback(settings.feedback);
                if (settings.wetMix !== undefined) effect.setWetMix(settings.wetMix);
                break;
                
            case 'eq':
                effect = new EQEffect(audioContext);
                if (settings.low !== undefined) effect.setLowGain(settings.low);
                if (settings.lowMid !== undefined) effect.setLowMidGain(settings.lowMid);
                if (settings.highMid !== undefined) effect.setHighMidGain(settings.highMid);
                if (settings.high !== undefined) effect.setHighGain(settings.high);
                break;
                
            case 'compressor':
                effect = new CompressorEffect(audioContext);
                if (settings.threshold !== undefined) effect.setThreshold(settings.threshold);
                if (settings.ratio !== undefined) effect.setRatio(settings.ratio);
                if (settings.attack !== undefined) effect.setAttack(settings.attack);
                if (settings.release !== undefined) effect.setRelease(settings.release);
                break;
        }
        
        return effect;
    }
    
    applyPresetToCue(cueId, presetName) {
        const preset = this.presets.get(presetName);
        if (!preset) return false;
        
        // Clear existing effects
        let chain = this.getEffectsChain(cueId);
        if (!chain) {
            chain = this.createEffectsChain(cueId);
        } else {
            chain.clear();
        }
        
        // Apply preset effects
        for (const effectConfig of preset.effects) {
            this.addEffectToCue(cueId, effectConfig.type, effectConfig.settings);
        }
        
        return true;
    }
    
    removeEffectFromCue(cueId, effectName) {
        const chain = this.getEffectsChain(cueId);
        if (chain) {
            return chain.removeEffect(effectName);
        }
        return false;
    }
    
    clearCueEffects(cueId) {
        const chain = this.getEffectsChain(cueId);
        if (chain) {
            chain.clear();
            return true;
        }
        return false;
    }
    
    savePreset(name, cueId) {
        const chain = this.getEffectsChain(cueId);
        if (!chain) return false;
        
        const preset = {
            name,
            effects: chain.effects.map(effect => ({
                type: effect.name.toLowerCase(),
                settings: this.extractEffectSettings(effect)
            }))
        };
        
        this.presets.set(name, preset);
        return true;
    }
    
    extractEffectSettings(effect) {
        const settings = {};
        
        // Extract settings based on effect type
        switch (effect.name.toLowerCase()) {
            case 'reverb':
                settings.wetMix = effect.wetMix;
                break;
            case 'delay':
                settings.time = effect.delay.delayTime.value;
                settings.feedback = effect.feedback.gain.value;
                settings.wetMix = effect.wetMix;
                break;
            case 'eq':
                settings.low = effect.lowShelf.gain.value;
                settings.lowMid = effect.lowMid.gain.value;
                settings.highMid = effect.highMid.gain.value;
                settings.high = effect.highShelf.gain.value;
                break;
            case 'compressor':
                settings.threshold = effect.compressor.threshold.value;
                settings.ratio = effect.compressor.ratio.value;
                settings.attack = effect.compressor.attack.value;
                settings.release = effect.compressor.release.value;
                break;
        }
        
        return settings;
    }
}

// Export ProfessionalAudioManager globally
window.ProfessionalAudioManager = ProfessionalAudioManager;

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EffectsChain,
        ProfessionalAudioManager
    };
}
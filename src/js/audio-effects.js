/**
 * Audio Effects Base Classes
 * Provides foundation for audio effects processing
 */

class AudioEffect {
    constructor(audioContext, name = 'Effect') {
        this.audioContext = audioContext;
        this.name = name;
        this.inputNode = null;
        this.outputNode = null;
        this.bypassed = false;
        this.wetMix = 1.0;
    }
    
    connect(destination) {
        if (this.outputNode) {
            this.outputNode.connect(destination);
        }
        return destination;
    }
    
    disconnect() {
        if (this.outputNode) {
            this.outputNode.disconnect();
        }
    }
    
    bypass(shouldBypass) {
        this.bypassed = shouldBypass;
    }
    
    setWetMix(value) {
        this.wetMix = Math.max(0, Math.min(1, value));
    }
}

class ReverbEffect extends AudioEffect {
    constructor(audioContext) {
        super(audioContext, 'Reverb');
        
        // Create convolver node
        this.convolver = audioContext.createConvolver();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        
        // Set up routing
        this.inputNode = audioContext.createGain();
        this.outputNode = this.outputGain;
        
        // Connect nodes
        this.inputNode.connect(this.convolver);
        this.inputNode.connect(this.dryGain);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.outputGain);
        this.dryGain.connect(this.outputGain);
        
        // Default settings
        this.setWetMix(0.3);
        
        // Load impulse response
        this.loadImpulseResponse();
    }
    
    async loadImpulseResponse() {
        // Create synthetic impulse response
        const length = this.audioContext.sampleRate * 2; // 2 seconds
        const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        this.convolver.buffer = impulse;
    }
    
    setWetMix(value) {
        super.setWetMix(value);
        this.wetGain.gain.value = value;
        this.dryGain.gain.value = 1 - value;
    }
}

class DelayEffect extends AudioEffect {
    constructor(audioContext) {
        super(audioContext, 'Delay');
        
        // Create delay node
        this.delay = audioContext.createDelay(5.0); // Max 5 seconds
        this.feedback = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        
        // Set up routing
        this.inputNode = audioContext.createGain();
        this.outputNode = this.outputGain;
        
        // Connect nodes
        this.inputNode.connect(this.delay);
        this.inputNode.connect(this.dryGain);
        this.delay.connect(this.feedback);
        this.delay.connect(this.wetGain);
        this.feedback.connect(this.delay);
        this.wetGain.connect(this.outputGain);
        this.dryGain.connect(this.outputGain);
        
        // Default settings
        this.setDelayTime(0.5);
        this.setFeedback(0.3);
        this.setWetMix(0.5);
    }
    
    setDelayTime(seconds) {
        this.delay.delayTime.value = Math.max(0, Math.min(5, seconds));
    }
    
    setFeedback(value) {
        this.feedback.gain.value = Math.max(0, Math.min(0.95, value));
    }
    
    setWetMix(value) {
        super.setWetMix(value);
        this.wetGain.gain.value = value;
        this.dryGain.gain.value = 1 - value;
    }
}

class EQEffect extends AudioEffect {
    constructor(audioContext) {
        super(audioContext, 'EQ');
        
        // Create filter nodes
        this.lowShelf = audioContext.createBiquadFilter();
        this.lowMid = audioContext.createBiquadFilter();
        this.highMid = audioContext.createBiquadFilter();
        this.highShelf = audioContext.createBiquadFilter();
        
        // Configure filters
        this.lowShelf.type = 'lowshelf';
        this.lowShelf.frequency.value = 320;
        
        this.lowMid.type = 'peaking';
        this.lowMid.frequency.value = 1000;
        this.lowMid.Q.value = 0.5;
        
        this.highMid.type = 'peaking';
        this.highMid.frequency.value = 3200;
        this.highMid.Q.value = 0.5;
        
        this.highShelf.type = 'highshelf';
        this.highShelf.frequency.value = 8000;
        
        // Set up routing
        this.inputNode = this.lowShelf;
        this.outputNode = this.highShelf;
        
        // Connect in series
        this.lowShelf.connect(this.lowMid);
        this.lowMid.connect(this.highMid);
        this.highMid.connect(this.highShelf);
    }
    
    setLowGain(db) {
        this.lowShelf.gain.value = db;
    }
    
    setLowMidGain(db) {
        this.lowMid.gain.value = db;
    }
    
    setHighMidGain(db) {
        this.highMid.gain.value = db;
    }
    
    setHighGain(db) {
        this.highShelf.gain.value = db;
    }
}

class CompressorEffect extends AudioEffect {
    constructor(audioContext) {
        super(audioContext, 'Compressor');
        
        // Create dynamics compressor
        this.compressor = audioContext.createDynamicsCompressor();
        
        // Set up routing
        this.inputNode = this.compressor;
        this.outputNode = this.compressor;
        
        // Default settings
        this.setThreshold(-24);
        this.setRatio(4);
        this.setAttack(0.003);
        this.setRelease(0.25);
    }
    
    setThreshold(db) {
        this.compressor.threshold.value = db;
    }
    
    setRatio(ratio) {
        this.compressor.ratio.value = ratio;
    }
    
    setAttack(seconds) {
        this.compressor.attack.value = seconds;
    }
    
    setRelease(seconds) {
        this.compressor.release.value = seconds;
    }
    
    setKnee(db) {
        if (this.compressor.knee) {
            this.compressor.knee.value = db;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AudioEffect,
        ReverbEffect,
        DelayEffect,
        EQEffect,
        CompressorEffect
    };
}
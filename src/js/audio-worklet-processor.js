// High-performance audio processing worklet
class ProfessionalAudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.cueId = options.processorOptions.cueId;
        this.gainReduction = 0;
        this.peakLevel = 0;
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (input.length > 0) {
            for (let channel = 0; channel < input.length; channel++) {
                const inputChannel = input[channel];
                const outputChannel = output[channel];
                
                for (let i = 0; i < inputChannel.length; i++) {
                    // High-performance audio processing here
                    outputChannel[i] = inputChannel[i];
                    
                    // Track peak levels
                    this.peakLevel = Math.max(this.peakLevel, Math.abs(inputChannel[i]));
                }
            }
        }
        
        // Send level data back to main thread
        this.port.postMessage({
            type: 'levelData',
            cueId: this.cueId,
            peakLevel: this.peakLevel,
            gainReduction: this.gainReduction
        });
        
        this.peakLevel *= 0.95; // Decay
        
        return true;
    }
}

registerProcessor('professional-audio-processor', ProfessionalAudioProcessor);
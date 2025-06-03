class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.cache = new Map(); // filePath -> waveform data
        this.initializeContext();
    }

    async initializeContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('Audio analyzer initialized');
        } catch (error) {
            console.error('Failed to initialize audio analyzer:', error);
        }
    }

    async ensureContext() {
        if (!this.initialized) {
            await this.initializeContext();
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Convert file path to proper URL (same as audio engine)
    getFileUrl(filePath) {
        if (!filePath) return null;
        
        if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
            return filePath;
        }
        
        if (filePath.startsWith('file://')) {
            return filePath;
        }
        
        let normalizedPath = filePath.replace(/\\/g, '/');
        
        if (normalizedPath.match(/^[A-Z]:/i)) {
            return `file:///${normalizedPath}`;
        }
        
        if (normalizedPath.startsWith('/')) {
            return `file://${normalizedPath}`;
        }
        
        return `file://${normalizedPath}`;
    }

    // Generate waveform data from audio file
    async generateWaveform(filePath, options = {}) {
        try {
            await this.ensureContext();

            // Check cache first
            const cacheKey = `${filePath}_${JSON.stringify(options)}`;
            if (this.cache.has(cacheKey)) {
                console.log('Using cached waveform data');
                return this.cache.get(cacheKey);
            }

            console.log('Generating waveform for:', filePath);
            
            const audioUrl = this.getFileUrl(filePath);
            const audioBuffer = await this.loadAudioFile(audioUrl);
            const waveformData = this.analyzeAudioBuffer(audioBuffer, options);
            
            // Cache the result
            this.cache.set(cacheKey, waveformData);
            
            console.log('Waveform generation complete');
            return waveformData;
            
        } catch (error) {
            console.error('Failed to generate waveform:', error);
            throw error;
        }
    }

    // Load and decode audio file
    async loadAudioFile(audioUrl) {
        try {
            console.log('Loading audio file:', audioUrl);
            
            const response = await fetch(audioUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio file: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            console.log(`Audio loaded: ${audioBuffer.duration}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels} channels`);
            return audioBuffer;
            
        } catch (error) {
            console.error('Error loading audio file:', error);
            throw new Error(`Could not load audio file: ${error.message}`);
        }
    }

    // Analyze audio buffer and extract waveform data
    analyzeAudioBuffer(audioBuffer, options = {}) {
        const {
            samples = 1000,           // Number of waveform samples
            channel = 0,              // Which channel to analyze (0 = left, 1 = right, -1 = mix)
            peakDetection = true,     // Enable peak detection
            rmsCalculation = true     // Enable RMS calculation
        } = options;

        const duration = audioBuffer.duration;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        const numberOfChannels = audioBuffer.numberOfChannels;
        
        // Get audio data
        let audioData;
        if (channel === -1 && numberOfChannels > 1) {
            // Mix stereo to mono
            const leftChannel = audioBuffer.getChannelData(0);
            const rightChannel = audioBuffer.getChannelData(1);
            audioData = new Float32Array(leftChannel.length);
            for (let i = 0; i < leftChannel.length; i++) {
                audioData[i] = (leftChannel[i] + rightChannel[i]) / 2;
            }
        } else {
            // Use specified channel or default to 0
            const channelIndex = Math.min(channel, numberOfChannels - 1);
            audioData = audioBuffer.getChannelData(channelIndex);
        }

        // Calculate samples per waveform point
        const samplesPerPoint = Math.floor(length / samples);
        
        const waveformData = {
            duration,
            sampleRate,
            numberOfChannels,
            samples: samples,
            peaks: [],
            rms: [],
            min: [],
            max: [],
            overallPeak: 0,
            overallRMS: 0,
            clippingPoints: []
        };

        let totalRMS = 0;
        let overallMax = 0;

        // Process each waveform point
        for (let i = 0; i < samples; i++) {
            const startIndex = i * samplesPerPoint;
            const endIndex = Math.min(startIndex + samplesPerPoint, audioData.length);
            
            let min = 1;
            let max = -1;
            let sum = 0;
            let sumSquares = 0;
            let count = endIndex - startIndex;

            // Analyze this segment
            for (let j = startIndex; j < endIndex; j++) {
                const sample = audioData[j];
                const abs = Math.abs(sample);
                
                min = Math.min(min, sample);
                max = Math.max(max, sample);
                sum += abs;
                sumSquares += sample * sample;
                
                // Track overall peak
                overallMax = Math.max(overallMax, abs);
                
                // Detect clipping (samples near ±1.0)
                if (abs > 0.99) {
                    waveformData.clippingPoints.push({
                        time: (j / sampleRate),
                        sample: j,
                        value: sample
                    });
                }
            }

            // Calculate statistics for this point
            const peak = Math.max(Math.abs(min), Math.abs(max));
            const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
            
            waveformData.peaks.push(peak);
            waveformData.rms.push(rms);
            waveformData.min.push(min);
            waveformData.max.push(max);
            
            totalRMS += rms;
        }

        // Calculate overall statistics
        waveformData.overallPeak = overallMax;
        waveformData.overallRMS = totalRMS / samples;
        
        // Convert to dB if requested
        waveformData.peakdB = this.linearToDB(waveformData.overallPeak);
        waveformData.rmsdB = this.linearToDB(waveformData.overallRMS);

        console.log(`Waveform analysis complete: Peak=${waveformData.peakdB.toFixed(1)}dB, RMS=${waveformData.rmsdB.toFixed(1)}dB, Clips=${waveformData.clippingPoints.length}`);
        
        return waveformData;
    }

    // Convert linear amplitude to decibels
    linearToDB(linear) {
        if (linear <= 0) return -Infinity;
        return 20 * Math.log10(linear);
    }

    // Convert decibels to linear amplitude
    dbToLinear(db) {
        if (db === -Infinity) return 0;
        return Math.pow(10, db / 20);
    }

    // Generate detailed analysis for specific time range
    async analyzeTimeRange(filePath, startTime, endTime, options = {}) {
        try {
            const audioUrl = this.getFileUrl(filePath);
            const audioBuffer = await this.loadAudioFile(audioUrl);
            
            const sampleRate = audioBuffer.sampleRate;
            const startSample = Math.floor(startTime * sampleRate);
            const endSample = Math.floor(endTime * sampleRate);
            const length = endSample - startSample;
            
            if (length <= 0) {
                throw new Error('Invalid time range');
            }

            // Extract the specified range
            const audioData = audioBuffer.getChannelData(0);
            const rangeData = audioData.slice(startSample, endSample);
            
            // Create a new buffer with just this range
            const rangeBuffer = this.audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                length,
                sampleRate
            );
            
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel).slice(startSample, endSample);
                rangeBuffer.copyToChannel(channelData, channel);
            }
            
            // Analyze the range
            return this.analyzeAudioBuffer(rangeBuffer, {
                ...options,
                samples: Math.min(options.samples || 1000, length / 10) // More detail for smaller ranges
            });
            
        } catch (error) {
            console.error('Failed to analyze time range:', error);
            throw error;
        }
    }

    // Get audio file metadata
    async getAudioMetadata(filePath) {
        try {
            const audioUrl = this.getFileUrl(filePath);
            const audioBuffer = await this.loadAudioFile(audioUrl);
            
            return {
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels,
                length: audioBuffer.length,
                bitDepth: 32, // Web Audio API uses 32-bit float
                estimatedBitrate: Math.round((audioBuffer.length * audioBuffer.numberOfChannels * 32) / audioBuffer.duration / 1000)
            };
        } catch (error) {
            console.error('Failed to get audio metadata:', error);
            return null;
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        console.log('Audio analyzer cache cleared');
    }

    // Get cache size
    getCacheInfo() {
        return {
            entries: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    // Cleanup
    destroy() {
        this.clearCache();
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioAnalyzer;
} else {
    window.AudioAnalyzer = AudioAnalyzer;
}
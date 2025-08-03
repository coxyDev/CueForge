#include "../include/AudioCue.h"
#include "../include/MatrixMixer.h"

AudioCue::AudioCue(const juce::String& id, MatrixMixer* mixer)
    : cueId(id), matrixMixer(mixer)
{
    // Initialize channel routing to default (no routing)
    channelRouting.resize(8, -1); // Support up to 8 channels by default
}

AudioCue::~AudioCue()
{
    unloadFile();
}

bool AudioCue::loadFile(const juce::String& filePath)
{
    unloadFile();
    
    audioFile = juce::File(filePath);
    if (!audioFile.existsAsFile()) {
        return false;
    }
    
    // For now, just mark as loaded - full implementation would use JUCE AudioFormatReader
    fileLoaded.store(true);
    numChannels.store(2); // Assume stereo for now
    sampleRate.store(44100.0);
    lengthInSeconds.store(60.0); // Assume 1 minute for now
    
    initializeSources();
    return true;
}

void AudioCue::unloadFile()
{
    if (playing.load()) {
        stop(0.0);
    }
    
    readerSource.reset();
    transportSource.reset();
    resamplingSource.reset();
    
    fileLoaded.store(false);
    numChannels.store(0);
    sampleRate.store(0.0);
    lengthInSeconds.store(0.0);
}

bool AudioCue::play(double startTime, double fadeInTime)
{
    if (!fileLoaded.load()) {
        return false;
    }
    
    // Reset fade state
    fadeState.active.store(false);
    fadeState.currentLevel.store(1.0f);
    fadeState.targetLevel.store(1.0f);
    
    // Set up fade in if requested
    if (fadeInTime > 0.0) {
        fadeState.active.store(true);
        fadeState.currentLevel.store(0.0f);
        fadeState.targetLevel.store(1.0f);
        
        // Calculate fade step size (assuming 44.1kHz sample rate)
        int totalSamples = static_cast<int>(fadeInTime * 44100.0);
        fadeState.stepSize.store(1.0f / totalSamples);
        fadeState.remainingSamples.store(totalSamples);
    }
    
    playing.store(true);
    paused.store(false);
    stopRequested.store(false);
    
    return true;
}

bool AudioCue::stop(double fadeOutTime)
{
    if (!playing.load()) {
        return false;
    }
    
    if (fadeOutTime > 0.0) {
        // Set up fade out
        fadeState.active.store(true);
        fadeState.targetLevel.store(0.0f);
        
        // Calculate fade step size
        int totalSamples = static_cast<int>(fadeOutTime * 44100.0);
        float currentLevel = fadeState.currentLevel.load();
        fadeState.stepSize.store(-currentLevel / totalSamples);
        fadeState.remainingSamples.store(totalSamples);
    } else {
        // Immediate stop
        playing.store(false);
        paused.store(false);
    }
    
    stopRequested.store(true);
    return true;
}

bool AudioCue::pause()
{
    if (!playing.load() || paused.load()) {
        return false;
    }
    
    paused.store(true);
    return true;
}

bool AudioCue::resume()
{
    if (!playing.load() || !paused.load()) {
        return false;
    }
    
    paused.store(false);
    return true;
}

double AudioCue::getCurrentTime() const
{
    // Implementation placeholder - would use transport source position
    return 0.0;
}

double AudioCue::getDuration() const
{
    return lengthInSeconds.load();
}

void AudioCue::processAudioBlock(juce::AudioBuffer<float>& buffer, int numSamples)
{
    if (!playing.load() || paused.load()) {
        return;
    }
    
    // Ensure processing buffer is the right size
    processingBuffer.setSize(numChannels.load(), numSamples, false, false, true);
    processingBuffer.clear();
    
    // For now, generate silence - full implementation would read from audio source
    // This is where we'd call transportSource->getNextAudioBlock()
    
    // Apply fade if active
    if (fadeState.active.load()) {
        updateFade(numSamples);
        applyFadeToBuffer(processingBuffer, numSamples);
    }
    
    // Route to matrix mixer inputs
    for (int fileChannel = 0; fileChannel < numChannels.load(); ++fileChannel) {
        int matrixInput = getInputChannel(fileChannel);
        if (matrixInput >= 0 && matrixInput < 64) {
            // Add this cue's audio to the matrix input
            if (fileChannel < processingBuffer.getNumChannels() && 
                matrixInput < buffer.getNumChannels()) {
                buffer.addFrom(matrixInput, 0, processingBuffer, fileChannel, 0, numSamples);
            }
        }
    }
    
    // Check if fade out is complete
    if (stopRequested.load() && fadeState.active.load() && 
        fadeState.remainingSamples.load() <= 0) {
        playing.store(false);
        paused.store(false);
        stopRequested.store(false);
        fadeState.active.store(false);
    }
}

juce::String AudioCue::getFileName() const
{
    return audioFile.getFileName();
}

int AudioCue::getNumChannels() const
{
    return numChannels.load();
}

double AudioCue::getSampleRate() const
{
    return sampleRate.load();
}

bool AudioCue::setInputChannel(int fileChannel, int matrixInput)
{
    if (fileChannel >= 0 && fileChannel < static_cast<int>(channelRouting.size())) {
        channelRouting[fileChannel] = matrixInput;
        return true;
    }
    return false;
}

int AudioCue::getInputChannel(int fileChannel) const
{
    if (fileChannel >= 0 && fileChannel < static_cast<int>(channelRouting.size())) {
        return channelRouting[fileChannel];
    }
    return -1;
}

void AudioCue::initializeSources()
{
    // Implementation placeholder - would create JUCE transport and reader sources
}

void AudioCue::updateFade(int numSamples)
{
    if (!fadeState.active.load()) {
        return;
    }
    
    int remainingSamples = fadeState.remainingSamples.load();
    int samplesToProcess = juce::jmin(numSamples, remainingSamples);
    
    if (samplesToProcess > 0) {
        float stepSize = fadeState.stepSize.load();
        float newLevel = fadeState.currentLevel.load() + (stepSize * samplesToProcess);
        
        // Clamp to target level
        float targetLevel = fadeState.targetLevel.load();
        if (stepSize > 0.0f) {
            newLevel = juce::jmin(newLevel, targetLevel);
        } else {
            newLevel = juce::jmax(newLevel, targetLevel);
        }
        
        fadeState.currentLevel.store(newLevel);
        fadeState.remainingSamples.store(remainingSamples - samplesToProcess);
        
        // Check if fade is complete
        if (fadeState.remainingSamples.load() <= 0) {
            fadeState.currentLevel.store(targetLevel);
            fadeState.active.store(false);
        }
    }
}

void AudioCue::applyFadeToBuffer(juce::AudioBuffer<float>& buffer, int numSamples)
{
    float level = fadeState.currentLevel.load();
    
    for (int channel = 0; channel < buffer.getNumChannels(); ++channel) {
        buffer.applyGain(channel, 0, numSamples, level);
    }
}
#include "../include/AudioCue.h"
#include <JuceHeader.h>

namespace CueForge {

AudioCue::AudioCue(const std::string& id, const std::string& filePath)
    : cueId(id), filePath(filePath), cueMatrix(0, 64), currentState(State::Stopped)
{
    volumeFader.reset(44100, 0.1); // 100ms fade time by default
    volumeFader.setCurrentAndTargetValue(1.0f);
    
    if (!filePath.empty())
    {
        loadAudioFile(filePath);
    }
}

AudioCue::~AudioCue()
{
    stop(0.0f); // Stop immediately
}

bool AudioCue::loadAudioFile(const std::string& filePath)
{
    updateState(State::Loading);
    
    // Convert std::string to juce::String properly
    juce::String juceFilePath(filePath);
    juce::File audioFile(juceFilePath);
    
    if (!audioFile.existsAsFile())
    {
        juce::Logger::writeToLog("AudioCue: File not found: " + juceFilePath);
        updateState(State::Stopped);
        return false;
    }
    
    // Create format manager and register common formats
    juce::AudioFormatManager formatManager;
    formatManager.registerBasicFormats();
    
    // Create reader for the audio file
    std::unique_ptr<juce::AudioFormatReader> reader(formatManager.createReaderFor(audioFile));
    
    if (reader == nullptr)
    {
        juce::Logger::writeToLog("AudioCue: Cannot read audio file: " + juceFilePath);
        updateState(State::Stopped);
        return false;
    }
    
    // Create audio buffer to hold the entire file
    audioBuffer = std::make_unique<juce::AudioBuffer<float>>(
        reader->numChannels, 
        static_cast<int>(reader->lengthInSamples)
    );
    
    // Read the entire file into memory
    reader->read(audioBuffer.get(), 0, static_cast<int>(reader->lengthInSamples), 0, true, true);
    
    // Store reader for metadata
    audioReader = std::move(reader);
    
    // Configure matrix mixer for this file's channel count
    cueMatrix.setSize(audioBuffer->getNumChannels(), 64);
    
    // Set up default routing (1:1 for as many channels as possible)
    for (int ch = 0; ch < audioBuffer->getNumChannels() && ch < 64; ++ch)
    {
        cueMatrix.setCrosspoint(ch, ch, 0.0f); // Unity gain (0 dB)
    }
    
    // Store the file path (this was line 75 causing the error)
    this->filePath = filePath;  // Both are std::string now, so this is safe
    resetPosition();
    updateState(State::Stopped);
    
    // Fixed string concatenation - convert std::string to juce::String first
    juce::String logMessage = "AudioCue: Loaded " + juce::String(filePath) + 
                             " (" + juce::String(audioBuffer->getNumChannels()) + " channels, " +
                             juce::String(getDuration(), 2) + " seconds)";
    juce::Logger::writeToLog(logMessage);
    
    return true;
}

bool AudioCue::play(float startTime, float volume)
{
    if (!isLoaded())
    {
        juce::Logger::writeToLog("AudioCue: Cannot play - audio not loaded");
        return false;
    }
    
    // Set playback parameters
    masterVolume = volume;
    volumeFader.setTargetValue(volume);
    
    // Set position
    double sampleRate = audioReader ? audioReader->sampleRate : 44100.0;
    currentPosition.store(startTime * sampleRate);
    
    // Start playback
    shouldPlay.store(true);
    updateState(State::Playing);
    
    // Fixed string concatenation
    juce::Logger::writeToLog("AudioCue: Started playback of " + juce::String(cueId));
    return true;
}

bool AudioCue::stop(float fadeTime)
{
    if (currentState == State::Stopped)
        return true;
    
    shouldPlay.store(false);
    
    if (fadeTime > 0.0f)
    {
        // Fade out over specified time
        volumeFader.setTargetValue(0.0f);
        // Note: In a real implementation, you'd want to stop when fade completes
    }
    else
    {
        // Stop immediately
        volumeFader.setCurrentAndTargetValue(0.0f);
        resetPosition();
        updateState(State::Stopped);
    }
    
    // Fixed string concatenation
    juce::Logger::writeToLog("AudioCue: Stopped playback of " + juce::String(cueId));
    return true;
}

bool AudioCue::pause()
{
    if (currentState != State::Playing)
        return false;
    
    shouldPlay.store(false);
    updateState(State::Paused);
    
    // Fixed string concatenation
    juce::Logger::writeToLog("AudioCue: Paused " + juce::String(cueId));
    return true;
}

bool AudioCue::resume()
{
    if (currentState != State::Paused)
        return false;
    
    shouldPlay.store(true);
    updateState(State::Playing);
    
    // Fixed string concatenation
    juce::Logger::writeToLog("AudioCue: Resumed " + juce::String(cueId));
    return true;
}

int AudioCue::getNumChannels() const
{
    return audioBuffer ? audioBuffer->getNumChannels() : 0;
}

double AudioCue::getDuration() const
{
    if (!audioBuffer || !audioReader)
        return 0.0;
    
    return audioBuffer->getNumSamples() / audioReader->sampleRate;
}

double AudioCue::getCurrentTime() const
{
    if (!audioReader)
        return 0.0;
    
    return currentPosition.load() / audioReader->sampleRate;
}

bool AudioCue::setCrosspoint(int input, int output, float levelDb)
{
    cueMatrix.setCrosspoint(input, output, levelDb);
    return true;
}

bool AudioCue::setInputLevel(int input, float levelDb)
{
    cueMatrix.setInputLevel(input, levelDb);
    return true;
}

bool AudioCue::setOutputLevel(int output, float levelDb)
{
    cueMatrix.setOutputLevel(output, levelDb);
    return true;
}

void AudioCue::processAudio(juce::AudioBuffer<float>& buffer, int startSample, int numSamples)
{
    // Clear the buffer first
    buffer.clear(startSample, numSamples);
    
    if (!isLoaded() || !shouldPlay.load() || currentState != State::Playing)
        return;
    
    double pos = currentPosition.load();
    int samplesInFile = audioBuffer->getNumSamples();
    
    // Check if we've reached the end
    if (pos >= samplesInFile)
    {
        if (loop)
        {
            resetPosition();
            pos = 0.0;
        }
        else
        {
            stop(0.0f);
            return;
        }
    }
    
    // Calculate how many samples we can read
    int samplesToRead = std::min(numSamples, samplesInFile - static_cast<int>(pos));
    if (samplesToRead <= 0)
        return;
    
    // Create temporary buffer for file audio
    juce::AudioBuffer<float> fileBuffer(audioBuffer->getNumChannels(), numSamples);
    fileBuffer.clear();
    
    // Copy audio from file buffer
    for (int ch = 0; ch < audioBuffer->getNumChannels(); ++ch)
    {
        fileBuffer.copyFrom(ch, 0, *audioBuffer, ch, static_cast<int>(pos), samplesToRead);
    }
    
    // Apply volume fader
    float currentVolume = volumeFader.getNextValue();
    for (int sample = 0; sample < numSamples; ++sample)
    {
        float vol = volumeFader.getNextValue();
        for (int ch = 0; ch < fileBuffer.getNumChannels(); ++ch)
        {
            fileBuffer.setSample(ch, sample, fileBuffer.getSample(ch, sample) * vol);
        }
    }
    
    // Process through matrix mixer
    cueMatrix.processAudio(fileBuffer, buffer, startSample, numSamples);
    
    // Update position
    currentPosition.store(pos + samplesToRead);
}

void AudioCue::changeListenerCallback(juce::ChangeBroadcaster* source)
{
    // Handle any change notifications here
    // This could be used for monitoring file changes, etc.
}

void AudioCue::resetPosition()
{
    currentPosition.store(0.0);
}

void AudioCue::updateState(State newState)
{
    if (currentState != newState)
    {
        currentState = newState;
        // In a full implementation, you might want to notify listeners here
    }
}

} // namespace CueForge
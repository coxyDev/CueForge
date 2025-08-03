#include "../include/AudioEngine.h"
#include "../include/MatrixMixer.h"
#include "../include/OutputPatch.h"
#include "../include/AudioCue.h"

// AudioEngine implementation
AudioEngine::AudioEngine()
    : formatManager(std::make_unique<juce::AudioFormatManager>())
    , deviceManager(std::make_unique<juce::AudioDeviceManager>())
    , mixer(std::make_unique<MatrixMixer>())
    , outputPatch(std::make_unique<OutputPatch>())
{
    initializeAudioFormats();
}

AudioEngine::~AudioEngine()
{
    shutdown();
}

bool AudioEngine::initialize()
{
    if (initialized.load()) {
        return true;
    }
    
    // Initialize audio device manager
    juce::String error = deviceManager->initialise(0, 2, nullptr, true);
    if (error.isNotEmpty()) {
        return false;
    }
    
    // Set up audio callback
    deviceManager->addAudioCallback(this);
    
    initialized.store(true);
    return true;
}

void AudioEngine::shutdown()
{
    if (!initialized.load()) {
        return;
    }
    
    // Stop all cues
    stopAllCues();
    
    // Remove audio callback
    deviceManager->removeAudioCallback(this);
    
    // Clean up device manager
    deviceManager->closeAudioDevice();
    
    initialized.store(false);
}

bool AudioEngine::setAudioDevice(const juce::String& deviceName)
{
    // Implementation placeholder
    return false;
}

juce::StringArray AudioEngine::getAvailableDevices() const
{
    return juce::StringArray();
}

juce::String AudioEngine::getCurrentDevice() const
{
    if (auto* device = deviceManager->getCurrentAudioDevice()) {
        return device->getName();
    }
    return juce::String();
}

AudioEngine::Status AudioEngine::getStatus() const
{
    Status status;
    status.isRunning = initialized.load();
    status.sampleRate = currentSampleRate.load();
    status.bufferSize = currentBufferSize.load();
    status.cpuUsage = cpuUsage.load();
    status.dropoutCount = dropoutCount.load();
    status.currentDevice = getCurrentDevice();
    return status;
}

void AudioEngine::audioDeviceIOCallback(const float* const* inputChannelData,
                                       int numInputChannels,
                                       float* const* outputChannelData,
                                       int numOutputChannels,
                                       int numSamples)
{
    // Clear output buffers
    for (int i = 0; i < numOutputChannels; ++i) {
        juce::FloatVectorOperations::clear(outputChannelData[i], numSamples);
    }
    
    // Process audio through mixer and output patch
    if (mixer && outputPatch) {
        processAudioBlock(outputChannelData, numOutputChannels, numSamples);
    }
}

void AudioEngine::audioDeviceAboutToStart(juce::AudioIODevice* device)
{
    currentSampleRate.store(device->getCurrentSampleRate());
    currentBufferSize.store(device->getCurrentBufferSizeSamples());
    
    // Prepare buffers
    mixBuffer.setSize(64, device->getCurrentBufferSizeSamples());
    tempBuffer.setSize(64, device->getCurrentBufferSizeSamples());
}

void AudioEngine::audioDeviceStopped()
{
    // Clean up when audio device stops
}

bool AudioEngine::createAudioCue(const juce::String& cueId, const juce::String& filePath)
{
    juce::ScopedLock lock(cueMapLock);
    
    if (audioCues.find(cueId) != audioCues.end()) {
        return false; // Cue already exists
    }
    
    auto cue = std::make_unique<AudioCue>(cueId, mixer.get());
    if (!cue->loadFile(filePath)) {
        return false;
    }
    
    audioCues[cueId] = std::move(cue);
    return true;
}

bool AudioEngine::loadAudioFile(const juce::String& cueId, const juce::String& filePath)
{
    juce::ScopedLock lock(cueMapLock);
    
    auto it = audioCues.find(cueId);
    if (it == audioCues.end()) {
        return false;
    }
    
    return it->second->loadFile(filePath);
}

bool AudioEngine::playCue(const juce::String& cueId, double startTime, double fadeInTime)
{
    juce::ScopedLock lock(cueMapLock);
    
    auto it = audioCues.find(cueId);
    if (it == audioCues.end()) {
        return false;
    }
    
    return it->second->play(startTime, fadeInTime);
}

bool AudioEngine::stopCue(const juce::String& cueId, double fadeOutTime)
{
    juce::ScopedLock lock(cueMapLock);
    
    auto it = audioCues.find(cueId);
    if (it == audioCues.end()) {
        return false;
    }
    
    return it->second->stop(fadeOutTime);
}

bool AudioEngine::pauseCue(const juce::String& cueId)
{
    juce::ScopedLock lock(cueMapLock);
    
    auto it = audioCues.find(cueId);
    if (it == audioCues.end()) {
        return false;
    }
    
    return it->second->pause();
}

bool AudioEngine::resumeCue(const juce::String& cueId)
{
    juce::ScopedLock lock(cueMapLock);
    
    auto it = audioCues.find(cueId);
    if (it == audioCues.end()) {
        return false;
    }
    
    return it->second->resume();
}

void AudioEngine::stopAllCues()
{
    juce::ScopedLock lock(cueMapLock);
    
    for (auto& pair : audioCues) {
        pair.second->stop(0.0);
    }
}

bool AudioEngine::setCrosspoint(const juce::String& cueId, int input, int output, float level)
{
    if (!mixer) {
        return false;
    }
    
    mixer->setCrosspoint(input, output, level);
    return true;
}

float AudioEngine::getCrosspoint(const juce::String& cueId, int input, int output) const
{
    if (!mixer) {
        return 0.0f;
    }
    
    return mixer->getCrosspoint(input, output);
}

bool AudioEngine::setInputLevel(const juce::String& cueId, int input, float level)
{
    if (!mixer) {
        return false;
    }
    
    mixer->setInputLevel(input, level);
    return true;
}

bool AudioEngine::setOutputLevel(int output, float level)
{
    if (!mixer) {
        return false;
    }
    
    mixer->setOutputLevel(output, level);
    return true;
}

bool AudioEngine::muteOutput(int output, bool mute)
{
    if (!mixer) {
        return false;
    }
    
    mixer->muteOutput(output, mute);
    return true;
}

bool AudioEngine::soloOutput(int output, bool solo)
{
    if (!mixer) {
        return false;
    }
    
    mixer->soloOutput(output, solo);
    return true;
}

bool AudioEngine::setPatchRouting(int cueOutput, int deviceOutput, float level)
{
    if (!outputPatch) {
        return false;
    }
    
    outputPatch->setPatchRouting(cueOutput, deviceOutput, level);
    return true;
}

float AudioEngine::getPatchRouting(int cueOutput, int deviceOutput) const
{
    if (!outputPatch) {
        return 0.0f;
    }
    
    return outputPatch->getPatchRouting(cueOutput, deviceOutput);
}

void AudioEngine::initializeAudioFormats()
{
    if (!formatManager) {
        return;
    }
    
    // Register basic audio formats
    formatManager->registerBasicFormats();
}

void AudioEngine::setupAudioDevice()
{
    // Implementation placeholder for device setup
}

void AudioEngine::processAudioBlock(float* const* outputChannelData, int numOutputChannels, int numSamples)
{
    // Ensure buffers are the right size
    mixBuffer.setSize(64, numSamples, false, false, true);
    tempBuffer.setSize(64, numSamples, false, false, true);
    
    // Clear mix buffer
    mixBuffer.clear();
    
    // Process all active cues
    {
        juce::ScopedLock lock(cueMapLock);
        for (auto& pair : audioCues) {
            if (pair.second->isPlaying()) {
                pair.second->processAudioBlock(tempBuffer, numSamples);
                
                // Add to mix buffer
                for (int ch = 0; ch < juce::jmin(tempBuffer.getNumChannels(), mixBuffer.getNumChannels()); ++ch) {
                    mixBuffer.addFrom(ch, 0, tempBuffer, ch, 0, numSamples);
                }
            }
        }
    }
    
    // Process through matrix mixer
    const float* const* mixInputs = mixBuffer.getArrayOfReadPointers();
    float* const* mixOutputs = tempBuffer.getArrayOfWritePointers();
    
    mixer->processAudioBlock(mixInputs, mixOutputs, 
                           mixBuffer.getNumChannels(), 
                           tempBuffer.getNumChannels(), 
                           numSamples);
    
    // Process through output patch
    outputPatch->processAudioBlock(tempBuffer.getArrayOfReadPointers(),
                                 outputChannelData,
                                 tempBuffer.getNumChannels(),
                                 numOutputChannels,
                                 numSamples);
}

void AudioEngine::updatePerformanceMetrics()
{
    // Implementation placeholder for performance monitoring
}
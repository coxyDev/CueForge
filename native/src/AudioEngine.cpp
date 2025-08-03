#include "../include/AudioEngine.h"
#include <JuceHeader.h>
#include <algorithm>

namespace CueForge {

AudioEngine::AudioEngine()
    : deviceManager(std::make_unique<juce::AudioDeviceManager>()),
      formatManager(std::make_unique<juce::AudioFormatManager>())
{
    formatManager->registerBasicFormats();
    deviceManager->addChangeListener(this);
    
    juce::Logger::writeToLog("AudioEngine: Created");
}

AudioEngine::~AudioEngine()
{
    shutdown();
    juce::Logger::writeToLog("AudioEngine: Destroyed");
}

bool AudioEngine::initialize(int sampleRate, int bufferSize)
{
    juce::Logger::writeToLog("AudioEngine: Initializing (SR: " + 
                            juce::String(sampleRate) + ", Buffer: " + 
                            juce::String(bufferSize) + ")");
    
    juce::AudioDeviceManager::AudioDeviceSetup setup;
    setup.outputDeviceName = "";
    setup.inputDeviceName = "";
    setup.sampleRate = sampleRate;
    setup.bufferSize = bufferSize;
    setup.useDefaultInputChannels = true;
    setup.useDefaultOutputChannels = true;
    
    juce::String error = deviceManager->initialise(2, 2, nullptr, true, "", &setup);
    
    if (error.isNotEmpty())
    {
        juce::Logger::writeToLog("AudioEngine: Failed to initialize audio device: " + error);
        return false;
    }
    
    deviceManager->addAudioCallback(this);
    createOutputPatch("main", "Main Output", 64, 2);
    defaultPatchId = "main";
    
    juce::Logger::writeToLog("AudioEngine: Initialized successfully");
    return true;
}

bool AudioEngine::setAudioDevice(const juce::String& deviceId)
{
    juce::Logger::writeToLog("AudioEngine: Setting audio device: " + deviceId);
    
    auto* currentSetup = &deviceManager->getAudioDeviceSetup();
    juce::AudioDeviceManager::AudioDeviceSetup newSetup = *currentSetup;
    
    if (deviceId.contains("ASIO"))
    {
        juce::OwnedArray<juce::AudioIODeviceType> deviceTypes;
        deviceManager->createAudioDeviceTypes(deviceTypes);
        
        for (auto* deviceType : deviceTypes)
        {
            if (deviceType->getTypeName().contains("ASIO"))
            {
                deviceType->scanForDevices();
                juce::StringArray deviceNames = deviceType->getDeviceNames();
                
                for (const auto& name : deviceNames)
                {
                    if (deviceId.contains(name) || name.contains(deviceId.substring(6)))
                    {
                        newSetup.outputDeviceName = name;
                        newSetup.inputDeviceName = name;
                        break;
                    }
                }
                break;
            }
        }
    }
    else
    {
        newSetup.outputDeviceName = "";
        newSetup.inputDeviceName = "";
    }
    
    juce::String error = deviceManager->setAudioDeviceSetup(newSetup, true);
    
    if (error.isNotEmpty())
    {
        juce::Logger::writeToLog("AudioEngine: Failed to set audio device: " + error);
        return false;
    }
    
    juce::Logger::writeToLog("AudioEngine: Audio device set successfully");
    return true;
}

void AudioEngine::shutdown()
{
    juce::Logger::writeToLog("AudioEngine: Shutting down");
    
    {
        juce::ScopedLock lock(cuesLock);
        for (auto& [id, cue] : cues)
        {
            cue->stop(0.0f);
        }
        cues.clear();
    }
    
    patches.clear();
    
    if (deviceManager)
    {
        deviceManager->removeAudioCallback(this);
        deviceManager->removeChangeListener(this);
        deviceManager->closeAudioDevice();
    }
    
    juce::Logger::writeToLog("AudioEngine: Shutdown complete");
}

void AudioEngine::audioDeviceIOCallback(const float** inputChannelData,
                                       int numInputChannels,
                                       float** outputChannelData,
                                       int numOutputChannels,
                                       int numSamples)
{
    updatePerformanceStats();
    
    for (int ch = 0; ch < numOutputChannels; ++ch)
    {
        juce::FloatVectorOperations::clear(outputChannelData[ch], numSamples);
    }
    
    {
        juce::ScopedLock lock(cuesLock);
        
        for (auto& [cueId, cue] : cues)
        {
            if (cue->isPlaying())
            {
                juce::AudioBuffer<float> cueBuffer(64, numSamples);
                cueBuffer.clear();
                
                cue->processAudio(cueBuffer, 0, numSamples);
                
                auto* defaultPatch = findPatch(defaultPatchId);
                if (defaultPatch)
                {
                    for (int cueOut = 0; cueOut < cueBuffer.getNumChannels(); ++cueOut)
                    {
                        const float* cueData = cueBuffer.getReadPointer(cueOut);
                        
                        for (int deviceOut = 0; deviceOut < numOutputChannels; ++deviceOut)
                        {
                            float gain = (cueOut == deviceOut) ? 1.0f : 0.0f;
                            
                            if (gain > 0.0f)
                            {
                                juce::FloatVectorOperations::addWithMultiply(
                                    outputChannelData[deviceOut], cueData, gain, numSamples);
                            }
                        }
                    }
                }
            }
        }
    }
}

void AudioEngine::audioDeviceAboutToStart(juce::AudioIODevice* device)
{
    juce::Logger::writeToLog("AudioEngine: Audio device about to start - " + 
                            device->getName() + 
                            " (SR: " + juce::String(device->getCurrentSampleRate()) + 
                            ", Buffer: " + juce::String(device->getCurrentBufferSizeSamples()) + ")");
    
    audioBuffer.setSize(2, device->getCurrentBufferSizeSamples());
    audioBuffer.clear();
    
    dropoutCount = 0;
    cpuUsage = 0.0f;
    lastCallbackTime = juce::Time::getCurrentTime();
}

void AudioEngine::audioDeviceStopped()
{
    juce::Logger::writeToLog("AudioEngine: Audio device stopped");
}

void AudioEngine::changeListenerCallback(juce::ChangeBroadcaster* source)
{
    if (source == deviceManager.get())
    {
        juce::Logger::writeToLog("AudioEngine: Audio device configuration changed");
    }
}

std::string AudioEngine::createAudioCue(const std::string& cueId, const std::string& filePath)
{
    juce::Logger::writeToLog("AudioEngine: Creating audio cue " + juce::String(cueId) + 
                            " with file " + juce::String(filePath));
    
    try
    {
        auto cue = std::make_unique<AudioCue>(cueId, filePath);
        
        if (!cue->isLoaded())
        {
            return "Failed to load audio file: " + filePath;
        }
        
        {
            juce::ScopedLock lock(cuesLock);
            cues[cueId] = std::move(cue);
        }
        
        juce::Logger::writeToLog("AudioEngine: Successfully created cue " + juce::String(cueId));
        return "";
    }
    catch (const std::exception& e)
    {
        juce::String error = "Exception creating cue: " + juce::String(e.what());
        juce::Logger::writeToLog("AudioEngine: " + error);
        return error.toStdString();
    }
}

bool AudioEngine::playCue(const std::string& cueId, float startTime, float volume)
{
    juce::Logger::writeToLog("AudioEngine: Playing cue " + juce::String(cueId));
    
    AudioCue* cue = findCue(cueId);
    if (!cue)
    {
        juce::Logger::writeToLog("AudioEngine: Cue not found: " + juce::String(cueId));
        return false;
    }
    
    return cue->play(startTime, volume);
}

bool AudioEngine::stopCue(const std::string& cueId, float fadeTime)
{
    juce::Logger::writeToLog("AudioEngine: Stopping cue " + juce::String(cueId));
    
    AudioCue* cue = findCue(cueId);
    if (!cue)
    {
        juce::Logger::writeToLog("AudioEngine: Cue not found: " + juce::String(cueId));
        return false;
    }
    
    return cue->stop(fadeTime);
}

bool AudioEngine::pauseCue(const std::string& cueId)
{
    juce::Logger::writeToLog("AudioEngine: Pausing cue " + juce::String(cueId));
    
    AudioCue* cue = findCue(cueId);
    if (!cue) return false;
    
    return cue->pause();
}

bool AudioEngine::resumeCue(const std::string& cueId)
{
    juce::Logger::writeToLog("AudioEngine: Resuming cue " + juce::String(cueId));
    
    AudioCue* cue = findCue(cueId);
    if (!cue) return false;
    
    return cue->resume();
}

bool AudioEngine::setCueMatrixRouting(const std::string& cueId, const juce::var& matrixData)
{
    AudioCue* cue = findCue(cueId);
    if (!cue) return false;
    
    if (matrixData.hasProperty("routing"))
    {
        juce::var routingArray = matrixData["routing"];
        
        if (routingArray.isArray())
        {
            for (int i = 0; i < routingArray.size(); ++i)
            {
                juce::var route = routingArray[i];
                
                if (route.hasProperty("input") && route.hasProperty("output") && route.hasProperty("level"))
                {
                    int input = route["input"];
                    int output = route["output"];
                    float level = route["level"];
                    
                    cue->setCrosspoint(input, output, level);
                }
            }
        }
    }
    
    return true;
}

bool AudioEngine::setCrosspoint(const std::string& cueId, int input, int output, float levelDb)
{
    AudioCue* cue = findCue(cueId);
    if (!cue) return false;
    
    return cue->setCrosspoint(input, output, levelDb);
}

bool AudioEngine::setCueInputLevel(const std::string& cueId, int input, float levelDb)
{
    AudioCue* cue = findCue(cueId);
    if (!cue) return false;
    
    return cue->setInputLevel(input, levelDb);
}

bool AudioEngine::setCueOutputLevel(const std::string& cueId, int output, float levelDb)
{
    AudioCue* cue = findCue(cueId);
    if (!cue) return false;
    
    return cue->setOutputLevel(output, levelDb);
}

bool AudioEngine::createOutputPatch(const std::string& patchId, const std::string& name, 
                                   int cueOutputs, int deviceOutputs)
{
    juce::Logger::writeToLog("AudioEngine: Creating output patch " + juce::String(patchId));
    
    patches[patchId] = nullptr; // Placeholder
    
    if (defaultPatchId.empty())
        defaultPatchId = patchId;
    
    return true;
}

bool AudioEngine::setPatchMatrixRouting(const std::string& patchId, const juce::var& matrixData)
{
    return true; // Placeholder
}

// PROPER JUCE VAR CONSTRUCTION - This is the key fix
juce::var AudioEngine::getAudioDevices() const
{
    juce::Array<juce::var> deviceArray; // Start with Array, not var
    
    juce::OwnedArray<juce::AudioIODeviceType> deviceTypes;
    deviceManager->createAudioDeviceTypes(deviceTypes);
    
    for (auto* deviceType : deviceTypes)
    {
        deviceType->scanForDevices();
        juce::StringArray deviceNames = deviceType->getDeviceNames();
        
        for (const auto& deviceName : deviceNames)
        {
            // CORRECT: Create DynamicObject properly
            auto* deviceObj = new juce::DynamicObject();
            
            juce::String deviceId = deviceType->getTypeName() + "::" + deviceName;
            
            deviceObj->setProperty("id", deviceId);
            deviceObj->setProperty("name", deviceName);
            deviceObj->setProperty("type", deviceType->getTypeName());
            
            auto* testDevice = deviceType->createDevice("", deviceName);
            if (testDevice)
            {
                deviceObj->setProperty("inputChannels", testDevice->getInputChannelNames().size());
                deviceObj->setProperty("outputChannels", testDevice->getOutputChannelNames().size());
                
                juce::Array<juce::var> sampleRates;
                for (double rate : testDevice->getAvailableSampleRates())
                    sampleRates.add(rate);
                deviceObj->setProperty("supportedSampleRates", juce::var(sampleRates));
                
                juce::Array<juce::var> bufferSizes;
                for (int size : testDevice->getAvailableBufferSizes())
                    bufferSizes.add(size);
                deviceObj->setProperty("supportedBufferSizes", juce::var(bufferSizes));
                
                delete testDevice;
            }
            else
            {
                deviceObj->setProperty("inputChannels", 2);
                deviceObj->setProperty("outputChannels", 2);
                
                juce::Array<juce::var> defaultRates;
                defaultRates.add(44100);
                defaultRates.add(48000);
                deviceObj->setProperty("supportedSampleRates", juce::var(defaultRates));
                
                juce::Array<juce::var> defaultSizes;
                defaultSizes.add(512);
                defaultSizes.add(1024);
                deviceObj->setProperty("supportedBufferSizes", juce::var(defaultSizes));
            }
            
            // CORRECT: Pass DynamicObject* to var constructor
            deviceArray.add(juce::var(deviceObj));
        }
    }
    
    // Return the Array wrapped in var
    return juce::var(deviceArray);
}

juce::var AudioEngine::getSystemStatus() const
{
    // CORRECT: Create DynamicObject properly  
    auto* statusObj = new juce::DynamicObject();
    
    statusObj->setProperty("status", "ready");
    
    if (auto* currentDevice = deviceManager->getCurrentAudioDevice())
    {
        statusObj->setProperty("currentDevice", currentDevice->getName());
        statusObj->setProperty("sampleRate", currentDevice->getCurrentSampleRate());
        statusObj->setProperty("bufferSize", currentDevice->getCurrentBufferSizeSamples());
    }
    else
    {
        statusObj->setProperty("currentDevice", "No device");
        statusObj->setProperty("sampleRate", 0);
        statusObj->setProperty("bufferSize", 0);
    }
    
    statusObj->setProperty("cpuUsage", cpuUsage);
    statusObj->setProperty("dropouts", dropoutCount);
    
    juce::Array<juce::var> activeCueIds;
    {
        juce::ScopedLock lock(const_cast<juce::CriticalSection&>(cuesLock));
        for (const auto& [cueId, cue] : cues)
        {
            if (cue->isPlaying())
                activeCueIds.add(juce::var(juce::String(cueId)));
        }
    }
    statusObj->setProperty("activeCues", juce::var(activeCueIds));
    
    return juce::var(statusObj);
}

void AudioEngine::updatePerformanceStats()
{
    auto currentTime = juce::Time::getCurrentTime();
    auto timeSinceLastCallback = currentTime - lastCallbackTime;
    lastCallbackTime = currentTime;
    
    auto* device = deviceManager->getCurrentAudioDevice();
    if (device)
    {
        double expectedInterval = device->getCurrentBufferSizeSamples() / device->getCurrentSampleRate() * 1000.0;
        double actualInterval = timeSinceLastCallback.inMilliseconds();
        
        if (actualInterval > expectedInterval * 1.1)
        {
            dropoutCount++;
            cpuUsage = std::min(100.0f, cpuUsage + 5.0f);
        }
        else
        {
            cpuUsage = std::max(0.0f, cpuUsage - 0.1f);
        }
    }
}

AudioCue* AudioEngine::findCue(const std::string& cueId)
{
    juce::ScopedLock lock(cuesLock);
    auto it = cues.find(cueId);
    return (it != cues.end()) ? it->second.get() : nullptr;
}

OutputPatch* AudioEngine::findPatch(const std::string& patchId)
{
    auto it = patches.find(patchId);
    return (it != patches.end()) ? it->second.get() : nullptr;
}

} // namespace CueForge
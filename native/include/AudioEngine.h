#pragma once

#include <JuceHeader.h>
#include <memory>
#include <unordered_map>
#include <string>
#include <vector>
#include "AudioCue.h"
#include "OutputPatch.h"
#include "CommandProcessor.h"

namespace CueForge {

class AudioEngine : public juce::AudioIODeviceCallback,
                   public juce::ChangeListener
{
public:
    AudioEngine();
    ~AudioEngine();
    
    // Initialization
    bool initialize(int sampleRate = 44100, int bufferSize = 512);
    bool setAudioDevice(const juce::String& deviceId);
    void shutdown();
    
    // AudioIODeviceCallback implementation
    void audioDeviceIOCallback(const float** inputChannelData,
                              int numInputChannels,
                              float** outputChannelData,
                              int numOutputChannels,
                              int numSamples) override;
    
    void audioDeviceAboutToStart(juce::AudioIODevice* device) override;
    void audioDeviceStopped() override;
    
    // ChangeListener implementation
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;
    
    // Cue Management
    std::string createAudioCue(const std::string& cueId, const std::string& filePath);
    bool playCue(const std::string& cueId, float startTime = 0.0f, float volume = 1.0f);
    bool stopCue(const std::string& cueId, float fadeTime = 0.0f);
    bool pauseCue(const std::string& cueId);
    bool resumeCue(const std::string& cueId);
    
    // Matrix Routing
    bool setCueMatrixRouting(const std::string& cueId, const juce::var& matrixData);
    bool setCrosspoint(const std::string& cueId, int input, int output, float levelDb);
    bool setCueInputLevel(const std::string& cueId, int input, float levelDb);
    bool setCueOutputLevel(const std::string& cueId, int output, float levelDb);
    
    // Patch Management
    bool createOutputPatch(const std::string& patchId, const std::string& name, 
                          int cueOutputs, int deviceOutputs);
    bool setPatchMatrixRouting(const std::string& patchId, const juce::var& matrixData);
    
    // Device Management
    juce::var getAudioDevices() const;
    juce::var getSystemStatus() const;
    
    // Performance Monitoring
    float getCpuUsage() const { return cpuUsage; }
    int getDropoutCount() const { return dropoutCount; }
    
private:
    // Core JUCE components
    std::unique_ptr<juce::AudioDeviceManager> deviceManager;
    std::unique_ptr<juce::AudioFormatManager> formatManager;
    
    // Audio processing
    juce::AudioBuffer<float> audioBuffer;
    juce::CriticalSection audioLock;
    
    // Cue management
    std::unordered_map<std::string, std::unique_ptr<AudioCue>> cues;
    juce::CriticalSection cuesLock;
    
    // Output patches
    std::unordered_map<std::string, std::unique_ptr<OutputPatch>> patches;
    std::string defaultPatchId;
    
    // Performance monitoring
    float cpuUsage = 0.0f;
    int dropoutCount = 0;
    juce::Time lastCallbackTime;
    
    // Internal methods
    void updatePerformanceStats();
    AudioCue* findCue(const std::string& cueId);
    OutputPatch* findPatch(const std::string& patchId);
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioEngine)
};

} // namespace CueForge
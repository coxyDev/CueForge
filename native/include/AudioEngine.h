#pragma once

// Individual JUCE module includes (no more JuceHeader.h)
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>

#include "MatrixMixer.h"
#include "OutputPatch.h"
#include <memory>
#include <atomic>

/**
 * @brief Main audio engine class implementing JUCE AudioIODeviceCallback
 * 
 * Provides professional audio capabilities with matrix routing, multiple format support,
 * and low-latency performance. Designed for live performance and show control applications.
 */
class AudioEngine : public juce::AudioIODeviceCallback
{
public:
    AudioEngine();
    ~AudioEngine() override;

    // Core engine control
    bool initialize();
    void shutdown();
    bool isInitialized() const { return initialized.load(); }

    // Device management
    bool setAudioDevice(const juce::String& deviceName);
    juce::StringArray getAvailableDevices() const;
    juce::String getCurrentDevice() const;
    
    // Performance monitoring
    struct Status {
        bool isRunning;
        double sampleRate;
        int bufferSize;
        double cpuUsage;
        int dropoutCount;
        juce::String currentDevice;
    };
    Status getStatus() const;

    // AudioIODeviceCallback implementation
    void audioDeviceIOCallback(const float* const* inputChannelData,
                             int numInputChannels,
                             float* const* outputChannelData,
                             int numOutputChannels,
                             int numSamples);

    void audioDeviceAboutToStart(juce::AudioIODevice* device) override;
    void audioDeviceStopped() override;

    // Audio cue management
    bool createAudioCue(const juce::String& cueId, const juce::String& filePath);
    bool loadAudioFile(const juce::String& cueId, const juce::String& filePath);
    bool playCue(const juce::String& cueId, double startTime = 0.0, double fadeInTime = 0.0);
    bool stopCue(const juce::String& cueId, double fadeOutTime = 0.0);
    bool pauseCue(const juce::String& cueId);
    bool resumeCue(const juce::String& cueId);
    void stopAllCues();

    // Matrix routing control
    bool setCrosspoint(const juce::String& cueId, int input, int output, float level);
    float getCrosspoint(const juce::String& cueId, int input, int output) const;
    bool setInputLevel(const juce::String& cueId, int input, float level);
    bool setOutputLevel(int output, float level);
    bool muteOutput(int output, bool mute);
    bool soloOutput(int output, bool solo);

    // Output patch routing
    bool setPatchRouting(int cueOutput, int deviceOutput, float level);
    float getPatchRouting(int cueOutput, int deviceOutput) const;

private:
    // Audio format management
    std::unique_ptr<juce::AudioFormatManager> formatManager;
    std::unique_ptr<juce::AudioDeviceManager> deviceManager;
    
    // Core audio components
    std::unique_ptr<MatrixMixer> mixer;
    std::unique_ptr<OutputPatch> outputPatch;
    
    // Audio cue storage
    std::map<juce::String, std::unique_ptr<class AudioCue>> audioCues;
    
    // Thread safety
    juce::CriticalSection cueMapLock;
    juce::SpinLock audioLock; // For real-time audio thread
    
    // Performance monitoring
    std::atomic<bool> initialized{false};
    std::atomic<double> currentSampleRate{44100.0};
    std::atomic<int> currentBufferSize{512};
    std::atomic<double> cpuUsage{0.0};
    std::atomic<int> dropoutCount{0};
    
    // Audio processing
    juce::AudioBuffer<float> mixBuffer;
    juce::AudioBuffer<float> tempBuffer;
    
    // Internal methods
    void initializeAudioFormats();
    void setupAudioDevice();
    void processAudioBlock(float* const* outputChannelData, int numOutputChannels, int numSamples);
    void updatePerformanceMetrics();
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioEngine)
};
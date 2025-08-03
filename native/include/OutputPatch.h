#pragma once

// Individual JUCE module includes
#include <juce_core/juce_core.h>
#include <juce_audio_basics/juce_audio_basics.h>

#include <array>
#include <atomic>

/**
 * @brief Output patch matrix for routing mixer outputs to device outputs
 * 
 * Second-stage routing matrix that takes the 64 outputs from MatrixMixer
 * and routes them to physical device outputs. Supports flexible routing
 * configurations for different hardware setups.
 */
class OutputPatch
{
public:
    static constexpr int MAX_CUE_OUTPUTS = 64;
    static constexpr int MAX_DEVICE_OUTPUTS = 32;
    
    OutputPatch();
    ~OutputPatch();

    // Core processing (real-time safe)
    void processAudioBlock(const float* const* cueOutputs,
                          float* const* deviceOutputs,
                          int numCueOutputs,
                          int numDeviceOutputs,
                          int numSamples);

    // Patch routing control
    void setPatchRouting(int cueOutput, int deviceOutput, float level);
    float getPatchRouting(int cueOutput, int deviceOutput) const;
    void clearPatchRouting(int cueOutput, int deviceOutput);
    void clearAllRouting();

    // Device output controls
    void setDeviceOutputLevel(int deviceOutput, float level);
    float getDeviceOutputLevel(int deviceOutput) const;
    void muteDeviceOutput(int deviceOutput, bool mute);
    bool isDeviceOutputMuted(int deviceOutput) const;

    // Preset configurations
    void setDirectRouting(); // 1:1 mapping where possible
    void setStereoRouting(int startCueOutput = 0, int startDeviceOutput = 0);
    void setMultiRoomRouting(const std::vector<std::pair<int, int>>& roomMappings);

    // State management
    void saveState(juce::ValueTree& state) const;
    void loadState(const juce::ValueTree& state);
    void resetToDefault();

    // Utility
    static float dBToLinear(float dB);
    static float linearToDb(float linear);
    
private:
    // Patch matrix (cue output -> device output)
    std::array<std::array<std::atomic<float>, MAX_DEVICE_OUTPUTS>, MAX_CUE_OUTPUTS> patchMatrix;
    
    // Device output controls
    std::array<std::atomic<float>, MAX_DEVICE_OUTPUTS> deviceOutputLevels;
    std::array<std::atomic<bool>, MAX_DEVICE_OUTPUTS> deviceOutputMutes;
    
    // Processing optimization
    juce::AudioBuffer<float> tempBuffer;
    
    // Internal methods
    void processDeviceOutput(int deviceOutput, float* outputBuffer, int numSamples);
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(OutputPatch)
};
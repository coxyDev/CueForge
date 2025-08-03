#pragma once

// Individual JUCE module includes
#include <juce_core/juce_core.h>
#include <juce_audio_basics/juce_audio_basics.h>

#include <array>
#include <atomic>

/**
 * @brief Professional matrix mixer with atomic operations for real-time safety
 * 
 * Implements a 64x64 crosspoint matrix with individual level controls,
 * input/output level controls, and mute/solo functionality.
 * All operations are lock-free for use in real-time audio contexts.
 */
class MatrixMixer
{
public:
    static constexpr int MAX_INPUTS = 64;
    static constexpr int MAX_OUTPUTS = 64;
    
    MatrixMixer();
    ~MatrixMixer();

    // Core mixing operation (real-time safe)
    void processAudioBlock(const float* const* inputBuffers, 
                          float* const* outputBuffers,
                          int numInputs, 
                          int numOutputs, 
                          int numSamples);

    // Crosspoint control
    void setCrosspoint(int input, int output, float level);
    float getCrosspoint(int input, int output) const;
    void clearCrosspoint(int input, int output);
    void clearAllCrosspoints();

    // Input controls
    void setInputLevel(int input, float level);
    float getInputLevel(int input) const;
    void muteInput(int input, bool mute);
    bool isInputMuted(int input) const;

    // Output controls
    void setOutputLevel(int output, float level);
    float getOutputLevel(int output) const;
    void muteOutput(int output, bool mute);
    bool isOutputMuted(int output) const;
    void soloOutput(int output, bool solo);
    bool isOutputSoloed(int output) const;

    // Gang operations
    void setInputGang(const std::vector<int>& inputs, float level);
    void setOutputGang(const std::vector<int>& outputs, float level);

    // Matrix state
    void saveState(juce::ValueTree& state) const;
    void loadState(const juce::ValueTree& state);
    void resetToDefault();

    // Utility functions
    static float dBToLinear(float dB);
    static float linearToDb(float linear);
    static constexpr float SILENCE_THRESHOLD = 0.0001f; // -80dB
    static constexpr float MAX_GAIN_DB = 12.0f;
    static constexpr float MIN_GAIN_DB = -60.0f;

private:
    // Matrix storage (atomic for real-time safety)
    std::array<std::array<std::atomic<float>, MAX_OUTPUTS>, MAX_INPUTS> crosspoints;
    
    // Input controls
    std::array<std::atomic<float>, MAX_INPUTS> inputLevels;
    std::array<std::atomic<bool>, MAX_INPUTS> inputMutes;
    
    // Output controls
    std::array<std::atomic<float>, MAX_OUTPUTS> outputLevels;
    std::array<std::atomic<bool>, MAX_OUTPUTS> outputMutes;
    std::array<std::atomic<bool>, MAX_OUTPUTS> outputSolos;
    
    // Solo state management
    std::atomic<bool> hasSoloActive{false};
    void updateSoloState();
    
    // Performance optimization
    juce::AudioBuffer<float> tempBuffer;
    
    // Internal processing methods
    void processInput(int inputIndex, const float* inputBuffer, int numSamples);
    void processOutput(int outputIndex, float* outputBuffer, int numSamples);
    bool shouldOutputBeActive(int output) const;
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MatrixMixer)
};
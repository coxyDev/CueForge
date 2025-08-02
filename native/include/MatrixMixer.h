#pragma once

#include <JuceHeader.h>
#include <vector>
#include <atomic>

namespace CueForge {

class MatrixMixer
{
public:
    MatrixMixer(int numInputs = 0, int numOutputs = 0);
    ~MatrixMixer() = default;
    
    // Configuration
    void setSize(int numInputs, int numOutputs);
    int getNumInputs() const { return numInputChannels; }
    int getNumOutputs() const { return numOutputChannels; }
    
    // Crosspoint control
    void setCrosspoint(int input, int output, float levelDb);
    float getCrosspoint(int input, int output) const;
    void clearCrosspoint(int input, int output);
    void clearAllCrosspoints();
    
    // Level control
    void setInputLevel(int input, float levelDb);
    void setOutputLevel(int output, float levelDb);
    void setMainLevel(float levelDb);
    
    float getInputLevel(int input) const;
    float getOutputLevel(int output) const;
    float getMainLevel() const;
    
    // Mute/Solo
    void setInputMute(int input, bool muted);
    void setOutputMute(int output, bool muted);
    void setInputSolo(int input, bool soloed);
    void setOutputSolo(int output, bool soloed);
    
    bool isInputMuted(int input) const;
    bool isOutputMuted(int output) const;
    bool isInputSoloed(int input) const;
    bool isOutputSoloed(int output) const;
    
    // Audio processing
    void processAudio(const juce::AudioBuffer<float>& inputBuffer,
                     juce::AudioBuffer<float>& outputBuffer,
                     int startSample, int numSamples);
    
    // Gain calculation
    float calculateGain(int input, int output) const;
    
    // Utility
    void setSilent();
    bool hasActiveRouting() const;
    
private:
    int numInputChannels;
    int numOutputChannels;
    
    // Crosspoint matrix (input x output)
    std::vector<std::vector<std::atomic<float>>> crosspoints;
    
    // Level controls
    std::vector<std::atomic<float>> inputLevels;
    std::vector<std::atomic<float>> outputLevels;
    std::atomic<float> mainLevel{1.0f};
    
    // Mute/Solo states
    std::vector<std::atomic<bool>> inputMutes;
    std::vector<std::atomic<bool>> outputMutes;
    std::vector<std::atomic<bool>> inputSolos;
    std::vector<std::atomic<bool>> outputSolos;
    
    // Helper methods
    float dbToGain(float db) const;
    float gainToDb(float gain) const;
    bool isValidInput(int input) const;
    bool isValidOutput(int output) const;
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MatrixMixer)
};

} // namespace CueForge
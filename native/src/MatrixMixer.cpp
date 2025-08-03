#include "../include/MatrixMixer.h"
#include <juce_data_structures/juce_data_structures.h>
#include <juce_audio_basics/juce_audio_basics.h>

MatrixMixer::MatrixMixer()
{
    // Initialize all crosspoints to zero
    for (int input = 0; input < MAX_INPUTS; ++input) {
        for (int output = 0; output < MAX_OUTPUTS; ++output) {
            crosspoints[input][output].store(0.0f);
        }
        inputLevels[input].store(1.0f);
        inputMutes[input].store(false);
    }
    
    for (int output = 0; output < MAX_OUTPUTS; ++output) {
        outputLevels[output].store(1.0f);
        outputMutes[output].store(false);
        outputSolos[output].store(false);
    }
}

MatrixMixer::~MatrixMixer()
{
}

void MatrixMixer::processAudioBlock(const float* const* inputBuffers, 
                                  float* const* outputBuffers,
                                  int numInputs, 
                                  int numOutputs, 
                                  int numSamples)
{
    // Clear output buffers
    for (int output = 0; output < numOutputs; ++output) {
        juce::FloatVectorOperations::clear(outputBuffers[output], numSamples);
    }
    
    // Process matrix mixing
    for (int output = 0; output < juce::jmin(numOutputs, MAX_OUTPUTS); ++output) {
        if (!shouldOutputBeActive(output)) {
            continue;
        }
        
        float outputLevel = outputLevels[output].load();
        
        for (int input = 0; input < juce::jmin(numInputs, MAX_INPUTS); ++input) {
            float crosspoint = crosspoints[input][output].load();
            if (crosspoint <= SILENCE_THRESHOLD) {
                continue;
            }
            
            float inputLevel = inputLevels[input].load();
            bool inputMuted = inputMutes[input].load();
            
            if (inputMuted) {
                continue;
            }
            
            float gain = crosspoint * inputLevel * outputLevel;
            
            juce::FloatVectorOperations::addWithMultiply(outputBuffers[output], 
                                                        inputBuffers[input], 
                                                        gain, 
                                                        numSamples);
        }
    }
}

void MatrixMixer::setCrosspoint(int input, int output, float level)
{
    if (input >= 0 && input < MAX_INPUTS && output >= 0 && output < MAX_OUTPUTS) {
        crosspoints[input][output].store(juce::jlimit(0.0f, dBToLinear(MAX_GAIN_DB), level));
    }
}

float MatrixMixer::getCrosspoint(int input, int output) const
{
    if (input >= 0 && input < MAX_INPUTS && output >= 0 && output < MAX_OUTPUTS) {
        return crosspoints[input][output].load();
    }
    return 0.0f;
}

void MatrixMixer::clearCrosspoint(int input, int output)
{
    setCrosspoint(input, output, 0.0f);
}

void MatrixMixer::clearAllCrosspoints()
{
    for (int input = 0; input < MAX_INPUTS; ++input) {
        for (int output = 0; output < MAX_OUTPUTS; ++output) {
            crosspoints[input][output].store(0.0f);
        }
    }
}

void MatrixMixer::setInputLevel(int input, float level)
{
    if (input >= 0 && input < MAX_INPUTS) {
        inputLevels[input].store(juce::jlimit(0.0f, dBToLinear(MAX_GAIN_DB), level));
    }
}

float MatrixMixer::getInputLevel(int input) const
{
    if (input >= 0 && input < MAX_INPUTS) {
        return inputLevels[input].load();
    }
    return 0.0f;
}

void MatrixMixer::muteInput(int input, bool mute)
{
    if (input >= 0 && input < MAX_INPUTS) {
        inputMutes[input].store(mute);
    }
}

bool MatrixMixer::isInputMuted(int input) const
{
    if (input >= 0 && input < MAX_INPUTS) {
        return inputMutes[input].load();
    }
    return false;
}

void MatrixMixer::setOutputLevel(int output, float level)
{
    if (output >= 0 && output < MAX_OUTPUTS) {
        outputLevels[output].store(juce::jlimit(0.0f, dBToLinear(MAX_GAIN_DB), level));
    }
}

float MatrixMixer::getOutputLevel(int output) const
{
    if (output >= 0 && output < MAX_OUTPUTS) {
        return outputLevels[output].load();
    }
    return 0.0f;
}

void MatrixMixer::muteOutput(int output, bool mute)
{
    if (output >= 0 && output < MAX_OUTPUTS) {
        outputMutes[output].store(mute);
    }
}

bool MatrixMixer::isOutputMuted(int output) const
{
    if (output >= 0 && output < MAX_OUTPUTS) {
        return outputMutes[output].load();
    }
    return false;
}

void MatrixMixer::soloOutput(int output, bool solo)
{
    if (output >= 0 && output < MAX_OUTPUTS) {
        outputSolos[output].store(solo);
        updateSoloState();
    }
}

bool MatrixMixer::isOutputSoloed(int output) const
{
    if (output >= 0 && output < MAX_OUTPUTS) {
        return outputSolos[output].load();
    }
    return false;
}

void MatrixMixer::setInputGang(const std::vector<int>& inputs, float level)
{
    for (int input : inputs) {
        setInputLevel(input, level);
    }
}

void MatrixMixer::setOutputGang(const std::vector<int>& outputs, float level)
{
    for (int output : outputs) {
        setOutputLevel(output, level);
    }
}

void MatrixMixer::saveState(juce::ValueTree& state) const
{
    // Implementation placeholder
}

void MatrixMixer::loadState(const juce::ValueTree& state)
{
    // Implementation placeholder
}

void MatrixMixer::resetToDefault()
{
    clearAllCrosspoints();
    
    for (int i = 0; i < MAX_INPUTS; ++i) {
        inputLevels[i].store(1.0f);
        inputMutes[i].store(false);
    }
    
    for (int i = 0; i < MAX_OUTPUTS; ++i) {
        outputLevels[i].store(1.0f);
        outputMutes[i].store(false);
        outputSolos[i].store(false);
    }
    
    hasSoloActive.store(false);
}

float MatrixMixer::dBToLinear(float dB)
{
    return juce::Decibels::decibelsToGain(dB);
}

float MatrixMixer::linearToDb(float linear)
{
    return juce::Decibels::gainToDecibels(linear);
}

void MatrixMixer::updateSoloState()
{
    bool anySolo = false;
    for (int i = 0; i < MAX_OUTPUTS; ++i) {
        if (outputSolos[i].load()) {
            anySolo = true;
            break;
        }
    }
    hasSoloActive.store(anySolo);
}

void MatrixMixer::processInput(int inputIndex, const float* inputBuffer, int numSamples)
{
    // Implementation placeholder for per-input processing
}

void MatrixMixer::processOutput(int outputIndex, float* outputBuffer, int numSamples)
{
    // Implementation placeholder for per-output processing
}

bool MatrixMixer::shouldOutputBeActive(int output) const
{
    if (output < 0 || output >= MAX_OUTPUTS) {
        return false;
    }
    
    bool isMuted = outputMutes[output].load();
    bool isSoloed = outputSolos[output].load();
    bool hasSolo = hasSoloActive.load();
    
    // If there are solo outputs, only play soloed outputs
    if (hasSolo) {
        return isSoloed && !isMuted;
    }
    
    // Otherwise, play all non-muted outputs
    return !isMuted;
}
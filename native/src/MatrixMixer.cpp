#include "../include/MatrixMixer.h"
#include <cmath>
#include <algorithm>

namespace CueForge {

MatrixMixer::MatrixMixer(int numInputs, int numOutputs)
    : numInputChannels(0), numOutputChannels(0)
{
    setSize(numInputs, numOutputs);
}

void MatrixMixer::setSize(int numInputs, int numOutputs)
{
    numInputChannels = std::max(0, numInputs);
    numOutputChannels = std::max(0, numOutputs);
    
    // Resize crosspoint matrix
    crosspoints.clear();
    crosspoints.resize(numInputChannels);
    for (int i = 0; i < numInputChannels; ++i)
    {
        crosspoints[i].resize(numOutputChannels);
        for (int j = 0; j < numOutputChannels; ++j)
        {
            crosspoints[i][j].store(0.0f); // No connection by default
        }
    }
    
    // Resize level controls
    inputLevels.clear();
    inputLevels.resize(numInputChannels);
    for (int i = 0; i < numInputChannels; ++i)
        inputLevels[i].store(1.0f); // Unity gain
    
    outputLevels.clear();
    outputLevels.resize(numOutputChannels);
    for (int i = 0; i < numOutputChannels; ++i)
        outputLevels[i].store(1.0f); // Unity gain
    
    // Resize mute/solo controls
    inputMutes.clear();
    inputMutes.resize(numInputChannels);
    inputSolos.clear();
    inputSolos.resize(numInputChannels);
    outputMutes.clear();
    outputMutes.resize(numOutputChannels);
    outputSolos.clear();
    outputSolos.resize(numOutputChannels);
    
    for (int i = 0; i < numInputChannels; ++i)
    {
        inputMutes[i].store(false);
        inputSolos[i].store(false);
    }
    
    for (int i = 0; i < numOutputChannels; ++i)
    {
        outputMutes[i].store(false);
        outputSolos[i].store(false);
    }
}

void MatrixMixer::setCrosspoint(int input, int output, float levelDb)
{
    if (isValidInput(input) && isValidOutput(output))
    {
        float gain = dbToGain(levelDb);
        crosspoints[input][output].store(gain);
    }
}

float MatrixMixer::getCrosspoint(int input, int output) const
{
    if (isValidInput(input) && isValidOutput(output))
    {
        float gain = crosspoints[input][output].load();
        return gainToDb(gain);
    }
    return -100.0f; // Very quiet if invalid
}

void MatrixMixer::clearCrosspoint(int input, int output)
{
    setCrosspoint(input, output, -100.0f); // Set to very quiet
}

void MatrixMixer::clearAllCrosspoints()
{
    for (int i = 0; i < numInputChannels; ++i)
    {
        for (int j = 0; j < numOutputChannels; ++j)
        {
            crosspoints[i][j].store(0.0f);
        }
    }
}

void MatrixMixer::setInputLevel(int input, float levelDb)
{
    if (isValidInput(input))
    {
        inputLevels[input].store(dbToGain(levelDb));
    }
}

void MatrixMixer::setOutputLevel(int output, float levelDb)
{
    if (isValidOutput(output))
    {
        outputLevels[output].store(dbToGain(levelDb));
    }
}

void MatrixMixer::setMainLevel(float levelDb)
{
    mainLevel.store(dbToGain(levelDb));
}

float MatrixMixer::getInputLevel(int input) const
{
    if (isValidInput(input))
        return gainToDb(inputLevels[input].load());
    return -100.0f;
}

float MatrixMixer::getOutputLevel(int output) const
{
    if (isValidOutput(output))
        return gainToDb(outputLevels[output].load());
    return -100.0f;
}

float MatrixMixer::getMainLevel() const
{
    return gainToDb(mainLevel.load());
}

void MatrixMixer::setInputMute(int input, bool muted)
{
    if (isValidInput(input))
        inputMutes[input].store(muted);
}

void MatrixMixer::setOutputMute(int output, bool muted)
{
    if (isValidOutput(output))
        outputMutes[output].store(muted);
}

void MatrixMixer::setInputSolo(int input, bool soloed)
{
    if (isValidInput(input))
        inputSolos[input].store(soloed);
}

void MatrixMixer::setOutputSolo(int output, bool soloed)
{
    if (isValidOutput(output))
        outputSolos[output].store(soloed);
}

bool MatrixMixer::isInputMuted(int input) const
{
    return isValidInput(input) ? inputMutes[input].load() : true;
}

bool MatrixMixer::isOutputMuted(int output) const
{
    return isValidOutput(output) ? outputMutes[output].load() : true;
}

bool MatrixMixer::isInputSoloed(int input) const
{
    return isValidInput(input) ? inputSolos[input].load() : false;
}

bool MatrixMixer::isOutputSoloed(int output) const
{
    return isValidOutput(output) ? outputSolos[output].load() : false;
}

void MatrixMixer::processAudio(const juce::AudioBuffer<float>& inputBuffer,
                              juce::AudioBuffer<float>& outputBuffer,
                              int startSample, int numSamples)
{
    // Clear output buffer first
    outputBuffer.clear(startSample, numSamples);
    
    // Check if we have any inputs to process
    int availableInputs = std::min(numInputChannels, inputBuffer.getNumChannels());
    int availableOutputs = std::min(numOutputChannels, outputBuffer.getNumChannels());
    
    if (availableInputs == 0 || availableOutputs == 0)
        return;
    
    // Check for solo states
    bool anySoloedInputs = false;
    bool anySoloedOutputs = false;
    
    for (int i = 0; i < numInputChannels; ++i)
    {
        if (inputSolos[i].load())
        {
            anySoloedInputs = true;
            break;
        }
    }
    
    for (int i = 0; i < numOutputChannels; ++i)
    {
        if (outputSolos[i].load())
        {
            anySoloedOutputs = true;
            break;
        }
    }
    
    // Main processing loop
    for (int input = 0; input < availableInputs; ++input)
    {
        // Check input mute/solo
        if (inputMutes[input].load())
            continue;
        
        if (anySoloedInputs && !inputSolos[input].load())
            continue;
        
        const float* inputData = inputBuffer.getReadPointer(input, startSample);
        float inputGain = inputLevels[input].load();
        
        for (int output = 0; output < availableOutputs; ++output)
        {
            // Check output mute/solo
            if (outputMutes[output].load())
                continue;
            
            if (anySoloedOutputs && !outputSolos[output].load())
                continue;
            
            // Calculate total gain for this routing
            float crosspointGain = crosspoints[input][output].load();
            if (crosspointGain == 0.0f)
                continue; // No connection
            
            float outputGain = outputLevels[output].load();
            float mainGain = mainLevel.load();
            float totalGain = inputGain * crosspointGain * outputGain * mainGain;
            
            if (totalGain == 0.0f)
                continue;
            
            // Mix input to output
            float* outputData = outputBuffer.getWritePointer(output, startSample);
            
            if (totalGain == 1.0f)
            {
                // Optimized path for unity gain
                juce::FloatVectorOperations::add(outputData, inputData, numSamples);
            }
            else
            {
                // Apply gain while mixing
                juce::FloatVectorOperations::addWithMultiply(outputData, inputData, totalGain, numSamples);
            }
        }
    }
}

float MatrixMixer::calculateGain(int input, int output) const
{
    if (!isValidInput(input) || !isValidOutput(output))
        return 0.0f;
    
    // Check mute states
    if (inputMutes[input].load() || outputMutes[output].load())
        return 0.0f;
    
    // Check solo states
    bool anySoloedInputs = false;
    bool anySoloedOutputs = false;
    
    for (int i = 0; i < numInputChannels; ++i)
    {
        if (inputSolos[i].load())
        {
            anySoloedInputs = true;
            break;
        }
    }
    
    for (int i = 0; i < numOutputChannels; ++i)
    {
        if (outputSolos[i].load())
        {
            anySoloedOutputs = true;
            break;
        }
    }
    
    if (anySoloedInputs && !inputSolos[input].load())
        return 0.0f;
    
    if (anySoloedOutputs && !outputSolos[output].load())
        return 0.0f;
    
    // Calculate total gain
    float crosspointGain = crosspoints[input][output].load();
    float inputGain = inputLevels[input].load();
    float outputGain = outputLevels[output].load();
    float mainGain = mainLevel.load();
    
    return inputGain * crosspointGain * outputGain * mainGain;
}

void MatrixMixer::setSilent()
{
    clearAllCrosspoints();
    
    for (int i = 0; i < numInputChannels; ++i)
        inputLevels[i].store(0.0f);
    
    for (int i = 0; i < numOutputChannels; ++i)
        outputLevels[i].store(0.0f);
    
    mainLevel.store(0.0f);
}

bool MatrixMixer::hasActiveRouting() const
{
    for (int i = 0; i < numInputChannels; ++i)
    {
        for (int j = 0; j < numOutputChannels; ++j)
        {
            if (crosspoints[i][j].load() > 0.0f)
                return true;
        }
    }
    return false;
}

float MatrixMixer::dbToGain(float db) const
{
    if (db <= -100.0f)
        return 0.0f;
    
    return std::pow(10.0f, db / 20.0f);
}

float MatrixMixer::gainToDb(float gain) const
{
    if (gain <= 0.0f)
        return -100.0f;
    
    return 20.0f * std::log10(gain);
}

bool MatrixMixer::isValidInput(int input) const
{
    return input >= 0 && input < numInputChannels;
}

bool MatrixMixer::isValidOutput(int output) const
{
    return output >= 0 && output < numOutputChannels;
}

} // namespace CueForge
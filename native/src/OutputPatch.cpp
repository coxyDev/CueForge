#include "../include/OutputPatch.h"

OutputPatch::OutputPatch()
{
    // Initialize patch matrix to zero
    for (int cueOutput = 0; cueOutput < MAX_CUE_OUTPUTS; ++cueOutput) {
        for (int deviceOutput = 0; deviceOutput < MAX_DEVICE_OUTPUTS; ++deviceOutput) {
            patchMatrix[cueOutput][deviceOutput].store(0.0f);
        }
    }
    
    // Initialize device output controls
    for (int deviceOutput = 0; deviceOutput < MAX_DEVICE_OUTPUTS; ++deviceOutput) {
        deviceOutputLevels[deviceOutput].store(1.0f);
        deviceOutputMutes[deviceOutput].store(false);
    }
    
    // Set up direct routing by default
    setDirectRouting();
}

OutputPatch::~OutputPatch()
{
}

void OutputPatch::processAudioBlock(const float* const* cueOutputs,
                                  float* const* deviceOutputs,
                                  int numCueOutputs,
                                  int numDeviceOutputs,
                                  int numSamples)
{
    // Clear device output buffers
    for (int deviceOut = 0; deviceOut < numDeviceOutputs; ++deviceOut) {
        juce::FloatVectorOperations::clear(deviceOutputs[deviceOut], numSamples);
    }
    
    // Process patch routing
    for (int deviceOut = 0; deviceOut < juce::jmin(numDeviceOutputs, MAX_DEVICE_OUTPUTS); ++deviceOut) {
        if (deviceOutputMutes[deviceOut].load()) {
            continue;
        }
        
        float deviceLevel = deviceOutputLevels[deviceOut].load();
        
        for (int cueOut = 0; cueOut < juce::jmin(numCueOutputs, MAX_CUE_OUTPUTS); ++cueOut) {
            float patchLevel = patchMatrix[cueOut][deviceOut].load();
            if (patchLevel <= 0.0001f) { // Below threshold
                continue;
            }
            
            float gain = patchLevel * deviceLevel;
            
            juce::FloatVectorOperations::addWithMultiply(deviceOutputs[deviceOut],
                                                        cueOutputs[cueOut],
                                                        gain,
                                                        numSamples);
        }
    }
}

void OutputPatch::setPatchRouting(int cueOutput, int deviceOutput, float level)
{
    if (cueOutput >= 0 && cueOutput < MAX_CUE_OUTPUTS && 
        deviceOutput >= 0 && deviceOutput < MAX_DEVICE_OUTPUTS) {
        patchMatrix[cueOutput][deviceOutput].store(juce::jlimit(0.0f, 4.0f, level)); // Max +12dB
    }
}

float OutputPatch::getPatchRouting(int cueOutput, int deviceOutput) const
{
    if (cueOutput >= 0 && cueOutput < MAX_CUE_OUTPUTS && 
        deviceOutput >= 0 && deviceOutput < MAX_DEVICE_OUTPUTS) {
        return patchMatrix[cueOutput][deviceOutput].load();
    }
    return 0.0f;
}

void OutputPatch::clearPatchRouting(int cueOutput, int deviceOutput)
{
    setPatchRouting(cueOutput, deviceOutput, 0.0f);
}

void OutputPatch::clearAllRouting()
{
    for (int cueOut = 0; cueOut < MAX_CUE_OUTPUTS; ++cueOut) {
        for (int deviceOut = 0; deviceOut < MAX_DEVICE_OUTPUTS; ++deviceOut) {
            patchMatrix[cueOut][deviceOut].store(0.0f);
        }
    }
}

void OutputPatch::setDeviceOutputLevel(int deviceOutput, float level)
{
    if (deviceOutput >= 0 && deviceOutput < MAX_DEVICE_OUTPUTS) {
        deviceOutputLevels[deviceOutput].store(juce::jlimit(0.0f, 4.0f, level));
    }
}

float OutputPatch::getDeviceOutputLevel(int deviceOutput) const
{
    if (deviceOutput >= 0 && deviceOutput < MAX_DEVICE_OUTPUTS) {
        return deviceOutputLevels[deviceOutput].load();
    }
    return 0.0f;
}

void OutputPatch::muteDeviceOutput(int deviceOutput, bool mute)
{
    if (deviceOutput >= 0 && deviceOutput < MAX_DEVICE_OUTPUTS) {
        deviceOutputMutes[deviceOutput].store(mute);
    }
}

bool OutputPatch::isDeviceOutputMuted(int deviceOutput) const
{
    if (deviceOutput >= 0 && deviceOutput < MAX_DEVICE_OUTPUTS) {
        return deviceOutputMutes[deviceOutput].load();
    }
    return false;
}

void OutputPatch::setDirectRouting()
{
    clearAllRouting();
    
    // Set 1:1 routing for as many channels as possible
    int maxChannels = juce::jmin(MAX_CUE_OUTPUTS, MAX_DEVICE_OUTPUTS);
    for (int ch = 0; ch < maxChannels; ++ch) {
        setPatchRouting(ch, ch, 1.0f);
    }
}

void OutputPatch::setStereoRouting(int startCueOutput, int startDeviceOutput)
{
    clearAllRouting();
    
    // Set up stereo pairs
    for (int pair = 0; pair < 16; ++pair) { // Up to 16 stereo pairs
        int cueLeft = startCueOutput + (pair * 2);
        int cueRight = startCueOutput + (pair * 2) + 1;
        int deviceLeft = startDeviceOutput + (pair * 2);
        int deviceRight = startDeviceOutput + (pair * 2) + 1;
        
        if (cueLeft < MAX_CUE_OUTPUTS && cueRight < MAX_CUE_OUTPUTS &&
            deviceLeft < MAX_DEVICE_OUTPUTS && deviceRight < MAX_DEVICE_OUTPUTS) {
            setPatchRouting(cueLeft, deviceLeft, 1.0f);
            setPatchRouting(cueRight, deviceRight, 1.0f);
        }
    }
}

void OutputPatch::setMultiRoomRouting(const std::vector<std::pair<int, int>>& roomMappings)
{
    clearAllRouting();
    
    for (const auto& mapping : roomMappings) {
        int cueOutput = mapping.first;
        int deviceOutput = mapping.second;
        setPatchRouting(cueOutput, deviceOutput, 1.0f);
    }
}

void OutputPatch::saveState(juce::ValueTree& state) const
{
    // Implementation placeholder
}

void OutputPatch::loadState(const juce::ValueTree& state)
{
    // Implementation placeholder
}

void OutputPatch::resetToDefault()
{
    clearAllRouting();
    setDirectRouting();
    
    for (int i = 0; i < MAX_DEVICE_OUTPUTS; ++i) {
        deviceOutputLevels[i].store(1.0f);
        deviceOutputMutes[i].store(false);
    }
}

float OutputPatch::dBToLinear(float dB)
{
    return juce::Decibels::decibelsToGain(dB);
}

float OutputPatch::linearToDb(float linear)
{
    return juce::Decibels::gainToDecibels(linear);
}

void OutputPatch::processDeviceOutput(int deviceOutput, float* outputBuffer, int numSamples)
{
    // Implementation placeholder for per-device-output processing
}
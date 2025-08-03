#pragma once

#include <JuceHeader.h>
#include <string>
#include "MatrixMixer.h"

namespace CueForge {

class OutputPatch
{
public:
    OutputPatch(const std::string& id, const std::string& name, int numCueOutputs, int numDeviceOutputs);
    ~OutputPatch();
    
    // Configuration
    const std::string& getId() const { return patchId; }
    const std::string& getName() const { return patchName; }
    
    // Matrix routing
    void setMatrixRouting(const juce::var& matrixData);
    MatrixMixer& getMatrix() { return patchMatrix; }
    const MatrixMixer& getMatrix() const { return patchMatrix; }
    
    // Audio processing
    void processAudio(const juce::AudioBuffer<float>& cueOutputs, 
                     juce::AudioBuffer<float>& deviceOutputs,
                     int startSample, int numSamples);
    
    // Status
    juce::var getStatus() const;
    
private:
    std::string patchId;
    std::string patchName;
    MatrixMixer patchMatrix;
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(OutputPatch)
};

} // namespace CueForge
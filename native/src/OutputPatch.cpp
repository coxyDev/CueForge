#include "../include/OutputPatch.h"

namespace CueForge {

OutputPatch::OutputPatch(const std::string& id, const std::string& name, int numCueOutputs, int numDeviceOutputs)
    : patchId(id), patchName(name), patchMatrix(numCueOutputs, numDeviceOutputs)
{
    juce::Logger::writeToLog("OutputPatch: Created " + patchId + " (" + 
                            juce::String(numCueOutputs) + " cue outputs -> " +
                            juce::String(numDeviceOutputs) + " device outputs)");
}

OutputPatch::~OutputPatch()
{
    juce::Logger::writeToLog("OutputPatch: Destroyed " + patchId);
}

void OutputPatch::setMatrixRouting(const juce::var& matrixData)
{
    if (matrixData.hasProperty("routing"))
    {
        juce::var routingArray = matrixData["routing"];
        
        if (routingArray.isArray())
        {
            // Clear existing routing
            patchMatrix.clearAllCrosspoints();
            
            for (int i = 0; i < routingArray.size(); ++i)
            {
                juce::var route = routingArray[i];
                
                if (route.hasProperty("input") && route.hasProperty("output") && route.hasProperty("level"))
                {
                    int input = route["input"];
                    int output = route["output"];
                    float level = route["level"];
                    bool muted = route.getProperty("muted", false);
                    
                    if (!muted)
                    {
                        patchMatrix.setCrosspoint(input, output, level);
                    }
                }
            }
        }
    }
    
    // Apply main level if specified
    if (matrixData.hasProperty("mainLevel"))
    {
        float mainLevel = matrixData["mainLevel"];
        patchMatrix.setMainLevel(mainLevel);
    }
}

void OutputPatch::processAudio(const juce::AudioBuffer<float>& cueOutputs, 
                              juce::AudioBuffer<float>& deviceOutputs,
                              int startSample, int numSamples)
{
    // Process through patch matrix
    patchMatrix.processAudio(cueOutputs, deviceOutputs, startSample, numSamples);
}

juce::var OutputPatch::getStatus() const
{
    juce::var status = juce::var(juce::DynamicObject());
    
    status.getDynamicObject()->setProperty("patchId", patchId);
    status.getDynamicObject()->setProperty("name", patchName);
    status.getDynamicObject()->setProperty("cueOutputs", patchMatrix.getNumInputs());
    status.getDynamicObject()->setProperty("deviceOutputs", patchMatrix.getNumOutputs());
    status.getDynamicObject()->setProperty("hasActiveRouting", patchMatrix.hasActiveRouting());
    
    return status;
}

} // namespace CueForge
#pragma once

#include <JuceHeader.h>
#include <string>
#include "AudioEngine.h"

namespace CueForge {

class CommandProcessor
{
public:
    CommandProcessor(AudioEngine& engine);
    ~CommandProcessor() = default;
    
    // Main command processing
    juce::var processCommand(const juce::var& command);
    
    // Event generation
    juce::var createPlaybackEvent(const std::string& cueId, const std::string& status, 
                                 double currentTime, double duration);
    juce::var createPerformanceEvent(float cpuUsage, int dropouts, float memoryUsage);
    juce::var createErrorEvent(const std::string& type, const std::string& message);
    
private:
    AudioEngine& audioEngine;
    
    // Command handlers
    juce::var handleSystemCommand(const juce::var& params, const juce::String& command);
    juce::var handleCueCommand(const juce::var& params, const juce::String& command);
    juce::var handleMatrixCommand(const juce::var& params, const juce::String& command);
    juce::var handlePatchCommand(const juce::var& params, const juce::String& command);
    juce::var handleDeviceCommand(const juce::var& params, const juce::String& command);
    
    // Utility methods
    juce::var createSuccessResponse(const juce::var& data = juce::var());
    juce::var createErrorResponse(const juce::String& code, const juce::String& message);
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(CommandProcessor)
};

} // namespace CueForge
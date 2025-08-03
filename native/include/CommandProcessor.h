#pragma once

// Individual JUCE module includes
#include <juce_core/juce_core.h>
#include <juce_data_structures/juce_data_structures.h>

#include <functional>

class AudioEngine;

/**
 * @brief JSON command processor for API communication
 * 
 * Handles JSON-based commands from the Node.js bridge and translates
 * them into AudioEngine operations. Provides asynchronous command
 * processing and event callbacks.
 */
class CommandProcessor
{
public:
    using EventCallback = std::function<void(const juce::String& event, const juce::var& data)>;
    
    CommandProcessor(AudioEngine* engine);
    ~CommandProcessor();

    // Command processing
    juce::var processCommand(const juce::String& jsonCommand);
    juce::var processCommand(const juce::var& command);
    
    // Event system
    void setEventCallback(EventCallback callback);
    void sendEvent(const juce::String& eventType, const juce::var& eventData);

    // Command registration
    void registerCommand(const juce::String& commandName, 
                        std::function<juce::var(const juce::var&)> handler);

private:
    AudioEngine* audioEngine;
    EventCallback eventCallback;
    
    // Command handlers map
    std::map<juce::String, std::function<juce::var(const juce::var&)>> commandHandlers;
    
    // Built-in command handlers
    juce::var handleInitialize(const juce::var& params);
    juce::var handleShutdown(const juce::var& params);
    juce::var handleGetStatus(const juce::var& params);
    juce::var handleSetAudioDevice(const juce::var& params);
    juce::var handleGetDevices(const juce::var& params);
    
    // Audio cue commands
    juce::var handleCreateCue(const juce::var& params);
    juce::var handleLoadFile(const juce::var& params);
    juce::var handlePlayCue(const juce::var& params);
    juce::var handleStopCue(const juce::var& params);
    juce::var handlePauseCue(const juce::var& params);
    juce::var handleResumeCue(const juce::var& params);
    juce::var handleStopAllCues(const juce::var& params);
    
    // Matrix commands
    juce::var handleSetCrosspoint(const juce::var& params);
    juce::var handleGetCrosspoint(const juce::var& params);
    juce::var handleSetInputLevel(const juce::var& params);
    juce::var handleSetOutputLevel(const juce::var& params);
    juce::var handleMuteOutput(const juce::var& params);
    juce::var handleSoloOutput(const juce::var& params);
    
    // Patch commands
    juce::var handleSetPatchRouting(const juce::var& params);
    juce::var handleGetPatchRouting(const juce::var& params);
    
    // Utility methods
    void registerBuiltInCommands();
    juce::var createErrorResponse(const juce::String& message, int code = -1);
    juce::var createSuccessResponse(const juce::var& data = juce::var());
    bool validateParameters(const juce::var& params, const juce::StringArray& required);
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(CommandProcessor)
};
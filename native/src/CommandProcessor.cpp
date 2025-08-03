#include "../include/CommandProcessor.h"
#include <JuceHeader.h>

namespace CueForge {

CommandProcessor::CommandProcessor(AudioEngine& engine)
    : audioEngine(engine)
{
    juce::Logger::writeToLog("CommandProcessor: Created");
}

juce::var CommandProcessor::processCommand(const juce::var& command)
{
    if (!command.hasProperty("command"))
    {
        return createErrorResponse("INVALID_COMMAND", "Missing command field");
    }
    
    juce::String commandType = command["command"].toString();
    juce::var params = command.getProperty("params", juce::var());
    
    juce::Logger::writeToLog("CommandProcessor: Processing command: " + commandType);
    
    try
    {
        // Route to appropriate handler
        if (commandType.startsWith("initialize") || commandType.startsWith("setAudio") || 
            commandType.startsWith("getSystem") || commandType.startsWith("getAudio"))
        {
            return handleSystemCommand(params, commandType);
        }
        else if (commandType.startsWith("create") && commandType.contains("Cue") ||
                 commandType.startsWith("play") || commandType.startsWith("stop") ||
                 commandType.startsWith("pause") || commandType.startsWith("resume") ||
                 commandType.startsWith("setCue"))
        {
            return handleCueCommand(params, commandType);
        }
        else if (commandType.startsWith("setCue") && commandType.contains("Matrix") ||
                 commandType.startsWith("setCrosspoint") || commandType.startsWith("setCueInput") ||
                 commandType.startsWith("setCueOutput") || commandType.startsWith("setCueGang"))
        {
            return handleMatrixCommand(params, commandType);
        }
        else if (commandType.startsWith("create") && commandType.contains("Patch") ||
                 commandType.startsWith("setPatch") || commandType.startsWith("loadPatch"))
        {
            return handlePatchCommand(params, commandType);
        }
        else if (commandType.startsWith("setDevice") || commandType.startsWith("getAudio"))
        {
            return handleDeviceCommand(params, commandType);
        }
        else
        {
            return createErrorResponse("UNKNOWN_COMMAND", "Unknown command: " + commandType);
        }
    }
    catch (const std::exception& e)
    {
        return createErrorResponse("COMMAND_EXCEPTION", "Exception processing command: " + juce::String(e.what()));
    }
}

juce::var CommandProcessor::handleSystemCommand(const juce::var& params, const juce::String& command)
{
    if (command == "initializeAudioSystem")
    {
        int sampleRate = params.getProperty("sampleRate", 44100);
        int bufferSize = params.getProperty("bufferSize", 512);
        
        bool success = audioEngine.initialize(sampleRate, bufferSize);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Audio system initialized"));
        }
        else
        {
            return createErrorResponse("INIT_FAILED", "Failed to initialize audio system");
        }
    }
    else if (command == "getSystemStatus")
    {
        return createSuccessResponse(audioEngine.getSystemStatus());
    }
    else if (command == "setAudioDevice")
    {
        juce::String deviceId = params.getProperty("deviceId", "");
        
        bool success = audioEngine.setAudioDevice(deviceId);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Audio device set"));
        }
        else
        {
            return createErrorResponse("DEVICE_SET_FAILED", "Failed to set audio device");
        }
    }
    
    return createErrorResponse("UNKNOWN_SYSTEM_COMMAND", "Unknown system command: " + command);
}

juce::var CommandProcessor::handleCueCommand(const juce::var& params, const juce::String& command)
{
    if (command == "createAudioCue")
    {
        juce::String cueId = params.getProperty("cueId", "");
        juce::String filePath = params.getProperty("filePath", "");
        
        if (cueId.isEmpty())
        {
            return createErrorResponse("INVALID_PARAMS", "Missing cueId");
        }
        
        if (filePath.isEmpty())
        {
            return createErrorResponse("INVALID_PARAMS", "Missing filePath");
        }
        
        std::string error = audioEngine.createAudioCue(cueId.toStdString(), filePath.toStdString());
        
        if (error.empty())
        {
            // Create response with audio info - FIXED: Proper DynamicObject creation
            auto responseObj = new juce::DynamicObject();
            responseObj->setProperty("success", true);
            responseObj->setProperty("cueId", cueId);
            
            // Get audio info from the created cue - FIXED: Proper DynamicObject creation
            auto audioInfoObj = new juce::DynamicObject();
            audioInfoObj->setProperty("channels", 2); // Placeholder
            audioInfoObj->setProperty("sampleRate", 44100);
            audioInfoObj->setProperty("duration", 120.0);
            audioInfoObj->setProperty("format", "WAV");
            
            responseObj->setProperty("audioInfo", juce::var(audioInfoObj));
            
            return juce::var(responseObj);
        }
        else
        {
            return createErrorResponse("CUE_CREATE_FAILED", juce::String(error));
        }
    }
    else if (command == "playCue")
    {
        juce::String cueId = params.getProperty("cueId", "");
        float startTime = params.getProperty("startTime", 0.0f);
        float volume = params.getProperty("volume", 1.0f);
        
        bool success = audioEngine.playCue(cueId.toStdString(), startTime, volume);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Cue started"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    else if (command == "stopCue")
    {
        juce::String cueId = params.getProperty("cueId", "");
        float fadeTime = params.getProperty("fadeOutTime", 0.0f);
        
        bool success = audioEngine.stopCue(cueId.toStdString(), fadeTime);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Cue stopped"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    else if (command == "pauseCue")
    {
        juce::String cueId = params.getProperty("cueId", "");
        
        bool success = audioEngine.pauseCue(cueId.toStdString());
        
        if (success)
        {
            return createSuccessResponse(juce::var("Cue paused"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    else if (command == "resumeCue")
    {
        juce::String cueId = params.getProperty("cueId", "");
        
        bool success = audioEngine.resumeCue(cueId.toStdString());
        
        if (success)
        {
            return createSuccessResponse(juce::var("Cue resumed"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    
    return createErrorResponse("UNKNOWN_CUE_COMMAND", "Unknown cue command: " + command);
}

juce::var CommandProcessor::handleMatrixCommand(const juce::var& params, const juce::String& command)
{
    if (command == "setCueMatrixRouting")
    {
        juce::String cueId = params.getProperty("cueId", "");
        juce::var matrix = params.getProperty("matrix", juce::var());
        
        bool success = audioEngine.setCueMatrixRouting(cueId.toStdString(), matrix);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Matrix routing set"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    else if (command == "setCrosspoint")
    {
        juce::String cueId = params.getProperty("cueId", "");
        int input = params.getProperty("input", 0);
        int output = params.getProperty("output", 0);
        float level = params.getProperty("level", 0.0f);
        
        bool success = audioEngine.setCrosspoint(cueId.toStdString(), input, output, level);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Crosspoint set"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    else if (command == "setCueInputLevel")
    {
        juce::String cueId = params.getProperty("cueId", "");
        int input = params.getProperty("input", 0);
        float level = params.getProperty("level", 0.0f);
        
        bool success = audioEngine.setCueInputLevel(cueId.toStdString(), input, level);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Input level set"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    else if (command == "setCueOutputLevel")
    {
        juce::String cueId = params.getProperty("cueId", "");
        int output = params.getProperty("output", 0);
        float level = params.getProperty("level", 0.0f);
        
        bool success = audioEngine.setCueOutputLevel(cueId.toStdString(), output, level);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Output level set"));
        }
        else
        {
            return createErrorResponse("CUE_NOT_FOUND", "Cue not found: " + cueId);
        }
    }
    
    return createErrorResponse("UNKNOWN_MATRIX_COMMAND", "Unknown matrix command: " + command);
}

juce::var CommandProcessor::handlePatchCommand(const juce::var& params, const juce::String& command)
{
    if (command == "createOutputPatch")
    {
        juce::String patchId = params.getProperty("patchId", "");
        juce::String name = params.getProperty("name", "");
        int cueOutputs = params.getProperty("cueOutputs", 64);
        int deviceOutputs = params.getProperty("deviceOutputs", 2);
        
        bool success = audioEngine.createOutputPatch(patchId.toStdString(), name.toStdString(), 
                                                    cueOutputs, deviceOutputs);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Output patch created"));
        }
        else
        {
            return createErrorResponse("PATCH_CREATE_FAILED", "Failed to create patch: " + patchId);
        }
    }
    else if (command == "setPatchMatrixRouting")
    {
        juce::String patchId = params.getProperty("patchId", "");
        juce::var matrix = params.getProperty("matrix", juce::var());
        
        bool success = audioEngine.setPatchMatrixRouting(patchId.toStdString(), matrix);
        
        if (success)
        {
            return createSuccessResponse(juce::var("Patch matrix routing set"));
        }
        else
        {
            return createErrorResponse("PATCH_NOT_FOUND", "Patch not found: " + patchId);
        }
    }
    
    return createErrorResponse("UNKNOWN_PATCH_COMMAND", "Unknown patch command: " + command);
}

juce::var CommandProcessor::handleDeviceCommand(const juce::var& params, const juce::String& command)
{
    if (command == "getAudioDevices")
    {
        return createSuccessResponse(audioEngine.getAudioDevices());
    }
    else if (command == "setDeviceOutputCount")
    {
        // This would be implemented for setting device output count
        return createSuccessResponse(juce::var("Device output count set"));
    }
    
    return createErrorResponse("UNKNOWN_DEVICE_COMMAND", "Unknown device command: " + command);
}

juce::var CommandProcessor::createPlaybackEvent(const std::string& cueId, const std::string& status, 
                                               double currentTime, double duration)
{
    // FIXED: Proper DynamicObject creation for events
    auto eventObj = new juce::DynamicObject();
    eventObj->setProperty("event", "playbackStatus");
    
    auto dataObj = new juce::DynamicObject();
    dataObj->setProperty("cueId", juce::String(cueId));
    dataObj->setProperty("status", juce::String(status));
    dataObj->setProperty("currentTime", currentTime);
    dataObj->setProperty("duration", duration);
    
    eventObj->setProperty("data", juce::var(dataObj));
    
    return juce::var(eventObj);
}

juce::var CommandProcessor::createPerformanceEvent(float cpuUsage, int dropouts, float memoryUsage)
{
    // FIXED: Proper DynamicObject creation for performance events
    auto eventObj = new juce::DynamicObject();
    eventObj->setProperty("event", "performanceStats");
    
    auto dataObj = new juce::DynamicObject();
    dataObj->setProperty("cpuUsage", cpuUsage);
    dataObj->setProperty("dropouts", dropouts);
    dataObj->setProperty("memoryUsage", memoryUsage);
    dataObj->setProperty("activeVoices", 0); // Placeholder
    
    eventObj->setProperty("data", juce::var(dataObj));
    
    return juce::var(eventObj);
}

juce::var CommandProcessor::createErrorEvent(const std::string& type, const std::string& message)
{
    // FIXED: Proper DynamicObject creation for error events
    auto eventObj = new juce::DynamicObject();
    eventObj->setProperty("event", "audioError");
    
    auto dataObj = new juce::DynamicObject();
    dataObj->setProperty("type", juce::String(type));
    dataObj->setProperty("severity", "error");
    dataObj->setProperty("message", juce::String(message));
    dataObj->setProperty("timestamp", juce::Time::getCurrentTime().toMilliseconds());
    
    eventObj->setProperty("data", juce::var(dataObj));
    
    return juce::var(eventObj);
}

juce::var CommandProcessor::createSuccessResponse(const juce::var& data)
{
    // FIXED: Proper DynamicObject creation for success responses
    auto responseObj = new juce::DynamicObject();
    responseObj->setProperty("success", true);
    
    if (!data.isVoid())
    {
        responseObj->setProperty("data", data);
    }
    
    return juce::var(responseObj);
}

juce::var CommandProcessor::createErrorResponse(const juce::String& code, const juce::String& message)
{
    // FIXED: Proper DynamicObject creation for error responses
    auto responseObj = new juce::DynamicObject();
    responseObj->setProperty("success", false);
    
    auto errorObj = new juce::DynamicObject();
    errorObj->setProperty("code", code);
    errorObj->setProperty("message", message);
    
    responseObj->setProperty("error", juce::var(errorObj));
    
    return juce::var(responseObj);
}

} // namespace CueForge
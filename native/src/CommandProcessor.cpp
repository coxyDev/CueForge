#include "../include/CommandProcessor.h"
#include "../include/AudioEngine.h"

CommandProcessor::CommandProcessor(AudioEngine* engine)
    : audioEngine(engine)
{
    registerBuiltInCommands();
}

CommandProcessor::~CommandProcessor()
{
}

juce::var CommandProcessor::processCommand(const juce::String& jsonCommand)
{
    try {
        juce::var command = juce::JSON::parse(jsonCommand);
        return processCommand(command);
    }
    catch (const std::exception& e) {
        return createErrorResponse(juce::String("JSON parse error: ") + e.what());
    }
}

juce::var CommandProcessor::processCommand(const juce::var& command)
{
    if (!command.isObject()) {
        return createErrorResponse("Command must be an object");
    }
    
    juce::String commandName = command.getProperty("command", juce::var()).toString();
    if (commandName.isEmpty()) {
        return createErrorResponse("Missing command name");
    }
    
    auto it = commandHandlers.find(commandName);
    if (it == commandHandlers.end()) {
        return createErrorResponse("Unknown command: " + commandName);
    }
    
    try {
        juce::var params = command.getProperty("params", juce::var());
        return it->second(params);
    }
    catch (const std::exception& e) {
        return createErrorResponse(juce::String("Command execution error: ") + e.what());
    }
}

void CommandProcessor::setEventCallback(EventCallback callback)
{
    eventCallback = callback;
}

void CommandProcessor::sendEvent(const juce::String& eventType, const juce::var& eventData)
{
    if (eventCallback) {
        eventCallback(eventType, eventData);
    }
}

void CommandProcessor::registerCommand(const juce::String& commandName, 
                                     std::function<juce::var(const juce::var&)> handler)
{
    commandHandlers[commandName] = handler;
}

void CommandProcessor::registerBuiltInCommands()
{
    // Engine control commands
    registerCommand("initialize", [this](const juce::var& params) { return handleInitialize(params); });
    registerCommand("shutdown", [this](const juce::var& params) { return handleShutdown(params); });
    registerCommand("getStatus", [this](const juce::var& params) { return handleGetStatus(params); });
    registerCommand("setAudioDevice", [this](const juce::var& params) { return handleSetAudioDevice(params); });
    registerCommand("getDevices", [this](const juce::var& params) { return handleGetDevices(params); });
    
    // Audio cue commands
    registerCommand("createCue", [this](const juce::var& params) { return handleCreateCue(params); });
    registerCommand("loadFile", [this](const juce::var& params) { return handleLoadFile(params); });
    registerCommand("playCue", [this](const juce::var& params) { return handlePlayCue(params); });
    registerCommand("stopCue", [this](const juce::var& params) { return handleStopCue(params); });
    registerCommand("pauseCue", [this](const juce::var& params) { return handlePauseCue(params); });
    registerCommand("resumeCue", [this](const juce::var& params) { return handleResumeCue(params); });
    registerCommand("stopAllCues", [this](const juce::var& params) { return handleStopAllCues(params); });
    
    // Matrix commands
    registerCommand("setCrosspoint", [this](const juce::var& params) { return handleSetCrosspoint(params); });
    registerCommand("getCrosspoint", [this](const juce::var& params) { return handleGetCrosspoint(params); });
    registerCommand("setInputLevel", [this](const juce::var& params) { return handleSetInputLevel(params); });
    registerCommand("setOutputLevel", [this](const juce::var& params) { return handleSetOutputLevel(params); });
    registerCommand("muteOutput", [this](const juce::var& params) { return handleMuteOutput(params); });
    registerCommand("soloOutput", [this](const juce::var& params) { return handleSoloOutput(params); });
    
    // Patch commands
    registerCommand("setPatchRouting", [this](const juce::var& params) { return handleSetPatchRouting(params); });
    registerCommand("getPatchRouting", [this](const juce::var& params) { return handleGetPatchRouting(params); });
}

juce::var CommandProcessor::handleInitialize(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    bool success = audioEngine->initialize();
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleShutdown(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    audioEngine->shutdown();
    return createSuccessResponse();
}

juce::var CommandProcessor::handleGetStatus(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    auto status = audioEngine->getStatus();
    
    juce::DynamicObject::Ptr statusObj = new juce::DynamicObject();
    statusObj->setProperty("isRunning", status.isRunning);
    statusObj->setProperty("sampleRate", status.sampleRate);
    statusObj->setProperty("bufferSize", status.bufferSize);
    statusObj->setProperty("cpuUsage", status.cpuUsage);
    statusObj->setProperty("dropoutCount", status.dropoutCount);
    statusObj->setProperty("currentDevice", status.currentDevice);
    
    return createSuccessResponse(juce::var(statusObj.get()));
}

juce::var CommandProcessor::handleSetAudioDevice(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"deviceName"})) {
        return createErrorResponse("Missing required parameter: deviceName");
    }
    
    juce::String deviceName = params.getProperty("deviceName", juce::var()).toString();
    bool success = audioEngine->setAudioDevice(deviceName);
    
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleGetDevices(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    juce::StringArray devices = audioEngine->getAvailableDevices();
    juce::Array<juce::var> deviceArray;
    
    for (const auto& device : devices) {
        deviceArray.add(juce::var(device));
    }
    
    return createSuccessResponse(juce::var(deviceArray));
}

juce::var CommandProcessor::handleCreateCue(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId", "filePath"})) {
        return createErrorResponse("Missing required parameters: cueId, filePath");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    juce::String filePath = params.getProperty("filePath", juce::var()).toString();
    
    bool success = audioEngine->createAudioCue(cueId, filePath);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleLoadFile(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId", "filePath"})) {
        return createErrorResponse("Missing required parameters: cueId, filePath");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    juce::String filePath = params.getProperty("filePath", juce::var()).toString();
    
    bool success = audioEngine->loadAudioFile(cueId, filePath);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handlePlayCue(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId"})) {
        return createErrorResponse("Missing required parameter: cueId");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    double startTime = params.getProperty("startTime", 0.0);
    double fadeInTime = params.getProperty("fadeInTime", 0.0);
    
    bool success = audioEngine->playCue(cueId, startTime, fadeInTime);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleStopCue(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId"})) {
        return createErrorResponse("Missing required parameter: cueId");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    double fadeOutTime = params.getProperty("fadeOutTime", 0.0);
    
    bool success = audioEngine->stopCue(cueId, fadeOutTime);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handlePauseCue(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId"})) {
        return createErrorResponse("Missing required parameter: cueId");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    bool success = audioEngine->pauseCue(cueId);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleResumeCue(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId"})) {
        return createErrorResponse("Missing required parameter: cueId");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    bool success = audioEngine->resumeCue(cueId);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleStopAllCues(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    audioEngine->stopAllCues();
    return createSuccessResponse();
}

juce::var CommandProcessor::handleSetCrosspoint(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId", "input", "output", "level"})) {
        return createErrorResponse("Missing required parameters: cueId, input, output, level");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    int input = params.getProperty("input", 0);
    int output = params.getProperty("output", 0);
    float level = params.getProperty("level", 0.0f);
    
    bool success = audioEngine->setCrosspoint(cueId, input, output, level);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleGetCrosspoint(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId", "input", "output"})) {
        return createErrorResponse("Missing required parameters: cueId, input, output");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    int input = params.getProperty("input", 0);
    int output = params.getProperty("output", 0);
    
    float level = audioEngine->getCrosspoint(cueId, input, output);
    return createSuccessResponse(juce::var(level));
}

juce::var CommandProcessor::handleSetInputLevel(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueId", "input", "level"})) {
        return createErrorResponse("Missing required parameters: cueId, input, level");
    }
    
    juce::String cueId = params.getProperty("cueId", juce::var()).toString();
    int input = params.getProperty("input", 0);
    float level = params.getProperty("level", 1.0f);
    
    bool success = audioEngine->setInputLevel(cueId, input, level);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleSetOutputLevel(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"output", "level"})) {
        return createErrorResponse("Missing required parameters: output, level");
    }
    
    int output = params.getProperty("output", 0);
    float level = params.getProperty("level", 1.0f);
    
    bool success = audioEngine->setOutputLevel(output, level);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleMuteOutput(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"output", "mute"})) {
        return createErrorResponse("Missing required parameters: output, mute");
    }
    
    int output = params.getProperty("output", 0);
    bool mute = params.getProperty("mute", false);
    
    bool success = audioEngine->muteOutput(output, mute);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleSoloOutput(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"output", "solo"})) {
        return createErrorResponse("Missing required parameters: output, solo");
    }
    
    int output = params.getProperty("output", 0);
    bool solo = params.getProperty("solo", false);
    
    bool success = audioEngine->soloOutput(output, solo);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleSetPatchRouting(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueOutput", "deviceOutput", "level"})) {
        return createErrorResponse("Missing required parameters: cueOutput, deviceOutput, level");
    }
    
    int cueOutput = params.getProperty("cueOutput", 0);
    int deviceOutput = params.getProperty("deviceOutput", 0);
    float level = params.getProperty("level", 1.0f);
    
    bool success = audioEngine->setPatchRouting(cueOutput, deviceOutput, level);
    return createSuccessResponse(juce::var(success));
}

juce::var CommandProcessor::handleGetPatchRouting(const juce::var& params)
{
    if (!audioEngine) {
        return createErrorResponse("AudioEngine not available");
    }
    
    if (!validateParameters(params, {"cueOutput", "deviceOutput"})) {
        return createErrorResponse("Missing required parameters: cueOutput, deviceOutput");
    }
    
    int cueOutput = params.getProperty("cueOutput", 0);
    int deviceOutput = params.getProperty("deviceOutput", 0);
    
    float level = audioEngine->getPatchRouting(cueOutput, deviceOutput);
    return createSuccessResponse(juce::var(level));
}

juce::var CommandProcessor::createErrorResponse(const juce::String& message, int code)
{
    juce::DynamicObject::Ptr response = new juce::DynamicObject();
    response->setProperty("success", false);
    response->setProperty("error", message);
    response->setProperty("code", code);
    return juce::var(response.get());
}

juce::var CommandProcessor::createSuccessResponse(const juce::var& data)
{
    juce::DynamicObject::Ptr response = new juce::DynamicObject();
    response->setProperty("success", true);
    if (!data.isVoid()) {
        response->setProperty("data", data);
    }
    return juce::var(response.get());
}

bool CommandProcessor::validateParameters(const juce::var& params, const juce::StringArray& required)
{
    if (!params.isObject()) {
        return false;
    }
    
    for (const auto& param : required) {
        if (!params.hasProperty(param)) {
            return false;
        }
    }
    
    return true;
}
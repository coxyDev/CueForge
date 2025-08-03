#include "audio_bridge.h"
#include "../include/AudioEngine.h"
#include "../include/CommandProcessor.h"

//==============================================================================
// AudioBridge Implementation
//==============================================================================

AudioBridge::AudioBridge() 
    : eventEnv(nullptr), eventCallbackRef(nullptr)
{
    audioEngine = std::make_unique<AudioEngine>();
    commandProcessor = std::make_unique<CommandProcessor>(audioEngine.get());
}

AudioBridge::~AudioBridge()
{
    shutdown();
    
    // Clean up event callback reference
    if (eventEnv && eventCallbackRef) {
        napi_delete_reference(eventEnv, eventCallbackRef);
        eventCallbackRef = nullptr;
    }
}

bool AudioBridge::initialize()
{
    return audioEngine ? audioEngine->initialize() : false;
}

void AudioBridge::shutdown()
{
    if (audioEngine) {
        audioEngine->shutdown();
    }
}

bool AudioBridge::isInitialized() const
{
    return audioEngine && audioEngine->isInitialized();
}

napi_value AudioBridge::processCommand(napi_env env, const char* jsonCommand)
{
    if (!commandProcessor) {
        napi_throw_error(env, nullptr, "CommandProcessor not initialized");
        return nullptr;
    }
    
    try {
        juce::String command(jsonCommand);
        juce::var result = commandProcessor->processCommand(command);
        return juceVarToNapi(env, result);
    }
    catch (const std::exception& e) {
        napi_throw_error(env, nullptr, e.what());
        return nullptr;
    }
}

napi_value AudioBridge::processCommandVar(napi_env env, napi_value commandObj)
{
    if (!commandProcessor) {
        napi_throw_error(env, nullptr, "CommandProcessor not initialized");
        return nullptr;
    }
    
    try {
        juce::var command = napiToJuceVar(env, commandObj);
        juce::var result = commandProcessor->processCommand(command);
        return juceVarToNapi(env, result);
    }
    catch (const std::exception& e) {
        napi_throw_error(env, nullptr, e.what());
        return nullptr;
    }
}

void AudioBridge::setEventCallback(napi_env env, napi_value callback)
{
    eventEnv = env;
    
    // Clean up existing reference
    if (eventCallbackRef) {
        napi_delete_reference(env, eventCallbackRef);
    }
    
    // Create new reference
    napi_status status = napi_create_reference(env, callback, 1, &eventCallbackRef);
    if (status != napi_ok) {
        napi_throw_error(env, nullptr, "Failed to create callback reference");
        return;
    }
    
    // Set up the callback with CommandProcessor
    commandProcessor->setEventCallback([this](const juce::String& eventType, const juce::var& eventData) {
        this->onAudioEvent(eventType, eventData);
    });
}

void AudioBridge::onAudioEvent(const juce::String& eventType, const juce::var& eventData)
{
    if (eventEnv && eventCallbackRef) {
        callJavaScriptCallback(eventType, eventData);
    }
}

void AudioBridge::callJavaScriptCallback(const juce::String& eventType, const juce::var& eventData)
{
    // In a full implementation, this would need proper thread handling
    // For now, this is a placeholder for the event system
}

//==============================================================================
// JUCE ↔ N-API Conversion Utilities
//==============================================================================

napi_value AudioBridge::juceVarToNapi(napi_env env, const juce::var& value)
{
    napi_value result = nullptr;
    napi_status status;
    
    if (value.isVoid()) {
        status = napi_get_undefined(env, &result);
    }
    else if (value.isBool()) {
        status = napi_get_boolean(env, static_cast<bool>(value), &result);
    }
    else if (value.isInt() || value.isInt64()) {
        status = napi_create_int32(env, static_cast<int32_t>(value), &result);
    }
    else if (value.isDouble()) {
        status = napi_create_double(env, static_cast<double>(value), &result);
    }
    else if (value.isString()) {
        juce::String str = value.toString();
        status = napi_create_string_utf8(env, str.toUTF8(), NAPI_AUTO_LENGTH, &result);
    }
    else if (value.isArray()) {
        juce::Array<juce::var>* array = value.getArray();
        if (array) {
            status = napi_create_array_with_length(env, static_cast<size_t>(array->size()), &result);
            if (status == napi_ok) {
                for (int i = 0; i < array->size(); ++i) {
                    napi_value element = juceVarToNapi(env, (*array)[i]);
                    napi_set_element(env, result, static_cast<uint32_t>(i), element);
                }
            }
        } else {
            status = napi_create_array(env, &result);
        }
    }
    else if (value.isObject()) {
        status = napi_create_object(env, &result);
        if (status == napi_ok) {
            auto* obj = value.getDynamicObject();
            if (obj) {
                for (auto& prop : obj->getProperties()) {
                    napi_value key = juceStringToNapi(env, prop.name.toString());
                    napi_value val = juceVarToNapi(env, prop.value);
                    napi_set_property(env, result, key, val);
                }
            }
        }
    }
    else {
        status = napi_get_null(env, &result);
    }
    
    // If conversion failed, return undefined
    if (status != napi_ok || result == nullptr) {
        napi_get_undefined(env, &result);
    }
    
    return result;
}

juce::var AudioBridge::napiToJuceVar(napi_env env, napi_value value)
{
    napi_valuetype type;
    napi_status status = napi_typeof(env, value, &type);
    
    if (status != napi_ok) {
        return juce::var();
    }
    
    switch (type) {
        case napi_undefined:
        case napi_null:
            return juce::var();
            
        case napi_boolean: {
            bool result = false;
            if (napi_get_value_bool(env, value, &result) == napi_ok) {
                return juce::var(result);
            }
            break;
        }
        
        case napi_number: {
            double result = 0.0;
            if (napi_get_value_double(env, value, &result) == napi_ok) {
                return juce::var(result);
            }
            break;
        }
        
        case napi_string: {
            size_t length = 0;
            if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) == napi_ok) {
                std::string str(length, '\0');
                if (napi_get_value_string_utf8(env, value, &str[0], length + 1, &length) == napi_ok) {
                    return juce::var(juce::String(str));
                }
            }
            break;
        }
        
        case napi_object: {
            bool isArray = false;
            if (napi_is_array(env, value, &isArray) == napi_ok && isArray) {
                uint32_t length = 0;
                if (napi_get_array_length(env, value, &length) == napi_ok) {
                    juce::Array<juce::var> array;
                    for (uint32_t i = 0; i < length; ++i) {
                        napi_value element = nullptr;
                        if (napi_get_element(env, value, i, &element) == napi_ok) {
                            array.add(napiToJuceVar(env, element));
                        }
                    }
                    return juce::var(array);
                }
            }
            else {
                // Handle object
                auto* obj = new juce::DynamicObject();
                napi_value propertyNames = nullptr;
                
                if (napi_get_property_names(env, value, &propertyNames) == napi_ok) {
                    uint32_t length = 0;
                    if (napi_get_array_length(env, propertyNames, &length) == napi_ok) {
                        for (uint32_t i = 0; i < length; ++i) {
                            napi_value key = nullptr, val = nullptr;
                            if (napi_get_element(env, propertyNames, i, &key) == napi_ok &&
                                napi_get_property(env, value, key, &val) == napi_ok) {
                                
                                juce::String keyStr = napiStringToJuce(env, key);
                                juce::var valVar = napiToJuceVar(env, val);
                                obj->setProperty(keyStr, valVar);
                            }
                        }
                    }
                }
                return juce::var(obj);
            }
            break;
        }
        
        default:
            break;
    }
    
    return juce::var();
}

juce::String AudioBridge::napiStringToJuce(napi_env env, napi_value value)
{
    size_t length = 0;
    if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok) {
        return juce::String();
    }
    
    std::string str(length, '\0');
    if (napi_get_value_string_utf8(env, value, &str[0], length + 1, &length) != napi_ok) {
        return juce::String();
    }
    
    return juce::String(str);
}

napi_value AudioBridge::juceStringToNapi(napi_env env, const juce::String& str)
{
    napi_value result = nullptr;
    if (napi_create_string_utf8(env, str.toUTF8(), NAPI_AUTO_LENGTH, &result) != napi_ok) {
        napi_get_null(env, &result);
    }
    return result;
}

//==============================================================================
// Global AudioBridge Instance
//==============================================================================

static std::unique_ptr<AudioBridge> g_audioBridge;

//==============================================================================
// N-API C-Style Exports
//==============================================================================

extern "C" {

napi_value Init(napi_env env, napi_value exports)
{
    // Create the global AudioBridge instance
    g_audioBridge = std::make_unique<AudioBridge>();
    
    // Define the AudioEngine constructor
    napi_value cons = nullptr;
    napi_define_class(env, "AudioEngine", NAPI_AUTO_LENGTH, CreateAudioEngine, 
                     nullptr, 0, nullptr, &cons);
    napi_set_named_property(env, exports, "AudioEngine", cons);
    
    // Export static methods
    napi_property_descriptor desc[] = {
        {"initialize", nullptr, AudioEngine_Initialize, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"shutdown", nullptr, AudioEngine_Shutdown, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"getStatus", nullptr, AudioEngine_GetStatus, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"processCommand", nullptr, AudioEngine_ProcessCommand, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"setEventCallback", nullptr, AudioEngine_SetEventCallback, nullptr, nullptr, nullptr, napi_default, nullptr},
    };
    
    napi_define_properties(env, exports, sizeof(desc) / sizeof(desc[0]), desc);
    
    return exports;
}

napi_value CreateAudioEngine(napi_env env, napi_callback_info info)
{
    napi_value jsthis = nullptr;
    napi_get_cb_info(env, info, nullptr, nullptr, &jsthis, nullptr);
    return jsthis;
}

napi_value AudioEngine_Initialize(napi_env env, napi_callback_info info)
{
    bool result = false;
    if (g_audioBridge) {
        result = g_audioBridge->initialize();
    }
    
    napi_value jsResult = nullptr;
    napi_get_boolean(env, result, &jsResult);
    return jsResult;
}

napi_value AudioEngine_Shutdown(napi_env env, napi_callback_info info)
{
    if (g_audioBridge) {
        g_audioBridge->shutdown();
    }
    
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_GetStatus(napi_env env, napi_callback_info info)
{
    if (!g_audioBridge) {
        napi_throw_error(env, nullptr, "AudioEngine not initialized");
        return nullptr;
    }
    
    napi_value status = nullptr;
    napi_create_object(env, &status);
    
    napi_value isInitialized = nullptr;
    napi_get_boolean(env, g_audioBridge->isInitialized(), &isInitialized);
    napi_set_named_property(env, status, "isInitialized", isInitialized);
    
    return status;
}

napi_value AudioEngine_ProcessCommand(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    if (argc < 1) {
        napi_throw_error(env, nullptr, "Expected 1 argument");
        return nullptr;
    }
    
    if (!g_audioBridge) {
        napi_throw_error(env, nullptr, "AudioEngine not initialized");
        return nullptr;
    }
    
    return g_audioBridge->processCommandVar(env, args[0]);
}

napi_value AudioEngine_SetEventCallback(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    if (argc < 1) {
        napi_throw_error(env, nullptr, "Expected 1 argument");
        return nullptr;
    }
    
    if (!g_audioBridge) {
        napi_throw_error(env, nullptr, "AudioEngine not initialized");
        return nullptr;
    }
    
    g_audioBridge->setEventCallback(env, args[0]);
    
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

// Placeholder implementations for other exported functions
napi_value AudioEngine_SetAudioDevice(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_GetAvailableDevices(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_CreateAudioCue(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_LoadAudioFile(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_PlayCue(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_StopCue(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_PauseCue(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_ResumeCue(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_StopAllCues(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_SetCrosspoint(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_GetCrosspoint(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_SetInputLevel(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_SetOutputLevel(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_MuteOutput(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_SoloOutput(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_SetPatchRouting(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_GetPatchRouting(napi_env env, napi_callback_info info) { 
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    return undefined;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

} // extern "C"
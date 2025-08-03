#include "audio_bridge.h"
#include "../include/AudioEngine.h"
#include "../include/CommandProcessor.h"

// AudioBridge implementation
AudioBridge::AudioBridge() 
    : eventEnv(nullptr), eventCallbackRef(nullptr)
{
    audioEngine = std::make_unique<AudioEngine>();
    commandProcessor = std::make_unique<CommandProcessor>(audioEngine.get());
}

AudioBridge::~AudioBridge()
{
    shutdown();
}

bool AudioBridge::initialize()
{
    if (audioEngine) {
        return audioEngine->initialize();
    }
    return false;
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
    NAPI_CALL_RETURN_VOID(env, napi_create_reference(env, callback, 1, &eventCallbackRef));
    
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
    // This would need to be called from the main thread in a real implementation
    // For now, just a placeholder
}

// Utility conversion functions
napi_value AudioBridge::juceVarToNapi(napi_env env, const juce::var& value)
{
    napi_value result;
    
    if (value.isVoid()) {
        NAPI_CALL(env, napi_get_undefined(env, &result));
    }
    else if (value.isBool()) {
        NAPI_CALL(env, napi_get_boolean(env, (bool)value, &result));
    }
    else if (value.isInt() || value.isInt64()) {
        NAPI_CALL(env, napi_create_int32(env, (int)value, &result));
    }
    else if (value.isDouble()) {
        NAPI_CALL(env, napi_create_double(env, (double)value, &result));
    }
    else if (value.isString()) {
        juce::String str = value.toString();
        NAPI_CALL(env, napi_create_string_utf8(env, str.toUTF8(), NAPI_AUTO_LENGTH, &result));
    }
    else if (value.isArray()) {
        juce::Array<juce::var>* array = value.getArray();
        NAPI_CALL(env, napi_create_array_with_length(env, array->size(), &result));
        
        for (int i = 0; i < array->size(); ++i) {
            napi_value element = juceVarToNapi(env, (*array)[i]);
            NAPI_CALL(env, napi_set_element(env, result, i, element));
        }
    }
    else if (value.isObject()) {
        NAPI_CALL(env, napi_create_object(env, &result));
        
        if (auto* obj = value.getDynamicObject()) {
            for (auto& prop : obj->getProperties()) {
                napi_value key = juceStringToNapi(env, prop.name.toString());
                napi_value val = juceVarToNapi(env, prop.value);
                NAPI_CALL(env, napi_set_property(env, result, key, val));
            }
        }
    }
    else {
        NAPI_CALL(env, napi_get_null(env, &result));
    }
    
    return result;
}

juce::var AudioBridge::napiToJuceVar(napi_env env, napi_value value)
{
    napi_valuetype type;
    NAPI_CALL(env, napi_typeof(env, value, &type));
    
    switch (type) {
        case napi_undefined:
        case napi_null:
            return juce::var::undefined();
            
        case napi_boolean: {
            bool result;
            NAPI_CALL(env, napi_get_value_bool(env, value, &result));
            return juce::var(result);
        }
        
        case napi_number: {
            double result;
            NAPI_CALL(env, napi_get_value_double(env, value, &result));
            return juce::var(result);
        }
        
        case napi_string: {
            size_t length;
            NAPI_CALL(env, napi_get_value_string_utf8(env, value, nullptr, 0, &length));
            
            std::string str(length, '\0');
            NAPI_CALL(env, napi_get_value_string_utf8(env, value, &str[0], length + 1, &length));
            
            return juce::var(juce::String(str));
        }
        
        case napi_object: {
            bool isArray;
            NAPI_CALL(env, napi_is_array(env, value, &isArray));
            
            if (isArray) {
                uint32_t length;
                NAPI_CALL(env, napi_get_array_length(env, value, &length));
                
                juce::Array<juce::var> array;
                for (uint32_t i = 0; i < length; ++i) {
                    napi_value element;
                    NAPI_CALL(env, napi_get_element(env, value, i, &element));
                    array.add(napiToJuceVar(env, element));
                }
                return juce::var(array);
            }
            else {
                auto* obj = new juce::DynamicObject();
                
                napi_value propertyNames;
                NAPI_CALL(env, napi_get_property_names(env, value, &propertyNames));
                
                uint32_t length;
                NAPI_CALL(env, napi_get_array_length(env, propertyNames, &length));
                
                for (uint32_t i = 0; i < length; ++i) {
                    napi_value key, val;
                    NAPI_CALL(env, napi_get_element(env, propertyNames, i, &key));
                    NAPI_CALL(env, napi_get_property(env, value, key, &val));
                    
                    juce::String keyStr = napiStringToJuce(env, key);
                    juce::var valVar = napiToJuceVar(env, val);
                    
                    obj->setProperty(keyStr, valVar);
                }
                
                return juce::var(obj);
            }
        }
        
        default:
            return juce::var::undefined();
    }
}

juce::String AudioBridge::napiStringToJuce(napi_env env, napi_value value)
{
    size_t length;
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
    napi_value result;
    if (napi_create_string_utf8(env, str.toUTF8(), NAPI_AUTO_LENGTH, &result) != napi_ok) {
        napi_get_null(env, &result);
    }
    return result;
}

// Global AudioBridge instance
static std::unique_ptr<AudioBridge> g_audioBridge;

// C-style API implementations
extern "C" {

napi_value Init(napi_env env, napi_value exports)
{
    // Create the global AudioBridge instance
    g_audioBridge = std::make_unique<AudioBridge>();
    
    // Export constructor
    napi_value cons;
    napi_define_class(env, "AudioEngine", NAPI_AUTO_LENGTH, CreateAudioEngine, nullptr, 0, nullptr, &cons);
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
    napi_value jsthis;
    NAPI_CALL(env, napi_get_cb_info(env, info, nullptr, nullptr, &jsthis, nullptr));
    return jsthis;
}

napi_value AudioEngine_Initialize(napi_env env, napi_callback_info info)
{
    bool result = false;
    if (g_audioBridge) {
        result = g_audioBridge->initialize();
    }
    
    napi_value jsResult;
    napi_get_boolean(env, result, &jsResult);
    return jsResult;
}

napi_value AudioEngine_Shutdown(napi_env env, napi_callback_info info)
{
    if (g_audioBridge) {
        g_audioBridge->shutdown();
    }
    
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

napi_value AudioEngine_GetStatus(napi_env env, napi_callback_info info)
{
    if (!g_audioBridge) {
        napi_throw_error(env, nullptr, "AudioEngine not initialized");
        return nullptr;
    }
    
    // Create a simple status object for now
    napi_value status;
    napi_create_object(env, &status);
    
    napi_value isInitialized;
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
    
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

// Placeholder implementations for other functions
napi_value AudioEngine_SetAudioDevice(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_GetAvailableDevices(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_CreateAudioCue(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_LoadAudioFile(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_PlayCue(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_StopCue(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_PauseCue(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_ResumeCue(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_StopAllCues(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_SetCrosspoint(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_GetCrosspoint(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_SetInputLevel(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_SetOutputLevel(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_MuteOutput(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_SoloOutput(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_SetPatchRouting(napi_env env, napi_callback_info info) { return nullptr; }
napi_value AudioEngine_GetPatchRouting(napi_env env, napi_callback_info info) { return nullptr; }

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

} // extern "C"
#pragma once

// Node.js N-API header
#include <node_api.h>

// Individual JUCE module includes  
#include <juce_core/juce_core.h>
#include <juce_data_structures/juce_data_structures.h>

#include <memory>

class AudioEngine;
class CommandProcessor;

/**
 * @brief N-API bridge between Node.js and JUCE audio engine
 * 
 * Provides the interface layer that allows JavaScript to control
 * the native JUCE audio engine through N-API callbacks.
 */
class AudioBridge
{
public:
    AudioBridge();
    ~AudioBridge();
    
    // Engine lifecycle
    bool initialize();
    void shutdown();
    bool isInitialized() const;
    
    // Command processing
    napi_value processCommand(napi_env env, const char* jsonCommand);
    napi_value processCommandVar(napi_env env, napi_value commandObj);
    
    // Event system
    void setEventCallback(napi_env env, napi_value callback);
    
    // Utility functions for N-API conversion
    static napi_value juceVarToNapi(napi_env env, const juce::var& value);
    static juce::var napiToJuceVar(napi_env env, napi_value value);
    static juce::String napiStringToJuce(napi_env env, napi_value value);
    static napi_value juceStringToNapi(napi_env env, const juce::String& str);

private:
    std::unique_ptr<AudioEngine> audioEngine;
    std::unique_ptr<CommandProcessor> commandProcessor;
    
    // Event callback storage
    napi_env eventEnv;
    napi_ref eventCallbackRef;
    
    // Event handling
    void onAudioEvent(const juce::String& eventType, const juce::var& eventData);
    void callJavaScriptCallback(const juce::String& eventType, const juce::var& eventData);
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioBridge)
};

// C-style API for N-API module exports
extern "C" {
    // Module initialization
    napi_value Init(napi_env env, napi_value exports);
    
    // AudioEngine wrapper functions
    napi_value CreateAudioEngine(napi_env env, napi_callback_info info);
    napi_value AudioEngine_Initialize(napi_env env, napi_callback_info info);
    napi_value AudioEngine_Shutdown(napi_env env, napi_callback_info info);
    napi_value AudioEngine_GetStatus(napi_env env, napi_callback_info info);
    napi_value AudioEngine_ProcessCommand(napi_env env, napi_callback_info info);
    napi_value AudioEngine_SetEventCallback(napi_env env, napi_callback_info info);
    
    // Device management
    napi_value AudioEngine_SetAudioDevice(napi_env env, napi_callback_info info);
    napi_value AudioEngine_GetAvailableDevices(napi_env env, napi_callback_info info);
    
    // Audio cue management
    napi_value AudioEngine_CreateAudioCue(napi_env env, napi_callback_info info);
    napi_value AudioEngine_LoadAudioFile(napi_env env, napi_callback_info info);
    napi_value AudioEngine_PlayCue(napi_env env, napi_callback_info info);
    napi_value AudioEngine_StopCue(napi_env env, napi_callback_info info);
    napi_value AudioEngine_PauseCue(napi_env env, napi_callback_info info);
    napi_value AudioEngine_ResumeCue(napi_env env, napi_callback_info info);
    napi_value AudioEngine_StopAllCues(napi_env env, napi_callback_info info);
    
    // Matrix control
    napi_value AudioEngine_SetCrosspoint(napi_env env, napi_callback_info info);
    napi_value AudioEngine_GetCrosspoint(napi_env env, napi_callback_info info);
    napi_value AudioEngine_SetInputLevel(napi_env env, napi_callback_info info);
    napi_value AudioEngine_SetOutputLevel(napi_env env, napi_callback_info info);
    napi_value AudioEngine_MuteOutput(napi_env env, napi_callback_info info);
    napi_value AudioEngine_SoloOutput(napi_env env, napi_callback_info info);
    
    // Output patch control
    napi_value AudioEngine_SetPatchRouting(napi_env env, napi_callback_info info);
    napi_value AudioEngine_GetPatchRouting(napi_env env, napi_callback_info info);
    
    // Helper macros for N-API error handling
    #define NAPI_CALL(env, call)                                      \
        do {                                                          \
            napi_status status = (call);                              \
            if (status != napi_ok) {                                  \
                napi_throw_error(env, nullptr, "N-API call failed"); \
                return nullptr;                                       \
            }                                                         \
        } while(0)
    
    #define NAPI_CALL_RETURN_VOID(env, call)                         \
        do {                                                          \
            napi_status status = (call);                              \
            if (status != napi_ok) {                                  \
                napi_throw_error(env, nullptr, "N-API call failed"); \
                return;                                               \
            }                                                         \
        } while(0)
}
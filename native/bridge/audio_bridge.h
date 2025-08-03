#pragma once

#include <napi.h>
#include <memory>
#include <thread>
#include <atomic>
#include "../include/AudioEngine.h"
#include "../include/CommandProcessor.h"

class AudioEngineWrapper : public Napi::ObjectWrap<AudioEngineWrapper>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    AudioEngineWrapper(const Napi::CallbackInfo& info);
    ~AudioEngineWrapper();
    
private:
    // JavaScript API methods
    Napi::Value SendCommand(const Napi::CallbackInfo& info);
    Napi::Value Initialize(const Napi::CallbackInfo& info);
    Napi::Value Shutdown(const Napi::CallbackInfo& info);
    Napi::Value GetStatus(const Napi::CallbackInfo& info);
    
    // Event handling
    void StartEventLoop();
    void StopEventLoop();
    void EmitEvent(const std::string& eventType, const juce::var& data);
    
    // Internal
    std::unique_ptr<CueForge::AudioEngine> audioEngine;
    std::unique_ptr<CueForge::CommandProcessor> commandProcessor;
    
    // Threading
    std::unique_ptr<std::thread> eventThread;
    std::atomic<bool> shouldRun{false};
    
    // JavaScript references
    Napi::ThreadSafeFunction eventCallback;
    
    static Napi::FunctionReference constructor;
    
    // Utility
    juce::var NapiToJuceVar(const Napi::Value& value);
    Napi::Value JuceVarToNapi(Napi::Env env, const juce::var& value);
};

// Module initialization
Napi::Object InitModule(Napi::Env env, Napi::Object exports);
NODE_API_MODULE(cueforge_audio, InitModule)
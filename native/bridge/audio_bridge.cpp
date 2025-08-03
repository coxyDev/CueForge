#include "audio_bridge.h"
#include <JuceHeader.h>

// Static member definition
Napi::FunctionReference AudioEngineWrapper::constructor;

AudioEngineWrapper::AudioEngineWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioEngineWrapper>(info)
{
    Napi::Env env = info.Env();
    
    try
    {
        // Initialize JUCE
        juce::initialiseJuce_GUI();
        
        // Create audio engine and command processor
        audioEngine = std::make_unique<CueForge::AudioEngine>();
        commandProcessor = std::make_unique<CueForge::CommandProcessor>(*audioEngine);
        
        // Start event loop for callbacks
        StartEventLoop();
        
        juce::Logger::writeToLog("AudioEngineWrapper: Created successfully");
    }
    catch (const std::exception& e)
    {
        Napi::TypeError::New(env, "Failed to create AudioEngine: " + std::string(e.what()))
            .ThrowAsJavaScriptException();
    }
}

AudioEngineWrapper::~AudioEngineWrapper()
{
    StopEventLoop();
    
    if (audioEngine)
    {
        audioEngine->shutdown();
        audioEngine.reset();
    }
    
    commandProcessor.reset();
    
    juce::shutdownJuce_GUI();
    
    juce::Logger::writeToLog("AudioEngineWrapper: Destroyed");
}

Napi::Object AudioEngineWrapper::Init(Napi::Env env, Napi::Object exports)
{
    Napi::HandleScope scope(env);
    
    Napi::Function func = DefineClass(env, "AudioEngine", {
        InstanceMethod("sendCommand", &AudioEngineWrapper::SendCommand),
        InstanceMethod("initialize", &AudioEngineWrapper::Initialize),
        InstanceMethod("shutdown", &AudioEngineWrapper::Shutdown),
        InstanceMethod("getStatus", &AudioEngineWrapper::GetStatus)
    });
    
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    
    exports.Set("AudioEngine", func);
    
    return exports;
}

Napi::Value AudioEngineWrapper::SendCommand(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (info.Length() < 1)
    {
        Napi::TypeError::New(env, "Expected at least 1 argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsObject())
    {
        Napi::TypeError::New(env, "Expected command to be an object").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    try
    {
        // Convert Napi object to JUCE var
        juce::var command = NapiToJuceVar(info[0]);
        
        // Process command
        juce::var result = commandProcessor->processCommand(command);
        
        // Convert result back to Napi
        return JuceVarToNapi(env, result);
    }
    catch (const std::exception& e)
    {
        Napi::Error::New(env, "Command processing failed: " + std::string(e.what()))
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Value AudioEngineWrapper::Initialize(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    int sampleRate = 44100;
    int bufferSize = 512;
    
    if (info.Length() >= 1 && info[0].IsNumber())
    {
        sampleRate = info[0].As<Napi::Number>().Int32Value();
    }
    
    if (info.Length() >= 2 && info[1].IsNumber())
    {
        bufferSize = info[1].As<Napi::Number>().Int32Value();
    }
    
    bool success = audioEngine->initialize(sampleRate, bufferSize);
    
    return Napi::Boolean::New(env, success);
}

Napi::Value AudioEngineWrapper::Shutdown(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (audioEngine)
    {
        audioEngine->shutdown();
    }
    
    return env.Undefined();
}

Napi::Value AudioEngineWrapper::GetStatus(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    
    if (!audioEngine)
    {
        return env.Null();
    }
    
    try
    {
        juce::var status = audioEngine->getSystemStatus();
        return JuceVarToNapi(env, status);
    }
    catch (const std::exception& e)
    {
        Napi::Error::New(env, "Failed to get status: " + std::string(e.what()))
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

void AudioEngineWrapper::StartEventLoop()
{
    if (shouldRun.load())
        return; // Already running
    
    shouldRun.store(true);
    
    eventThread = std::make_unique<std::thread>([this]()
    {
        juce::Logger::writeToLog("AudioEngineWrapper: Event loop started");
        
        while (shouldRun.load())
        {
            // Send periodic performance updates
            if (audioEngine)
            {
                try
                {
                    juce::var perfEvent = commandProcessor->createPerformanceEvent(
                        audioEngine->getCpuUsage(),
                        audioEngine->getDropoutCount(),
                        0.0f // Memory usage placeholder
                    );
                    
                    EmitEvent("performanceStats", perfEvent);
                }
                catch (const std::exception& e)
                {
                    juce::Logger::writeToLog("Event loop error: " + juce::String(e.what()));
                }
            }
            
            // Sleep for 1 second between updates
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
        
        juce::Logger::writeToLog("AudioEngineWrapper: Event loop stopped");
    });
}

void AudioEngineWrapper::StopEventLoop()
{
    shouldRun.store(false);
    
    if (eventThread && eventThread->joinable())
    {
        eventThread->join();
        eventThread.reset();
    }
}

void AudioEngineWrapper::EmitEvent(const std::string& eventType, const juce::var& data)
{
    // In a full implementation, you would emit events back to JavaScript
    // For now, just log them
    juce::Logger::writeToLog("Event: " + eventType + " - " + juce::JSON::toString(data));
}

juce::var AudioEngineWrapper::NapiToJuceVar(const Napi::Value& value)
{
    if (value.IsNull() || value.IsUndefined())
    {
        return juce::var();
    }
    else if (value.IsBoolean())
    {
        return juce::var(value.As<Napi::Boolean>().Value());
    }
    else if (value.IsNumber())
    {
        // Check if it's an integer or float
        double numValue = value.As<Napi::Number>().DoubleValue();
        if (numValue == std::floor(numValue))
        {
            return juce::var(static_cast<int>(numValue));
        }
        else
        {
            return juce::var(numValue);
        }
    }
    else if (value.IsString())
    {
        return juce::var(value.As<Napi::String>().Utf8Value());
    }
    else if (value.IsArray())
    {
        Napi::Array arr = value.As<Napi::Array>();
        juce::Array<juce::var> juceArray;
        
        for (uint32_t i = 0; i < arr.Length(); ++i)
        {
            juceArray.add(NapiToJuceVar(arr[i]));
        }
        
        return juce::var(juceArray);
    }
    else if (value.IsObject())
    {
        Napi::Object obj = value.As<Napi::Object>();
        Napi::Array propNames = obj.GetPropertyNames();
        
        juce::DynamicObject::Ptr dynamicObj = new juce::DynamicObject();
        
        for (uint32_t i = 0; i < propNames.Length(); ++i)
        {
            Napi::Value key = propNames[i];
            juce::String propName = key.As<Napi::String>().Utf8Value();
            juce::var propValue = NapiToJuceVar(obj.Get(key));
            
            dynamicObj->setProperty(propName, propValue);
        }
        
        return juce::var(dynamicObj.get());
    }
    
    return juce::var();
}

Napi::Value AudioEngineWrapper::JuceVarToNapi(Napi::Env env, const juce::var& value)
{
    if (value.isVoid())
    {
        return env.Null();
    }
    else if (value.isBool())
    {
        return Napi::Boolean::New(env, static_cast<bool>(value));
    }
    else if (value.isInt())
    {
        return Napi::Number::New(env, static_cast<int>(value));
    }
    else if (value.isInt64())
    {
        return Napi::Number::New(env, static_cast<int64_t>(value));
    }
    else if (value.isDouble())
    {
        return Napi::Number::New(env, static_cast<double>(value));
    }
    else if (value.isString())
    {
        return Napi::String::New(env, value.toString().toStdString());
    }
    else if (value.isArray())
    {
        juce::Array<juce::var>* arr = value.getArray();
        Napi::Array napiArray = Napi::Array::New(env, arr->size());
        
        for (int i = 0; i < arr->size(); ++i)
        {
            napiArray[i] = JuceVarToNapi(env, (*arr)[i]);
        }
        
        return napiArray;
    }
    else if (value.isObject())
    {
        juce::DynamicObject* obj = value.getDynamicObject();
        Napi::Object napiObj = Napi::Object::New(env);
        
        if (obj)
        {
            auto& properties = obj->getProperties();
            
            for (auto it = properties.begin(); it != properties.end(); ++it)
            {
                juce::String propName = it.getName().toString();
                juce::var propValue = it.getValue();
                
                napiObj.Set(propName.toStdString(), JuceVarToNapi(env, propValue));
            }
        }
        
        return napiObj;
    }
    
    return env.Null();
}

// Module initialization function
Napi::Object InitModule(Napi::Env env, Napi::Object exports)
{
    // Set up JUCE message manager for this thread
    juce::MessageManager::getInstance();
    
    return AudioEngineWrapper::Init(env, exports);
}

// Register the module
NODE_API_MODULE(cueforge_audio, InitModule)
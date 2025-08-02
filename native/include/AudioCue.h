#pragma once

#include <JuceHeader.h>
#include <string>
#include "MatrixMixer.h"

namespace CueForge {

class AudioCue : public juce::ChangeListener
{
public:
    enum class State {
        Stopped,
        Playing,
        Paused,
        Loading
    };
    
    AudioCue(const std::string& id, const std::string& filePath);
    ~AudioCue();
    
    // File loading
    bool loadAudioFile(const std::string& filePath);
    bool isLoaded() const { return audioBuffer != nullptr; }
    
    // Playback control
    bool play(float startTime = 0.0f, float volume = 1.0f);
    bool stop(float fadeTime = 0.0f);
    bool pause();
    bool resume();
    
    // State
    State getState() const { return currentState; }
    bool isPlaying() const { return currentState == State::Playing; }
    
    // Audio properties
    int getNumChannels() const;
    double getDuration() const;
    double getCurrentTime() const;
    
    // Matrix routing
    MatrixMixer& getMatrix() { return cueMatrix; }
    bool setCrosspoint(int input, int output, float levelDb);
    bool setInputLevel(int input, float levelDb);
    bool setOutputLevel(int output, float levelDb);
    
    // Audio processing
    void processAudio(juce::AudioBuffer<float>& buffer, int startSample, int numSamples);
    
    // Properties
    void setVolume(float volume) { masterVolume = volume; }
    float getVolume() const { return masterVolume; }
    void setLoop(bool shouldLoop) { loop = shouldLoop; }
    bool isLooping() const { return loop; }
    
    // ChangeListener implementation
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;
    
private:
    std::string cueId;
    std::string filePath;
    
    // Audio data
    std::unique_ptr<juce::AudioBuffer<float>> audioBuffer;
    std::unique_ptr<juce::AudioFormatReader> audioReader;
    
    // Playback state
    State currentState = State::Stopped;
    std::atomic<double> currentPosition{0.0};
    std::atomic<bool> shouldPlay{false};
    
    // Audio processing
    MatrixMixer cueMatrix;
    float masterVolume = 1.0f;
    bool loop = false;
    
    // Fade automation
    juce::LinearSmoothedValue<float> volumeFader;
    
    // Internal methods
    void resetPosition();
    void updateState(State newState);
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioCue)
};

} // namespace CueForge
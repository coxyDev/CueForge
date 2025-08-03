#pragma once

// Individual JUCE module includes
#include <juce_core/juce_core.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_audio_utils/juce_audio_utils.h>

#include <memory>
#include <atomic>

class MatrixMixer;

/**
 * @brief Audio cue class for file playback with matrix integration
 * 
 * Handles audio file loading, playback control, and routing to matrix mixer.
 * Supports multiple audio formats and provides sample-accurate timing.
 */
class AudioCue
{
public:
    AudioCue(const juce::String& id, MatrixMixer* mixer);
    ~AudioCue();

    // File management
    bool loadFile(const juce::String& filePath);
    void unloadFile();
    bool isLoaded() const { return fileLoaded.load(); }

    // Playback control
    bool play(double startTime = 0.0, double fadeInTime = 0.0);
    bool stop(double fadeOutTime = 0.0);
    bool pause();
    bool resume();
    
    // State queries
    bool isPlaying() const { return playing.load(); }
    bool isPaused() const { return paused.load(); }
    double getCurrentTime() const;
    double getDuration() const;
    
    // Audio processing (called from audio thread)
    void processAudioBlock(juce::AudioBuffer<float>& buffer, int numSamples);
    
    // Properties
    const juce::String& getId() const { return cueId; }
    juce::String getFileName() const;
    int getNumChannels() const;
    double getSampleRate() const;

    // Matrix integration
    bool setInputChannel(int fileChannel, int matrixInput);
    int getInputChannel(int fileChannel) const;

private:
    const juce::String cueId;
    MatrixMixer* matrixMixer;
    
    // Audio file data
    std::unique_ptr<juce::AudioFormatReaderSource> readerSource;
    std::unique_ptr<juce::AudioTransportSource> transportSource;
    std::unique_ptr<juce::ResamplingAudioSource> resamplingSource;
    
    // File information
    juce::File audioFile;
    std::atomic<bool> fileLoaded{false};
    std::atomic<int> numChannels{0};
    std::atomic<double> sampleRate{0.0};
    std::atomic<double> lengthInSeconds{0.0};
    
    // Playback state
    std::atomic<bool> playing{false};
    std::atomic<bool> paused{false};
    std::atomic<bool> stopRequested{false};
    
    // Fade control
    struct FadeState {
        std::atomic<bool> active{false};
        std::atomic<float> currentLevel{1.0f};
        std::atomic<float> targetLevel{1.0f};
        std::atomic<float> stepSize{0.0f};
        std::atomic<int> remainingSamples{0};
    } fadeState;
    
    // Channel routing (file channel -> matrix input)
    std::vector<int> channelRouting;
    
    // Processing buffers
    juce::AudioBuffer<float> processingBuffer;
    
    // Internal methods
    void initializeSources();
    void updateFade(int numSamples);
    void applyFadeToBuffer(juce::AudioBuffer<float>& buffer, int numSamples);
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioCue)
};
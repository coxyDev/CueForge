cmake_minimum_required(VERSION 3.15)
project(CueForgeAudio VERSION 1.0.0)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(PkgConfig REQUIRED)

# Add JUCE
add_subdirectory(third_party/JUCE)

# Include directories
include_directories(include)

# Define our target as a shared library (for Node.js native module)
add_library(cueforge_audio SHARED
    src/AudioEngine.cpp
    src/AudioCue.cpp
    src/MatrixMixer.cpp
    src/OutputPatch.cpp
    src/CommandProcessor.cpp
    bridge/audio_bridge.cpp
)

# Link JUCE modules
target_link_libraries(cueforge_audio
    juce::juce_core
    juce::juce_events
    juce::juce_audio_basics
    juce::juce_audio_devices
    juce::juce_audio_formats
    juce::juce_audio_processors
    juce::juce_audio_utils
)

# Set target properties for Node.js native module
set_target_properties(cueforge_audio PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    CXX_VISIBILITY_PRESET hidden
)

# Platform-specific configurations
if(WIN32)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_WIN32=1
        JUCE_ASIO=1
        NOMINMAX
    )
endif()

if(APPLE)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_MAC=1
    )
endif()

if(UNIX AND NOT APPLE)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_LINUX=1
        JUCE_ALSA=1
        JUCE_JACK=1
    )
endif()

# Debug/Release configurations
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_definitions(cueforge_audio PRIVATE
        JUCE_DEBUG=1
        DEBUG=1
    )
else()
    target_compile_definitions(cueforge_audio PRIVATE
        JUCE_DEBUG=0
        NDEBUG=1
    )
endif()
cmake_minimum_required(VERSION 3.15)
project(CueForgeAudio VERSION 1.0.0)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Only find PkgConfig on Linux (not needed on Windows/macOS)
if(UNIX AND NOT APPLE)
    find_package(PkgConfig REQUIRED)
endif()

# Set JUCE path - adjust this to where you extracted JUCE
set(JUCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/JUCE")

# Verify JUCE exists
if(NOT EXISTS "${JUCE_DIR}/CMakeLists.txt")
    message(FATAL_ERROR "JUCE not found at ${JUCE_DIR}. Please extract JUCE 7.x to native/third_party/JUCE/")
endif()

# Add JUCE
add_subdirectory(${JUCE_DIR})

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
target_link_libraries(cueforge_audio PRIVATE
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

# Windows-specific configuration
if(WIN32)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_WIN32=1
        JUCE_ASIO=1
        NOMINMAX
        WIN32_LEAN_AND_MEAN
        _WIN32_WINNT=0x0601  # Windows 7+
    )
    
    # Link Windows libraries
    target_link_libraries(cueforge_audio PRIVATE
        winmm
        ole32
        user32
        kernel32
        gdi32
        comdlg32
        advapi32
        shell32
        version
        ws2_32
        wininet
    )
    
    # Visual Studio specific settings
    if(MSVC)
        target_compile_options(cueforge_audio PRIVATE
            /W3          # Warning level 3
            /permissive- # Strict C++ conformance
            /Zc:__cplusplus # Enable correct __cplusplus macro
        )
        
        # Release optimizations
        target_compile_options(cueforge_audio PRIVATE
            $<$<CONFIG:Release>:/O2>
            $<$<CONFIG:Release>:/GL>
        )
        
        target_link_options(cueforge_audio PRIVATE
            $<$<CONFIG:Release>:/LTCG>
        )
    endif()
endif()

# macOS-specific configuration
if(APPLE)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_MAC=1
    )
    
    # Link macOS frameworks
    find_library(CORE_AUDIO CoreAudio)
    find_library(CORE_MIDI CoreMIDI)
    find_library(AUDIO_UNIT AudioUnit)
    find_library(AUDIO_TOOLBOX AudioToolbox)
    find_library(FOUNDATION Foundation)
    find_library(COCOA Cocoa)
    
    target_link_libraries(cueforge_audio PRIVATE
        ${CORE_AUDIO}
        ${CORE_MIDI}
        ${AUDIO_UNIT}
        ${AUDIO_TOOLBOX}
        ${FOUNDATION}
        ${COCOA}
    )
endif()

# Linux-specific configuration
if(UNIX AND NOT APPLE)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_LINUX=1
        JUCE_ALSA=1
        JUCE_JACK=1
    )
    
    # Find and link Linux audio libraries
    find_package(Threads REQUIRED)
    target_link_libraries(cueforge_audio PRIVATE Threads::Threads)
    
    # Try to find ALSA
    find_path(ALSA_INCLUDE_DIR alsa/asoundlib.h)
    find_library(ALSA_LIBRARY asound)
    if(ALSA_INCLUDE_DIR AND ALSA_LIBRARY)
        target_include_directories(cueforge_audio PRIVATE ${ALSA_INCLUDE_DIR})
        target_link_libraries(cueforge_audio PRIVATE ${ALSA_LIBRARY})
    endif()
    
    # Try to find JACK
    find_library(JACK_LIBRARY jack)
    if(JACK_LIBRARY)
        target_link_libraries(cueforge_audio PRIVATE ${JACK_LIBRARY})
    endif()
    
    # Additional Linux libraries
    target_link_libraries(cueforge_audio PRIVATE
        dl
        pthread
        rt
    )
endif()

# Debug/Release configurations
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_definitions(cueforge_audio PRIVATE
        JUCE_DEBUG=1
        JUCE_LOG_ASSERTIONS=1
        DEBUG=1
        _DEBUG=1
    )
else()
    target_compile_definitions(cueforge_audio PRIVATE
        JUCE_DEBUG=0
        NDEBUG=1
        JUCE_OPTIMISE_NATIVE_CALLS=1
    )
endif()

# Display configuration info
message(STATUS "Building CueForge Audio Engine:")
message(STATUS "  Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "  Architecture: ${CMAKE_SYSTEM_PROCESSOR}")
message(STATUS "  JUCE directory: ${JUCE_DIR}")
message(STATUS "  Output: ${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_BUILD_TYPE}/cueforge_audio.node")
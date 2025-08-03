cmake_minimum_required(VERSION 3.15)
project(CueForgeAudio VERSION 1.0.0)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Node.js for N-API headers
execute_process(COMMAND node -p "process.execPath"
                OUTPUT_VARIABLE NODE_EXECUTABLE
                OUTPUT_STRIP_TRAILING_WHITESPACE)

execute_process(COMMAND node -p "process.version"
                OUTPUT_VARIABLE NODE_VERSION  
                OUTPUT_STRIP_TRAILING_WHITESPACE)

# Get Node.js include directory
execute_process(COMMAND node -p "process.config.variables.node_prefix + '/include/node'"
                OUTPUT_VARIABLE NODE_INCLUDE_DIR
                OUTPUT_STRIP_TRAILING_WHITESPACE)

# Fallback to standard locations if above fails
if(NOT EXISTS "${NODE_INCLUDE_DIR}/node_api.h")
    if(WIN32)
        # Try to find Node.js installation
        execute_process(COMMAND where node
                       OUTPUT_VARIABLE NODE_PATH
                       OUTPUT_STRIP_TRAILING_WHITESPACE)
        get_filename_component(NODE_DIR "${NODE_PATH}" DIRECTORY)
        set(NODE_INCLUDE_DIR "${NODE_DIR}/../include/node")
    endif()
endif()

# Verify N-API headers exist
if(NOT EXISTS "${NODE_INCLUDE_DIR}/node_api.h")
    message(FATAL_ERROR "Could not find Node.js N-API headers. Please ensure Node.js is installed.")
endif()

message(STATUS "Node.js version: ${NODE_VERSION}")
message(STATUS "Node.js include directory: ${NODE_INCLUDE_DIR}")

# Set JUCE path
set(JUCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/JUCE")

# Verify JUCE exists
if(NOT EXISTS "${JUCE_DIR}/CMakeLists.txt")
    message(FATAL_ERROR "JUCE not found at ${JUCE_DIR}. Please extract JUCE 7.x to native/third_party/JUCE/")
endif()

# Configure JUCE for our build
set(JUCE_BUILD_EXTRAS OFF CACHE BOOL "Build JUCE Extras")
set(JUCE_BUILD_EXAMPLES OFF CACHE BOOL "Build JUCE Examples")

# Add JUCE
add_subdirectory(${JUCE_DIR})

# Include directories
include_directories(include)
include_directories(${NODE_INCLUDE_DIR})

# Define our target as a shared library (for Node.js native module)
add_library(cueforge_audio SHARED
    src/AudioEngine.cpp
    src/AudioCue.cpp
    src/MatrixMixer.cpp
    src/OutputPatch.cpp
    src/CommandProcessor.cpp
    bridge/audio_bridge.cpp
)

# Link JUCE modules (using individual modules, not juce_recommended_config_flags)
target_link_libraries(cueforge_audio PRIVATE
    juce::juce_core
    juce::juce_events
    juce::juce_audio_basics
    juce::juce_audio_devices
    juce::juce_audio_formats
    juce::juce_audio_processors
    juce::juce_audio_utils
    juce::juce_data_structures
)

# Set target properties for Node.js native module
set_target_properties(cueforge_audio PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    CXX_VISIBILITY_PRESET hidden
)

# Core JUCE definitions (required for all platforms)
target_compile_definitions(cueforge_audio PRIVATE
    JUCE_STANDALONE_APPLICATION=0
    JUCE_USE_CURL=0
    JUCE_WEB_BROWSER=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
    JUCE_REPORT_APP_USAGE=0
    JUCE_STRICT_REFCOUNTEDPOINTER=1
)

# Windows-specific configuration
if(WIN32)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_WIN32=1
        JUCE_ASIO=1
        JUCE_WASAPI=1
        JUCE_DIRECTSOUND=1
        NOMINMAX
        WIN32_LEAN_AND_MEAN
        _WIN32_WINNT=0x0601  # Windows 7+
        UNICODE
        _UNICODE
    )
    
    # Download and configure ASIO SDK for Windows
    include(FetchContent)
    set(ASIO_SDK_DIR "${CMAKE_CURRENT_BINARY_DIR}/asio_sdk")
    
    if(NOT EXISTS "${ASIO_SDK_DIR}/common/iasiodrv.h")
        message(STATUS "ASIO SDK not found, downloading...")
        FetchContent_Declare(
            asio_sdk
            URL "https://download.steinberg.net/sdk_downloads/asiosdk_2.3.3_2019-06-14.zip"
            URL_HASH MD5=1c50c3a2b609b77e11b87e89f2e8d11e
            SOURCE_DIR ${ASIO_SDK_DIR}
        )
        FetchContent_MakeAvailable(asio_sdk)
    endif()
    
    # Add ASIO SDK include path
    if(EXISTS "${ASIO_SDK_DIR}/common/iasiodrv.h")
        target_include_directories(cueforge_audio PRIVATE "${ASIO_SDK_DIR}/common")
        target_include_directories(cueforge_audio PRIVATE "${ASIO_SDK_DIR}/host")
        target_include_directories(cueforge_audio PRIVATE "${ASIO_SDK_DIR}/host/pc")
        message(STATUS "ASIO SDK configured at: ${ASIO_SDK_DIR}")
    else()
        message(WARNING "ASIO SDK headers not found. ASIO support will be limited.")
        target_compile_definitions(cueforge_audio PRIVATE JUCE_ASIO=0)
    endif()
    
    # Link Windows libraries
    target_link_libraries(cueforge_audio PRIVATE
        winmm
        ole32
        oleaut32
        user32
        kernel32
        gdi32
        comctl32
        comdlg32
        advapi32
        shell32
        version
        ws2_32
        wininet
        shlwapi
        rpcrt4
    )
    
    # Visual Studio specific settings
    if(MSVC)
        target_compile_options(cueforge_audio PRIVATE
            /W3          # Warning level 3
            /permissive- # Strict C++ conformance
            /Zc:__cplusplus # Enable correct __cplusplus macro
            /bigobj      # Support large object files
        )
        
        # Release optimizations
        target_compile_options(cueforge_audio PRIVATE
            $<$<CONFIG:Release>:/O2>
            $<$<CONFIG:Release>:/GL>
        )
        
        target_link_options(cueforge_audio PRIVATE
            $<$<CONFIG:Release>:/LTCG>
            /SUBSYSTEM:WINDOWS
        )
    endif()
endif()

# macOS-specific configuration
if(APPLE)
    target_compile_definitions(cueforge_audio PRIVATE 
        JUCE_MAC=1
        JUCE_COREAUDIO=1
        JUCE_COREMIDI=1
    )
    
    # Link macOS frameworks
    find_library(CORE_AUDIO CoreAudio)
    find_library(CORE_MIDI CoreMIDI)
    find_library(AUDIO_UNIT AudioUnit)
    find_library(AUDIO_TOOLBOX AudioToolbox)
    find_library(FOUNDATION Foundation)
    find_library(COCOA Cocoa)
    find_library(IOKIT IOKit)
    find_library(CARBON Carbon)
    find_library(ACCELERATE Accelerate)
    
    target_link_libraries(cueforge_audio PRIVATE
        ${CORE_AUDIO}
        ${CORE_MIDI}
        ${AUDIO_UNIT}
        ${AUDIO_TOOLBOX}
        ${FOUNDATION}
        ${COCOA}
        ${IOKIT}
        ${CARBON}
        ${ACCELERATE}
    )
    
    # Set deployment target
    set_target_properties(cueforge_audio PROPERTIES
        MACOSX_DEPLOYMENT_TARGET "10.15"
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
    
    # Find required Linux packages
    find_package(PkgConfig REQUIRED)
    
    # ALSA
    pkg_check_modules(ALSA REQUIRED alsa)
    target_include_directories(cueforge_audio PRIVATE ${ALSA_INCLUDE_DIRS})
    target_link_libraries(cueforge_audio PRIVATE ${ALSA_LIBRARIES})
    
    # X11 (required for JUCE)
    pkg_check_modules(X11 REQUIRED x11)
    target_include_directories(cueforge_audio PRIVATE ${X11_INCLUDE_DIRS})
    target_link_libraries(cueforge_audio PRIVATE ${X11_LIBRARIES})
    
    # Additional Linux libraries
    target_link_libraries(cueforge_audio PRIVATE
        dl
        pthread
        rt
    )
    
    # Optional: JACK
    pkg_check_modules(JACK jack)
    if(JACK_FOUND)
        target_include_directories(cueforge_audio PRIVATE ${JACK_INCLUDE_DIRS})
        target_link_libraries(cueforge_audio PRIVATE ${JACK_LIBRARIES})
    else()
        target_compile_definitions(cueforge_audio PRIVATE JUCE_JACK=0)
    endif()
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

# N-API specific configuration
target_compile_definitions(cueforge_audio PRIVATE
    NAPI_VERSION=6
    NODE_ADDON_API_DISABLE_DEPRECATED
)

# Display configuration info
message(STATUS "Building CueForge Audio Engine:")
message(STATUS "  Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "  Architecture: ${CMAKE_SYSTEM_PROCESSOR}")
message(STATUS "  JUCE directory: ${JUCE_DIR}")
message(STATUS "  Node.js include: ${NODE_INCLUDE_DIR}")
message(STATUS "  Output: ${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_BUILD_TYPE}/cueforge_audio.node")
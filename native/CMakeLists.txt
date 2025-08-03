cmake_minimum_required(VERSION 3.15)
project(CueForgeAudio VERSION 1.0.0)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build configuration
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Platform detection
if(WIN32)
    set(PLATFORM_NAME "win32")
elseif(APPLE)
    set(PLATFORM_NAME "darwin")
else()
    set(PLATFORM_NAME "linux")
endif()

# Architecture detection
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(ARCH_NAME "x64")
else()
    set(ARCH_NAME "ia32")
endif()

# ============================================================================
# NODE.JS AND N-API HEADER CONFIGURATION
# ============================================================================

# Get Node.js executable path
execute_process(
    COMMAND node -p "process.execPath"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
    OUTPUT_VARIABLE NODE_EXECUTABLE
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
)

# Get Node.js version
execute_process(
    COMMAND node -p "process.version"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
    OUTPUT_VARIABLE NODE_VERSION_FULL
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
)

# Extract version number (remove 'v' prefix)
string(SUBSTRING ${NODE_VERSION_FULL} 1 -1 NODE_VERSION)

message(STATUS "Node.js executable: ${NODE_EXECUTABLE}")
message(STATUS "Node.js version: ${NODE_VERSION}")

# Find Node.js installation directory
get_filename_component(NODE_BIN_DIR "${NODE_EXECUTABLE}" DIRECTORY)
get_filename_component(NODE_ROOT_DIR "${NODE_BIN_DIR}" DIRECTORY)

# Possible Node.js header locations (in priority order)
set(NODE_HEADER_SEARCH_PATHS
    "${NODE_ROOT_DIR}/include/node"
    "${CMAKE_SOURCE_DIR}/../.node-gyp/${NODE_VERSION}/include/node"
    "$ENV{USERPROFILE}/.node-gyp/${NODE_VERSION}/include/node" 
    "$ENV{HOME}/.node-gyp/${NODE_VERSION}/include/node"
    "$ENV{APPDATA}/npm/node_modules/node/include/node"
    "C:/Program Files/nodejs/include/node"
    "${CMAKE_SOURCE_DIR}/../node_modules/node/include/node"
)

# Find actual Node.js headers (node_api.h)
set(NODE_HEADERS_FOUND FALSE)
set(NODE_INCLUDE_DIR "")

foreach(SEARCH_PATH ${NODE_HEADER_SEARCH_PATHS})
    if(EXISTS "${SEARCH_PATH}/node_api.h")
        set(NODE_INCLUDE_DIR "${SEARCH_PATH}")
        set(NODE_HEADERS_FOUND TRUE)
        message(STATUS "✅ Found Node.js headers at: ${NODE_INCLUDE_DIR}")
        break()
    endif()
endforeach()

# If Node.js headers not found, try to install them
if(NOT NODE_HEADERS_FOUND)
    message(STATUS "⚠️  Node.js headers not found, attempting to install...")
    
    # Try to install headers using node-gyp
    execute_process(
        COMMAND node-gyp install ${NODE_VERSION}
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
        RESULT_VARIABLE NODE_GYP_RESULT
        OUTPUT_VARIABLE NODE_GYP_OUTPUT
        ERROR_VARIABLE NODE_GYP_ERROR
    )
    
    # Check again after installation attempt
    foreach(SEARCH_PATH ${NODE_HEADER_SEARCH_PATHS})
        if(EXISTS "${SEARCH_PATH}/node_api.h")
            set(NODE_INCLUDE_DIR "${SEARCH_PATH}")
            set(NODE_HEADERS_FOUND TRUE)
            message(STATUS "✅ Node.js headers installed at: ${NODE_INCLUDE_DIR}")
            break()
        endif()
    endforeach()
endif()

# Find node-addon-api (C++ wrapper)
find_path(NODE_ADDON_API_DIR
    NAMES "napi.h"
    PATHS 
        "${CMAKE_SOURCE_DIR}/../node_modules/node-addon-api"
        "${CMAKE_SOURCE_DIR}/node_modules/node-addon-api"
    NO_DEFAULT_PATH
)

# Final validation
if(NOT NODE_HEADERS_FOUND)
    message(STATUS "")
    message(STATUS "❌ CRITICAL: Node.js headers not found!")
    message(STATUS "Searched paths:")
    foreach(PATH ${NODE_HEADER_SEARCH_PATHS})
        message(STATUS "  - ${PATH}")
    endforeach()
    message(STATUS "")
    message(STATUS "🔧 To fix this issue:")
    message(STATUS "  1. Close Visual Studio")
    message(STATUS "  2. Open 'Developer Command Prompt for VS 2022'")
    message(STATUS "  3. cd \"${CMAKE_SOURCE_DIR}/..\"")
    message(STATUS "  4. npm install")
    message(STATUS "  5. node-gyp install ${NODE_VERSION}")
    message(STATUS "  6. Reopen project in Visual Studio")
    message(STATUS "")
    message(FATAL_ERROR "Node.js N-API headers are required to build the native module")
endif()

if(NOT NODE_ADDON_API_DIR)
    message(STATUS "")
    message(STATUS "❌ node-addon-api not found!")
    message(STATUS "🔧 To fix: npm install node-addon-api")
    message(STATUS "")
    message(FATAL_ERROR "node-addon-api is required for C++ N-API development")
endif()

message(STATUS "✅ Node.js headers: ${NODE_INCLUDE_DIR}")
message(STATUS "✅ Node addon API: ${NODE_ADDON_API_DIR}")

# ============================================================================
# JUCE FRAMEWORK CONFIGURATION
# ============================================================================

# Find JUCE framework
set(JUCE_SEARCH_PATHS
    "${CMAKE_CURRENT_SOURCE_DIR}/third_party/JUCE"
    "${CMAKE_CURRENT_SOURCE_DIR}/../third_party/JUCE"
    "${CMAKE_SOURCE_DIR}/third_party/JUCE"
    "${CMAKE_SOURCE_DIR}/native/third_party/JUCE"
)

set(JUCE_FOUND FALSE)
foreach(JUCE_PATH ${JUCE_SEARCH_PATHS})
    if(EXISTS "${JUCE_PATH}/CMakeLists.txt")
        set(JUCE_DIR "${JUCE_PATH}")
        set(JUCE_FOUND TRUE)
        message(STATUS "✅ Found JUCE at: ${JUCE_DIR}")
        break()
    endif()
endforeach()

if(NOT JUCE_FOUND)
    message(STATUS "")
    message(STATUS "❌ JUCE framework not found!")
    message(STATUS "Searched locations:")
    foreach(PATH ${JUCE_SEARCH_PATHS})
        message(STATUS "  - ${PATH}")
    endforeach()
    message(STATUS "")
    message(STATUS "Current source directory: ${CMAKE_CURRENT_SOURCE_DIR}")
    message(STATUS "Project root directory: ${CMAKE_SOURCE_DIR}")
    message(STATUS "")
    message(FATAL_ERROR 
        "Please ensure JUCE is installed at one of the above locations.\n"
        "Run: npm run setup:juce\n"
        "Or manually download JUCE 7.x to native/third_party/JUCE/"
    )
endif()

# Configure JUCE for our build
set(JUCE_BUILD_EXTRAS OFF CACHE BOOL "Build JUCE Extras")
set(JUCE_BUILD_EXAMPLES OFF CACHE BOOL "Build JUCE Examples")

# Add JUCE
add_subdirectory(${JUCE_DIR})

message(STATUS "JUCE framework found at: ${JUCE_DIR}")

# ============================================================================
# TARGET DEFINITION
# ============================================================================

# Include directories
target_include_directories(cueforge_audio PRIVATE
    include
    ${NODE_INCLUDE_DIR}
    ${NODE_ADDON_API_DIR}
)

# Define our target as a shared library (for Node.js native module)
add_library(cueforge_audio SHARED
    src/AudioEngine.cpp
    src/AudioCue.cpp
    src/MatrixMixer.cpp
    src/OutputPatch.cpp
    src/CommandProcessor.cpp
    bridge/audio_bridge.cpp
)

# Set target properties for Node.js native module
set_target_properties(cueforge_audio PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    CXX_VISIBILITY_PRESET hidden
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
    juce::juce_data_structures
)

# ============================================================================
# PLATFORM-SPECIFIC CONFIGURATION
# ============================================================================

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
    
    # ASIO SDK configuration - use local copy
    # Common ASIO SDK locations to check
    set(ASIO_SDK_SEARCH_PATHS
        "${CMAKE_CURRENT_SOURCE_DIR}/third_party/asiosdk"
        "${CMAKE_CURRENT_SOURCE_DIR}/asiosdk"
        "${CMAKE_SOURCE_DIR}/../asiosdk"
        "C:/SDKs/asiosdk"
        "C:/Program Files/ASIO SDK"
        "C:/dev/asiosdk"
        "${CMAKE_CURRENT_BINARY_DIR}/asio_sdk"
    )
    
    # Find ASIO SDK
    set(ASIO_SDK_FOUND FALSE)
    foreach(ASIO_PATH ${ASIO_SDK_SEARCH_PATHS})
        if(EXISTS "${ASIO_PATH}/common/iasiodrv.h")
            set(ASIO_SDK_DIR "${ASIO_PATH}")
            set(ASIO_SDK_FOUND TRUE)
            message(STATUS "✅ Found ASIO SDK at: ${ASIO_SDK_DIR}")
            break()
        endif()
    endforeach()
    
    # If not found in standard locations, prompt user
    if(NOT ASIO_SDK_FOUND)
        message(STATUS "")
        message(STATUS "ASIO SDK not found in standard locations.")
        message(STATUS "Checked locations:")
        foreach(PATH ${ASIO_SDK_SEARCH_PATHS})
            message(STATUS "  - ${PATH}")
        endforeach()
        message(STATUS "")
        message(STATUS "Since you have the ASIO SDK, please:")
        message(STATUS "  1. Copy it to: ${CMAKE_CURRENT_SOURCE_DIR}/third_party/asiosdk")
        message(STATUS "  2. Or set ASIO_SDK_PATH: cmake .. -DASIO_SDK_PATH=\"/path/to/asiosdk\"")
        message(STATUS "")
        message(STATUS "Building without ASIO support for now...")
        target_compile_definitions(cueforge_audio PRIVATE JUCE_ASIO=0)
    else()
        # Configure ASIO SDK
        target_include_directories(cueforge_audio PRIVATE 
            "${ASIO_SDK_DIR}/common"
            "${ASIO_SDK_DIR}/host"
            "${ASIO_SDK_DIR}/host/pc"
        )
        target_compile_definitions(cueforge_audio PRIVATE JUCE_ASIO=1)
        message(STATUS "✅ ASIO support enabled")
    endif()
    
    # Allow manual override via command line
    if(DEFINED ASIO_SDK_PATH AND EXISTS "${ASIO_SDK_PATH}/common/iasiodrv.h")
        set(ASIO_SDK_DIR "${ASIO_SDK_PATH}")
        target_include_directories(cueforge_audio PRIVATE 
            "${ASIO_SDK_DIR}/common"
            "${ASIO_SDK_DIR}/host" 
            "${ASIO_SDK_DIR}/host/pc"
        )
        target_compile_definitions(cueforge_audio PRIVATE JUCE_ASIO=1)
        message(STATUS "✅ Using manually specified ASIO SDK: ${ASIO_SDK_DIR}")
        set(ASIO_SDK_FOUND TRUE)
    endif()
    
    # Link Windows libraries
    target_link_libraries(cueforge_audio PRIVATE
        winmm ole32 oleaut32 user32 kernel32 gdi32
        comctl32 comdlg32 advapi32 shell32 version
        ws2_32 wininet shlwapi rpcrt4
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
        ${CORE_AUDIO} ${CORE_MIDI} ${AUDIO_UNIT} ${AUDIO_TOOLBOX}
        ${FOUNDATION} ${COCOA} ${IOKIT} ${CARBON} ${ACCELERATE}
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
    target_link_libraries(cueforge_audio PRIVATE dl pthread rt)
    
    # Optional: JACK
    pkg_check_modules(JACK jack)
    if(JACK_FOUND)
        target_include_directories(cueforge_audio PRIVATE ${JACK_INCLUDE_DIRS})
        target_link_libraries(cueforge_audio PRIVATE ${JACK_LIBRARIES})
    else()
        target_compile_definitions(cueforge_audio PRIVATE JUCE_JACK=0)
    endif()
endif()

# ============================================================================
# BUILD CONFIGURATION
# ============================================================================

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

# ============================================================================
# BUILD INFORMATION
# ============================================================================

# Display configuration info
message(STATUS "")
message(STATUS "=== CueForge Audio Engine Build Configuration ===")
message(STATUS "  Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Platform: ${CMAKE_SYSTEM_NAME} (${PLATFORM_NAME})")
message(STATUS "  Architecture: ${CMAKE_SYSTEM_PROCESSOR} (${ARCH_NAME})")
message(STATUS "  Electron version: ${ELECTRON_VERSION}")
message(STATUS "  Node.js version: ${NODE_VERSION}")
message(STATUS "  JUCE directory: ${JUCE_DIR}")
message(STATUS "  Node.js headers: ${NODE_INCLUDE_DIR}")
message(STATUS "  Node addon API: ${NODE_ADDON_API_DIR}")
message(STATUS "  Output: ${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_BUILD_TYPE}/cueforge_audio.node")
message(STATUS "================================================")
message(STATUS "")
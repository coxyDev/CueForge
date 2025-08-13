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
# NODE.JS AND N-API HEADER CONFIGURATION - Updated for Electron v32
# ============================================================================

# Get Node.js executable and version from current environment
execute_process(
    COMMAND node -p "process.execPath"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
    OUTPUT_VARIABLE NODE_EXECUTABLE
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
)

execute_process(
    COMMAND node -p "process.version"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
    OUTPUT_VARIABLE NODE_VERSION_FULL
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
)

# Extract version number (remove 'v' prefix)
if(NODE_VERSION_FULL)
    string(SUBSTRING ${NODE_VERSION_FULL} 1 -1 NODE_VERSION)
else()
    set(NODE_VERSION "24.4.0")  # Fallback to current system version
endif()

# Get Electron's Node.js version for comparison
execute_process(
    COMMAND npx electron -p "process.versions.node"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/..
    OUTPUT_VARIABLE ELECTRON_NODE_VERSION
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
)

message(STATUS "System Node.js version: ${NODE_VERSION}")
message(STATUS "Electron Node.js version: ${ELECTRON_NODE_VERSION}")

# Use Electron's Node.js version if available, otherwise use system version
if(ELECTRON_NODE_VERSION)
    set(TARGET_NODE_VERSION "${ELECTRON_NODE_VERSION}")
else()
    set(TARGET_NODE_VERSION "${NODE_VERSION}")
endif()

message(STATUS "Target Node.js version for build: ${TARGET_NODE_VERSION}")

# Find Node.js installation directory and library
if(NODE_EXECUTABLE)
    get_filename_component(NODE_BIN_DIR "${NODE_EXECUTABLE}" DIRECTORY)
    get_filename_component(NODE_ROOT_DIR "${NODE_BIN_DIR}" DIRECTORY)
    
    # Look for Node.js import library on Windows
    if(WIN32)
        set(NODE_LIB_SEARCH_PATHS
            "${NODE_ROOT_DIR}/lib/node.lib"
            "${NODE_BIN_DIR}/node.lib"
            "C:/Program Files/nodejs/node.lib"
            "C:/Program Files (x86)/nodejs/node.lib"
            "${CMAKE_SOURCE_DIR}/../.node-gyp/${TARGET_NODE_VERSION}/node.lib"
            "$ENV{USERPROFILE}/.node-gyp/${TARGET_NODE_VERSION}/node.lib"
            "${CMAKE_SOURCE_DIR}/../.node-gyp/${TARGET_NODE_VERSION}/Release/node.lib"
            "$ENV{USERPROFILE}/.node-gyp/${TARGET_NODE_VERSION}/Release/node.lib"
        )
        
        set(NODE_LIB_FOUND FALSE)
        foreach(LIB_PATH ${NODE_LIB_SEARCH_PATHS})
            if(EXISTS "${LIB_PATH}")
                set(NODE_LIB "${LIB_PATH}")
                set(NODE_LIB_FOUND TRUE)
                message(STATUS "✅ Found Node.js library at: ${NODE_LIB}")
                break()
            endif()
        endforeach()
        
        if(NOT NODE_LIB_FOUND)
            message(STATUS "⚠️  Node.js import library not found, will try alternative linking method")
        endif()
    endif()
endif()

# Comprehensive Node.js header search paths for v24+ (including NVM)
set(NODE_HEADER_SEARCH_PATHS
    # NVM for Windows locations
    "C:/nvm4w/v${TARGET_NODE_VERSION}/include/node"
    "C:/nvm4w/v${NODE_VERSION}/include/node"
    "$ENV{NVM_HOME}/v${TARGET_NODE_VERSION}/include/node"
    "$ENV{NVM_HOME}/v${NODE_VERSION}/include/node"
    
    # System Node.js installation
    "${NODE_ROOT_DIR}/include/node"
    "C:/Program Files/nodejs/include/node"
    "C:/Program Files (x86)/nodejs/include/node"
    
    # node-gyp cache locations
    "${CMAKE_SOURCE_DIR}/../.node-gyp/${TARGET_NODE_VERSION}/include/node"
    "${CMAKE_SOURCE_DIR}/../.node-gyp/${NODE_VERSION}/include/node"
    "$ENV{USERPROFILE}/.node-gyp/${TARGET_NODE_VERSION}/include/node"
    "$ENV{USERPROFILE}/.node-gyp/${NODE_VERSION}/include/node"
    "$ENV{HOME}/.node-gyp/${TARGET_NODE_VERSION}/include/node"
    "$ENV{HOME}/.node-gyp/${NODE_VERSION}/include/node"
    
    # npm global locations
    "$ENV{APPDATA}/npm/node_modules/node/include/node"
    "$ENV{NPM_CONFIG_PREFIX}/include/node"
    
    # Alternative locations
    "${CMAKE_SOURCE_DIR}/../node_modules/node/include/node"
    "${CMAKE_SOURCE_DIR}/node_modules/node/include/node"
)

# Find actual Node.js headers (node_api.h)
set(NODE_HEADERS_FOUND FALSE)
set(NODE_INCLUDE_DIR "")

message(STATUS "Searching for Node.js N-API headers...")
foreach(SEARCH_PATH ${NODE_HEADER_SEARCH_PATHS})
    if(EXISTS "${SEARCH_PATH}/node_api.h")
        set(NODE_INCLUDE_DIR "${SEARCH_PATH}")
        set(NODE_HEADERS_FOUND TRUE)
        message(STATUS "✅ Found Node.js headers at: ${NODE_INCLUDE_DIR}")
        break()
    endif()
endforeach()

# Find node-addon-api (C++ wrapper) - updated for v8+
find_path(NODE_ADDON_API_DIR
    NAMES "napi.h"
    PATHS 
        "${CMAKE_SOURCE_DIR}/../node_modules/node-addon-api"
        "${CMAKE_SOURCE_DIR}/node_modules/node-addon-api"
        "$ENV{APPDATA}/npm/node_modules/node-addon-api"
    NO_DEFAULT_PATH
)

# Final validation with helpful error messages
if(NOT NODE_HEADERS_FOUND)
    message(FATAL_ERROR "Node.js N-API headers are required for native module compilation")
endif()

if(NOT NODE_ADDON_API_DIR)
    message(FATAL_ERROR "node-addon-api v8+ is required for Node.js v24 compatibility")
endif()

message(STATUS "✅ Node.js headers: ${NODE_INCLUDE_DIR}")
message(STATUS "✅ Node addon API: ${NODE_ADDON_API_DIR}")
message(STATUS "✅ Target Node.js version: ${TARGET_NODE_VERSION}")

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
    message(FATAL_ERROR "JUCE framework not found! Please ensure JUCE is installed at native/third_party/JUCE/")
endif()

# Configure JUCE for our build
set(JUCE_BUILD_EXTRAS OFF CACHE BOOL "Build JUCE Extras")
set(JUCE_BUILD_EXAMPLES OFF CACHE BOOL "Build JUCE Examples")

# Add JUCE
add_subdirectory(${JUCE_DIR})

message(STATUS "JUCE framework found at: ${JUCE_DIR}")

# ============================================================================
# TARGET DEFINITION - Create target FIRST
# ============================================================================

# Define our target as a shared library (for Node.js native module)
add_library(cueforge_audio SHARED
    src/AudioEngine.cpp
    src/AudioCue.cpp
    src/MatrixMixer.cpp
    src/OutputPatch.cpp
    src/CommandProcessor.cpp
    bridge/audio_bridge.cpp
)

# Set target properties for Node.js native module - IMMEDIATELY after creation
set_target_properties(cueforge_audio PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    CXX_VISIBILITY_PRESET hidden
)

# Include directories - AFTER target is created
target_include_directories(cueforge_audio PRIVATE
    include
    ${NODE_INCLUDE_DIR}
    ${NODE_ADDON_API_DIR}
)

# Link JUCE modules - AFTER target is created
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

# Link Node.js library for N-API functions
if(WIN32 AND NODE_LIB_FOUND)
    target_link_libraries(cueforge_audio PRIVATE "${NODE_LIB}")
    message(STATUS "✅ Linking Node.js library: ${NODE_LIB}")
else()
    # Alternative: Use delay-loaded linking (Windows-specific)
    if(WIN32)
        target_link_options(cueforge_audio PRIVATE 
            "/DELAYLOAD:node.exe"
            "/IGNORE:4199"  # Ignore delay-load warnings
        )
        target_link_libraries(cueforge_audio PRIVATE delayimp)
        message(STATUS "✅ Using delay-load linking for Node.js")
    endif()
endif()

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
    
    # Configure ASIO SDK
    if(ASIO_SDK_FOUND)
        target_include_directories(cueforge_audio PRIVATE 
            "${ASIO_SDK_DIR}/common"
            "${ASIO_SDK_DIR}/host"
            "${ASIO_SDK_DIR}/host/pc"
        )
        target_compile_definitions(cueforge_audio PRIVATE JUCE_ASIO=1)
        message(STATUS "✅ ASIO support enabled")
    else()
        message(STATUS "⚠️  ASIO SDK not found - building without ASIO support")
        target_compile_definitions(cueforge_audio PRIVATE JUCE_ASIO=0)
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

# N-API specific configuration for Node.js v24+
target_compile_definitions(cueforge_audio PRIVATE
    NAPI_VERSION=8                           # Updated for Node.js v24
    NODE_ADDON_API_DISABLE_DEPRECATED
    NODE_API_NO_EXTERNAL_BUFFERS_ALLOWED    # Security feature in v24
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
message(STATUS "  Electron version: ${ELECTRON_NODE_VERSION}")
message(STATUS "  Node.js version: ${TARGET_NODE_VERSION}")
message(STATUS "  JUCE directory: ${JUCE_DIR}")
message(STATUS "  Node.js headers: ${NODE_INCLUDE_DIR}")
message(STATUS "  Node addon API: ${NODE_ADDON_API_DIR}")
message(STATUS "  Output: ${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_BUILD_TYPE}/cueforge_audio.node")
message(STATUS "================================================")
message(STATUS "")
@echo off
REM =============================================================================
REM File: native/build-windows.bat
REM Windows build script for CueForge Audio Engine
REM =============================================================================

echo CueForge Audio Engine - Windows Build Script
echo =============================================

REM Check if we're in the right directory
if not exist "CMakeLists.txt" (
    echo Error: CMakeLists.txt not found. Please run this from the native/ directory.
    pause
    exit /b 1
)

REM Check if JUCE exists
if not exist "third_party\JUCE\CMakeLists.txt" (
    echo Error: JUCE not found at third_party\JUCE\
    echo Please download JUCE 7.x from https://juce.com/get-juce/download
    echo and extract it to native\third_party\JUCE\
    pause
    exit /b 1
)

REM Create build directory
if not exist "build" mkdir build
cd build

echo.
echo Step 1: Configuring CMake...
echo =============================

REM Try to find Visual Studio automatically
cmake .. -DCMAKE_BUILD_TYPE=Release

if %ERRORLEVEL% neq 0 (
    echo.
    echo CMake configuration failed. Trying with specific generator...
    echo.
    
    REM Try with Visual Studio 2022
    cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Release
    
    if %ERRORLEVEL% neq 0 (
        REM Try with Visual Studio 2019
        cmake .. -G "Visual Studio 16 2019" -A x64 -DCMAKE_BUILD_TYPE=Release
        
        if %ERRORLEVEL% neq 0 (
            echo.
            echo Error: CMake configuration failed with all generators.
            echo Please ensure Visual Studio 2019 or 2022 is installed with C++ development tools.
            pause
            exit /b 1
        )
    )
)

echo.
echo Step 2: Building the project...
echo ================================

cmake --build . --config Release

if %ERRORLEVEL% neq 0 (
    echo.
    echo Error: Build failed.
    pause
    exit /b 1
)

echo.
echo Step 3: Checking output...
echo ==========================

if exist "Release\cueforge_audio.node" (
    echo Success! Native module built at: build\Release\cueforge_audio.node
    
    REM Copy to expected location for testing
    if not exist "..\build\Release" mkdir "..\build\Release"
    copy "Release\cueforge_audio.node" "..\build\Release\"
    
    echo.
    echo Testing the module...
    echo =====================
    
    REM Create a simple test
    echo const path = require('path'); > test.js
    echo const modulePath = path.join(__dirname, 'Release', 'cueforge_audio.node'); >> test.js
    echo try { >> test.js
    echo   const nativeModule = require(modulePath); >> test.js
    echo   console.log('✅ Native module loaded successfully'); >> test.js
    echo   const engine = new nativeModule.AudioEngine(); >> test.js
    echo   console.log('✅ AudioEngine created successfully'); >> test.js
    echo   console.log('Engine status:', engine.getStatus()); >> test.js
    echo   engine.shutdown(); >> test.js
    echo   console.log('✅ Test completed successfully'); >> test.js
    echo } catch (error) { >> test.js
    echo   console.error('❌ Test failed:', error.message); >> test.js
    echo } >> test.js
    
    node test.js
    del test.js
    
) else (
    echo Error: cueforge_audio.node not found in expected location.
    echo Please check the build output above for errors.
)

echo.
echo Build script completed.
pause
@echo off
REM =============================================================================
REM File: build_native.bat
REM Complete CueForge Audio Engine Build Script for Windows
REM =============================================================================

echo 🎵 CueForge Audio Engine - Complete Build Process
echo ==================================================

REM Store the original directory
set ORIGINAL_DIR=%CD%

REM Check if we're in the project root
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this from the project root directory.
    pause
    exit /b 1
)

REM Check if native directory exists
if not exist "native" (
    echo ❌ Error: native directory not found.
    pause
    exit /b 1
)

echo 📋 Build Configuration:
echo   Project Root: %CD%
echo   Native Path:  %CD%\native
echo   Node Version: 
node --version
echo   NPM Version:  
npm --version
echo.

echo ⚙️  Step 1: Setting up JUCE framework...
echo ==========================================
node setup_juce.js
if %ERRORLEVEL% neq 0 (
    echo ❌ JUCE setup failed
    pause
    exit /b 1
)

echo.
echo 🔧 Step 2: Preparing build environment...
echo =========================================

REM Navigate to native directory
cd native

REM Check required files exist
if not exist "CMakeLists.txt" (
    echo ❌ Error: CMakeLists.txt not found in native directory
    cd %ORIGINAL_DIR%
    pause
    exit /b 1
)

if not exist "third_party\JUCE\CMakeLists.txt" (
    echo ❌ Error: JUCE CMakeLists.txt not found
    cd %ORIGINAL_DIR%
    pause
    exit /b 1
)

REM Create build directory
echo 📁 Creating build directory...
if exist "build" (
    echo   Cleaning existing build directory...
    rmdir /s /q build
)
mkdir build
cd build

echo.
echo 🏗️  Step 3: Configuring CMake...
echo ================================

REM Try to configure with CMake
echo   Attempting CMake configuration...
cmake .. -DCMAKE_BUILD_TYPE=Release

if %ERRORLEVEL% neq 0 (
    echo.
    echo ⚠️  Default CMake configuration failed. Trying with specific generator...
    echo.
    
    REM Try with Visual Studio 2022
    echo   Trying Visual Studio 2022...
    cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Release
    
    if %ERRORLEVEL% neq 0 (
        echo   Visual Studio 2022 failed, trying 2019...
        cmake .. -G "Visual Studio 16 2019" -A x64 -DCMAKE_BUILD_TYPE=Release
        
        if %ERRORLEVEL% neq 0 (
            echo.
            echo ❌ Error: CMake configuration failed with all generators.
            echo.
            echo 🔧 Troubleshooting steps:
            echo   1. Ensure Visual Studio 2019 or 2022 is installed
            echo   2. Install "Desktop development with C++" workload
            echo   3. Ensure CMake is installed and in PATH
            echo   4. Check that Node.js development headers are available
            echo.
            cd %ORIGINAL_DIR%
            pause
            exit /b 1
        )
    )
)

echo ✅ CMake configuration successful

echo.
echo 🔨 Step 4: Building the native module...
echo ========================================

cmake --build . --config Release --verbose

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Error: Build failed.
    echo.
    echo 🔧 Common solutions:
    echo   1. Check that all JUCE dependencies are installed
    echo   2. Ensure ASIO SDK is properly downloaded
    echo   3. Verify Visual Studio C++ compiler is working
    echo   4. Check build output above for specific errors
    echo.
    cd %ORIGINAL_DIR%
    pause
    exit /b 1
)

echo.
echo 🔍 Step 5: Verifying build output...
echo ====================================

if exist "Release\cueforge_audio.node" (
    echo ✅ Native module built successfully!
    echo    Location: native\build\Release\cueforge_audio.node
    
    REM Copy to expected location for Node.js
    echo 📋 Setting up module for Node.js...
    if not exist "%ORIGINAL_DIR%\build" mkdir "%ORIGINAL_DIR%\build"
    if not exist "%ORIGINAL_DIR%\build\Release" mkdir "%ORIGINAL_DIR%\build\Release"
    copy "Release\cueforge_audio.node" "%ORIGINAL_DIR%\build\Release\"
    
    echo    Copied to: build\Release\cueforge_audio.node
    
) else (
    echo ❌ Error: cueforge_audio.node not found in expected location.
    echo    Expected: native\build\Release\cueforge_audio.node
    echo.
    echo 🔍 Checking alternative locations...
    dir /s cueforge_audio.node
    cd %ORIGINAL_DIR%
    pause
    exit /b 1
)

echo.
echo 🧪 Step 6: Testing the native module...
echo =======================================

cd %ORIGINAL_DIR%

REM Create a simple test file
echo Creating test file...
(
echo const path = require('path'^);
echo const modulePath = path.join(__dirname, 'build', 'Release', 'cueforge_audio.node'^);
echo.
echo console.log('🧪 Testing CueForge Audio Engine Native Module'^);
echo console.log('==============================================='^);
echo console.log('Module path:', modulePath^);
echo.
echo try {
echo   // Test loading the module
echo   console.log('📦 Loading native module...'^);
echo   const nativeModule = require(modulePath^);
echo   console.log('✅ Native module loaded successfully'^);
echo.
echo   // Test creating AudioEngine
echo   console.log('🎵 Creating AudioEngine...'^);
echo   const AudioEngine = nativeModule.AudioEngine;
echo   if ^(AudioEngine^) {
echo     console.log('✅ AudioEngine constructor available'^);
echo   } else {
echo     console.log('⚠️  AudioEngine constructor not found'^);
echo   }
echo.
echo   // Test basic functionality
echo   console.log('🔧 Testing basic functions...'^);
echo   const engine = new AudioEngine(^);
echo   console.log('✅ AudioEngine instance created'^);
echo.
echo   console.log('🎉 All basic tests passed!'^);
echo   console.log(''^);
echo   console.log('📋 Next steps:'^);
echo   console.log('  1. Run your Electron app: npm start'^);
echo   console.log('  2. The native audio engine should now be available'^);
echo   console.log('  3. Check the audio engine status in the app'^);
echo.
echo } catch ^(error^) {
echo   console.error('❌ Test failed:', error.message^);
echo   console.error('Stack:', error.stack^);
echo   console.log(''^);
echo   console.log('🔧 Troubleshooting:'^);
echo   console.log('  1. Ensure all Visual C++ redistributables are installed'^);
echo   console.log('  2. Check Node.js version compatibility'^);
echo   console.log('  3. Verify all dependencies were built correctly'^);
echo   process.exit(1^);
echo }
) > test_native.js

echo Running test...
node test_native.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Native module test failed.
    echo    The module built but cannot be loaded by Node.js.
    echo.
    echo 🔧 Common solutions:
    echo   1. Install Visual C++ Redistributable 2019/2022
    echo   2. Check Node.js and Electron version compatibility
    echo   3. Rebuild with correct Node.js headers
    echo.
    del test_native.js
    pause
    exit /b 1
)

REM Clean up test file
del test_native.js

echo.
echo 🎉 BUILD COMPLETE!
echo ==================
echo.
echo ✅ CueForge Audio Engine has been built successfully
echo 📁 Native module location: build\Release\cueforge_audio.node
echo 🚀 Ready to use in your Electron application
echo.
echo 📋 Integration checklist:
echo   ☐ Native module is built and tested
echo   ☐ Module is in the correct location for Electron
echo   ☐ Audio engine can be imported in JavaScript
echo   ☐ Basic functionality is working
echo.
echo 🎵 You can now use professional audio features:
echo   • JUCE-powered audio engine
echo   • Matrix mixing and routing
echo   • ASIO driver support
echo   • Multi-format audio playback
echo   • Low-latency performance
echo.

pause
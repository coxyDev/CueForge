@echo off
REM =============================================================================
REM Download Individual Node.js Header Files
REM =============================================================================

echo 🔧 Downloading Individual Node.js Headers
echo =========================================

set PROJECT_ROOT=C:\Users\joelc\Documents\Code\CueForge
set TARGET_DIR=%PROJECT_ROOT%\.node-gyp\24.4.0\include\node
set BASE_URL=https://raw.githubusercontent.com/nodejs/node/v24.4.0/src

echo 📁 Creating target directory...
if not exist "%PROJECT_ROOT%\.node-gyp" mkdir "%PROJECT_ROOT%\.node-gyp"
if not exist "%PROJECT_ROOT%\.node-gyp\24.4.0" mkdir "%PROJECT_ROOT%\.node-gyp\24.4.0"
if not exist "%PROJECT_ROOT%\.node-gyp\24.4.0\include" mkdir "%PROJECT_ROOT%\.node-gyp\24.4.0\include"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo ✅ Directory created: %TARGET_DIR%

echo.
echo 📥 Downloading essential header files...

REM Download the essential headers one by one
echo Downloading node_api.h...
powershell -command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.4.0/src/node_api.h' -OutFile '%TARGET_DIR%\node_api.h'"

echo Downloading node_api_types.h...
powershell -command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.4.0/src/node_api_types.h' -OutFile '%TARGET_DIR%\node_api_types.h'"

echo Downloading js_native_api.h...
powershell -command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.4.0/src/js_native_api.h' -OutFile '%TARGET_DIR%\js_native_api.h'"

echo Downloading js_native_api_types.h...
powershell -command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.4.0/src/js_native_api_types.h' -OutFile '%TARGET_DIR%\js_native_api_types.h'"

echo Downloading node_version.h...
powershell -command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.4.0/src/node_version.h' -OutFile '%TARGET_DIR%\node_version.h'"

echo Downloading uv.h...
powershell -command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.4.0/deps/uv/include/uv.h' -OutFile '%TARGET_DIR%\uv.h'"

echo Downloading v8.h...
powershell -command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.4.0/deps/v8/include/v8.h' -OutFile '%TARGET_DIR%\v8.h'"

echo.
echo 🔍 Verifying downloads...

set ALL_GOOD=1

if exist "%TARGET_DIR%\node_api.h" (
    echo ✅ node_api.h
) else (
    echo ❌ node_api.h FAILED
    set ALL_GOOD=0
)

if exist "%TARGET_DIR%\node_api_types.h" (
    echo ✅ node_api_types.h  
) else (
    echo ❌ node_api_types.h FAILED
    set ALL_GOOD=0
)

if exist "%TARGET_DIR%\js_native_api.h" (
    echo ✅ js_native_api.h
) else (
    echo ❌ js_native_api.h FAILED
    set ALL_GOOD=0
)

if %ALL_GOOD% equ 1 (
    echo.
    echo 🎉 SUCCESS! Essential headers downloaded
    echo =======================================
    echo Location: %TARGET_DIR%
    echo.
    echo 📋 Files downloaded:
    dir "%TARGET_DIR%" /b
    echo.
    echo 📋 Next steps:
    echo   1. Return to Visual Studio
    echo   2. CMake → Delete Cache and Reconfigure
    echo   3. CMake should now find the headers
    echo.
) else (
    echo.
    echo ❌ Some downloads failed
    echo ======================
    echo.
    echo 🔧 Manual alternative:
    echo   1. Go to: https://nodejs.org/dist/v24.4.0/
    echo   2. Download: node-v24.4.0-headers.tar.gz  
    echo   3. Extract and copy include/node/* to:
    echo      %TARGET_DIR%
    echo.
)

pause
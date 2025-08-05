@echo off
setlocal enabledelayedexpansion

echo MIAW Configuration Validation
echo ================================

REM Check if .env.local file exists
if not exist .env.local (
    echo ❌ .env.local file not found!
    echo 📝 Please create .env.local file with the required environment variables.
    echo 📖 See MIAW_SETUP.md for detailed instructions.
    pause
    exit /b 1
)

echo ✅ .env.local file found

echo.
echo 🔧 Checking Environment Variables:
echo -----------------------------------

REM Load environment variables from .env.local
for /f "tokens=1,2 delims==" %%i in (.env.local) do (
    if "%%i"=="SF_ORG_ID" set SF_ORG_ID=%%j
    if "%%i"=="MIAW_SCRT_URL" set MIAW_SCRT_URL=%%j
    if "%%i"=="MIAW_DEVELOPER_NAME" set MIAW_DEVELOPER_NAME=%%j
)

REM Check required variables
set missing=0

if "!SF_ORG_ID!"=="" (
    echo ❌ SF_ORG_ID: Not set
    set missing=1
) else (
    echo ✅ SF_ORG_ID: !SF_ORG_ID!
)

if "!MIAW_SCRT_URL!"=="" (
    echo ❌ MIAW_SCRT_URL: Not set
    set missing=1
) else (
    echo ✅ MIAW_SCRT_URL: !MIAW_SCRT_URL!
)

if "!MIAW_DEVELOPER_NAME!"=="" (
    echo ❌ MIAW_DEVELOPER_NAME: Not set
    set missing=1
) else (
    echo ✅ MIAW_DEVELOPER_NAME: !MIAW_DEVELOPER_NAME!
)

if !missing!==1 (
    echo.
    echo ❌ Missing required environment variables!
    echo 📖 Please check MIAW_SETUP.md for configuration details.
    pause
    exit /b 1
)

echo.
echo 🌐 Testing API Connectivity:
echo -----------------------------
echo Testing token generation...

REM Test token generation using curl (if available) or PowerShell
where curl >nul 2>nul
if !errorlevel!==0 (
    REM Use curl if available
    curl -s -X POST "!MIAW_SCRT_URL!/api/v2/messaging/tokens/unauthenticated" ^
        -H "Content-Type: application/json" ^
        -d "{\"organizationId\": \"!SF_ORG_ID!\", \"developerName\": \"!MIAW_DEVELOPER_NAME!\"}" ^
        -w "HTTP_STATUS:%%{http_code}" > temp_response.txt
    
    set /p response=<temp_response.txt
    del temp_response.txt
    
    REM Extract HTTP status (simplified check)
    echo !response! | findstr "200" >nul
    if !errorlevel!==0 (
        echo ✅ Token generation successful
        echo !response! | findstr "token" >nul
        if !errorlevel!==0 (
            echo ✅ Valid token received
        ) else (
            echo ⚠️  Token generation returned 200 but no token found in response
        )
    ) else (
        echo ❌ Token generation failed
        echo Response: !response!
        echo.
        echo 🔧 Common fixes:
        echo    - Verify SF_ORG_ID is correct
        echo    - Check MIAW_DEVELOPER_NAME spelling  
        echo    - Ensure MIAW_SCRT_URL is accessible
        echo    - Verify Embedded Service Deployment is active
    )
) else (
    echo ⚠️  curl not found, skipping API connectivity test
    echo 📝 Install curl or manually test the API endpoint:
    echo    POST !MIAW_SCRT_URL!/api/v2/messaging/tokens/unauthenticated
)

echo.
echo 🚀 Starting Application:
echo ------------------------

if !missing!==0 (
    echo ✅ Configuration validated successfully!
    echo 🚀 Starting development server...
    npm run dev
) else (
    echo ❌ Configuration validation failed!
    echo 📖 Please check the errors above and refer to MIAW_SETUP.md
    pause
    exit /b 1
)

pause

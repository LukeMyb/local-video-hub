@echo off
setlocal enabledelayedexpansion

:: Resolve project root directory
pushd "%~dp0.."
set "BASE_DIR=%CD%"
popd

set "MEDIA_DIR=%BASE_DIR%\media"

echo ==================================================
echo   Please select a library (folder) to tag
echo ==================================================
echo.

set index=1
for /d %%D in ("%MEDIA_DIR%\*") do (
    set "folderName=%%~nxD"
    if /I not "!folderName!"=="trash" (
        echo [!index!] !folderName!
        set "folder_!index!=%%~nxD"
        set /a index+=1
    )
)

echo.
set /p selection="Enter the number (leave empty to cancel): "

if "%selection%"=="" (
    echo Canceled.
    pause
    exit /b
)

set "targetFolder=!folder_%selection%!"

if "!targetFolder!"=="" (
    echo Invalid number.
    pause
    exit /b
)

set "TARGET_PATH=%MEDIA_DIR%\!targetFolder!"
echo.
echo ==================================================
echo Tagging the following directory:
echo !TARGET_PATH!
echo ==================================================
echo.

cd /d "%BASE_DIR%"
call .venv\Scripts\activate
python tagger\tagger.py "!TARGET_PATH!"

echo.
echo Done.
pause

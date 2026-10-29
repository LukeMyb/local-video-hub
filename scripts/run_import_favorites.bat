@echo off
setlocal

:: Resolve project root directory
pushd "%~dp0.."
set "BASE_DIR=%CD%"
popd

echo ==================================================
echo   Import favorites from Jellyfin
echo ==================================================
echo.
echo This will copy the current Jellyfin favorites
echo into the app database (data\favorites.db).
echo.
echo - Existing favorites in the app are kept.
echo - Already imported files are skipped.
echo.
set /p confirm="Continue? (y/N): "

if /I not "%confirm%"=="y" (
    echo Canceled.
    pause
    exit /b
)

echo.
cd /d "%BASE_DIR%"
call .venv\Scripts\activate
python scripts\import_favorites.py

echo.
echo Done.
pause

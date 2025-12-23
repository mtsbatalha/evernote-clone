@echo off
REM ==============================================================================
REM Evernote Clone - Restore Script (Windows)
REM Restores database and/or files from backup
REM ==============================================================================

setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   Evernote Clone - Restore Script
echo ========================================
echo.

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\.."
cd /d "%PROJECT_ROOT%"
set "PROJECT_ROOT=%CD%"

REM Backup directory
if not defined BACKUP_DIR set "BACKUP_DIR=%PROJECT_ROOT%\backups"

REM Load .env if exists
if exist "%PROJECT_ROOT%\.env" (
    for /f "tokens=1,2 delims==" %%a in ('type "%PROJECT_ROOT%\.env" ^| findstr /v "^#"') do (
        set "%%a=%%b"
    )
)

REM Default database settings
if not defined DATABASE_HOST set "DATABASE_HOST=localhost"
if not defined DATABASE_PORT set "DATABASE_PORT=5432"
if not defined DATABASE_NAME set "DATABASE_NAME=evernote_clone"
if not defined DATABASE_USER set "DATABASE_USER=postgres"
if not defined DATABASE_PASSWORD set "DATABASE_PASSWORD=postgres"

REM ==============================================================================
REM Check Arguments
REM ==============================================================================

set "BACKUP_FILE=%~1"

if "%BACKUP_FILE%"=="" (
    echo Available backups:
    echo.
    dir /b /o-d "%BACKUP_DIR%\*.zip" 2>nul
    echo.
    set /p BACKUP_FILE="Enter backup file path: "
)

REM Check if file exists
if not exist "%BACKUP_FILE%" (
    if exist "%BACKUP_DIR%\%BACKUP_FILE%" (
        set "BACKUP_FILE=%BACKUP_DIR%\%BACKUP_FILE%"
    ) else (
        echo [ERROR] Backup file not found: %BACKUP_FILE%
        exit /b 1
    )
)

echo [INFO] Restoring from: %BACKUP_FILE%

REM ==============================================================================
REM Confirm Restore
REM ==============================================================================

echo.
echo [WARNING] This will overwrite existing data!
echo.
set /p confirm="Are you sure you want to restore? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo [INFO] Restore cancelled
    exit /b 0
)

REM ==============================================================================
REM Determine Backup Type
REM ==============================================================================

for %%F in ("%BACKUP_FILE%") do set "FILENAME=%%~nxF"

echo %FILENAME% | findstr /i "^db_" >nul && set "BACKUP_TYPE=database"
echo %FILENAME% | findstr /i "^files_" >nul && set "BACKUP_TYPE=files"
echo %FILENAME% | findstr /i "^full_" >nul && set "BACKUP_TYPE=full"

if not defined BACKUP_TYPE (
    echo [WARNING] Unknown backup type, attempting as files backup...
    set "BACKUP_TYPE=files"
)

echo [INFO] Detected backup type: %BACKUP_TYPE%

REM ==============================================================================
REM Restore Based on Type
REM ==============================================================================

if "%BACKUP_TYPE%"=="database" goto :restore_database
if "%BACKUP_TYPE%"=="files" goto :restore_files
if "%BACKUP_TYPE%"=="full" goto :restore_full

:restore_database
echo [INFO] Restoring database...

REM Extract SQL from zip
set "TEMP_DIR=%TEMP%\evernote_restore_%RANDOM%"
mkdir "%TEMP_DIR%" 2>nul

powershell -Command "Expand-Archive -Path '%BACKUP_FILE%' -DestinationPath '%TEMP_DIR%' -Force"

REM Find SQL file
for %%F in ("%TEMP_DIR%\*.sql") do set "SQL_FILE=%%F"

if not exist "%SQL_FILE%" (
    echo [ERROR] No SQL file found in backup
    rmdir /s /q "%TEMP_DIR%" 2>nul
    exit /b 1
)

REM Check if Docker is running PostgreSQL
docker ps --format "{{.Names}}" 2>nul | findstr /i "evernote-postgres" >nul
if %errorlevel%==0 (
    echo [INFO] Using Docker PostgreSQL...
    
    REM Drop and recreate database
    docker exec evernote-postgres psql -U %DATABASE_USER% -c "DROP DATABASE IF EXISTS %DATABASE_NAME%;" postgres 2>nul
    docker exec evernote-postgres psql -U %DATABASE_USER% -c "CREATE DATABASE %DATABASE_NAME%;" postgres
    
    REM Restore
    type "%SQL_FILE%" | docker exec -i evernote-postgres psql -U %DATABASE_USER% %DATABASE_NAME%
) else (
    REM Direct connection
    set "PGPASSWORD=%DATABASE_PASSWORD%"
    psql -h %DATABASE_HOST% -p %DATABASE_PORT% -U %DATABASE_USER% -c "DROP DATABASE IF EXISTS %DATABASE_NAME%;" postgres 2>nul
    psql -h %DATABASE_HOST% -p %DATABASE_PORT% -U %DATABASE_USER% -c "CREATE DATABASE %DATABASE_NAME%;" postgres
    psql -h %DATABASE_HOST% -p %DATABASE_PORT% -U %DATABASE_USER% %DATABASE_NAME% < "%SQL_FILE%"
)

rmdir /s /q "%TEMP_DIR%" 2>nul
echo [SUCCESS] Database restored
goto :summary

:restore_files
echo [INFO] Restoring files...

powershell -Command "Expand-Archive -Path '%BACKUP_FILE%' -DestinationPath '%PROJECT_ROOT%' -Force"

echo [SUCCESS] Files restored
goto :summary

:restore_full
echo [INFO] Restoring full backup...

set "TEMP_DIR=%TEMP%\evernote_restore_%RANDOM%"
mkdir "%TEMP_DIR%" 2>nul

powershell -Command "Expand-Archive -Path '%BACKUP_FILE%' -DestinationPath '%TEMP_DIR%' -Force"

REM Restore database if exists
if exist "%TEMP_DIR%\database_backup.zip" (
    echo [INFO] Extracting database backup...
    powershell -Command "Expand-Archive -Path '%TEMP_DIR%\database_backup.zip' -DestinationPath '%TEMP_DIR%\db' -Force"
    for %%F in ("%TEMP_DIR%\db\*.sql") do (
        set "SQL_FILE=%%F"
        goto :found_sql
    )
    :found_sql
    if defined SQL_FILE (
        echo [INFO] Restoring database...
        docker ps --format "{{.Names}}" 2>nul | findstr /i "evernote-postgres" >nul
        if %errorlevel%==0 (
            docker exec evernote-postgres psql -U %DATABASE_USER% -c "DROP DATABASE IF EXISTS %DATABASE_NAME%;" postgres 2>nul
            docker exec evernote-postgres psql -U %DATABASE_USER% -c "CREATE DATABASE %DATABASE_NAME%;" postgres
            type "!SQL_FILE!" | docker exec -i evernote-postgres psql -U %DATABASE_USER% %DATABASE_NAME%
        )
    )
)

REM Restore uploads
if exist "%TEMP_DIR%\uploads" (
    echo [INFO] Restoring uploads...
    xcopy /e /i /y "%TEMP_DIR%\uploads" "%PROJECT_ROOT%\uploads"
)

REM Restore .env
if exist "%TEMP_DIR%\.env" (
    echo [INFO] Restoring .env...
    copy /y "%TEMP_DIR%\.env" "%PROJECT_ROOT%\.env"
)

rmdir /s /q "%TEMP_DIR%" 2>nul
echo [SUCCESS] Full restore complete
goto :summary

REM ==============================================================================
REM Summary
REM ==============================================================================

:summary
echo.
echo ========================================
echo   Restore Complete!
echo ========================================
echo.
echo Restored from: %BACKUP_FILE%
echo.
echo Next steps:
echo   1. Restart services
echo   2. Verify data integrity
echo   3. Test the application
echo.

endlocal

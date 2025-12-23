@echo off
REM ==============================================================================
REM Evernote Clone - Backup Script (Windows)
REM Creates compressed backup of database and project files
REM ==============================================================================

setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   Evernote Clone - Backup Script
echo ========================================
echo.

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\.."
cd /d "%PROJECT_ROOT%"
set "PROJECT_ROOT=%CD%"

REM Backup directory
if not defined BACKUP_DIR set "BACKUP_DIR=%PROJECT_ROOT%\backups"

REM Create timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "datetime=%%I"
set "TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%"

REM Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

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
REM Menu
REM ==============================================================================

echo Select backup type:
echo   1) Database only
echo   2) Files only (uploads, logs)
echo   3) Full backup (database + files + code)
echo   4) Quick backup (database + uploads)
echo.

set /p choice="Enter choice [1-4]: "

REM ==============================================================================
REM Database Backup
REM ==============================================================================

if "%choice%"=="1" goto :backup_database
if "%choice%"=="2" goto :backup_files
if "%choice%"=="3" goto :backup_full
if "%choice%"=="4" goto :backup_quick

echo [ERROR] Invalid choice
exit /b 1

:backup_database
echo [INFO] Backing up PostgreSQL database...

set "DB_BACKUP_FILE=%BACKUP_DIR%\db_%DATABASE_NAME%_%TIMESTAMP%.sql"

REM Check if Docker is running PostgreSQL
docker ps --format "{{.Names}}" 2>nul | findstr /i "evernote-postgres" >nul
if %errorlevel%==0 (
    echo [INFO] Using Docker PostgreSQL...
    docker exec evernote-postgres pg_dump -U %DATABASE_USER% %DATABASE_NAME% > "%DB_BACKUP_FILE%"
) else (
    REM Try local pg_dump
    where pg_dump >nul 2>&1
    if %errorlevel%==0 (
        set "PGPASSWORD=%DATABASE_PASSWORD%"
        pg_dump -h %DATABASE_HOST% -p %DATABASE_PORT% -U %DATABASE_USER% %DATABASE_NAME% > "%DB_BACKUP_FILE%"
    ) else (
        echo [ERROR] pg_dump not found. Install PostgreSQL client tools.
        exit /b 1
    )
)

REM Compress with PowerShell
echo [INFO] Compressing...
powershell -Command "Compress-Archive -Path '%DB_BACKUP_FILE%' -DestinationPath '%DB_BACKUP_FILE%.zip' -Force"
del "%DB_BACKUP_FILE%" 2>nul

echo [SUCCESS] Database backup: %DB_BACKUP_FILE%.zip
if "%choice%"=="1" goto :summary
goto :eof

:backup_files
echo [INFO] Backing up files...

set "FILES_BACKUP=%BACKUP_DIR%\files_%TIMESTAMP%.zip"

REM Create list of files to backup
set "DIRS_TO_BACKUP="
if exist "%PROJECT_ROOT%\uploads" set "DIRS_TO_BACKUP=%DIRS_TO_BACKUP% '%PROJECT_ROOT%\uploads'"
if exist "%PROJECT_ROOT%\logs" set "DIRS_TO_BACKUP=%DIRS_TO_BACKUP% '%PROJECT_ROOT%\logs'"
if exist "%PROJECT_ROOT%\data" set "DIRS_TO_BACKUP=%DIRS_TO_BACKUP% '%PROJECT_ROOT%\data'"
if exist "%PROJECT_ROOT%\.env" set "DIRS_TO_BACKUP=%DIRS_TO_BACKUP% '%PROJECT_ROOT%\.env'"

if "%DIRS_TO_BACKUP%"=="" (
    echo [WARNING] No files to backup
    goto :summary
)

powershell -Command "Compress-Archive -Path %DIRS_TO_BACKUP% -DestinationPath '%FILES_BACKUP%' -Force"
echo [SUCCESS] Files backup: %FILES_BACKUP%
if "%choice%"=="2" goto :summary
goto :eof

:backup_full
echo [INFO] Creating full project backup...

set "FULL_BACKUP=%BACKUP_DIR%\full_backup_%TIMESTAMP%.zip"

REM First backup database
call :backup_database

REM Create full backup excluding node_modules
echo [INFO] Creating full project archive...
powershell -Command ^
  "$exclude = @('node_modules', 'dist', '.next', '.git', 'backups'); ^
   $source = '%PROJECT_ROOT%'; ^
   $dest = '%FULL_BACKUP%'; ^
   $tempDir = [System.IO.Path]::GetTempPath() + 'evernote_backup_' + [guid]::NewGuid().ToString(); ^
   New-Item -ItemType Directory -Path $tempDir -Force | Out-Null; ^
   Get-ChildItem -Path $source -Exclude $exclude | ForEach-Object { ^
     if ($_.PSIsContainer) { ^
       Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force ^
     } else { ^
       Copy-Item -Path $_.FullName -Destination $tempDir -Force ^
     } ^
   }; ^
   Copy-Item -Path '%BACKUP_DIR%\db_%DATABASE_NAME%_%TIMESTAMP%.sql.zip' -Destination (Join-Path $tempDir 'database_backup.zip') -ErrorAction SilentlyContinue; ^
   Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $dest -Force; ^
   Remove-Item -Path $tempDir -Recurse -Force"

echo [SUCCESS] Full backup: %FULL_BACKUP%
goto :summary

:backup_quick
echo [INFO] Creating quick backup...
call :backup_database
call :backup_files
goto :summary

REM ==============================================================================
REM Summary
REM ==============================================================================

:summary
echo.
echo ========================================
echo   Backup Complete!
echo ========================================
echo.
echo Backup location: %BACKUP_DIR%
echo.
echo Files created:
dir /b "%BACKUP_DIR%\*%TIMESTAMP%*" 2>nul
echo.
echo To restore, use: scripts\windows\restore.bat ^<backup_file^>
echo.

endlocal

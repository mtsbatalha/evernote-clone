# uninstall.ps1 - Uninstallation Script for Evernote Clone

Write-Host "========================================" -ForegroundColor Red
Write-Host "   EVERNOTE CLONE - UNINSTALLATION      " -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red

Write-Host "`nWARNING: This script will delete:" -ForegroundColor Yellow
Write-Host "  1. All Docker containers for this project" -ForegroundColor Yellow
Write-Host "  2. All Docker volumes (DATABASE DATA WILL BE LOST)" -ForegroundColor Yellow
Write-Host "  3. The entire project directory (optional)" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Are you sure you want to proceed? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Uninstallation cancelled." -ForegroundColor Green
    exit
}

# --- Stop Everything First ---
Write-Host "`n--- Stopping all services ---" -ForegroundColor Cyan
& "$PSScriptRoot/stop.ps1"

# --- Remove Docker Resources ---
Write-Host "`n--- Removing Docker resources ---" -ForegroundColor Cyan
if (Test-Path "$PSScriptRoot/../docker/docker-compose.yml") {
    Push-Location "$PSScriptRoot/../docker"
    try {
        Write-Host "  Removing containers, volumes, and images..." -ForegroundColor Gray
        docker-compose down -v --rmi all --remove-orphans 2>&1 | Out-Null
        Write-Host "  Docker cleanup complete." -ForegroundColor Green
    }
    catch {
        Write-Host "  Error during Docker cleanup: $_" -ForegroundColor Red
    }
    Pop-Location
}

# --- Remove Dependencies ---
Write-Host "`n--- Removing node_modules and artifacts ---" -ForegroundColor Cyan
$rootPath = "$PSScriptRoot/.."
$dirsToRemove = @(
    "$rootPath/node_modules",
    "$rootPath/.turbo",
    "$rootPath/dist",
    "$rootPath/apps/api/node_modules",
    "$rootPath/apps/api/dist",
    "$rootPath/apps/web/node_modules",
    "$rootPath/apps/web/.next",
    "$rootPath/packages/database/node_modules",
    "$rootPath/packages/database/dist"
)

foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Write-Host "  Removing $dir..." -ForegroundColor Gray
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "  Cleanup complete." -ForegroundColor Green

# --- Delete Project Directory ---
Write-Host "`n========================================" -ForegroundColor Red
Write-Host "Do you want to delete the entire project directory?"
Write-Host "Directory: $(Resolve-Path $rootPath)"
Write-Host "WARNING: This action cannot be undone!"
Write-Host ""

$deleteFiles = Read-Host "Delete project files? (y/N)"
if ($deleteFiles -eq 'y' -or $deleteFiles -eq 'Y') {
    Write-Host "`n  Removing project files..." -ForegroundColor Yellow
    $parentDir = Split-Path -Parent (Resolve-Path $rootPath)
    $projectDirName = Split-Path -Leaf (Resolve-Path $rootPath)
    
    # We can't delete the script we are running easily, so we usually schedule it or ask user to delete parent folder.
    # But in PowerShell, we can try to remove recursively from the parent context, but keeping the script running might block.
    # Instead, we will instruct the user or try best effort.
    
    Write-Host "  Note: PowerShell currently running inside the directory might verify file locks." -ForegroundColor Gray
    Write-Host "  Attempting to delete..." -ForegroundColor Gray
    
    # Start a background job to delete the folder after this script exits? 
    # Or just tell the user to delete it manually to be safe.
    
    # Let's try to delete content first
    Get-ChildItem -Path $rootPath -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    
    Write-Host "  Project files removed (some system files might remain due to locks)." -ForegroundColor Green
    Write-Host "  You can manually delete the folder: $(Resolve-Path $rootPath)" -ForegroundColor Yellow
}
else {
    Write-Host "`n  Project files were kept." -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "   UNINSTALLATION COMPLETE             " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Magenta

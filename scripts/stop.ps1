# stop.ps1 - Stop the Evernote Clone project

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   EVERNOTE CLONE - STOP SCRIPT        " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# --- Stop Node processes first ---
Write-Host "`n--- Stopping Node/Turbo/Nest processes ---" -ForegroundColor Cyan
$processNames = @("node", "turbo", "nest", "ts-node")
foreach ($procName in $processNames) {
    $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($procs) {
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped $($procs.Count) $procName process(es)" -ForegroundColor Yellow
    }
}

# --- Kill processes on specific ports ---
Write-Host "`n--- Freeing up ports ---" -ForegroundColor Cyan
$ports = @(3000, 4000, 5432, 6379, 7700, 9000, 9001)
foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                if ($proc) {
                    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                    Write-Host "  Freed port $port (killed $($proc.ProcessName))" -ForegroundColor Yellow
                }
            }
        }
    }
    catch {}
}

# --- Stop Docker containers ---
Write-Host "`n--- Stopping Docker containers ---" -ForegroundColor Cyan

# Check if Docker is running
$dockerOutput = docker info 2>&1
if ($LASTEXITCODE -eq 0) {
    # Stop any containers using our ports (from any project)
    Write-Host "  Checking for containers on ports 3000, 4000, 5432..." -ForegroundColor Gray
    $conflictPorts = @(3000, 4000, 5432)
    foreach ($port in $conflictPorts) {
        $containers = docker ps --format "{{.Names}}:{{.Ports}}" 2>&1 | Select-String ":$port->"
        foreach ($match in $containers) {
            $containerName = $match.Line.Split(":")[0]
            if ($containerName) {
                Write-Host "  Stopping container '$containerName' (port $port)" -ForegroundColor Yellow
                docker stop $containerName 2>&1 | Out-Null
            }
        }
    }
    
    Write-Host "  Stopping Evernote containers..." -ForegroundColor Gray
    
    # Stop using docker-compose
    docker-compose -f docker/docker-compose.yml down --remove-orphans 2>&1 | Out-Null
    
    # Also stop any orphaned containers by name
    $containers = @("evernote-postgres", "evernote-redis", "evernote-minio", "evernote-minio-setup", "evernote-meilisearch")
    foreach ($container in $containers) {
        docker stop $container 2>&1 | Out-Null
        docker rm $container 2>&1 | Out-Null
    }
    
    Write-Host "  All Docker containers stopped" -ForegroundColor Green
}
else {
    Write-Host "  Docker is not running, skipping container cleanup" -ForegroundColor Yellow
}

# --- Final cleanup ---
Write-Host "`n--- Cleanup complete ---" -ForegroundColor Cyan

# Show what's still running (if anything)
$remaining = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "  Warning: ${$remaining.Count} node process(es) still running" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "   PROJECT STOPPED SUCCESSFULLY        " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Magenta

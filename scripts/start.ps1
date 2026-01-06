# start.ps1 - Start the Evernote Clone project

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   EVERNOTE CLONE - START SCRIPT       " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# --- Check if using remote services ---
Write-Host "`n--- Checking service configuration ---" -ForegroundColor Cyan
$useRemoteServices = $false

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    # Check USE_REMOTE_SERVICES flag
    if ($envContent -match 'USE_REMOTE_SERVICES\s*=\s*"?true"?') {
        $useRemoteServices = $true
        Write-Host "  USE_REMOTE_SERVICES=true detected" -ForegroundColor Yellow
    }
    # Check if DATABASE_URL points to non-localhost
    elseif ($envContent -match 'DATABASE_URL.*@[^l][^o][^c][^a][^l]') {
        $useRemoteServices = $true
        Write-Host "  Remote database detected in DATABASE_URL" -ForegroundColor Yellow
    }
}

if (-not $useRemoteServices) {
    # --- Stop existing processes on ports ---
    Write-Host "`n--- Stopping existing processes on ports ---" -ForegroundColor Cyan
    $ports = @(3000, 4000, 5432, 6379, 7700, 9000, 9001)

    # Kill processes multiple times to ensure they're dead
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        foreach ($port in $ports) {
            try {
                $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
                if ($connections) {
                    foreach ($conn in $connections) {
                        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                        if ($proc) {
                            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                            Write-Host "  Killed $($proc.ProcessName) on port $port" -ForegroundColor Yellow
                        }
                    }
                }
            }
            catch {}
        }
        if ($attempt -lt 3) {
            Start-Sleep -Milliseconds 500
        }
    }

    # Wait a moment for ports to be released
    Start-Sleep -Seconds 2

    # --- Check Docker Status ---
    Write-Host "`n--- Checking Docker Status ---" -ForegroundColor Cyan
    $dockerRunning = $false
    $dockerOutput = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
        Write-Host "  Docker is running!" -ForegroundColor Green
        
        # Stop any Docker containers using our ports (from other projects)
        Write-Host "`n--- Stopping conflicting Docker containers ---" -ForegroundColor Cyan
        $conflictPorts = @(3000, 4000, 5432)
        foreach ($port in $conflictPorts) {
            $containers = docker ps --format "{{.Names}}:{{.Ports}}" 2>&1 | Select-String ":$port->"
            foreach ($match in $containers) {
                $containerName = $match.Line.Split(":")[0]
                if ($containerName -and $containerName -notmatch "^evernote-") {
                    Write-Host "  Stopping container '$containerName' (uses port $port)" -ForegroundColor Yellow
                    docker stop $containerName 2>&1 | Out-Null
                }
            }
        }
    }

    if (-not $dockerRunning) {
        Write-Host "  Docker is not running. Attempting to start Docker Desktop..." -ForegroundColor Yellow
        $dockerPaths = @(
            "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
            "C:\Program Files\Docker\Docker\Docker Desktop.exe",
            "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
        )
        
        $started = $false
        foreach ($path in $dockerPaths) {
            if (Test-Path $path) {
                Start-Process $path
                $started = $true
                Write-Host "  Started Docker Desktop from: $path" -ForegroundColor Green
                break
            }
        }
        
        if (-not $started) {
            Write-Host "  ERROR: Could not find Docker Desktop. Please start it manually." -ForegroundColor Red
            exit 1
        }

        Write-Host "  Waiting for Docker to be ready..." -ForegroundColor Cyan
        $attempts = 0
        $maxAttempts = 45 # 3 minutes
        while ($attempts -lt $maxAttempts) {
            Start-Sleep -Seconds 4
            $attempts++
            $dockerOutput = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  Docker is ready!" -ForegroundColor Green
                $dockerRunning = $true
                break
            }
            Write-Host "  Still waiting... ($attempts/$maxAttempts)" -ForegroundColor Gray
        }

        if (-not $dockerRunning) {
            Write-Host "  ERROR: Docker failed to start in time." -ForegroundColor Red
            exit 1
        }
    }

    # --- Stop any existing containers first ---
    Write-Host "`n--- Stopping existing Docker containers ---" -ForegroundColor Cyan
    docker-compose -f docker/docker-compose.yml down --remove-orphans 2>&1 | Out-Null

    # --- Start all Docker containers ---
    Write-Host "`n--- Starting Docker containers ---" -ForegroundColor Cyan
    Write-Host "  Starting: PostgreSQL, Redis, MinIO, Meilisearch" -ForegroundColor Gray
    docker-compose -f docker/docker-compose.yml up -d

    # --- Wait for containers to be healthy ---
    Write-Host "`n--- Waiting for containers to be healthy ---" -ForegroundColor Cyan
    $services = @("evernote-postgres", "evernote-redis", "evernote-minio", "evernote-meilisearch")
    $maxWait = 60
    $waited = 0

    foreach ($service in $services) {
        Write-Host "  Waiting for $service..." -ForegroundColor Gray -NoNewline
        while ($waited -lt $maxWait) {
            $status = docker inspect --format='{{.State.Health.Status}}' $service 2>&1
            if ($status -eq "healthy" -or $LASTEXITCODE -ne 0) {
                break
            }
            $running = docker inspect --format='{{.State.Running}}' $service 2>&1
            if ($running -eq "true") {
                break
            }
            Start-Sleep -Seconds 2
            $waited += 2
            Write-Host "." -ForegroundColor Gray -NoNewline
        }
        Write-Host " Ready!" -ForegroundColor Green
    }

    # --- Verify containers are running ---
    Write-Host "`n--- Docker containers status ---" -ForegroundColor Cyan
    docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" --filter "name=evernote"
}
else {
    Write-Host "`n--- Skipping Docker containers (using remote services) ---" -ForegroundColor Yellow
    Write-Host "  Make sure your remote PostgreSQL, Redis, S3, and Meilisearch are accessible!" -ForegroundColor Gray
}

# --- Configure Database ---
Write-Host "`n--- Configuring Database ---" -ForegroundColor Cyan
if (Test-Path ".env") {
    Copy-Item ".env" "packages/database/.env" -Force
    Write-Host "  Copied .env to packages/database/" -ForegroundColor Green
}
else {
    Write-Host "  Warning: .env file not found in root!" -ForegroundColor Yellow
}

Write-Host "  Running db:generate..." -ForegroundColor Gray
pnpm db:generate

Write-Host "  Running db:push..." -ForegroundColor Gray
pnpm db:push

# --- Start Development Servers ---
Write-Host "`n--- Starting Development Servers ---" -ForegroundColor Cyan
Write-Host "  Web: http://localhost:3000" -ForegroundColor Green
Write-Host "  API: http://localhost:4000" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""
pnpm dev

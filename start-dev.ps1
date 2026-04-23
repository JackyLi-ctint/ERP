param(
    [switch]$Install,
    [switch]$Seed,
    [switch]$ForceRestart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $repoRoot "server"
$clientDir = Join-Path $repoRoot "client"

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PortOwner {
    param([int]$Port)

    $listener = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq $Port } |
        Select-Object -First 1

    if (-not $listener) {
        return $null
    }

    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    return [PSCustomObject]@{
        Port = $Port
        ProcessId = $listener.OwningProcess
        Name = if ($proc) { $proc.Name } else { "unknown" }
        CommandLine = if ($proc) { $proc.CommandLine } else { "unknown" }
    }
}

if (-not (Test-Path $serverDir)) {
    throw "Server folder not found: $serverDir"
}

if (-not (Test-Path $clientDir)) {
    throw "Client folder not found: $clientDir"
}

if (-not (Test-Command "node")) {
    throw "Node.js is not installed or not on PATH."
}

if (-not (Test-Command "npm")) {
    throw "npm is not installed or not on PATH."
}

# --- Ensure Postgres container is running via Docker Compose ---
if (Test-Command "docker") {
    $oldErrorActionPreference = $ErrorActionPreference
    try {
        # Native command stderr becomes a PowerShell error when EAP=Stop.
        # Temporarily allow checking docker availability without aborting startup.
        $ErrorActionPreference = "Continue"
        docker info >$null 2>$null
        $dockerEngineAvailable = ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $oldErrorActionPreference
    }

    if ($dockerEngineAvailable) {
        try {
            $oldErrorActionPreference = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            $pgContainer = docker ps --filter "name=leave_management_db" --filter "status=running" --format "{{.Names}}" 2>$null

            if ($pgContainer -eq "leave_management_db") {
                Write-Host "Postgres container already running." -ForegroundColor Green
            } else {
                Write-Host "Starting Postgres container via Docker Compose..." -ForegroundColor Cyan
                Push-Location $repoRoot
                docker compose up postgres -d
                Pop-Location

                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to start postgres container with 'docker compose up postgres -d'."
                }

                # Wait for Postgres to be healthy (up to 30s)
                Write-Host "Waiting for Postgres to be ready..." -ForegroundColor Cyan
                $maxWait = 30
                $waited = 0
                do {
                    Start-Sleep -Seconds 2
                    $waited += 2
                    $healthy = docker inspect --format "{{.State.Health.Status}}" leave_management_db 2>$null
                } while ($healthy -ne "healthy" -and $waited -lt $maxWait)

                if ($healthy -ne "healthy") {
                    throw "Postgres container did not become healthy within ${maxWait}s. Check 'docker logs leave_management_db'."
                }
                Write-Host "Postgres is ready." -ForegroundColor Green
            }
        } finally {
            $ErrorActionPreference = $oldErrorActionPreference
        }
    } else {
        Write-Warning "Docker CLI is installed, but Docker engine is not running. Start Docker Desktop or run local Postgres on port 5432."
    }
} else {
    Write-Warning "Docker not found - skipping Postgres container check. Make sure Postgres is running on port 5432."
}

$backendOwner = Get-PortOwner -Port 3000
if ($backendOwner) {
    Write-Host "Port 3000 in use by PID $($backendOwner.ProcessId) ($($backendOwner.Name)) - stopping it..." -ForegroundColor Yellow
    Stop-Process -Id $backendOwner.ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

$frontendOwner = Get-PortOwner -Port 5173
if ($frontendOwner) {
    Write-Host "Port 5173 in use by PID $($frontendOwner.ProcessId) ($($frontendOwner.Name)) - stopping it..." -ForegroundColor Yellow
    Stop-Process -Id $frontendOwner.ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

if ($Install) {
    Write-Host "Installing server dependencies..." -ForegroundColor Cyan
    Push-Location $serverDir
    npm install
    Pop-Location

    Write-Host "Installing client dependencies..." -ForegroundColor Cyan
    Push-Location $clientDir
    npm install
    Pop-Location
}

if ($Seed) {
    Write-Host "Seeding database (server/prisma/seed.ts)..." -ForegroundColor Cyan
    Push-Location $serverDir
    npm run db:seed
    Pop-Location
}

$serverCmd = "Set-Location '$serverDir'; npm run dev"
$clientCmd = "Set-Location '$clientDir'; npm run dev"

Write-Host "Starting backend on http://localhost:3000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverCmd | Out-Null

Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $clientCmd | Out-Null

Write-Host "Done. Two terminal windows were launched." -ForegroundColor Yellow
Write-Host "Optional flags: -Install (npm install), -Seed (run db seed first)" -ForegroundColor Yellow
Write-Host "Postgres is running via Docker (container: leave_management_db)." -ForegroundColor Yellow

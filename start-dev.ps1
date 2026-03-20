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

$backendOwner = Get-PortOwner -Port 3000
if ($backendOwner) {
    Write-Host "Port 3000 in use by PID $($backendOwner.ProcessId) ($($backendOwner.Name)) — stopping it..." -ForegroundColor Yellow
    Stop-Process -Id $backendOwner.ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

$frontendOwner = Get-PortOwner -Port 5173
if ($frontendOwner) {
    Write-Host "Port 5173 in use by PID $($frontendOwner.ProcessId) ($($frontendOwner.Name)) — stopping it..." -ForegroundColor Yellow
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

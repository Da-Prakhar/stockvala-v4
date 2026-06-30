#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Uninstall the StockVala Gateway Windows service.

.PARAMETER ServiceName
    Windows service name to remove.  Default: StockValaGateway

.PARAMETER InstallDir
    Install directory to remove.  Default: C:\StockVala\Gateway
    Pass -KeepFiles to leave files on disk.

.PARAMETER HttpPort
    HTTP port whose firewall rule will be removed.  Default: 8081

.PARAMETER KeepFiles
    If specified, the install directory is NOT deleted (keeps logs, config).
#>

param(
    [string]$ServiceName = "StockValaGateway",
    [string]$InstallDir  = "C:\StockVala\Gateway",
    [int]   $HttpPort    = 8081,
    [switch]$KeepFiles
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "  StockVala Gateway - Uninstaller" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Remove service '$ServiceName' and firewall rule for port $HttpPort? [y/N]"
if ($confirm -notmatch '^[Yy]') {
    Write-Host "Aborted." -ForegroundColor DarkGray
    exit 0
}

# Try NSSM first
$nssmExe = "$InstallDir\nssm\nssm.exe"
$useNssm = Test-Path $nssmExe

# Stop service
Write-Host "[1/4] Stopping service..." -ForegroundColor Cyan
if ($useNssm) {
    & $nssmExe stop $ServiceName 2>&1 | Out-Null
} else {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Remove service
Write-Host "[2/4] Removing service..." -ForegroundColor Cyan
if ($useNssm) {
    & $nssmExe remove $ServiceName confirm 2>&1 | Out-Null
} else {
    sc.exe delete $ServiceName 2>&1 | Out-Null
}
Write-Host "  [OK] Service removed" -ForegroundColor Green

# Remove firewall rule
Write-Host "[3/4] Removing firewall rule..." -ForegroundColor Cyan
Remove-NetFirewallRule -DisplayName "StockVala Gateway HTTP $HttpPort" -ErrorAction SilentlyContinue
Write-Host "  [OK] Firewall rule removed" -ForegroundColor Green

# Remove netsh URL ACL
netsh http delete urlacl url="http://*:$HttpPort/" 2>&1 | Out-Null
Write-Host "  [OK] URL ACL removed" -ForegroundColor Green

# Remove files
if (-not $KeepFiles) {
    Write-Host "[4/4] Removing install directory: $InstallDir..." -ForegroundColor Cyan
    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Directory removed" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] Directory not found" -ForegroundColor DarkGray
    }
} else {
    Write-Host "[4/4] Keeping files (--KeepFiles specified)" -ForegroundColor DarkGray
    Write-Host "  Directory preserved: $InstallDir" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Uninstall Complete" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

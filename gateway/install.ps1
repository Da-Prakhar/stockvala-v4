#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Install StockVala Gateway as a Windows service on a new VPS.

.DESCRIPTION
    Full installer for the StockVala C# MT5 Gateway.
    - Prompts for all required credentials (or accept via parameters)
    - Writes app.config with your values
    - Registers netsh URL ACL for the HTTP port
    - Opens Windows Firewall inbound rule
    - Installs and starts a Windows service via NSSM
      (downloads NSSM automatically if not present)

.PARAMETER InstallDir
    Folder where the gateway will be installed.  Default: C:\StockVala\Gateway

.PARAMETER ServiceName
    Windows service name.  Default: StockValaGateway

.PARAMETER MT5Server
    MT5 server address in HOST:PORT format, e.g. 1.2.3.4:443

.PARAMETER MT5Login
    MT5 manager account login number

.PARAMETER MT5Password
    MT5 manager account password

.PARAMETER MT5ServerName
    Human-readable server name shown to clients in their MT5 terminal
    (what users type as "Server" when connecting)

.PARAMETER RedisHost
    Redis server on the web VPS in HOST:PORT format, e.g. 5.6.7.8:6379

.PARAMETER RedisPassword
    Redis AUTH password

.PARAMETER HttpPort
    Port the gateway HTTP API will listen on (default 8081).
    Your Node.js backend must set MT5_GATEWAY_URL=http://THIS_VPS_IP:PORT

.PARAMETER MT5DefaultGroup
    Default MT5 group for new accounts.  Default: real\clients

.EXAMPLE
    # Interactive (prompts for everything):
    powershell -ExecutionPolicy Bypass -File install.ps1

.EXAMPLE
    # Fully non-interactive:
    powershell -ExecutionPolicy Bypass -File install.ps1 `
        -MT5Server "1.2.3.4:443" -MT5Login "28001" -MT5Password "Secret@123" `
        -MT5ServerName "MyBroker-Server" `
        -RedisHost "5.6.7.8:6379" -RedisPassword "RedisPass" `
        -HttpPort 8081

.NOTES
    MUST be run as Administrator.
    Run build.ps1 first if you have not compiled the gateway yet.
#>

[CmdletBinding()]
param(
    [string]$InstallDir      = "C:\StockVala\Gateway",
    [string]$ServiceName     = "StockValaGateway",
    [string]$MT5Server       = "",
    [string]$MT5Login        = "",
    [string]$MT5Password     = "",
    [string]$MT5ServerName   = "",
    [string]$RedisHost       = "",
    [string]$RedisPassword   = "",
    [int]   $HttpPort        = 8081,
    [string]$MT5DefaultGroup = "real\\clients"
)

$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────────────────────

function Prompt-Required {
    param([string]$Label, [string]$Current, [switch]$Secret)
    if ($Current) { return $Current }
    do {
        if ($Secret) {
            $val = (Read-Host "  $Label (required, hidden)" -AsSecureString |
                    ConvertFrom-SecureString -AsPlainText 2>$null)
            # Fallback for older PS that lacks -AsPlainText
            if (-not $val) {
                $val = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
                    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR(
                        (Read-Host "  $Label (required, hidden)" -AsSecureString)))
            }
        } else {
            $val = Read-Host "  $Label (required)"
        }
    } while (-not $val.Trim())
    return $val.Trim()
}

function Prompt-WithDefault {
    param([string]$Label, [string]$Default)
    $val = Read-Host "  $Label [default: $Default]"
    if (-not $val.Trim()) { return $Default }
    return $val.Trim()
}

function Write-Step {
    param([string]$Msg)
    Write-Host ""
    Write-Host "[STEP] $Msg" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Msg)
    Write-Host "  [OK] $Msg" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Msg)
    Write-Host "  [WARN] $Msg" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Msg)
    Write-Host "  [FAIL] $Msg" -ForegroundColor Red
}

# ── Banner ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  StockVala Gateway - Windows VPS Installer" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────

Write-Step "Checking prerequisites"

# .NET 4.8 check
$netKey = "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full"
$netRelease = (Get-ItemProperty $netKey -ErrorAction SilentlyContinue).Release
if ($netRelease -lt 528040) {
    Write-Fail ".NET Framework 4.8 is required (detected release key: $netRelease)"
    Write-Host ""
    Write-Host "Download .NET 4.8 Runtime:" -ForegroundColor Yellow
    Write-Host "  https://dotnet.microsoft.com/download/dotnet-framework/net48"
    Write-Host ""
    Write-Host "After installing, restart and re-run this script." -ForegroundColor Yellow
    exit 1
}
Write-Ok ".NET Framework 4.8 detected (release key: $netRelease)"

# Source exe — must have been built first
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcExe    = Join-Path $scriptDir "bin\Release\StockVala.Gateway.exe"
if (-not (Test-Path $srcExe)) {
    Write-Fail "Gateway executable not found: $srcExe"
    Write-Host ""
    Write-Host "Run build.ps1 first to compile the gateway:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File build.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Ok "Gateway executable found: $srcExe"

# ── Collect configuration ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "── Gateway Configuration ──────────────────────────" -ForegroundColor White
Write-Host "   (Press Enter to keep current/default value)" -ForegroundColor DarkGray
Write-Host ""

$MT5Server     = Prompt-Required "MT5 server (host:port, e.g. 1.2.3.4:443)" $MT5Server
$MT5Login      = Prompt-Required "MT5 manager login number" $MT5Login
$MT5Password   = Prompt-Required "MT5 manager password" $MT5Password -Secret
$MT5ServerName = Prompt-Required "MT5 server display name (e.g. MyBroker-Server)" $MT5ServerName

Write-Host ""
Write-Host "── Redis Configuration ─────────────────────────────" -ForegroundColor White
Write-Host ""
$RedisHost     = Prompt-Required "Redis host on web VPS (host:port, e.g. 5.6.7.8:6379)" $RedisHost
$RedisPassword = Prompt-Required "Redis password" $RedisPassword -Secret

Write-Host ""
Write-Host "── HTTP / Install Settings ─────────────────────────" -ForegroundColor White
Write-Host ""
$portStr    = Prompt-WithDefault "Gateway HTTP port" $HttpPort
$HttpPort   = [int]$portStr

$InstallDir  = Prompt-WithDefault "Install directory" $InstallDir
$ServiceName = Prompt-WithDefault "Windows service name" $ServiceName
$MT5DefaultGroup = Prompt-WithDefault "Default MT5 account group" $MT5DefaultGroup

Write-Host ""
Write-Host "── Summary ─────────────────────────────────────────" -ForegroundColor White
Write-Host "  MT5 Server    : $MT5Server"
Write-Host "  MT5 Login     : $MT5Login"
Write-Host "  MT5 ServerName: $MT5ServerName"
Write-Host "  Redis Host    : $RedisHost"
Write-Host "  HTTP Port     : $HttpPort"
Write-Host "  Install Dir   : $InstallDir"
Write-Host "  Service Name  : $ServiceName"
Write-Host ""

$confirm = Read-Host "Proceed with installation? [Y/n]"
if ($confirm -and $confirm -notmatch '^[Yy]') {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

# ── Create install directory ──────────────────────────────────────────────────

Write-Step "Creating install directory: $InstallDir"
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Write-Ok "Directory ready"

# ── Copy gateway files ────────────────────────────────────────────────────────

Write-Step "Copying gateway files"

$srcDir    = Join-Path $scriptDir "bin\Release"
$libsSrc   = Join-Path $scriptDir "Libs"
$configSrc = Join-Path $scriptDir "app.config"

# Copy everything from bin\Release to install dir
Copy-Item "$srcDir\*" $InstallDir -Recurse -Force

# Copy native DLL (MT5APIManager64.dll) from Libs in case it wasn't in bin\Release
$nativeDll = Join-Path $libsSrc "MT5APIManager64.dll"
if (Test-Path $nativeDll) {
    Copy-Item $nativeDll $InstallDir -Force
}

Write-Ok "Files copied to $InstallDir"

# ── Write app.config ──────────────────────────────────────────────────────────

Write-Step "Writing app.config with your settings"

$destConfig = Join-Path $InstallDir "StockVala.Gateway.exe.config"

# Escape backslashes for XML
$MT5DefaultGroupXml = $MT5DefaultGroup -replace '\\', '\\'

$configXml = @"
<?xml version="1.0" encoding="utf-8" ?>
<configuration>
  <appSettings>
    <!-- MT5 Manager API credentials (use a manager account with dealer rights) -->
    <add key="MT5Server"       value="$MT5Server" />
    <add key="MT5Login"        value="$MT5Login" />
    <add key="MT5Password"     value="$MT5Password" />

    <!-- Display name shown to clients in account info / creation responses -->
    <!-- This is what users type as "Server" in their MT5 terminal           -->
    <add key="MT5ServerName"   value="$MT5ServerName" />

    <!-- Default group when creating MT5 accounts without an explicit group -->
    <add key="MT5DefaultGroup" value="$MT5DefaultGroup" />

    <!-- Redis on the Web VPS - gateway pushes ticks here -->
    <add key="RedisHost"       value="$RedisHost" />
    <add key="RedisPassword"   value="$RedisPassword" />

    <!-- HTTP REST API port (Node.js backend sets MT5_GATEWAY_URL=http://THIS_IP:PORT) -->
    <add key="HttpPort"        value="$HttpPort" />
  </appSettings>
  <runtime>
    <assemblyBinding xmlns="urn:schemas-microsoft-com:asm.v1">
      <dependentAssembly>
        <assemblyIdentity name="System.Runtime.CompilerServices.Unsafe" publicKeyToken="b03f5f7f11d50a3a" culture="neutral" />
        <bindingRedirect oldVersion="0.0.0.0-6.0.0.0" newVersion="6.0.0.0" />
      </dependentAssembly>
      <dependentAssembly>
        <assemblyIdentity name="System.Memory" publicKeyToken="cc7b13ffcd2ddd51" culture="neutral" />
        <bindingRedirect oldVersion="0.0.0.0-4.0.2.0" newVersion="4.0.1.2" />
      </dependentAssembly>
      <dependentAssembly>
        <assemblyIdentity name="System.Buffers" publicKeyToken="cc7b13ffcd2ddd51" culture="neutral" />
        <bindingRedirect oldVersion="0.0.0.0-4.0.3.0" newVersion="4.0.3.0" />
      </dependentAssembly>
      <dependentAssembly>
        <assemblyIdentity name="System.Threading.Tasks.Extensions" publicKeyToken="cc7b13ffcd2ddd51" culture="neutral" />
        <bindingRedirect oldVersion="0.0.0.0-4.2.0.1" newVersion="4.2.0.1" />
      </dependentAssembly>
      <dependentAssembly>
        <assemblyIdentity name="System.Numerics.Vectors" publicKeyToken="b03f5f7f11d50a3a" culture="neutral" />
        <bindingRedirect oldVersion="0.0.0.0-4.1.4.0" newVersion="4.1.4.0" />
      </dependentAssembly>
      <dependentAssembly>
        <assemblyIdentity name="Microsoft.Bcl.AsyncInterfaces" publicKeyToken="cc7b13ffcd2ddd51" culture="neutral" />
        <bindingRedirect oldVersion="0.0.0.0-5.0.0.0" newVersion="5.0.0.0" />
      </dependentAssembly>
    </assemblyBinding>
  </runtime>
</configuration>
"@

[System.IO.File]::WriteAllText($destConfig, $configXml, [System.Text.Encoding]::UTF8)
Write-Ok "Config written: $destConfig"

# ── Register netsh URL ACL ────────────────────────────────────────────────────

Write-Step "Registering HTTP URL ACL (allows gateway to bind port $HttpPort)"

$url = "http://*:$HttpPort/"

# Remove any existing ACL for this URL first (idempotent)
netsh http delete urlacl url=$url 2>&1 | Out-Null

$result = netsh http add urlacl url=$url user="NT AUTHORITY\NETWORK SERVICE" 2>&1
if ($LASTEXITCODE -ne 0) {
    # Try with Everyone if NETWORK SERVICE fails
    $result = netsh http add urlacl url=$url user=Everyone 2>&1
}
if ($LASTEXITCODE -eq 0) {
    Write-Ok "URL ACL registered: $url"
} else {
    Write-Warn "URL ACL registration failed (non-fatal - service may still work as SYSTEM)"
    Write-Host "  $result" -ForegroundColor DarkGray
}

# ── Windows Firewall rule ─────────────────────────────────────────────────────

Write-Step "Adding Windows Firewall inbound rule for port $HttpPort"

$ruleName = "StockVala Gateway HTTP $HttpPort"

# Remove existing rule if present
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $HttpPort `
    -Action Allow `
    -Profile Any `
    -Description "StockVala MT5 Gateway REST API" | Out-Null

Write-Ok "Firewall rule added: inbound TCP $HttpPort"

# ── Install NSSM (service manager) ───────────────────────────────────────────

Write-Step "Setting up Windows service: $ServiceName"

$nssmDir  = "$InstallDir\nssm"
$nssmExe  = "$nssmDir\nssm.exe"
$nssmUrl  = "https://nssm.cc/release/nssm-2.24.zip"
$nssmZip  = "$env:TEMP\nssm.zip"

function Get-NSSM {
    if (Test-Path $nssmExe) { return $true }

    Write-Host "  Downloading NSSM (Non-Sucking Service Manager)..." -ForegroundColor DarkGray

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing -TimeoutSec 30

        $extractTo = "$env:TEMP\nssm_extract"
        Expand-Archive -Path $nssmZip -DestinationPath $extractTo -Force

        # Find the x64 nssm.exe inside the zip
        $nssmInZip = Get-ChildItem -Path $extractTo -Recurse -Filter "nssm.exe" |
                     Where-Object { $_.DirectoryName -match "win64" } |
                     Select-Object -First 1

        if (-not $nssmInZip) {
            $nssmInZip = Get-ChildItem -Path $extractTo -Recurse -Filter "nssm.exe" |
                         Select-Object -First 1
        }

        New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
        Copy-Item $nssmInZip.FullName $nssmExe -Force

        Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
        Remove-Item $extractTo -Recurse -Force -ErrorAction SilentlyContinue

        return (Test-Path $nssmExe)
    } catch {
        return $false
    }
}

$gatewayExe = Join-Path $InstallDir "StockVala.Gateway.exe"
$logDir     = Join-Path $InstallDir "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$nssmOk = Get-NSSM

if ($nssmOk) {
    # Remove old service if exists
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Removing existing service '$ServiceName'..." -ForegroundColor DarkGray
        & $nssmExe stop $ServiceName 2>&1 | Out-Null
        & $nssmExe remove $ServiceName confirm 2>&1 | Out-Null
        Start-Sleep -Seconds 2
    }

    # Install service
    & $nssmExe install $ServiceName $gatewayExe
    & $nssmExe set $ServiceName AppDirectory $InstallDir
    & $nssmExe set $ServiceName DisplayName "StockVala MT5 Gateway"
    & $nssmExe set $ServiceName Description "StockVala C# gateway: MT5 Manager API, HTTP REST, Redis tick publisher"
    & $nssmExe set $ServiceName Start SERVICE_AUTO_START
    & $nssmExe set $ServiceName ObjectName "LocalSystem"

    # Log stdout/stderr to files
    & $nssmExe set $ServiceName AppStdout "$logDir\gateway.log"
    & $nssmExe set $ServiceName AppStderr "$logDir\gateway-error.log"
    & $nssmExe set $ServiceName AppRotateFiles 1
    & $nssmExe set $ServiceName AppRotateSeconds 86400
    & $nssmExe set $ServiceName AppRotateBytes 10485760

    # Auto-restart on failure
    & $nssmExe set $ServiceName AppExit Default Restart
    & $nssmExe set $ServiceName AppRestartDelay 5000

    Write-Ok "Service installed via NSSM"

    Write-Step "Starting service: $ServiceName"
    & $nssmExe start $ServiceName

    Start-Sleep -Seconds 4

    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Ok "Service is RUNNING"
    } else {
        Write-Warn "Service did not start automatically. Check logs:"
        Write-Host "  $logDir\gateway.log" -ForegroundColor DarkGray
        Write-Host "  $logDir\gateway-error.log" -ForegroundColor DarkGray
    }

} else {
    # Fallback: install via sc.exe (no auto-restart, but works without NSSM)
    Write-Warn "NSSM download failed. Falling back to sc.exe..."

    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }

    sc.exe create $ServiceName `
        binPath= "`"$gatewayExe`"" `
        DisplayName= "StockVala MT5 Gateway" `
        start= auto | Out-Null

    sc.exe description $ServiceName "StockVala C# gateway: MT5 Manager API, HTTP REST, Redis tick publisher" | Out-Null

    # Configure failure recovery (restart after 5s, three times)
    sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null

    Write-Ok "Service registered via sc.exe"

    Write-Step "Starting service"
    Start-Service -Name $ServiceName -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 4
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Ok "Service is RUNNING"
    } else {
        Write-Warn "Service may not have started. Check Event Viewer > Windows Logs > Application."
    }
}

# ── Health check ──────────────────────────────────────────────────────────────

Write-Step "Health check: GET http://localhost:$HttpPort/health"

Start-Sleep -Seconds 2  # give the gateway a moment to bind

try {
    $resp = Invoke-RestMethod -Uri "http://localhost:$HttpPort/health" -TimeoutSec 8 -ErrorAction Stop
    Write-Ok "Gateway responded: $($resp | ConvertTo-Json -Compress)"
} catch {
    Write-Warn "Health check failed (gateway may still be starting). Try manually:"
    Write-Host "  curl http://localhost:$HttpPort/health" -ForegroundColor DarkGray
    Write-Host "  or open in browser: http://$(hostname):$HttpPort/health" -ForegroundColor DarkGray
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Install dir  : $InstallDir" -ForegroundColor White
Write-Host "  Service name : $ServiceName" -ForegroundColor White
Write-Host "  HTTP API     : http://$(hostname):$HttpPort/" -ForegroundColor White
Write-Host "  Logs         : $logDir\" -ForegroundColor White
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Cyan
Write-Host "    sc query $ServiceName           - check service status"
Write-Host "    sc stop $ServiceName            - stop gateway"
Write-Host "    sc start $ServiceName           - start gateway"
Write-Host ""
Write-Host "  Backend .env setting for Node.js:" -ForegroundColor Cyan
Write-Host "    MT5_GATEWAY_URL=http://THIS_VPS_IP:$HttpPort" -ForegroundColor Yellow
Write-Host ""
Write-Host "  To reconfigure: edit $destConfig" -ForegroundColor DarkGray
Write-Host "  then restart: sc stop $ServiceName && sc start $ServiceName" -ForegroundColor DarkGray
Write-Host ""

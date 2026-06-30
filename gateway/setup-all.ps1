#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Full one-shot installer for the StockVala Gateway Windows VPS.
.DESCRIPTION
    Installs: Chocolatey, Redis (local), Node.js 18 + PM2, Python 3.11 + pip packages,
    C# Gateway service, MCX Feed service, Cloudflare Tunnel.
.PARAMETER InstallDir
    Root install folder. Default: C:\StockVala
.PARAMETER ServicePrefix
    Prefix for Windows service names. Default: StockVala
.PARAMETER MT5Server
    MT5 server HOST:PORT for the C# Gateway
.PARAMETER MT5Login
    MT5 manager login (numeric)
.PARAMETER MT5Password
    MT5 manager password
.PARAMETER MT5ServerName
    Display name shown in MT5 terminal (e.g. MyBroker-Server)
.PARAMETER MT5DefaultGroup
    Default group for new accounts. Default: real\clients
.PARAMETER RedisHost
    Redis HOST:PORT. Leave blank to install Redis locally on this VPS (recommended for V2 per-gateway setup).
    When blank, Redis is installed at 127.0.0.1:6379 and RedisPassword is used as the AUTH password.
.PARAMETER RedisPassword
    Redis AUTH password (required — used both when installing local Redis and when connecting to remote Redis)
.PARAMETER LocalRedisPort
    Port for local Redis. Default: 6379 (only used when RedisHost is blank)
.PARAMETER HttpPort
    Gateway HTTP API port. Default: 8081
.PARAMETER McxMT5Login
    MT5 login for the MCX feed
.PARAMETER McxMT5Password
    MT5 password for the MCX feed
.PARAMETER McxMT5Server
    MT5 server for the MCX feed
.PARAMETER McxMT5Path
    Path to MT5 terminal64.exe
.PARAMETER CfTunnelToken
    Cloudflare Tunnel token. Leave blank to skip tunnel registration.
.PARAMETER SkipBuild
    Skip compiling the C# gateway.
.PARAMETER SkipNode
    Skip Node.js / PM2 installation.
.PARAMETER SkipPython
    Skip Python / pip installation.
.PARAMETER SkipCloudflare
    Skip Cloudflare Tunnel installation.
.PARAMETER SkipMcxFeed
    Skip MCX feed service installation.
.PARAMETER SkipRedis
    Skip local Redis installation (use this when RedisHost points to a remote Redis).
#>

[CmdletBinding()]
param(
    [string]$InstallDir       = "C:\StockVala",
    [string]$ServicePrefix    = "StockVala",
    [string]$MT5Server        = "",
    [string]$MT5Login         = "",
    [string]$MT5Password      = "",
    [string]$MT5ServerName    = "",
    [string]$MT5DefaultGroup  = "real\clients",
    [string]$RedisHost        = "",
    [string]$RedisPassword    = "",
    [int]   $LocalRedisPort   = 6379,
    [int]   $HttpPort         = 8081,
    [string]$McxMT5Login      = "",
    [string]$McxMT5Password   = "",
    [string]$McxMT5Server     = "",
    [string]$McxMT5Path       = 'C:\Program Files\MetaTrader 5\terminal64.exe',
    [string]$CfTunnelToken    = "",
    [switch]$SkipBuild,
    [switch]$SkipNode,
    [switch]$SkipPython,
    [switch]$SkipCloudflare,
    [switch]$SkipMcxFeed,
    [switch]$SkipRedis
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ===========================================================================
#  HELPERS
# ===========================================================================

function Write-Banner {
    param([string]$Text, [string]$Color = "Cyan")
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor $Color
    Write-Host "  $Text" -ForegroundColor $Color
    Write-Host "====================================================" -ForegroundColor $Color
    Write-Host ""
}

function Write-Phase {
    param([int]$N, [string]$Text)
    Write-Host ""
    Write-Host "--- Phase $N : $Text ---" -ForegroundColor Magenta
}

function Write-Ok   { param([string]$M); Write-Host "  [OK]   $M" -ForegroundColor Green  }
function Write-Warn { param([string]$M); Write-Host "  [WARN] $M" -ForegroundColor Yellow }
function Write-Fail { param([string]$M); Write-Host "  [FAIL] $M" -ForegroundColor Red; exit 1 }
function Write-Info { param([string]$M); Write-Host "  [...]  $M" -ForegroundColor DarkGray }

function Prompt-Required {
    param([string]$Label, [string]$Current, [switch]$Secret)
    if ($Current) { return $Current }
    do {
        if ($Secret) {
            $ss  = Read-Host "  $Label (required, hidden)" -AsSecureString
            $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
            $val = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        } else {
            $val = Read-Host "  $Label (required)"
        }
    } while (-not $val.Trim())
    return $val.Trim()
}

function Prompt-Optional {
    param([string]$Label, [string]$Current, [string]$Default = "")
    if ($Current) { return $Current }
    if ($Default) {
        $val = Read-Host "  $Label [default: $Default]"
    } else {
        $val = Read-Host "  $Label [Enter to skip]"
    }
    if (-not $val.Trim()) { return $Default }
    return $val.Trim()
}

function Command-Exists {
    param([string]$Cmd)
    return [bool](Get-Command $Cmd -ErrorAction SilentlyContinue)
}

function Ensure-NSSM {
    $nssmExe = "$InstallDir\tools\nssm.exe"
    if (Test-Path $nssmExe) { return $nssmExe }
    Write-Info "Downloading NSSM..."
    $zip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zip -UseBasicParsing -TimeoutSec 60
    $tmp = "$env:TEMP\nssm_x"
    Expand-Archive $zip $tmp -Force
    $src = Get-ChildItem $tmp -Recurse -Filter "nssm.exe" |
           Where-Object { $_.DirectoryName -match "win64" } |
           Select-Object -First 1
    if (-not $src) {
        $src = Get-ChildItem $tmp -Recurse -Filter "nssm.exe" | Select-Object -First 1
    }
    New-Item -ItemType Directory -Path "$InstallDir\tools" -Force | Out-Null
    Copy-Item $src.FullName $nssmExe -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    return $nssmExe
}

function Install-AsService {
    param(
        [string]$Name,
        [string]$DisplayName,
        [string]$Description,
        [string]$ExePath,
        [string]$Arguments = "",
        [string]$WorkDir   = "",
        [string]$LogDir    = "$InstallDir\logs"
    )
    $nssm = Ensure-NSSM
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

    $existing = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($existing) {
        & $nssm stop $Name 2>&1 | Out-Null
        & $nssm remove $Name confirm 2>&1 | Out-Null
        Start-Sleep -Seconds 2
    }

    & $nssm install $Name $ExePath
    if ($Arguments) { & $nssm set $Name AppParameters $Arguments }
    if ($WorkDir)   { & $nssm set $Name AppDirectory  $WorkDir   }
    & $nssm set $Name DisplayName    $DisplayName
    & $nssm set $Name Description    $Description
    & $nssm set $Name Start          SERVICE_AUTO_START
    & $nssm set $Name ObjectName     LocalSystem
    & $nssm set $Name AppStdout      "$LogDir\$Name.log"
    & $nssm set $Name AppStderr      "$LogDir\$Name-error.log"
    & $nssm set $Name AppRotateFiles 1
    & $nssm set $Name AppRotateSeconds 86400
    & $nssm set $Name AppRotateBytes   10485760
    & $nssm set $Name AppExit Default  Restart
    & $nssm set $Name AppRestartDelay  5000
}

# ===========================================================================
#  BANNER + COLLECT CONFIG
# ===========================================================================

Write-Banner "StockVala Gateway - Full VPS Installer" "Cyan"

Write-Host "This installer will set up:" -ForegroundColor White
Write-Host "  1. Chocolatey (Windows package manager)"
Write-Host "  2. Node.js 18 LTS + PM2"
Write-Host "  3. Python 3.11 + MetaTrader5 + redis pip packages"
Write-Host "  4. C# Gateway compiled + installed as a service"
Write-Host "  5. MCX Feed (mcx_feed.py) as a service"
Write-Host "  6. Cloudflare Tunnel (cloudflared)"
Write-Host ""

$confirm = Read-Host "Continue? [Y/n]"
if ($confirm -and $confirm -notmatch "^[Yy]") { Write-Host "Aborted."; exit 0 }

Write-Host ""
Write-Host "--- C# Gateway Settings ---" -ForegroundColor White
$MT5Server     = Prompt-Required "MT5 server (host:port, e.g. 1.2.3.4:443)" $MT5Server
$MT5Login      = Prompt-Required "MT5 manager login number" $MT5Login
$MT5Password   = Prompt-Required "MT5 manager password" $MT5Password -Secret
$MT5ServerName = Prompt-Required "MT5 server display name (e.g. MyBroker-Server)" $MT5ServerName

Write-Host ""
Write-Host "--- Redis ---" -ForegroundColor White
Write-Host "  Leave Redis host BLANK to install Redis locally on this VPS (V2 per-gateway mode)." -ForegroundColor DarkGray
if (-not $SkipRedis) {
    $RedisHost = Prompt-Optional "Redis host:port (blank = install locally on this VPS)" $RedisHost ""
}
if (-not $RedisHost) {
    Write-Host "  -> Redis will be installed locally at 127.0.0.1:$LocalRedisPort" -ForegroundColor Green
    $RedisPassword = Prompt-Required "Redis AUTH password (will be set on local Redis)" $RedisPassword -Secret
} else {
    $RedisPassword = Prompt-Required "Redis password" $RedisPassword -Secret
}

Write-Host ""
Write-Host "--- MCX / NSE Feed (Python) ---" -ForegroundColor White
if (-not $SkipMcxFeed) {
    $McxMT5Login    = Prompt-Required "MCX feed MT5 login" $McxMT5Login
    $McxMT5Password = Prompt-Required "MCX feed MT5 password" $McxMT5Password -Secret
    $McxMT5Server   = Prompt-Required "MCX feed MT5 server (host:port)" $McxMT5Server
    $McxMT5Path     = Prompt-Optional "MT5 terminal64.exe path" $McxMT5Path $McxMT5Path
}

Write-Host ""
Write-Host "--- Cloudflare Tunnel ---" -ForegroundColor White
if (-not $SkipCloudflare) {
    Write-Host "  Get your token from Cloudflare dashboard:" -ForegroundColor DarkGray
    Write-Host "  Zero Trust -> Networks -> Tunnels -> Create tunnel -> cloudflared" -ForegroundColor DarkGray
    $CfTunnelToken = Prompt-Optional "Cloudflare Tunnel token" $CfTunnelToken ""
}

Write-Host ""
Write-Host "--- HTTP Port and Install Path ---" -ForegroundColor White
$portStr    = Prompt-Optional "Gateway HTTP port" "" "8081"
$HttpPort   = [int]$portStr
$InstallDir = Prompt-Optional "Install root directory" $InstallDir $InstallDir

$GatewayDir = "$InstallDir\Gateway"
$McxFeedDir = "$InstallDir\McxFeed"
$LogDir     = "$InstallDir\logs"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path

New-Item -ItemType Directory -Path $GatewayDir -Force | Out-Null
New-Item -ItemType Directory -Path $McxFeedDir -Force | Out-Null
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallDir\tools" -Force | Out-Null

# ===========================================================================
#  PHASE 1 - CHOCOLATEY
# ===========================================================================

Write-Phase 1 "Chocolatey (Windows package manager)"

if (-not (Command-Exists choco)) {
    Write-Info "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

if (Command-Exists choco) {
    Write-Ok "Chocolatey ready"
} else {
    Write-Warn "Chocolatey install may need a shell restart. Continuing..."
}

function Choco-Install {
    param([string]$Pkg, [string]$CheckCmd)
    if (Command-Exists $CheckCmd) {
        Write-Ok "$CheckCmd already installed"
        return
    }
    Write-Info "Installing $Pkg via Chocolatey..."
    choco install $Pkg -y --no-progress 2>&1 | Where-Object { $_ -match "installed|error|fail" }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

# ===========================================================================
#  PHASE 2 - NODE.JS + PM2
# ===========================================================================

Write-Phase 2 "Node.js 18 LTS + PM2"

if (-not $SkipNode) {
    Choco-Install "nodejs-lts" "node"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Command-Exists node) {
        Write-Ok "Node.js $(node --version)"
    } else {
        Write-Warn "Node.js not in PATH yet. May need a new shell session."
    }
    if (Command-Exists npm) {
        Write-Info "Installing PM2 globally..."
        npm install -g pm2 --silent 2>&1 | Out-Null
        if (Command-Exists pm2) {
            Write-Ok "PM2 installed"
        } else {
            Write-Warn "PM2 not in PATH yet. Run: npm install -g pm2"
        }
    }
} else {
    Write-Info "Skipped (SkipNode flag set)"
}

# ===========================================================================
#  PHASE 3 - PYTHON + PIP PACKAGES
# ===========================================================================

Write-Phase 3 "Python 3.11 + MetaTrader5 + redis"

if (-not $SkipPython) {
    Choco-Install "python311" "python"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Command-Exists python) {
        Write-Ok "Python $(python --version)"
        Write-Info "Installing pip packages: MetaTrader5, redis..."
        python -m pip install --upgrade pip --quiet 2>&1 | Out-Null
        python -m pip install MetaTrader5 redis --quiet 2>&1 | Out-Null
        Write-Ok "pip packages installed"
    } else {
        Write-Warn "Python not in PATH. Run manually: pip install MetaTrader5 redis"
    }
} else {
    Write-Info "Skipped (SkipPython flag set)"
}

# ===========================================================================
#  PHASE 4 - .NET 4.8 CHECK
# ===========================================================================

Write-Phase 4 ".NET Framework 4.8"

$netKey     = "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full"
$netRelease = (Get-ItemProperty $netKey -ErrorAction SilentlyContinue).Release

if ($netRelease -ge 528040) {
    Write-Ok ".NET 4.8 present"
} else {
    Write-Info "Installing .NET 4.8 dev pack..."
    choco install netfx-4.8-devpack -y --no-progress 2>&1 | Out-Null
    Write-Warn ".NET 4.8 installed. A reboot may be required if build fails."
}

# ===========================================================================
#  PHASE 5 - BUILD C# GATEWAY
# ===========================================================================

Write-Phase 5 "Build C# Gateway"

if (-not $SkipBuild) {
    $srcExe     = Join-Path $scriptDir "bin\Release\StockVala.Gateway.exe"
    $buildScript = Join-Path $scriptDir "build.ps1"

    if (Test-Path $srcExe) {
        Write-Ok "Pre-built exe found, skipping compile"
    } elseif (Test-Path $buildScript) {
        Write-Info "Running build.ps1..."
        & powershell -ExecutionPolicy Bypass -File $buildScript
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Build failed. Install VS Build Tools manually:"
            Write-Warn "https://aka.ms/vs/17/release/vs_BuildTools.exe"
        }
    } else {
        Write-Warn "build.ps1 not found. Skipping compile."
    }
} else {
    Write-Info "Skipped (SkipBuild flag set)"
}

# ===========================================================================
#  PHASE 6 - INSTALL C# GATEWAY SERVICE
# ===========================================================================

Write-Phase 6 "C# Gateway service"

$srcExe     = Join-Path $scriptDir "bin\Release\StockVala.Gateway.exe"
$gatewayExe = Join-Path $GatewayDir "StockVala.Gateway.exe"

if (Test-Path $srcExe) {
    Copy-Item "$scriptDir\bin\Release\*" $GatewayDir -Recurse -Force

    $nativeDll = Join-Path $scriptDir "Libs\MT5APIManager64.dll"
    if (Test-Path $nativeDll) {
        Copy-Item $nativeDll $GatewayDir -Force
    }
    Write-Ok "Files copied to $GatewayDir"

    $destConfig = Join-Path $GatewayDir "StockVala.Gateway.exe.config"
    $configXml = "<?xml version=""1.0"" encoding=""utf-8"" ?>`r`n"
    $configXml += "<configuration>`r`n"
    $configXml += "  <appSettings>`r`n"
    $configXml += "    <add key=""MT5Server""       value=""$MT5Server"" />`r`n"
    $configXml += "    <add key=""MT5Login""        value=""$MT5Login"" />`r`n"
    $configXml += "    <add key=""MT5Password""     value=""$MT5Password"" />`r`n"
    $configXml += "    <add key=""MT5ServerName""   value=""$MT5ServerName"" />`r`n"
    $configXml += "    <add key=""MT5DefaultGroup"" value=""$MT5DefaultGroup"" />`r`n"
    $configXml += "    <add key=""RedisHost""       value=""$RedisHost"" />`r`n"
    $configXml += "    <add key=""RedisPassword""   value=""$RedisPassword"" />`r`n"
    $configXml += "    <add key=""HttpPort""        value=""$HttpPort"" />`r`n"
    $configXml += "  </appSettings>`r`n"
    $configXml += "  <runtime>`r`n"
    $configXml += "    <assemblyBinding xmlns=""urn:schemas-microsoft-com:asm.v1"">`r`n"
    $configXml += "      <dependentAssembly>`r`n"
    $configXml += "        <assemblyIdentity name=""System.Runtime.CompilerServices.Unsafe"" publicKeyToken=""b03f5f7f11d50a3a"" culture=""neutral"" />`r`n"
    $configXml += "        <bindingRedirect oldVersion=""0.0.0.0-6.0.0.0"" newVersion=""6.0.0.0"" />`r`n"
    $configXml += "      </dependentAssembly>`r`n"
    $configXml += "      <dependentAssembly>`r`n"
    $configXml += "        <assemblyIdentity name=""System.Memory"" publicKeyToken=""cc7b13ffcd2ddd51"" culture=""neutral"" />`r`n"
    $configXml += "        <bindingRedirect oldVersion=""0.0.0.0-4.0.2.0"" newVersion=""4.0.1.2"" />`r`n"
    $configXml += "      </dependentAssembly>`r`n"
    $configXml += "      <dependentAssembly>`r`n"
    $configXml += "        <assemblyIdentity name=""System.Buffers"" publicKeyToken=""cc7b13ffcd2ddd51"" culture=""neutral"" />`r`n"
    $configXml += "        <bindingRedirect oldVersion=""0.0.0.0-4.0.3.0"" newVersion=""4.0.3.0"" />`r`n"
    $configXml += "      </dependentAssembly>`r`n"
    $configXml += "      <dependentAssembly>`r`n"
    $configXml += "        <assemblyIdentity name=""System.Threading.Tasks.Extensions"" publicKeyToken=""cc7b13ffcd2ddd51"" culture=""neutral"" />`r`n"
    $configXml += "        <bindingRedirect oldVersion=""0.0.0.0-4.2.0.1"" newVersion=""4.2.0.1"" />`r`n"
    $configXml += "      </dependentAssembly>`r`n"
    $configXml += "      <dependentAssembly>`r`n"
    $configXml += "        <assemblyIdentity name=""System.Numerics.Vectors"" publicKeyToken=""b03f5f7f11d50a3a"" culture=""neutral"" />`r`n"
    $configXml += "        <bindingRedirect oldVersion=""0.0.0.0-4.1.4.0"" newVersion=""4.1.4.0"" />`r`n"
    $configXml += "      </dependentAssembly>`r`n"
    $configXml += "      <dependentAssembly>`r`n"
    $configXml += "        <assemblyIdentity name=""Microsoft.Bcl.AsyncInterfaces"" publicKeyToken=""cc7b13ffcd2ddd51"" culture=""neutral"" />`r`n"
    $configXml += "        <bindingRedirect oldVersion=""0.0.0.0-5.0.0.0"" newVersion=""5.0.0.0"" />`r`n"
    $configXml += "      </dependentAssembly>`r`n"
    $configXml += "    </assemblyBinding>`r`n"
    $configXml += "  </runtime>`r`n"
    $configXml += "</configuration>`r`n"

    [System.IO.File]::WriteAllText($destConfig, $configXml, (New-Object System.Text.UTF8Encoding $false))
    Write-Ok "app.config written"

    netsh http delete urlacl url="http://*:$HttpPort/" 2>&1 | Out-Null
    netsh http add urlacl url="http://*:$HttpPort/" user="NT AUTHORITY\NETWORK SERVICE" 2>&1 | Out-Null
    Write-Ok "netsh URL ACL registered for port $HttpPort"

    Remove-NetFirewallRule -DisplayName "StockVala Gateway HTTP $HttpPort" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "StockVala Gateway HTTP $HttpPort" `
        -Direction Inbound -Protocol TCP -LocalPort $HttpPort `
        -Action Allow -Profile Any | Out-Null
    Write-Ok "Firewall: inbound TCP $HttpPort allowed"

    $svcName = $ServicePrefix + "Gateway"
    Install-AsService -Name $svcName `
        -DisplayName "StockVala MT5 Gateway" `
        -Description "C# gateway: MT5 Manager API + HTTP REST + Redis tick publisher" `
        -ExePath $gatewayExe `
        -WorkDir $GatewayDir

    $nssm = Ensure-NSSM
    & $nssm start $svcName 2>&1 | Out-Null
    Start-Sleep -Seconds 4

    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Ok "Gateway service RUNNING"
    } else {
        Write-Warn "Gateway service not running. Check: $LogDir\${svcName}-error.log"
    }

    try {
        $h = Invoke-RestMethod "http://localhost:$HttpPort/health" -TimeoutSec 6 -ErrorAction Stop
        Write-Ok "Health check OK"
    } catch {
        Write-Warn "Health check pending - gateway may still be starting"
    }

} else {
    Write-Warn "Gateway exe not found. Run build.ps1 first."
}

# ===========================================================================
#  PHASE 7 - MCX FEED SERVICE
# ===========================================================================

Write-Phase 7 "MCX / NSE Feed service (Python)"

if (-not $SkipMcxFeed) {
    $feedSrc = $null
    $candidate1 = Join-Path (Split-Path $scriptDir -Parent) "mcx_feed.py"
    $candidate2 = Join-Path $scriptDir "mcx_feed.py"
    if (Test-Path $candidate1) { $feedSrc = $candidate1 }
    elseif (Test-Path $candidate2) { $feedSrc = $candidate2 }

    if (-not $feedSrc) {
        Write-Warn "mcx_feed.py not found. Skipping MCX feed service."
    } else {
        $feedDest = Join-Path $McxFeedDir "mcx_feed.py"
        Copy-Item $feedSrc $feedDest -Force

        $content = Get-Content $feedDest -Raw

        $content = $content -replace 'MT5_LOGIN\s*=\s*\d+',         "MT5_LOGIN    = $McxMT5Login"
        $content = $content -replace 'MT5_PASSWORD\s*=\s*"[^"]*"',  "MT5_PASSWORD = `"$McxMT5Password`""
        $content = $content -replace 'MT5_SERVER\s*=\s*"[^"]*"',    "MT5_SERVER   = `"$McxMT5Server`""
        $content = $content -replace 'MT5_PATH\s*=\s*r"[^"]*"',     "MT5_PATH     = r`"$McxMT5Path`""

        $rHost = $RedisHost -replace ':.*', ''
        $rPort = "6379"
        if ($RedisHost -match ':(\d+)') { $rPort = $Matches[1] }

        $content = $content -replace 'REDIS_HOST\s*=\s*"[^"]*"',  "REDIS_HOST = `"$rHost`""
        $content = $content -replace 'REDIS_PORT\s*=\s*\d+',      "REDIS_PORT = $rPort"
        $content = $content -replace 'REDIS_PASS\s*=\s*"[^"]*"',  "REDIS_PASS = `"$RedisPassword`""

        [System.IO.File]::WriteAllText($feedDest, $content, (New-Object System.Text.UTF8Encoding $false))
        Write-Ok "mcx_feed.py patched and copied to $McxFeedDir"

        $c = Get-Command python -ErrorAction SilentlyContinue
        $pythonExe = if ($c) { $c.Source } else { $null }
        if (-not $pythonExe) {
            $c = Get-Command python3 -ErrorAction SilentlyContinue
            $pythonExe = if ($c) { $c.Source } else { $null }
        }
        if (-not $pythonExe) { $pythonExe = "python" }

        $svcName = $ServicePrefix + "McxFeed"
        Install-AsService -Name $svcName `
            -DisplayName "StockVala MCX/NSE Feed" `
            -Description "Python MCX/NSE/BSE price feed via MT5 terminal to Redis" `
            -ExePath $pythonExe `
            -Arguments "-u `"$feedDest`"" `
            -WorkDir $McxFeedDir

        $nssm = Ensure-NSSM
        & $nssm start $svcName 2>&1 | Out-Null
        Start-Sleep -Seconds 3

        $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq "Running") {
            Write-Ok "MCX Feed service RUNNING"
        } else {
            Write-Warn "MCX Feed service not running."
            Write-Warn "Make sure MT5 terminal is installed at: $McxMT5Path"
            Write-Host "  Check log: $LogDir\${svcName}-error.log" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Info "Skipped (SkipMcxFeed flag set)"
}

# ===========================================================================
#  PHASE 8 - CLOUDFLARE TUNNEL
# ===========================================================================

Write-Phase 8 "Cloudflare Tunnel (cloudflared)"

if (-not $SkipCloudflare) {
    $cfDir = "$InstallDir\cloudflared"
    $cfExe = "$cfDir\cloudflared.exe"
    $cfDownloadOk = $true

    if (-not (Test-Path $cfExe)) {
        Write-Info "Downloading cloudflared..."
        New-Item -ItemType Directory -Path $cfDir -Force | Out-Null
        $cfUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        try {
            Invoke-WebRequest -Uri $cfUrl -OutFile $cfExe -UseBasicParsing -TimeoutSec 120
            Write-Ok "cloudflared downloaded"
        } catch {
            Write-Warn "cloudflared download failed: $_"
            Write-Warn "Download manually from: https://github.com/cloudflare/cloudflared/releases"
            $cfDownloadOk = $false
        }
    } else {
        Write-Ok "cloudflared already present"
    }

    if ($cfDownloadOk) {
        if ($CfTunnelToken) {
            Write-Info "Installing cloudflared as Windows service..."
            & $cfExe service install $CfTunnelToken 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Start-Service -Name "cloudflared" -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 3
                $svc = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
                if ($svc -and $svc.Status -eq "Running") {
                    Write-Ok "Cloudflare Tunnel service RUNNING"
                    Write-Host "  Add public hostname in Cloudflare dashboard:" -ForegroundColor DarkGray
                    Write-Host "  Zero Trust -> Tunnels -> your tunnel -> Public Hostnames" -ForegroundColor DarkGray
                } else {
                    Write-Warn "cloudflared service did not start. Check Windows Event Viewer."
                }
            } else {
                Write-Warn "cloudflared service install failed. Run manually:"
                Write-Host "  $cfExe service install YOUR_TOKEN" -ForegroundColor DarkGray
            }
        } else {
            Write-Warn "No tunnel token - cloudflared downloaded but not registered as a service."
            Write-Host ""
            Write-Host "  To finish setup later:" -ForegroundColor Yellow
            Write-Host "  1. Go to Cloudflare dashboard" -ForegroundColor Yellow
            Write-Host "  2. Zero Trust -> Networks -> Tunnels -> Create tunnel" -ForegroundColor Yellow
            Write-Host "  3. Run: $cfExe service install YOUR_TOKEN" -ForegroundColor Yellow
            Write-Host "  4. Add public hostname: gateway.yourdomain.com -> http://localhost:$HttpPort" -ForegroundColor Yellow
        }
    }
} else {
    Write-Info "Skipped (SkipCloudflare flag set)"
}

# ===========================================================================
#  DONE
# ===========================================================================

Write-Banner "Installation Complete!" "Green"

Write-Host "  Install root  : $InstallDir" -ForegroundColor White
Write-Host "  Gateway dir   : $GatewayDir" -ForegroundColor White
Write-Host "  MCX feed dir  : $McxFeedDir" -ForegroundColor White
Write-Host "  Logs          : $LogDir" -ForegroundColor White
Write-Host ""
Write-Host "  Services:" -ForegroundColor Cyan
Write-Host "    $($ServicePrefix)Gateway  - MT5 C# Gateway HTTP API on port $HttpPort"
Write-Host "    $($ServicePrefix)McxFeed  - MCX/NSE Python feed to Redis"
Write-Host "    cloudflared      - Cloudflare Tunnel"
Write-Host ""
Write-Host "  Set this in your Linux web VPS backend .env:" -ForegroundColor Cyan
$hostname = $env:COMPUTERNAME
Write-Host "    MT5_GATEWAY_URL=http://$hostname`:$HttpPort" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Cyan
Write-Host "    sc query $($ServicePrefix)Gateway"
Write-Host "    sc query $($ServicePrefix)McxFeed"
Write-Host "    curl http://localhost:$HttpPort/health"
Write-Host ""
Write-Host "  Config file:" -ForegroundColor DarkGray
Write-Host "    $GatewayDir\StockVala.Gateway.exe.config" -ForegroundColor DarkGray
Write-Host ""

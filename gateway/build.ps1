#Requires -Version 5.1
<#
.SYNOPSIS
    Build StockVala Gateway (C# .NET 4.8, x64 Release)
.DESCRIPTION
    Finds or auto-installs MSBuild (via Chocolatey), then compiles the gateway.
    Run this BEFORE install.ps1 / setup-all.ps1.
#>

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Ok   { param([string]$M); Write-Host "  [OK]  $M" -ForegroundColor Green  }
function Write-Info { param([string]$M); Write-Host "  [...] $M" -ForegroundColor DarkGray }
function Write-Fail { param([string]$M); Write-Host "  [ERR] $M" -ForegroundColor Red    }

# ── Find MSBuild ──────────────────────────────────────────────────────────────

function Find-MSBuild {
    $candidates = @(
        # VS 2022 — both Program Files locations (choco uses x86, official installer uses x64)
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe",
        # VS 2019
        "${env:ProgramFiles}\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe",
        # VS 2017 / older standalone
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2017\BuildTools\MSBuild\15.0\Bin\MSBuild.exe",
        "${env:ProgramFiles(x86)}\MSBuild\14.0\Bin\MSBuild.exe"
    )
    # Also check PATH
    $c = Get-Command msbuild -ErrorAction SilentlyContinue
    if ($c) { $candidates += $c.Source }

    # Deep search under Visual Studio folders as final fallback
    foreach ($root in @("${env:ProgramFiles}\Microsoft Visual Studio","${env:ProgramFiles(x86)}\Microsoft Visual Studio")) {
        if (Test-Path $root) {
            $found = Get-ChildItem $root -Recurse -Filter "MSBuild.exe" -ErrorAction SilentlyContinue |
                     Where-Object { $_.FullName -notmatch "amd64|arm" } |
                     Select-Object -First 1 -ExpandProperty FullName
            if ($found) { $candidates += $found }
        }
    }

    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

# ── Auto-install MSBuild via Chocolatey ───────────────────────────────────────

function Install-MSBuild {
    Write-Host ""
    Write-Host "  MSBuild not found. Installing VS Build Tools via Chocolatey..." -ForegroundColor Yellow
    Write-Host "  (This takes 5-10 minutes — please wait)" -ForegroundColor Yellow
    Write-Host ""

    # Ensure Chocolatey is installed
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Info "Installing Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
    }

    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Fail "Chocolatey install failed. Install MSBuild manually:"
        Write-Host "  https://aka.ms/vs/17/release/vs_BuildTools.exe" -ForegroundColor Yellow
        Write-Host "  Select workload: '.NET desktop build tools'" -ForegroundColor Yellow
        exit 1
    }

    # Install the workload-specific package (more reliable than --package-parameters)
    Write-Info "Running: choco install visualstudio2022-workload-manageddesktopbuildtools ..."
    choco install visualstudio2022-workload-manageddesktopbuildtools -y --no-progress

    # Refresh PATH so the new msbuild.exe is visible
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

# ── Banner ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  StockVala Gateway - Build Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$csproj    = Join-Path $scriptDir "StockVala.Gateway.csproj"

if (-not (Test-Path $csproj)) {
    Write-Fail "StockVala.Gateway.csproj not found in: $scriptDir"
    Write-Host "  Make sure you are running this from inside the gateway folder." -ForegroundColor Yellow
    exit 1
}

# ── Find or install MSBuild ───────────────────────────────────────────────────

$msbuild = Find-MSBuild

if (-not $msbuild) {
    Install-MSBuild
    $msbuild = Find-MSBuild   # try again after install
}

if (-not $msbuild) {
    Write-Fail "MSBuild still not found after install attempt."
    Write-Host ""
    Write-Host "  Manual option A — download VS Build Tools:" -ForegroundColor Yellow
    Write-Host "    https://aka.ms/vs/17/release/vs_BuildTools.exe" -ForegroundColor White
    Write-Host "    Workload: '.NET desktop build tools'" -ForegroundColor White
    Write-Host ""
    Write-Host "  Manual option B — reboot the VPS then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Ok "MSBuild: $msbuild"
Write-Ok "Project: $csproj"
Write-Host ""
Write-Info "Building Release|x64 ..."
Write-Host ""

# ── Compile ───────────────────────────────────────────────────────────────────

& $msbuild $csproj /p:Configuration=Release /p:Platform=x64 /m /nologo /v:minimal

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Fail "Build failed (exit code $LASTEXITCODE)"
    Write-Host ""
    Write-Host "  Common fixes:" -ForegroundColor Yellow
    Write-Host "    - Reboot the VPS and re-run (sometimes .NET install needs a restart)"
    Write-Host "    - Check that all Libs/*.dll files are present in the gateway folder"
    exit $LASTEXITCODE
}

# ── Done ──────────────────────────────────────────────────────────────────────

$exePath = Join-Path $scriptDir "bin\Release\StockVala.Gateway.exe"
if (Test-Path $exePath) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "  Build succeeded!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host ""
    Write-Ok "Exe: $exePath"
    Write-Host ""
    Write-Host "  Next step — run the full installer:" -ForegroundColor Cyan
    Write-Host "    .\setup-all.ps1" -ForegroundColor White
    Write-Host ""
} else {
    Write-Fail "Build reported success but exe not found: $exePath"
    exit 1
}

# StockVala V2 — Windows Gateway deploy script
# Run this on your Windows MT5 server

param(
  [string]$Action = "deploy"   # deploy | rebuild | restart
)

$GatewayDir = "C:\stockvala-v2\gateway"
$RepoUrl    = "git@github.com:Da-Prakhar/stockvala-v2.git"
$BuildCfg   = "Release"

function Pull-Repo {
  if (Test-Path "C:\stockvala-v2") {
    Write-Host "Pulling latest..."
    Set-Location "C:\stockvala-v2"
    git pull origin main
  } else {
    Write-Host "Cloning repo..."
    git clone $RepoUrl "C:\stockvala-v2"
    Set-Location "C:\stockvala-v2"
  }
}

function Copy-SDKLibs {
  # Copy SDK DLLs from MT5 SDK to gateway/Libs/
  $LibsDir = "$GatewayDir\Libs"
  New-Item -ItemType Directory -Force -Path $LibsDir | Out-Null

  # Update this path to your actual MT5 SDK location
  $SdkLibs = "C:\MT5SDK\Libs"
  Copy-Item "$SdkLibs\MT5APIGateway64.dll"             $LibsDir -Force
  Copy-Item "$SdkLibs\MetaQuotes.MT5GatewayAPI64.dll"  $LibsDir -Force
  Copy-Item "$SdkLibs\MetaQuotes.MT5CommonAPI64.dll"   $LibsDir -Force
  Write-Host "SDK DLLs copied"
}

function Install-NuGet {
  Set-Location $GatewayDir
  nuget install StackExchange.Redis -OutputDirectory packages
  Write-Host "NuGet packages installed"
}

function Build-Gateway {
  Set-Location $GatewayDir
  msbuild StockVala.Gateway.csproj /p:Configuration=$BuildCfg /p:Platform=x64
  if ($LASTEXITCODE -eq 0) { Write-Host "Build SUCCESS" }
  else                      { Write-Host "Build FAILED"; exit 1 }
}

function Stop-Gateway {
  Stop-Process -Name "StockVala.Gateway" -Force -ErrorAction SilentlyContinue
  Write-Host "Gateway stopped"
}

function Start-Gateway {
  $exe = "$GatewayDir\bin\Release\StockVala.Gateway.exe"
  Start-Process $exe -WindowStyle Hidden
  Write-Host "Gateway started"
}

# ── Main ──────────────────────────────────────────────────────────
switch ($Action) {
  "deploy" {
    Pull-Repo
    Copy-SDKLibs
    Install-NuGet
    Stop-Gateway
    Build-Gateway
    Start-Gateway
  }
  "rebuild" {
    Stop-Gateway
    Build-Gateway
    Start-Gateway
  }
  "restart" {
    Stop-Gateway
    Start-Gateway
  }
}

Write-Host "Done."

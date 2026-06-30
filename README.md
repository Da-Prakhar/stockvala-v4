# StockVala V2

## Structure
- `gateway/` — C# MT5 Gateway (compile on Windows, runs on MT5 server)
- `copy-trading/` — Node.js copy trading engine (runs on any server)
- `redis/` — Redis key schema docs

## Windows Server Setup

### 1. Copy SDK DLLs
```
gateway/Libs/
  MT5APIGateway64.dll
  MetaQuotes.MT5GatewayAPI64.dll
  MetaQuotes.MT5CommonAPI64.dll
```

### 2. Install Redis NuGet
```
cd gateway
nuget install StackExchange.Redis -OutputDirectory packages
```

### 3. Build
```
msbuild StockVala.Gateway.csproj /p:Configuration=Release /p:Platform=x64
```

### 4. Configure
Edit `gateway/app.config` with your MT5 credentials.

### 5. Run
```
gateway\bin\Release\StockVala.Gateway.exe
```

## Pull Latest Updates
```
git pull origin main
# Then rebuild: msbuild ...
```

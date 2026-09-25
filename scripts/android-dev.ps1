# Starts the whole local stack and launches the app on the Android emulator.
#   pnpm android:dev
# 1. local Supabase (Docker)  2. Edge Functions (new window)
# 3. emulator (if none is running)  4. expo run:android (builds + installs the dev client)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User') }
$env:ANDROID_HOME = $sdk
if (-not $env:ANDROID_AVD_HOME) { $env:ANDROID_AVD_HOME = [Environment]::GetEnvironmentVariable('ANDROID_AVD_HOME', 'User') }
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = [Environment]::GetEnvironmentVariable('GRADLE_USER_HOME', 'User') }
$env:Path = "$sdk\platform-tools;$sdk\emulator;$env:Path"

# 1. Supabase
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Error 'Docker Desktop is not running. Start it first.' }
pnpm exec supabase status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '▶ Starting local Supabase…'
  pnpm exec supabase start -x studio,imgproxy,vector,logflare,supavisor,mailpit,realtime
}

# .env.local for the app (10.0.2.2 = host machine as seen from the emulator)
$envFile = Join-Path $root 'apps\mobile\.env.local'
if (-not (Test-Path $envFile)) {
  $status = pnpm exec supabase status -o json | ConvertFrom-Json
  "EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$($status.PUBLISHABLE_KEY)" | Set-Content -Encoding utf8 $envFile
  Write-Host '▶ Wrote apps/mobile/.env.local'
}

# 2. Edge Functions in their own window
$fnEnv = Join-Path $root 'supabase\functions\.env'
if (-not (Test-Path $fnEnv)) { Copy-Item (Join-Path $root 'supabase\functions\.env.example') $fnEnv }
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root'; pnpm functions:serve" | Out-Null
Write-Host '▶ Edge Functions starting in a new window'

# 3. Emulator
$devices = (adb devices) -match "`tdevice$"
if (-not $devices) {
  Write-Host '▶ Booting emulator BibleFriend_Pixel…'
  Start-Process "$sdk\emulator\emulator.exe" -ArgumentList '-avd', 'BibleFriend_Pixel', '-netdelay', 'none', '-netspeed', 'full' | Out-Null
  adb wait-for-device
  do { Start-Sleep -Seconds 2; $boot = (adb shell getprop sys.boot_completed 2>$null) } until ($boot -match '1')
}

# 4. Build, install and start Metro
Set-Location (Join-Path $root 'apps\mobile')
npx expo run:android

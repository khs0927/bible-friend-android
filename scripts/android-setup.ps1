# One-time Android emulator setup (Windows).
#   pnpm android:setup
# Installs the SDK packages this app needs (if missing) and creates the
# "BibleFriend_Pixel" emulator. Safe to run again.
$ErrorActionPreference = 'Stop'

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User') }
if (-not $sdk -or -not (Test-Path "$sdk\cmdline-tools\latest\bin\sdkmanager.bat")) {
  Write-Error "ANDROID_HOME is not set or cmdline-tools are missing. See docs/LOCAL_DEVELOPMENT.md."
}
if (-not $env:ANDROID_AVD_HOME) { $env:ANDROID_AVD_HOME = [Environment]::GetEnvironmentVariable('ANDROID_AVD_HOME', 'User') }

$sdkmanager = "$sdk\cmdline-tools\latest\bin\sdkmanager.bat"
$avdmanager = "$sdk\cmdline-tools\latest\bin\avdmanager.bat"
$image = 'system-images;android-36;google_apis_playstore;x86_64'
$packages = @('platform-tools', 'emulator', 'platforms;android-36', 'build-tools;36.0.0', 'ndk;27.1.12297006', 'cmake;3.22.1', $image)

$missing = $packages | Where-Object { -not (Test-Path (Join-Path $sdk ($_ -replace ';', '\'))) }
if ($missing) {
  Write-Host "Installing: $($missing -join ', ')"
  $missing | ForEach-Object { 'y' } | & $sdkmanager --sdk_root=$sdk @missing
}

$avdName = 'BibleFriend_Pixel'
$existing = & "$sdk\emulator\emulator.exe" -list-avds
if ($existing -notcontains $avdName) {
  Write-Host "Creating emulator $avdName"
  'no' | & $avdmanager create avd --name $avdName --package $image --device 'pixel_8' --force
  $config = Join-Path $env:ANDROID_AVD_HOME "$avdName.avd\config.ini"
  if (Test-Path $config) {
    # Hardware keyboard + 4GB RAM + larger data partition for dev builds.
    Add-Content $config "hw.keyboard=yes`nhw.ramSize=4096`ndisk.dataPartition.size=8G`nhw.audioInput=yes"
  }
}

Write-Host ''
Write-Host 'Acceleration check:'
& "$sdk\emulator\emulator.exe" -accel-check
Write-Host ''
Write-Host "Done. Start everything with: pnpm android:dev"

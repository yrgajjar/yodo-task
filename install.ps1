# install.ps1 - Production installer for YoDo Task (Windows)
# Builds an Electron NSIS installer so global hotkeys and app list integration work properly.

Write-Host "==========================================" -ForegroundColor Green
Write-Host "    Installing YoDo Task (Windows)        " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Repository configuration
$GITHUB_REPO = "yrgajjar/yodo-task"

# Helper: pause before exit so user can read logs
function Exit-With-Pause ($code) {
  Write-Host ""
  Write-Host "Press any key to close this window..." -ForegroundColor Yellow
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
  Exit $code
}

# ── 1. Check / Install Node.js ────────────────────────────────────────────
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
  Write-Host "Node.js not found. Downloading and installing Node.js 20 LTS..." -ForegroundColor Yellow
  $msiPath = "$env:TEMP\node-install.msi"
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.14.0/node-v20.14.0-x64.msi" -OutFile $msiPath
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msiPath`" /qn /norestart ADDLOCAL=ALL" -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
      Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msiPath`"" -Wait
    }
  } catch {
    Write-Host "ERROR: Could not download/install Node.js: $($_.Exception.Message)" -ForegroundColor Red
    Exit-With-Pause 1
  } finally {
    if (Test-Path $msiPath) { Remove-Item -Path $msiPath -Force }
  }
  # Refresh PATH
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  $nodeCheck = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCheck) {
    Write-Host "ERROR: Node.js installed but 'node' command still not found. Please restart and re-run." -ForegroundColor Red
    Exit-With-Pause 1
  }
  Write-Host "Node.js installed successfully!" -ForegroundColor Green
}

# Refresh PATH once more to ensure npm is available
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCheck) {
  Write-Host "ERROR: npm not found. Please install Node.js 20+ from https://nodejs.org and re-run." -ForegroundColor Red
  Exit-With-Pause 1
}

Write-Host "Node.js: $(node -v)   npm: $(npm -v)" -ForegroundColor Cyan

# ── 2. Stop any running instances ─────────────────────────────────────────
Write-Host "Stopping any running YoDo Task instances..." -ForegroundColor Cyan
try {
  Get-Process -Name "Yodo Task","yodo-task","electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*yodo-task*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch {}
Start-Sleep -Seconds 1

# ── 3. Download and extract source ────────────────────────────────────────
$buildDir = "$env:LOCALAPPDATA\yodo-task-build"
$zipPath  = "$env:TEMP\yodo-task-$(Get-Random).zip"
$tmpDir   = "$env:TEMP\yodo-task-tmp-$(Get-Random)"

Write-Host "Downloading source from GitHub ($GITHUB_REPO)..." -ForegroundColor Cyan
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri "https://github.com/$GITHUB_REPO/archive/refs/heads/main.zip" -OutFile $zipPath
} catch {
  Write-Host "ERROR: Download failed: $($_.Exception.Message)" -ForegroundColor Red
  Exit-With-Pause 1
}

Write-Host "Extracting source..." -ForegroundColor Cyan
try {
  Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force
  if (Test-Path $buildDir) { Remove-Item -Path $buildDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
  $extracted = Get-ChildItem -Path $tmpDir | Select-Object -First 1
  Copy-Item -Path "$($extracted.FullName)\*" -Destination $buildDir -Recurse -Force
} catch {
  Write-Host "ERROR: Extraction failed: $($_.Exception.Message)" -ForegroundColor Red
  Exit-With-Pause 1
} finally {
  if (Test-Path $tmpDir)   { Remove-Item -Path $tmpDir   -Recurse -Force }
  if (Test-Path $zipPath)  { Remove-Item -Path $zipPath  -Force }
}

# ── 4. npm install ────────────────────────────────────────────────────────
Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
Set-Location $buildDir
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: npm install failed." -ForegroundColor Red
  Exit-With-Pause 1
}

# ── 5. Build React bundle ─────────────────────────────────────────────────
Write-Host "Building React UI bundle..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Vite build failed." -ForegroundColor Red
  Exit-With-Pause 1
}

# ── 6. Rebuild native SQLite for Electron ─────────────────────────────────
Write-Host "Rebuilding better-sqlite3 for Electron..." -ForegroundColor Cyan
npm rebuild better-sqlite3
if ($LASTEXITCODE -ne 0) {
  # Try electron-rebuild as fallback
  & ".\node_modules\.bin\electron-rebuild.cmd" -f -w better-sqlite3
}

# ── 7. Build NSIS installer with electron-builder ────────────────────────
Write-Host "Building Electron NSIS installer..." -ForegroundColor Cyan
npm run package:win
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: electron-builder packaging failed." -ForegroundColor Red
  Exit-With-Pause 1
}

# ── 8. Run the NSIS installer silently ────────────────────────────────────
$nsisExe = Get-ChildItem -Path "$buildDir\dist-packaged" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $nsisExe) {
  Write-Host "ERROR: NSIS .exe installer not found in dist-packaged/." -ForegroundColor Red
  Exit-With-Pause 1
}

Write-Host "Installing Yodo Task via NSIS installer: $($nsisExe.FullName)" -ForegroundColor Cyan
Write-Host "(This installs to Program Files and adds Start Menu + Desktop shortcuts)" -ForegroundColor Gray
$proc = Start-Process -FilePath $nsisExe.FullName -ArgumentList "/S" -Wait -PassThru
if ($proc.ExitCode -ne 0) {
  Write-Host "Warning: NSIS installer exited with code $($proc.ExitCode). Trying interactive mode..." -ForegroundColor Yellow
  Start-Process -FilePath $nsisExe.FullName -Wait
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  YoDo Task installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  - Open from: Start Menu or Desktop shortcut 'Yodo Task'" -ForegroundColor White
Write-Host "  - Global hotkeys work once the app is running:" -ForegroundColor White
Write-Host "      Ctrl+Shift+Space  → Mini Todo Popup" -ForegroundColor Cyan
Write-Host "      Ctrl+Shift+A      → Quick Add Task" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Green

# ── 9. Launch the app ─────────────────────────────────────────────────────
Write-Host "Launching Yodo Task..." -ForegroundColor Cyan
$installedExe = @(
  "$env:LOCALAPPDATA\Programs\yodo-task\Yodo Task.exe",
  "$env:ProgramFiles\Yodo Task\Yodo Task.exe",
  "${env:ProgramFiles(x86)}\Yodo Task\Yodo Task.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($installedExe) {
  Start-Process -FilePath $installedExe
} else {
  Write-Host "App installed. Open it from the Start Menu or Desktop shortcut." -ForegroundColor Yellow
}

Exit-With-Pause 0

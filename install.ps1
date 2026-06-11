# install.ps1 - Production installer script for YoDo Task (Windows)

Write-Host "==========================================" -ForegroundColor Green
Write-Host "    Installing YoDo Task (Windows)        " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Repository configuration (can be updated for user fork)
$GITHUB_REPO = "yodo/task"

# 1. Check if Node.js is installed
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
  Write-Host "Error: Node.js is not installed." -ForegroundColor Red
  Write-Host "Please install Node.js (version 18 or newer) and run this script again." -ForegroundColor Yellow
  Write-Host "You can download Node.js from https://nodejs.org" -ForegroundColor Yellow
  Exit 1
}

# 2. Check if npm is installed
$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCheck) {
  Write-Host "Error: npm is not installed. Please install npm and try again." -ForegroundColor Red
  Exit 1
}

Write-Host "Node.js detected: $(node -v)"
Write-Host "npm detected: $(npm -v)"

# 3. Target directory (Production Safe: AppData)
$installDir = "$env:LOCALAPPDATA\yodo-task"
Write-Host "Creating installation directory: $installDir..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# 4. Download and extract codebase from GitHub
Write-Host "Downloading codebase from GitHub ($GITHUB_REPO)..." -ForegroundColor Cyan
$zipPath = "$env:TEMP\yodo-task-$(Get-Random).zip"
$tempExtractDir = "$env:TEMP\yodo-task-temp-$(Get-Random)"

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri "https://github.com/$GITHUB_REPO/archive/refs/heads/main.zip" -OutFile $zipPath
} catch {
  Write-Host "Error: Failed to download source zip from GitHub." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  Exit 1
}

Write-Host "Extracting archive..." -ForegroundColor Cyan
try {
  Expand-Archive -Path $zipPath -DestinationPath $tempExtractDir -Force
  
  # Clean up existing files in target dir
  Get-ChildItem -Path $installDir | Remove-Item -Recurse -Force
  
  # Move extracted files to target directory (strip top-level directory wrapper)
  $extractedRoot = Get-ChildItem -Path $tempExtractDir | Select-Object -First 1
  Copy-Item -Path "$($extractedRoot.FullName)\*" -Destination $installDir -Recurse -Force
} catch {
  Write-Host "Error: Failed to extract and install files." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  Exit 1
} finally {
  # Clean up temporary files
  if (Test-Path $tempExtractDir) { Remove-Item -Path $tempExtractDir -Recurse -Force }
  if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force }
}

# 5. Install dependencies and compile
Write-Host "Installing application dependencies..." -ForegroundColor Cyan
Set-Location $installDir
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "Error: npm install failed." -ForegroundColor Red
  Exit 1
}

Write-Host "Building React static distribution..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Error: Vite build failed." -ForegroundColor Red
  Exit 1
}

Write-Host "Rebuilding better-sqlite3 native module..." -ForegroundColor Cyan
npm rebuild better-sqlite3
if ($LASTEXITCODE -ne 0) {
  Write-Host "Error: Native module rebuild failed." -ForegroundColor Red
  Exit 1
}

# 6. Create global command (yodo-task.cmd) inside installation directory and add to Path
Write-Host "Creating command launcher (yodo-task.cmd)..." -ForegroundColor Cyan
$cmdContent = @"
@echo off
set PORT=%PORT%
if "%PORT%"=="" set PORT=54321
start http://localhost:%PORT%
node "%~dp0src\main\server.js" %*
"@
$cmdContent | Out-File -FilePath "$installDir\yodo-task.cmd" -Encoding ASCII

# Append installation directory to the User Path environment variable if not already present
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
  Write-Host "Registering global 'yodo-task' command to User PATH environment variable..." -ForegroundColor Cyan
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
  # Update local session path variable
  $env:Path += ";$installDir"
}

# 7. Configure autostart in Windows Startup Folder
Write-Host "Configuring boot autostart..." -ForegroundColor Cyan
try {
  $StartupFolder = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Startup'), 'YoDo Task.lnk')
  $WshShell = New-Object -ComObject WScript.Shell
  $Shortcut = $WshShell.CreateShortcut($StartupFolder)
  $Shortcut.TargetPath = "cmd.exe"
  $Shortcut.Arguments = "/c yodo-task"
  $Shortcut.WorkingDirectory = $installDir
  $Shortcut.Description = "Start YoDo Task Local ToDo App"
  $Shortcut.WindowStyle = 7 # Minimized/Hidden
  $Shortcut.Save()
  Write-Host "Autostart shortcut created in Windows Startup Folder." -ForegroundColor Green
} catch {
  Write-Host "Warning: Failed to configure autostart shortcut." -ForegroundColor Yellow
}

# 8. Start the application
Write-Host "Starting YoDo Task..." -ForegroundColor Cyan
Start-Process "cmd.exe" -ArgumentList "/c yodo-task" -WindowStyle Hidden

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Installation complete! YoDo Task is ready." -ForegroundColor Green
Write-Host "You can now run 'yodo-task' in any command prompt." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

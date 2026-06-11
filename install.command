#!/bin/bash

# install.command - Production installer script for YoDo Task (macOS)

echo "=========================================="
echo "    Installing YoDo Task (macOS)          "
echo "=========================================="

# Repository configuration (can be updated for user fork)
GITHUB_REPO="yrgajjar/yodo-task"

# 1. Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed."
  echo "Please install Node.js (version 18 or newer) and run this script again."
  echo "You can install Node.js using Homebrew: brew install node"
  echo "Or download the installer from https://nodejs.org"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed. Please install npm and try again."
  exit 1
fi

echo "Node.js detected: $(node -v)"
echo "npm detected: $(npm -v)"

# 2. Target installation directory
echo "Creating installation directory in /usr/local/yodo-task..."
sudo mkdir -p /usr/local/yodo-task

# 3. Download and extract codebase from GitHub
echo "Downloading codebase from GitHub ($GITHUB_REPO)..."
TEMP_TAR="/tmp/yodo-task-$(date +%s).tar.gz"

if command -v curl &> /dev/null; then
  curl -L -s "https://github.com/$GITHUB_REPO/archive/refs/heads/main.tar.gz" -o "$TEMP_TAR"
elif command -v wget &> /dev/null; then
  wget -q "https://github.com/$GITHUB_REPO/archive/refs/heads/main.tar.gz" -O "$TEMP_TAR"
else
  echo "Error: Neither curl nor wget is installed. Cannot download source code."
  exit 1
fi

if [ ! -f "$TEMP_TAR" ] || [ ! -s "$TEMP_TAR" ]; then
  echo "Error: Failed to download the source code archive from GitHub."
  exit 1
fi

echo "Extracting codebase..."
sudo rm -rf /usr/local/yodo-task/*
sudo tar -xzf "$TEMP_TAR" -C /usr/local/yodo-task --strip-components=1
rm -f "$TEMP_TAR"

# 4. Fix permissions
echo "Setting permissions for /usr/local/yodo-task..."
sudo chown -R "$USER" /usr/local/yodo-task

# 5. Install dependencies and compile
echo "Installing application dependencies..."
cd /usr/local/yodo-task || exit 1

npm install
if [ $? -ne 0 ]; then
  echo "Error: npm install failed. Please verify Xcode command line tools are installed (xcode-select --install)."
  exit 1
fi

echo "Building React static distribution..."
npm run build
if [ $? -ne 0 ]; then
  echo "Error: Vite build failed."
  exit 1
fi

echo "Rebuilding better-sqlite3 native module..."
npm rebuild better-sqlite3
if [ $? -ne 0 ]; then
  echo "Error: Native module rebuild failed."
  exit 1
fi

# 6. Configure LaunchAgent boot autostart
echo "Configuring boot autostart LaunchAgent..."
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENT_DIR"

NODE_PATH=$(command -v node)

cat <<EOF > "$LAUNCH_AGENT_DIR/com.yodotask.app.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yodotask.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>/usr/local/yodo-task/src/main/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/usr/local/yodo-task</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>54321</string>
    </dict>
</dict>
</plist>
EOF

# Load and start LaunchAgent immediately
launchctl unload "$LAUNCH_AGENT_DIR/com.yodotask.app.plist" >/dev/null 2>&1 || true
launchctl load "$LAUNCH_AGENT_DIR/com.yodotask.app.plist"

# 7. Create global command (yodo-task) to control daemon and launch web UI
echo "Creating global launcher command /usr/local/bin/yodo-task..."
cat <<EOF | sudo tee /usr/local/bin/yodo-task > /dev/null
#!/bin/bash
# yodo-task - Controlling script for YoDo Task

# Ensure LaunchAgent is active/running
launchctl list com.yodotask.app >/dev/null 2>&1
if [ \$? -ne 0 ]; then
  echo "Starting background LaunchAgent..."
  launchctl load "$HOME/Library/LaunchAgents/com.yodotask.app.plist" 2>/dev/null
  launchctl start com.yodotask.app 2>/dev/null
  sleep 1.5
fi

# Open browser
if command -v open > /dev/null; then
  open "http://localhost:54321"
fi
EOF

sudo chmod +x /usr/local/bin/yodo-task

echo "=========================================="
echo "Installation complete! YoDo Task is ready."
echo "You can now run 'yodo-task' from anywhere."
echo "The application runs as a background LaunchAgent daemon."
echo "  - Start:   launchctl start com.yodotask.app"
echo "  - Stop:    launchctl stop com.yodotask.app"
echo "=========================================="
exit 0

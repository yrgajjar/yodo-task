#!/bin/bash
# install.sh - Production installer script for YoDo Task (Linux)

echo "=========================================="
# shellcheck disable=SC2154
echo "    Installing YoDo Task (Linux/Ubuntu)   "
echo "=========================================="

# Repository configuration (can be updated for user fork)
GITHUB_REPO="yrgajjar/yodo-task"

# 1. Accept port as argument (defaults to 54321)
PORT="${1:-54321}"
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Error: Port must be a numeric value."
  exit 1
fi

echo "Configuration: Port set to $PORT"

# 2. Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed."
  echo "Please install Node.js (version 18 or newer) and try again."
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed."
  echo "Please install npm and try again."
  exit 1
fi

echo "Node.js detected: $(node -v)"
echo "npm detected: $(npm -v)"

# 3. Create target directory
echo "Creating installation directory in /opt/yodo-task..."
sudo mkdir -p /opt/yodo-task

# 4. Download and extract codebase from GitHub
echo "Downloading codebase from GitHub ($GITHUB_REPO)..."
TEMP_TAR="/tmp/yodo-task-$(date +%s).tar.gz"

if command -v curl &> /dev/null; then
  curl -L -s "https://github.com/$GITHUB_REPO/archive/refs/heads/main.tar.gz" -o "$TEMP_TAR"
elif command -v wget &> /dev/null; then
  wget -q "https://github.com/$GITHUB_REPO/archive/refs/heads/main.tar.gz" -O "$TEMP_TAR"
else
  echo "Error: Neither curl nor wget is installed. Cannot download application source."
  exit 1
fi

if [ ! -f "$TEMP_TAR" ] || [ ! -s "$TEMP_TAR" ]; then
  echo "Error: Failed to download the source code archive from GitHub."
  exit 1
fi

echo "Extracting codebase..."
sudo rm -rf /opt/yodo-task/*
sudo tar -xzf "$TEMP_TAR" -C /opt/yodo-task --strip-components=1
rm -f "$TEMP_TAR"

# 5. Fix permissions
echo "Setting permissions for /opt/yodo-task..."
sudo chown -R "$USER":"$USER" /opt/yodo-task

# 6. Install dependencies and compile
echo "Installing application dependencies..."
cd /opt/yodo-task || exit 1

npm install
if [ $? -ne 0 ]; then
  echo "Error: npm install failed."
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
  echo "Error: Rebuilding better-sqlite3 failed."
  exit 1
fi

# 7. Configure systemd user service
echo "Configuring persistent user-level systemd daemon..."
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"

NODE_PATH=$(command -v node)

cat <<EOF > "$SYSTEMD_USER_DIR/yodo-task.service"
[Unit]
Description=YoDo Task Manager Daemon
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/yodo-task
ExecStart=$NODE_PATH src/main/server.js
Restart=always
RestartSec=5
Environment=PORT=$PORT

[Install]
WantedBy=default.target
EOF

# Reload and enable/start the service
systemctl --user daemon-reload
systemctl --user enable yodo-task.service
systemctl --user restart yodo-task.service

# Enable linger so user-level services run at boot without active sessions
sudo loginctl enable-linger "$USER" 2>/dev/null || true

# 8. Create global command (yodo-task) to control daemon and launch web UI
echo "Creating global command /usr/local/bin/yodo-task..."
cat <<EOF | sudo tee /usr/local/bin/yodo-task > /dev/null
#!/bin/bash
# yodo-task - Controlling script for YoDo Task

# Ensure systemd user service is running
systemctl --user is-active --quiet yodo-task
if [ \$? -ne 0 ]; then
  echo "Starting background daemon..."
  systemctl --user start yodo-task
  sleep 1
fi

PORT=\$(systemctl --user show yodo-task -p Environment | grep -o -E 'PORT=[0-9]+' | cut -d= -f2)
if [ -z "\$PORT" ]; then
  PORT=$PORT
fi

# Auto-open browser
if command -v xdg-open > /dev/null; then
  xdg-open "http://localhost:\$PORT"
elif command -v sensible-browser > /dev/null; then
  sensible-browser "http://localhost:\$PORT"
fi
EOF

sudo chmod +x /usr/local/bin/yodo-task

echo "=========================================="
echo "Installation complete! YoDo Task is ready."
echo "You can now run 'yodo-task' from anywhere."
echo "The application runs as a persistent service."
echo "  - Start:   systemctl --user start yodo-task"
echo "  - Stop:    systemctl --user stop yodo-task"
echo "  - Logs:    journalctl --user -u yodo-task -f"
echo "=========================================="
exit 0

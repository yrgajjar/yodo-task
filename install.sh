#!/bin/bash
# install.sh - Production installer for YoDo Task (Linux/Ubuntu)
# Builds an Electron .deb package so global hotkeys and desktop integration work properly.

set -e

echo "=========================================="
echo "    Installing YoDo Task (Linux/Ubuntu)   "
echo "=========================================="

GITHUB_REPO="yrgajjar/yodo-task"
INSTALL_SRC="/opt/yodo-task-src"
DEB_OUT="$INSTALL_SRC/dist-packaged"

# ── 1. Check Node.js + npm ─────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "Node.js is not installed. Attempting to install via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
  echo "ERROR: Node.js / npm could not be installed. Please install Node.js 20+ manually."
  exit 1
fi

echo "Node.js: $(node -v)   npm: $(npm -v)"

# ── 2. Install system build dependencies (needed by better-sqlite3 + electron-builder) ──
echo "Installing required system dependencies..."
sudo apt-get install -y build-essential libsqlite3-dev rpm fakeroot dpkg 2>/dev/null || true

# ── 3. Download source from GitHub ────────────────────────────────────────
echo "Stopping any running YoDo Task instances..."
pkill -f "yodo-task" 2>/dev/null || true
pkill -f "electron"  2>/dev/null || true
sleep 1

echo "Downloading source from GitHub ($GITHUB_REPO)..."
TEMP_TAR="/tmp/yodo-task-$(date +%s).tar.gz"

if command -v curl &> /dev/null; then
  curl -L -s "https://github.com/$GITHUB_REPO/archive/refs/heads/main.tar.gz" -o "$TEMP_TAR"
else
  wget -q "https://github.com/$GITHUB_REPO/archive/refs/heads/main.tar.gz" -O "$TEMP_TAR"
fi

if [ ! -s "$TEMP_TAR" ]; then
  echo "ERROR: Failed to download source archive from GitHub."
  exit 1
fi

echo "Extracting source..."
sudo rm -rf "$INSTALL_SRC"
sudo mkdir -p "$INSTALL_SRC"
sudo tar -xzf "$TEMP_TAR" -C "$INSTALL_SRC" --strip-components=1
rm -f "$TEMP_TAR"
sudo chown -R "$USER":"$USER" "$INSTALL_SRC"

# ── 4. Install npm dependencies ────────────────────────────────────────────
echo "Installing npm dependencies..."
cd "$INSTALL_SRC"
npm install

# ── 5. Build React renderer ────────────────────────────────────────────────
echo "Building React UI bundle..."
npm run build

# ── 6. Rebuild native SQLite module for Electron ──────────────────────────
echo "Rebuilding better-sqlite3 for Electron..."
npm rebuild better-sqlite3 || ./node_modules/.bin/electron-rebuild -f -w better-sqlite3

# ── 7. Package Electron app as .deb ───────────────────────────────────────
echo "Packaging Electron desktop app (.deb)..."
npm run package:linux

# Find the generated .deb
DEB_FILE=$(find "$DEB_OUT" -maxdepth 1 -name "*.deb" | head -n 1)
if [ -z "$DEB_FILE" ]; then
  echo "ERROR: .deb package was not produced. Check electron-builder output above."
  exit 1
fi

echo "Installing .deb package: $DEB_FILE"
sudo dpkg -i "$DEB_FILE"
# Fix any missing dependencies
sudo apt-get install -f -y 2>/dev/null || true

# ── 8. Create .desktop entry (redundant if .deb already does it, but ensures it) ──
DESKTOP_ENTRY_PATH="/usr/share/applications/yodo-task.desktop"
if [ ! -f "$DESKTOP_ENTRY_PATH" ]; then
  echo "Creating desktop application entry..."
  INSTALLED_BIN=$(find /opt /usr -name "yodo-task" -type f -executable 2>/dev/null | head -n 1)
  INSTALLED_ICON=$(find /opt /usr -name "icon.png" -path "*/yodo*" 2>/dev/null | head -n 1)
  if [ -n "$INSTALLED_BIN" ]; then
    sudo tee "$DESKTOP_ENTRY_PATH" > /dev/null <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=YoDo Task
Comment=A local-first ToDo app with global hotkeys
Exec=$INSTALLED_BIN
Icon=${INSTALLED_ICON:-yodo-task}
StartupNotify=true
Terminal=false
Categories=Office;Utility;
Keywords=todo;task;productivity;
EOF
    sudo chmod 644 "$DESKTOP_ENTRY_PATH"
    echo "Desktop entry created at $DESKTOP_ENTRY_PATH"
  fi
fi

# Update icon/desktop caches
sudo update-desktop-database /usr/share/applications/ 2>/dev/null || true
gtk-update-icon-cache 2>/dev/null || true

echo "=========================================="
echo "  YoDo Task installed successfully!"
echo ""
echo "  Open from: Application Menu → YoDo Task"
echo "  Or run:    yodo-task"
echo ""
echo "  Global hotkeys (Ctrl+Shift+Space / Ctrl+Shift+A)"
echo "  will work system-wide once the app is open."
echo "=========================================="

# ── 9. Launch the app immediately ─────────────────────────────────────────
echo "Launching YoDo Task..."
INSTALLED_BIN=$(find /opt /usr -name "yodo-task" -type f -executable 2>/dev/null | head -n 1)
if [ -n "$INSTALLED_BIN" ]; then
  nohup "$INSTALLED_BIN" > /dev/null 2>&1 &
else
  echo "App installed. Open it from your Application Menu."
fi

exit 0

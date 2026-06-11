#!/bin/bash
# install.command - Production installer for YoDo Task (macOS)
# Builds an Electron DMG and installs the .app to /Applications.

set -e

echo "=========================================="
echo "    Installing YoDo Task (macOS)          "
echo "=========================================="

GITHUB_REPO="yrgajjar/yodo-task"
INSTALL_SRC="$HOME/.yodo-task-build"
APP_NAME="Yodo Task.app"
APPS_DIR="/Applications"

# ── 1. Check Node.js / npm ─────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "Node.js not found."
  if command -v brew &> /dev/null; then
    echo "Installing via Homebrew..."
    brew install node
  else
    echo "ERROR: Please install Node.js 20+ from https://nodejs.org and re-run."
    exit 1
  fi
fi

echo "Node.js: $(node -v)   npm: $(npm -v)"

# ── 2. Install system build tools ─────────────────────────────────────────
xcode-select --install 2>/dev/null || true

# ── 3. Stop any running instances ─────────────────────────────────────────
echo "Stopping any running YoDo Task instances..."
pkill -f "Yodo Task" 2>/dev/null || true
pkill -f "electron"  2>/dev/null || true
launchctl remove com.yodotask.app 2>/dev/null || true
sleep 1

# ── 4. Download source ────────────────────────────────────────────────────
echo "Downloading source from GitHub ($GITHUB_REPO)..."
TEMP_TAR="/tmp/yodo-task-$(date +%s).tar.gz"

curl -L -s "https://github.com/$GITHUB_REPO/archive/refs/heads/main.tar.gz" -o "$TEMP_TAR"

if [ ! -s "$TEMP_TAR" ]; then
  echo "ERROR: Download failed."
  exit 1
fi

echo "Extracting source..."
rm -rf "$INSTALL_SRC"
mkdir -p "$INSTALL_SRC"
tar -xzf "$TEMP_TAR" -C "$INSTALL_SRC" --strip-components=1
rm -f "$TEMP_TAR"

# ── 5. Install npm deps ────────────────────────────────────────────────────
echo "Installing npm dependencies..."
cd "$INSTALL_SRC"
npm install

# ── 6. Build React UI ─────────────────────────────────────────────────────
echo "Building React UI bundle..."
npm run build

# ── 7. Rebuild native SQLite for Electron ─────────────────────────────────
echo "Rebuilding better-sqlite3 for Electron..."
npm rebuild better-sqlite3 || ./node_modules/.bin/electron-rebuild -f -w better-sqlite3

# ── 8. Build .dmg with electron-builder ───────────────────────────────────
echo "Building Electron DMG package..."
npm run package:mac

DMG_FILE=$(find "$INSTALL_SRC/dist-packaged" -maxdepth 1 -name "*.dmg" | head -n 1)
if [ -z "$DMG_FILE" ]; then
  echo "ERROR: .dmg was not produced. Check electron-builder output."
  exit 1
fi

# ── 9. Mount DMG and copy .app to /Applications ───────────────────────────
echo "Installing $APP_NAME to $APPS_DIR..."
MOUNT_POINT=$(hdiutil attach "$DMG_FILE" -nobrowse -readonly | grep Volumes | awk '{print $NF}')

if [ -d "$APPS_DIR/$APP_NAME" ]; then
  rm -rf "$APPS_DIR/$APP_NAME"
fi

cp -R "$MOUNT_POINT/$APP_NAME" "$APPS_DIR/"
hdiutil detach "$MOUNT_POINT" -quiet

echo "$APP_NAME installed to $APPS_DIR"

# ── 10. Register LaunchAgent for login autostart ───────────────────────────
echo "Configuring login autostart..."
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_AGENT_DIR/com.yodotask.app.plist"
mkdir -p "$LAUNCH_AGENT_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yodotask.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>open</string>
        <string>-a</string>
        <string>$APPS_DIR/$APP_NAME</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOF

launchctl load "$PLIST" 2>/dev/null || true

echo "=========================================="
echo "  YoDo Task installed successfully!"
echo ""
echo "  Open from: Launchpad → Yodo Task"
echo "  Or run:    open -a 'Yodo Task'"
echo ""
echo "  Global hotkeys (Ctrl+Shift+Space / Ctrl+Shift+A)"
echo "  work system-wide once the app is running."
echo "=========================================="

# ── 11. Launch the app immediately ─────────────────────────────────────────
echo "Launching Yodo Task..."
open -a "$APPS_DIR/$APP_NAME" &

exit 0

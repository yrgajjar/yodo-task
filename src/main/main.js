const { app, BrowserWindow, ipcMain, globalShortcut, Notification, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = require('url');
const db = require('./db');
const server = require('./server');

app.isQuitting = false;
let mainWindow = null;
let miniWindow = null;
let quickAddWindow = null;
let tray = null;

const distExists = fs.existsSync(path.join(__dirname, '../../dist/renderer/index.html'));
const isDev = !app.isPackaged && !distExists;

/**
 * Configure auto-start on boot for Windows, macOS, and Ubuntu.
 * @param {boolean} enabled 
 */
function configureAutostart(enabled) {
  const appPath = app.getPath('exe');
  const appName = 'YoDo Task';

  if (process.platform === 'linux') {
    const autostartDir = path.join(os.homedir(), '.config', 'autostart');
    const desktopFilePath = path.join(autostartDir, 'yodo-task.desktop');

    if (enabled) {
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true });
      }
      const desktopContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=${appName}
Comment=YoDo Task ToDo Application
Exec="${appPath}"
StartupNotify=false
Terminal=false
`;
      fs.writeFileSync(desktopFilePath, desktopContent, 'utf-8');
      console.log('[Autostart] Linux .desktop entry created.');
    } else {
      if (fs.existsSync(desktopFilePath)) {
        fs.unlinkSync(desktopFilePath);
        console.log('[Autostart] Linux .desktop entry removed.');
      }
    }
  } else if (process.platform === 'win32') {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: appPath
      });
      console.log(`[Autostart] Windows startup configuration set to: ${enabled}`);
    } catch (err) {
      console.error('[Autostart] Failed to set Windows login item settings:', err);
    }
  } else if (process.platform === 'darwin') {
    const autostartDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistPath = path.join(autostartDir, 'com.yodotask.app.plist');

    if (enabled) {
      try {
        if (!fs.existsSync(autostartDir)) {
          fs.mkdirSync(autostartDir, { recursive: true });
        }
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yodotask.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>${appPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>`;
        fs.writeFileSync(plistPath, plistContent, 'utf-8');
        console.log('[Autostart] macOS LaunchAgent plist created.');
      } catch (err) {
        console.error('[Autostart] Failed to create macOS LaunchAgent plist:', err);
      }
    } else {
      if (fs.existsSync(plistPath)) {
        try {
          fs.unlinkSync(plistPath);
          console.log('[Autostart] macOS LaunchAgent plist removed.');
        } catch (err) {
          console.error('[Autostart] Failed to remove macOS LaunchAgent plist:', err);
        }
      }
    }
  }
}

/**
 * Create the main full-screen dashboard window
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: 'YoDo Task',
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Intercept close events to hide to tray
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      const settings = db.getSettings();
      const closeToTray = (settings.close_to_tray === 'true' || settings.close_to_tray === true);
      if (closeToTray) {
        event.preventDefault();
        mainWindow.hide();
        return false;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (miniWindow) {
      miniWindow.close();
    }
    if (quickAddWindow) {
      quickAddWindow.close();
    }
    if (!app.isQuitting) {
      app.quit();
    }
  });
}

/**
 * Create the spotlight-like floating mini window
 */
function createMiniWindow() {
  miniWindow = new BrowserWindow({
    width: 500,
    height: 400,
    frame: false,
    resizable: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    miniWindow.loadURL('http://localhost:5173?window=mini');
  } else {
    const filePath = path.resolve(__dirname, '../../dist/renderer/index.html');
    const miniUrl = url.format({
      pathname: filePath,
      protocol: 'file:',
      slashes: true,
      query: { window: 'mini' }
    });
    miniWindow.loadURL(miniUrl);
  }

  // Hide the window automatically when focus is lost
  miniWindow.on('blur', () => {
    if (miniWindow) {
      miniWindow.hide();
    }
  });

  miniWindow.on('closed', () => {
    miniWindow = null;
  });
}

/**
 * Create the spotlight-like floating quick add window
 */
function createQuickAddWindow() {
  quickAddWindow = new BrowserWindow({
    width: 500,
    height: 100,
    frame: false,
    resizable: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    quickAddWindow.loadURL('http://localhost:5173?window=quickadd');
  } else {
    const filePath = path.resolve(__dirname, '../../dist/renderer/index.html');
    const quickAddUrl = url.format({
      pathname: filePath,
      protocol: 'file:',
      slashes: true,
      query: { window: 'quickadd' }
    });
    quickAddWindow.loadURL(quickAddUrl);
  }

  quickAddWindow.on('blur', () => {
    if (quickAddWindow) {
      quickAddWindow.hide();
    }
  });

  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });
}

function toggleQuickAddWindow() {
  if (!quickAddWindow) {
    createQuickAddWindow();
  }

  if (quickAddWindow.isVisible()) {
    quickAddWindow.hide();
  } else {
    quickAddWindow.center();
    quickAddWindow.show();
    quickAddWindow.focus();
  }
}

// Track currently active global hotkey
let activeShortcutKey = null;

/**
 * Register global shortcut. Handles conflicts and fallback alerts.
 * @param {string} shortcutStr 
 * @returns {boolean} Whether registration succeeded
 */
function registerAppShortcut(shortcutStr) {
  if (activeShortcutKey) {
    globalShortcut.unregister(activeShortcutKey);
    activeShortcutKey = null;
  }

  const primaryKey = shortcutStr || 'CommandOrControl+Alt+Y';
  console.log(`[Shortcut] Attempting to register global shortcut: ${primaryKey}`);

  let isRegistered = false;
  try {
    isRegistered = globalShortcut.register(primaryKey, () => {
      toggleMiniWindow();
    });
  } catch (err) {
    console.error(`[Shortcut] Error registering primary shortcut ${primaryKey}:`, err);
  }

  if (isRegistered) {
    activeShortcutKey = primaryKey;
    return true;
  }

  // Fallback to Ctrl+Shift+Space
  const fallbackKey = 'CommandOrControl+Shift+Space';
  console.log(`[Shortcut] Fallback: attempting to register backup shortcut: ${fallbackKey}`);
  
  let isFallbackRegistered = false;
  try {
    isFallbackRegistered = globalShortcut.register(fallbackKey, () => {
      toggleMiniWindow();
    });
  } catch (err) {
    console.error(`[Shortcut] Error registering fallback ${fallbackKey}:`, err);
  }

  if (isFallbackRegistered) {
    activeShortcutKey = fallbackKey;
    
    // Save fallback back into database
    db.saveSetting('global_shortcut', fallbackKey);
    db.addLog('SHORTCUT_FALLBACK_REGISTERED', `Primary shortcut "${primaryKey}" failed. Fell back to "${fallbackKey}".`);
    
    if (Notification.isSupported()) {
      new Notification({
        title: 'Shortcut Redirected',
        body: `The hotkey "${primaryKey}" was already taken. YoDo Task fell back to "${fallbackKey}" (Ctrl+Shift+Space).`,
        silent: false
      }).show();
    }
    return true;
  } else {
    console.error('[Shortcut] Both primary and fallback shortcuts failed to register.');
    db.addLog('SHORTCUT_REGISTRATION_FAILED', 'Failed to register both primary and fallback shortcuts.');
    
    if (Notification.isSupported()) {
      new Notification({
        title: 'Shortcut Registration Failed',
        body: 'Could not register any global shortcut key. Please configure a custom one in Settings.',
        silent: false
      }).show();
    }
    return false;
  }
}

/**
 * Toggle the visibility of the mini window
 */
function toggleMiniWindow() {
  if (!miniWindow) {
    createMiniWindow();
  }

  if (miniWindow.isVisible() && miniWindow.isFocused()) {
    miniWindow.hide();
  } else {
    miniWindow.center();
    miniWindow.show();
    miniWindow.focus();
  }
}

/**
 * Register Electron IPC handlers for communication with React
 */
function registerIpcHandlers() {
  // ToDos SQLite bindings
  ipcMain.handle('db:getTodos', () => db.getAllTodos());
  ipcMain.handle('db:addTodo', (event, todo) => db.addTodo(todo));
  ipcMain.handle('db:updateTodo', (event, id, fields) => db.updateTodo(id, fields));
  ipcMain.handle('db:deleteTodo', (event, id) => db.deleteTodo(id));

  // Settings SQLite bindings
  ipcMain.handle('db:getSettings', () => db.getSettings());
  ipcMain.handle('db:saveSetting', (event, key, value) => {
    const result = db.saveSetting(key, value);
    if (key === 'auto_start') {
      const isTrue = (value === 'true' || value === true);
      configureAutostart(isTrue);
    }
    
    // Dynamic hotkey reload on settings changes
    if (key === 'global_shortcut') {
      const success = registerAppShortcut(value);
      return { ...result, shortcutRegistrationSuccess: success };
    }
    
    return result;
  });

  // Backup and Restore bindings
  ipcMain.handle('db:exportBackup', () => db.exportBackup());
  ipcMain.handle('db:importBackup', (event, backupData) => db.importBackup(backupData));

  // Test Shortcut Handler
  ipcMain.handle('sys:testShortcut', (event, key) => {
    try {
      // If same key is active shortcut, it is valid!
      if (key === activeShortcutKey) {
        toggleMiniWindow();
        return true;
      }

      // If registered by another process, fail
      if (globalShortcut.isRegistered(key)) {
        return false;
      }

      // Try temporary registration
      const success = globalShortcut.register(key, () => {
        toggleMiniWindow();
      });

      if (success) {
        globalShortcut.unregister(key);
        toggleMiniWindow(); // Toggle to prove it worked
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Shortcut] Testing failed:', err);
      return false;
    }
  });

  // Native notification emitter
  ipcMain.on('sys:sendNotification', (event, title, body) => {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        silent: false
      }).show();
    }
  });

  // Toggle mini window always-on-top handler
  ipcMain.handle('sys:toggleAlwaysOnTop', (event, value) => {
    try {
      if (miniWindow) {
        miniWindow.setAlwaysOnTop(value);
        db.saveSetting('always_on_top', value);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[AlwaysOnTop] Failed to toggle:', err);
      return false;
    }
  });

  // Hide quick add floating window handler
  ipcMain.handle('sys:hideQuickAdd', () => {
    try {
      if (quickAddWindow) {
        quickAddWindow.hide();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[QuickAdd] Failed to hide:', err);
      return false;
    }
  });
}

/**
 * Create the system tray / menu bar icon and context menu
 */
function createTray() {
  if (tray) return;

  const iconPath = path.join(__dirname, '../../build/icon.png');
  if (!fs.existsSync(iconPath)) {
    console.error(`[Tray] Icon file not found at: ${iconPath}`);
  }

  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Yodo Task',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: 'Quick Add Task',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('sys:openCommandBar');
        } else {
          createMainWindow();
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('sys:openCommandBar');
          });
        }
      }
    },
    {
      label: 'Show Mini Popup',
      click: () => {
        toggleMiniWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Yodo Task');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (process.platform === 'darwin') {
      toggleMiniWindow();
    } else {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createMainWindow();
      }
    }
  });
}

// App Ready Lifecycle hook
app.whenReady().then(() => {
  // Portable mode check
  let dbPath;
  const exeDir = path.dirname(app.getPath('exe'));
  const portablePathInExe = path.join(exeDir, 'yodo-portable');
  const portablePathInApp = path.join(app.getAppPath(), 'yodo-portable');
  
  if (fs.existsSync(portablePathInExe)) {
    console.log('[Portable] Portable mode detected (executable directory). Storing DB locally.');
    dbPath = path.join(exeDir, 'yodo-task.db');
  } else if (fs.existsSync(portablePathInApp)) {
    console.log('[Portable] Portable mode detected (app path). Storing DB locally.');
    dbPath = path.join(app.getAppPath(), 'yodo-task.db');
  } else {
    dbPath = path.join(app.getPath('userData'), 'yodo-task.db');
  }

  // Initialize Database
  db.init(dbPath);

  // Load and apply startup registry/file options
  const settings = db.getSettings();
  const isAutostart = (settings.auto_start === 'true' || settings.auto_start === true);
  configureAutostart(isAutostart);

  // Run automatic daily backup if enabled
  if (settings.auto_backup === 'true' || settings.auto_backup === true) {
    db.backupDatabase();
  }

  // Start Express API server
  const port = parseInt(settings.port, 10) || 54321;
  server.start(port);

  // Create GUI Windows
  createMainWindow();
  createMiniWindow();

  // Create System Tray
  createTray();

  // Register dynamic global shortcut (fallback to Ctrl+Alt+Y)
  const shortcutStr = settings.global_shortcut || 'CommandOrControl+Alt+Y';
  registerAppShortcut(shortcutStr);

  // Register global shortcuts for Quick Add/Command Bar
  const quickAddShortcuts = ['CommandOrControl+Alt+A', 'CommandOrControl+Shift+A', 'CommandOrControl+Alt+K'];
  quickAddShortcuts.forEach(key => {
    try {
      globalShortcut.register(key, () => {
        toggleQuickAddWindow();
      });
      console.log(`[Shortcut] Registered global Quick Add: ${key}`);
    } catch (err) {
      console.error(`[Shortcut] Failed to register global Quick Add shortcut ${key}:`, err);
    }
  });

  // Start listener processes
  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Clean shut down logic
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  server.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

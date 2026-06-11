const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

let db = null;
let activeDbPath = null;

/**
 * Initializes the SQLite database file, tables, and runs schema migrations.
 * @param {string} [dbPath] Optional path to database file.
 */
function init(dbPath) {
  if (db) return db;
  
  let targetPath = dbPath;
  if (!targetPath) {
    const userHome = os.homedir();
    const appDir = path.join(userHome, '.yodo-task');
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }
    targetPath = path.join(appDir, 'yodo-task.db');
  } else {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  activeDbPath = targetPath;
  console.log(`[Database] Initializing SQLite database at: ${targetPath}`);
  
  try {
    db = new Database(targetPath);
    
    // Enable WAL mode for concurrency
    db.pragma('journal_mode = WAL');
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        status TEXT CHECK(status IN ('Open', 'In Progress', 'Completed', 'Canceled')) DEFAULT 'Open',
        due_date TEXT,
        priority TEXT CHECK(priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
        workspace_id INTEGER DEFAULT 1 REFERENCES workspaces(id),
        archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS command_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // Run migrations: check if columns exist in todos
    const tableInfo = db.prepare("PRAGMA table_info(todos)").all();
    
    const hasPriority = tableInfo.some(col => col.name === 'priority');
    if (!hasPriority) {
      db.exec("ALTER TABLE todos ADD COLUMN priority TEXT CHECK(priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium'");
      console.log("[Database] Migrated schema: added 'priority' column to todos table.");
    }
    
    const hasWorkspaceId = tableInfo.some(col => col.name === 'workspace_id');
    if (!hasWorkspaceId) {
      db.exec("ALTER TABLE todos ADD COLUMN workspace_id INTEGER DEFAULT 1");
      console.log("[Database] Migrated schema: added 'workspace_id' column to todos table.");
    }

    const hasArchived = tableInfo.some(col => col.name === 'archived');
    if (!hasArchived) {
      db.exec("ALTER TABLE todos ADD COLUMN archived INTEGER DEFAULT 0");
      console.log("[Database] Migrated schema: added 'archived' column to todos table.");
    }

    // Insert default workspaces
    const wsStmt = db.prepare('INSERT OR IGNORE INTO workspaces (id, name) VALUES (?, ?)');
    wsStmt.run(1, 'Personal');
    wsStmt.run(2, 'Work');
    
    // Insert default settings
    const insertStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertStmt.run('theme_color', '#6366f1'); // Default Indigo Accent
    insertStmt.run('port', '54321');
    insertStmt.run('visible_sections', JSON.stringify(['Open', 'In Progress', 'Completed', 'Canceled']));
    insertStmt.run('auto_start', 'false');
    insertStmt.run('global_shortcut', 'CommandOrControl+Alt+Y');
    insertStmt.run('close_to_tray', 'true');
    insertStmt.run('always_on_top', 'true');
    insertStmt.run('auto_backup', 'true');

    addLog('SYSTEM_BOOT', 'SQLite Database initialized successfully.');
    
  } catch (err) {
    console.error('[Database] Initialization error:', err);
    throw err;
  }
  
  return db;
}

function getDb() {
  if (!db) {
    init(); // Fallback to default
  }
  return db;
}

/**
 * Retrieve the active SQLite file path.
 */
function getDbPath() {
  return activeDbPath;
}

/**
 * Close current database connection.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[Database] Database connection closed.');
  }
}

/**
 * Add an audit log to the logs table.
 */
function addLog(action, details = null) {
  try {
    const database = getDb();
    const stmt = database.prepare('INSERT INTO logs (action, details) VALUES (?, ?)');
    stmt.run(action, details);
  } catch (err) {
    console.error('[Database] Failed to write log:', err);
  }
}

/**
 * Fetch latest audit logs.
 */
function getLogs() {
  const database = getDb();
  return database.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 500').all();
}

function getAllTodos() {
  const database = getDb();
  return database.prepare('SELECT * FROM todos ORDER BY id DESC').all();
}

function addTodo({ title, status = 'Open', dueDate = null, priority = 'Medium', workspace_id = 1, archived = 0 }) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO todos (title, status, due_date, priority, workspace_id, archived) VALUES (?, ?, ?, ?, ?, ?)');
  const info = stmt.run(title, status, dueDate, priority, workspace_id, archived);
  
  addLog('TASK_CREATED', `Created task "${title}" in workspace ${workspace_id}`);
  return database.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid);
}

function updateTodo(id, fields) {
  const database = getDb();
  
  const allowedColumns = {
    title: 'title',
    status: 'status',
    dueDate: 'due_date',
    due_date: 'due_date',
    priority: 'priority',
    workspace_id: 'workspace_id',
    workspaceId: 'workspace_id',
    archived: 'archived'
  };
  
  const updates = [];
  const values = [];
  
  for (const [key, value] of Object.entries(fields)) {
    if (allowedColumns[key]) {
      updates.push(`${allowedColumns[key]} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) {
    return database.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  }
  
  updates.push("updated_at = datetime('now', 'localtime')");
  values.push(id);
  
  const query = `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`;
  database.prepare(query).run(...values);
  
  const updated = database.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  addLog('TASK_UPDATED', `Updated task #${id}. Fields: ${JSON.stringify(fields)}`);
  return updated;
}

function deleteTodo(id) {
  const database = getDb();
  database.prepare('DELETE FROM todos WHERE id = ?').run(id);
  addLog('TASK_DELETED', `Deleted task #${id}`);
  return { id: Number(id) };
}

function getSettings() {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM settings').all();
  const settingsObj = {};
  
  rows.forEach(r => {
    try {
      settingsObj[r.key] = JSON.parse(r.value);
    } catch {
      settingsObj[r.key] = r.value;
    }
  });
  
  return settingsObj;
}

function saveSetting(key, value) {
  const database = getDb();
  const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
  database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, valStr);
  addLog('SETTING_CHANGED', `Changed setting key "${key}"`);
  return { key, value };
}

function exportBackup() {
  const database = getDb();
  const todos = database.prepare('SELECT * FROM todos').all();
  const settings = database.prepare('SELECT * FROM settings').all();
  
  addLog('BACKUP_JSON_EXPORT', 'Exported JSON backup of ToDos and Settings.');
  return {
    todos,
    settings,
    version: '1.1.0',
    exportedAt: new Date().toISOString()
  };
}

function importBackup(backupData) {
  const database = getDb();
  
  const transaction = database.transaction((data) => {
    database.prepare('DELETE FROM todos').run();
    database.prepare('DELETE FROM settings').run();
    
    if (Array.isArray(data.todos)) {
      const insertTodo = database.prepare(`
        INSERT INTO todos (id, title, status, due_date, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const todo of data.todos) {
        insertTodo.run(
          todo.id,
          todo.title,
          todo.status,
          todo.due_date || todo.due_date === null ? todo.due_date : null,
          todo.priority || 'Medium',
          todo.created_at,
          todo.updated_at
        );
      }
    }
    
    if (Array.isArray(data.settings)) {
      const insertSetting = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      for (const setting of data.settings) {
        insertSetting.run(setting.key, setting.value);
      }
    }
  });
  
  transaction(backupData);
  addLog('BACKUP_JSON_IMPORT', 'Overwrote database from JSON import.');
  return { success: true };
}

/**
 * Merges an uploaded SQLite database backup file into the active database.
 * @param {string} backupFilePath Path of the temporary database file.
 */
function mergeDatabase(backupFilePath) {
  const database = getDb();
  let backupDb = null;
  
  try {
    backupDb = new Database(backupFilePath, { readonly: true });
  } catch (err) {
    console.error('[Database] Failed to open backup db file:', err);
    throw new Error('Invalid SQLite database file.');
  }

  try {
    // Migration check on the backup database itself to avoid failures
    const backupTableInfo = backupDb.prepare("PRAGMA table_info(todos)").all();
    const backupHasPriority = backupTableInfo.some(col => col.name === 'priority');

    const backupTodos = backupDb.prepare('SELECT * FROM todos').all();
    const backupSettings = backupDb.prepare('SELECT * FROM settings').all();

    const transaction = database.transaction(() => {
      const checkStmt = database.prepare(`
        SELECT COUNT(*) as count FROM todos 
        WHERE title = ? AND (due_date = ? OR (due_date IS NULL AND ? IS NULL))
      `);
      
      const insertTodo = database.prepare(`
        INSERT INTO todos (title, status, due_date, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      let todosAdded = 0;
      for (const todo of backupTodos) {
        const check = checkStmt.get(todo.title, todo.due_date, todo.due_date);
        if (check.count === 0) {
          const priorityVal = backupHasPriority ? (todo.priority || 'Medium') : 'Medium';
          insertTodo.run(
            todo.title,
            todo.status,
            todo.due_date || null,
            priorityVal,
            todo.created_at,
            todo.updated_at
          );
          todosAdded++;
        }
      }

      const insertSetting = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
      let settingsAdded = 0;
      for (const setting of backupSettings) {
        const info = insertSetting.run(setting.key, setting.value);
        if (info.changes > 0) {
          settingsAdded++;
        }
      }

      addLog('DATABASE_MERGED', `Successfully merged backup. Added ${todosAdded} tasks, ${settingsAdded} settings.`);
    });

    transaction();
    return { success: true };
  } catch (err) {
    console.error('[Database] Error during merge transaction:', err);
    throw err;
  } finally {
    if (backupDb) {
      backupDb.close();
    }
  }
}

function getAllWorkspaces() {
  const database = getDb();
  return database.prepare('SELECT * FROM workspaces ORDER BY id ASC').all();
}

function addWorkspace(name) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO workspaces (name) VALUES (?)');
  const info = stmt.run(name);
  addLog('WORKSPACE_CREATED', `Created workspace "${name}"`);
  return { id: info.lastInsertRowid, name };
}

function deleteWorkspace(id) {
  const database = getDb();
  const transaction = database.transaction(() => {
    database.prepare('UPDATE todos SET workspace_id = 1 WHERE workspace_id = ?').run(id);
    database.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  });
  transaction();
  addLog('WORKSPACE_DELETED', `Deleted workspace #${id}`);
  return { id: Number(id) };
}

function getNotifications() {
  const database = getDb();
  return database.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all();
}

function addNotification(title, body) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO notifications (title, body) VALUES (?, ?)');
  const info = stmt.run(title, body);
  return { id: info.lastInsertRowid, title, body, read: 0 };
}

function markNotificationsRead() {
  const database = getDb();
  database.prepare('UPDATE notifications SET read = 1').run();
  return { success: true };
}

function getCommandHistory() {
  const database = getDb();
  return database.prepare('SELECT * FROM command_history ORDER BY id DESC LIMIT 50').all();
}

function addCommandHistory(command) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO command_history (command) VALUES (?)');
  stmt.run(command);
  return { command };
}

function backupDatabase() {
  try {
    const dbPath = getDbPath();
    if (!dbPath) return false;

    const backupDir = path.join(path.dirname(dbPath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const backupFile = path.join(backupDir, `yodo-task-backup-${todayStr}.db`);

    fs.copyFileSync(dbPath, backupFile);
    console.log(`[Backup] Automatic daily backup created at: ${backupFile}`);
    addLog('AUTO_BACKUP_CREATED', `Backup created: ${path.basename(backupFile)}`);

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('yodo-task-backup-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 7) {
      const toDelete = files.slice(7);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[Backup] Pruned old backup: ${file.name}`);
      }
    }
    return true;
  } catch (err) {
    console.error('[Backup] Backup failed:', err);
    return false;
  }
}

function getBackups() {
  try {
    const dbPath = getDbPath();
    if (!dbPath) return [];
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    if (!fs.existsSync(backupDir)) return [];

    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('yodo-task-backup-') && f.endsWith('.db'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    console.error('[Backup] Failed to read backups:', err);
    return [];
  }
}

function restoreBackup(filename) {
  try {
    const dbPath = getDbPath();
    if (!dbPath) return false;
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    const sourceFile = path.join(backupDir, filename);

    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Backup file ${filename} does not exist.`);
    }

    closeDb();
    fs.copyFileSync(sourceFile, dbPath);
    init(dbPath);
    addLog('BACKUP_RESTORED', `Restored backup: ${filename}`);
    return true;
  } catch (err) {
    console.error('[Backup] Failed to restore backup:', err);
    return false;
  }
}

module.exports = {
  init,
  getDbPath,
  closeDb,
  addLog,
  getLogs,
  getAllTodos,
  addTodo,
  updateTodo,
  deleteTodo,
  getSettings,
  saveSetting,
  exportBackup,
  importBackup,
  mergeDatabase,
  getAllWorkspaces,
  addWorkspace,
  deleteWorkspace,
  getNotifications,
  addNotification,
  markNotificationsRead,
  getCommandHistory,
  addCommandHistory,
  backupDatabase,
  getBackups,
  restoreBackup
};

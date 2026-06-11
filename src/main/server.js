const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('./db');
const exportService = require('./exportService');

let serverInstance = null;
let currentPort = null;

/**
 * Starts the Express server on the specified port.
 * @param {number} port Port number to listen on.
 */
function start(port) {
  const portNum = parseInt(port, 10);
  if (isNaN(portNum)) {
    console.error(`[Server] Invalid port specified: ${port}`);
    return;
  }

  if (serverInstance && currentPort === portNum) {
    console.log(`[Server] Already running on port ${portNum}`);
    return;
  }

  if (serverInstance) {
    console.log(`[Server] Stopping current server on port ${currentPort} to restart on ${portNum}...`);
    serverInstance.close();
  }

  const app = express();

  app.use(cors());

  // Standard JSON parser
  app.use(express.json({ limit: '10mb' }));

  // Custom raw body parser to handle binary file uploads without Multer dependency
  app.use('/api/raw-upload', express.raw({ type: '*/*', limit: '50mb' }));

  // Serve static UI assets from production build folder
  const buildPath = path.join(__dirname, '../../dist');
  app.use(express.static(buildPath));

  // --- Core CRUD APIs ---

  app.get('/api/todos', (req, res) => {
    try {
      res.json(db.getAllTodos());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/todos', (req, res) => {
    try {
      const { title, status, dueDate, priority, workspace_id, archived } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      res.json(db.addTodo({ title, status, dueDate, priority, workspace_id, archived }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/todos/:id', (req, res) => {
    try {
      res.json(db.updateTodo(req.params.id, req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/todos/:id', (req, res) => {
    try {
      res.json(db.deleteTodo(req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/settings', (req, res) => {
    try {
      res.json(db.getSettings());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: 'Key is required' });
      const saved = db.saveSetting(key, value);

      if (key === 'port') {
        const newPort = parseInt(value, 10);
        if (!isNaN(newPort) && newPort !== currentPort) {
          setTimeout(() => start(newPort), 1000);
        }
      }
      res.json(saved);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Full Database Backup / Restore APIs ---

  // Export physical SQLite .db file
  app.get('/api/backup/export-db', (req, res) => {
    try {
      const dbPath = db.getDbPath();
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: 'Database file not found.' });
      }

      db.addLog('DATABASE_PHYSICAL_EXPORT', 'Exported physical SQLite database file.');

      res.setHeader('Content-Disposition', 'attachment; filename="yodo-task.db"');
      res.setHeader('Content-Type', 'application/octet-stream');

      const fileStream = fs.createReadStream(dbPath);
      fileStream.pipe(res);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Import physical SQLite .db file (Merge or Replace)
  app.post('/api/raw-upload/import-db', async (req, res) => {
    const mode = req.query.mode || 'replace'; // replace | merge
    const tempPath = path.join(os.tmpdir(), `temp_import_${Date.now()}.db`);

    try {
      if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: 'No database file uploaded.' });
      }

      // Write upload stream to temp file
      fs.writeFileSync(tempPath, req.body);

      if (mode === 'merge') {
        db.mergeDatabase(tempPath);
        fs.unlinkSync(tempPath);
        res.json({ success: true, message: 'Database merged successfully.' });
      } else {
        // REPLACE mode
        // 1. Close current connection
        db.closeDb();

        // 2. Overwrite database file
        const activePath = db.getDbPath();
        fs.copyFileSync(tempPath, activePath);
        fs.unlinkSync(tempPath);

        // 3. Re-open connection
        db.init(activePath);
        db.addLog('DATABASE_PHYSICAL_REPLACE', 'Overwrote active database file with uploaded DB backup.');

        res.json({ success: true, message: 'Database replaced successfully.' });
      }
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch { }
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Legacy JSON Backup APIs
  app.post('/api/backup/export', (req, res) => {
    try {
      res.json(db.exportBackup());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup/import', (req, res) => {
    try {
      res.json(db.importBackup(req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Task-Level Multi-Format Export/Import APIs ---

  // Compile tasks to specific file formats
  app.get('/api/tasks/export', async (req, res) => {
    const format = req.query.format || 'txt';
    try {
      const tasks = db.getAllTodos();
      const buffer = await exportService.exportTasks(tasks, format);

      const contentTypes = {
        csv: 'text/csv',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain'
      };

      res.setHeader('Content-Disposition', `attachment; filename="yodo-task-export.${format}"`);
      res.setHeader('Content-Type', contentTypes[format] || 'application/octet-stream');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Import tasks from CSV, Excel, TXT, or JSON
  app.post('/api/raw-upload/tasks/import', async (req, res) => {
    const fileType = req.query.format || 'txt';
    try {
      if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: 'No task file uploaded.' });
      }

      // Parse uploaded buffer
      const parsedTasks = exportService.parseImport(req.body, fileType);

      // Merge tasks into active database (deduplicate by title + due date)
      const currentTasks = db.getAllTodos();
      let importedCount = 0;

      for (const t of parsedTasks) {
        // Duplicate check
        const isDuplicate = currentTasks.some(existing =>
          existing.title.toLowerCase() === t.title.toLowerCase() &&
          (existing.due_date === t.due_date || (!existing.due_date && !t.due_date))
        );

        if (!isDuplicate) {
          db.addTodo({
            title: t.title,
            status: t.status,
            dueDate: t.due_date
          });
          importedCount++;
        }
      }

      res.json({
        success: true,
        message: `Successfully imported ${importedCount} of ${parsedTasks.length} tasks. Duplicates were ignored.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Workspaces Endpoints ---
  app.get('/api/workspaces', (req, res) => {
    try {
      res.json(db.getAllWorkspaces());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/workspaces', (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      res.json(db.addWorkspace(name));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/workspaces/:id', (req, res) => {
    try {
      res.json(db.deleteWorkspace(req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Notifications Endpoints ---
  app.get('/api/notifications', (req, res) => {
    try {
      res.json(db.getNotifications());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notifications/read', (req, res) => {
    try {
      res.json(db.markNotificationsRead());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notifications', (req, res) => {
    try {
      const { title, body } = req.body;
      res.json(db.addNotification(title, body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Command History Endpoints ---
  app.get('/api/history', (req, res) => {
    try {
      res.json(db.getCommandHistory());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/history', (req, res) => {
    try {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'Command is required' });
      res.json(db.addCommandHistory(command));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Backup List & Restore Endpoints ---
  app.get('/api/backups', (req, res) => {
    try {
      res.json(db.getBackups());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/restore', (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) return res.status(400).json({ error: 'Filename is required' });
      const success = db.restoreBackup(filename);
      res.json({ success });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/trigger', (req, res) => {
    try {
      const success = db.backupDatabase();
      res.json({ success });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Weekly Stats Endpoint ---
  app.get('/api/stats/weekly', (req, res) => {
    try {
      const todos = db.getAllTodos();
      const logs = db.getLogs();

      const now = new Date();
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        days.push({
          dateStr: d.toISOString().split('T')[0],
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          completedCount: 0
        });
      }

      for (const todo of todos) {
        if (todo.status === 'Completed' && todo.updated_at) {
          const todoDateStr = todo.updated_at.split(' ')[0];
          const dayObj = days.find(d => d.dateStr === todoDateStr);
          if (dayObj) {
            dayObj.completedCount++;
          }
        }
      }

      const pomodoroLogs = logs.filter(l => l.action === 'POMODORO_COMPLETE');
      let totalFocusMinutes = 0;
      let totalSessions = pomodoroLogs.length;

      for (const log of pomodoroLogs) {
        totalFocusMinutes += 25;
      }

      res.json({
        weeklyCompleted: days,
        totalSessions,
        totalFocusMinutes
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/pomodoro', (req, res) => {
    try {
      const { taskId, taskTitle } = req.body;
      db.addLog('POMODORO_COMPLETE', `Task #${taskId}: ${taskTitle}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fallback to React static pages
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });

  serverInstance = app.listen(portNum, '0.0.0.0', () => {
    console.log(`[Server] YoDo Task server running on http://localhost:${portNum}`);
    currentPort = portNum;
  });

  serverInstance.on('error', (err) => {
    console.error(`[Server] Error occurred on port ${portNum}:`, err.message);
  });
}

function stop() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
    currentPort = null;
    console.log('[Server] Server shut down.');
  }
}

if (require.main === module) {
  db.init();
  const settings = db.getSettings();
  const argPort = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
  const defaultPort = argPort || envPort || parseInt(settings.port, 10) || 54321;
  start(defaultPort);
}

module.exports = {
  start,
  stop
};

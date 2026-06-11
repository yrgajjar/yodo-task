const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

/**
 * Resolves the absolute API url to the correct port.
 * If running in browser under Vite dev server (port 5173), redirects to Express port.
 * otherwise uses relative path.
 * @param {string} endpoint 
 * @returns {string} Fully resolved path
 */
function getApiUrl(endpoint) {
  if (isElectron) return endpoint;
  
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      const savedPort = localStorage.getItem('yodo_task_port') || '54321';
      return `http://localhost:${savedPort}${endpoint}`;
    }
  }
  return endpoint;
}

export const api = {
  /**
   * Resolves the target API host dynamically based on the current context.
   * If in Electron (file:// protocol) or Vite dev server (port 5173), returns http://localhost:port.
   * Otherwise in a standard production web browser, returns window.location.origin.
   * @param {string|number} [portSetting]
   */
  getHost: (portSetting) => {
    if (typeof window !== 'undefined') {
      const isElectronFile = window.location.protocol === 'file:';
      if (isElectronFile || window.location.port === '5173') {
        const port = portSetting || localStorage.getItem('yodo_task_port') || '54321';
        return `http://localhost:${port}`;
      }
      return window.location.origin;
    }
    return `http://localhost:${portSetting || '54321'}`;
  },

  /**
   * Fetch all ToDos from the local store
   */
  getTodos: async () => {
    if (isElectron) {
      return await window.electronAPI.getTodos();
    } else {
      const res = await fetch(getApiUrl('/api/todos'));
      return await res.json();
    }
  },

  /**
   * Add a new ToDo item
   * @param {object} todo { title, status, dueDate }
   */
  addTodo: async (todo) => {
    if (isElectron) {
      return await window.electronAPI.addTodo(todo);
    } else {
      const res = await fetch(getApiUrl('/api/todos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo)
      });
      return await res.json();
    }
  },

  /**
   * Update fields on an existing ToDo
   * @param {number} id
   * @param {object} fields { title, status, dueDate }
   */
  updateTodo: async (id, fields) => {
    if (isElectron) {
      return await window.electronAPI.updateTodo(id, fields);
    } else {
      const res = await fetch(getApiUrl(`/api/todos/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      return await res.json();
    }
  },

  /**
   * Delete an existing ToDo
   * @param {number} id
   */
  deleteTodo: async (id) => {
    if (isElectron) {
      return await window.electronAPI.deleteTodo(id);
    } else {
      const res = await fetch(getApiUrl(`/api/todos/${id}`), {
        method: 'DELETE'
      });
      return await res.json();
    }
  },

  /**
   * Fetch all Settings
   */
  getSettings: async () => {
    let settings;
    if (isElectron) {
      settings = await window.electronAPI.getSettings();
    } else {
      const res = await fetch(getApiUrl('/api/settings'));
      settings = await res.json();
    }
    
    // Cache the port inside localStorage to route dev server requests properly
    if (settings && settings.port && typeof window !== 'undefined') {
      localStorage.setItem('yodo_task_port', String(settings.port));
    }
    
    return settings;
  },

  /**
   * Update a setting key-value pair
   * @param {string} key
   * @param {any} value
   */
  saveSetting: async (key, value) => {
    if (key === 'port' && typeof window !== 'undefined') {
      localStorage.setItem('yodo_task_port', String(value));
    }

    if (isElectron) {
      return await window.electronAPI.saveSetting(key, value);
    } else {
      const res = await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      return await res.json();
    }
  },

  /**
   * Export the local database backup
   */
  exportBackup: async () => {
    if (isElectron) {
      return await window.electronAPI.exportBackup();
    } else {
      const res = await fetch(getApiUrl('/api/backup/export'), { method: 'POST' });
      return await res.json();
    }
  },

  /**
   * Restore database from raw JSON backup
   * @param {object} backupData
   */
  importBackup: async (backupData) => {
    if (isElectron) {
      return await window.electronAPI.importBackup(backupData);
    } else {
      const res = await fetch(getApiUrl('/api/backup/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData)
      });
      return await res.json();
    }
  },

  /**
   * Send system local notification
   * @param {string} title
   * @param {string} body
   */
  sendNotification: (title, body) => {
    if (isElectron) {
      window.electronAPI.sendNotification(title, body);
    } else {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification(title, { body });
            }
          });
        }
      }
    }
  },

  /**
   * Test if a global shortcut is valid and registered
   * @param {string} key
   */
  testShortcut: async (key) => {
    if (isElectron) {
      return await window.electronAPI.testShortcut(key);
    }
    return false;
  },

  isElectron
};

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, selected methods to the React renderer thread
contextBridge.exposeInMainWorld('electronAPI', {
  // ToDo Database Handlers
  getTodos: () => ipcRenderer.invoke('db:getTodos'),
  addTodo: (todo) => ipcRenderer.invoke('db:addTodo', todo),
  updateTodo: (id, fields) => ipcRenderer.invoke('db:updateTodo', id, fields),
  deleteTodo: (id) => ipcRenderer.invoke('db:deleteTodo', id),
  
  // Settings Handlers
  getSettings: () => ipcRenderer.invoke('db:getSettings'),
  saveSetting: (key, value) => ipcRenderer.invoke('db:saveSetting', key, value),
  
  // Backup Management Handlers
  exportBackup: () => ipcRenderer.invoke('db:exportBackup'),
  importBackup: (backupData) => ipcRenderer.invoke('db:importBackup', backupData),
  
  // OS Native System Notification Trigger
  sendNotification: (title, body) => ipcRenderer.send('sys:sendNotification', title, body),
  
  // Test Shortcut Handler
  testShortcut: (key) => ipcRenderer.invoke('sys:testShortcut', key),

  // Toggle mini window always-on-top
  toggleAlwaysOnTop: (value) => ipcRenderer.invoke('sys:toggleAlwaysOnTop', value),

  // Hide quick add floating window
  hideQuickAdd: () => ipcRenderer.invoke('sys:hideQuickAdd'),
  
  // Open command bar callback from tray Quick Add
  onOpenCommandBar: (callback) => {
    const subscription = (_event) => callback();
    ipcRenderer.on('sys:openCommandBar', subscription);
    return () => ipcRenderer.removeListener('sys:openCommandBar', subscription);
  },
  
  // Flag indicating native context is available
  isElectron: true
});

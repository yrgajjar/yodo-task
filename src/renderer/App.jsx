import React, { useState, useEffect } from 'react';
import { api } from './utils/api';
import Sidebar from './components/Sidebar';
import Board from './components/Board';
import Stats from './components/Stats';
import Settings from './components/Settings';
import CommandBar from './components/CommandBar';
import MiniWindow from './components/MiniWindow';
import QuickAdd from './components/QuickAdd';

/**
 * Utility to convert HEX color strings to RGB.
 * @param {string} hex 
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Helper to update CSS global primary theme color custom variables.
 * @param {string} hexColor 
 */
function applyThemeColor(hexColor) {
  if (!hexColor) return;
  const rgb = hexToRgb(hexColor);
  if (rgb) {
    document.documentElement.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
}

export default function App({ isMini }) {
  const [todos, setTodos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeView, setActiveView] = useState('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isQuickAdd = typeof window !== 'undefined' && window.location.search.includes('window=quickadd');

  // Advanced Phase 2 States
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(1);
  const [activeSmartFilter, setActiveSmartFilter] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pomodoroTimer, setPomodoroTimer] = useState({
    minutes: 25,
    seconds: 0,
    isActive: false,
    taskTitle: '',
    taskId: null
  });

  // Load baseline datasets on mount
  useEffect(() => {
    refreshData();
  }, []);

  // Sync data again when window gains focus (for cross-window syncing between Main and Mini)
  useEffect(() => {
    window.addEventListener('focus', refreshData);
    return () => window.removeEventListener('focus', refreshData);
  }, []);

  // Watch and apply theme colors
  useEffect(() => {
    if (settings && settings.theme_color) {
      applyThemeColor(settings.theme_color);
    }
  }, [settings]);

  // Capture global 'Ctrl + A' shortcut to summon the floating Command Bar
  useEffect(() => {
    if (isMini) return; // Disregard command bar in the mini window

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        const active = document.activeElement;
        const isTextInput = active.tagName === 'INPUT' || 
                            active.tagName === 'TEXTAREA' || 
                            active.isContentEditable;
        
        // Only trigger if focus is NOT inside an active input field
        if (!isTextInput) {
          e.preventDefault();
          setIsCommandBarOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMini]);

  // Listen to openCommandBar event from native system tray
  useEffect(() => {
    if (isMini || !api.isElectron) return;
    
    const unsubscribe = window.electronAPI.onOpenCommandBar(() => {
      setIsCommandBarOpen(true);
    });
    
    return () => unsubscribe();
  }, [isMini]);

  const refreshData = async () => {
    try {
      const allTodos = await api.getTodos();
      const allSettings = await api.getSettings();
      
      // Load workspaces and notifications
      const host = api.getHost(allSettings.port);
      const wsRes = await fetch(`${host}/api/workspaces`);
      const allWorkspaces = await wsRes.json();
      const notifRes = await fetch(`${host}/api/notifications`);
      const allNotifications = await notifRes.json();

      setTodos(allTodos || []);
      setSettings(allSettings || {});
      setWorkspaces(allWorkspaces || []);
      setNotifications(allNotifications || []);
    } catch (err) {
      console.error('[App] Failed to load data:', err);
    }
  };

  const handleAddTodo = async (todo) => {
    const todoWithWorkspace = {
      ...todo,
      workspace_id: todo.workspace_id || activeWorkspaceId
    };
    const newTodo = await api.addTodo(todoWithWorkspace);
    setTodos((prev) => [newTodo, ...prev]);
    return newTodo;
  };

  const handleUpdateTodo = async (id, fields) => {
    const updated = await api.updateTodo(id, fields);
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  };

  const handleDeleteTodo = async (id) => {
    await api.deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  // Pomodoro Timer Effect Ticker
  useEffect(() => {
    let interval = null;
    if (pomodoroTimer.isActive) {
      interval = setInterval(() => {
        setPomodoroTimer((prev) => {
          if (prev.seconds > 0) {
            return { ...prev, seconds: prev.seconds - 1 };
          } else if (prev.minutes > 0) {
            return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
          } else {
            clearInterval(interval);
            handlePomodoroComplete(prev.taskId, prev.taskTitle);
            return { ...prev, isActive: false, minutes: 25, seconds: 0 };
          }
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [pomodoroTimer.isActive]);

  const handleStartPomodoro = (taskId, taskTitle) => {
    setPomodoroTimer({
      minutes: 25,
      seconds: 0,
      isActive: true,
      taskTitle,
      taskId
    });
    api.sendNotification('Pomodoro Started', `Focus session started for task: ${taskTitle}`);
  };

  const handleStopPomodoro = () => {
    setPomodoroTimer({
      minutes: 25,
      seconds: 0,
      isActive: false,
      taskTitle: '',
      taskId: null
    });
  };

  const handlePomodoroComplete = async (taskId, taskTitle) => {
    try {
      const host = api.getHost(settings?.port);
      
      await fetch(`${host}/api/pomodoro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, taskTitle })
      });

      const notifTitle = 'Pomodoro Focus Session Finished';
      const notifBody = `Focus timer finished for: "${taskTitle}". Take a break!`;
      await handleAddNotification(notifTitle, notifBody);

      api.sendNotification(notifTitle, notifBody);
    } catch (err) {
      console.error('Failed to log Pomodoro completion:', err);
    }
  };

  const handleAddWorkspace = async (name) => {
    try {
      const host = api.getHost(settings?.port);
      const res = await fetch(`${host}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const ws = await res.json();
      setWorkspaces((prev) => [...prev, ws]);
      return ws;
    } catch (err) {
      console.error('Failed to add workspace:', err);
    }
  };

  const handleDeleteWorkspace = async (id) => {
    try {
      const host = api.getHost(settings?.port);
      await fetch(`${host}/api/workspaces/${id}`, { method: 'DELETE' });
      setWorkspaces((prev) => prev.filter(w => w.id !== id));
      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(1);
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      const host = api.getHost(settings?.port);
      await fetch(`${host}/api/notifications/read`, { method: 'POST' });
      setNotifications((prev) => prev.map(n => ({ ...n, read: 1 })));
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const handleAddNotification = async (title, body) => {
    try {
      const host = api.getHost(settings?.port);
      const res = await fetch(`${host}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      });
      const notif = await res.json();
      setNotifications((prev) => [notif, ...prev]);
    } catch (err) {
      console.error('Failed to add notification:', err);
    }
  };

  const handleSaveSetting = async (key, value) => {
    const saved = await api.saveSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
    return saved;
  };

  // Task-level export download trigger
  const handleExportTasks = (format) => {
    setIsMenuOpen(false);
    const host = api.getHost(settings?.port);
    const downloadUrl = `${host}/api/tasks/export?format=${format}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `yodo-task-export.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    api.sendNotification('Tasks Exported', `Successfully downloaded task list as ${format.toUpperCase()}`);
  };

  // Task-level import file reading trigger
  const handleImportTasksFile = (e) => {
    setIsMenuOpen(false);
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      const buffer = evt.target.result;
      try {
        const host = api.getHost(settings?.port);
        const res = await fetch(`${host}/api/raw-upload/tasks/import?format=${ext}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: buffer
        });
        
        const result = await res.json();
        if (result.success) {
          alert(result.message);
          refreshData();
        } else {
          alert('Import failed: ' + result.error);
        }
      } catch (err) {
        alert('Import error: ' + err.message);
      }
    };
    
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset file input selection
  };

  if (!settings) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading configuration...
      </div>
    );
  }

  // --- Render Mode: Spotlight Quick Add Window ---
  if (isQuickAdd) {
    return (
      <QuickAdd
        onAddTodo={handleAddTodo}
        onClose={() => {
          if (window.electronAPI) {
            window.electronAPI.hideQuickAdd();
          }
        }}
      />
    );
  }

  // --- Render Mode: Spotlight Mini Window ---
  if (isMini) {
    return (
      <MiniWindow
        todos={todos}
        onRefresh={refreshData}
        onUpdateTodo={handleUpdateTodo}
        onAddTodo={handleAddTodo}
      />
    );
  }

  // Apply workspaces, smart views, and search query filters to todos
  let filteredTodos = todos;

  // Filter archived: if active smart filter is 'archive', show only archived. Otherwise, hide archived!
  if (activeSmartFilter === 'archive') {
    filteredTodos = filteredTodos.filter(t => t.archived === 1 || t.archived === 'true' || t.archived === true);
  } else {
    filteredTodos = filteredTodos.filter(t => !t.archived && t.archived !== 1 && t.archived !== 'true' && t.archived !== true);
  }

  // Filter by active workspace id
  filteredTodos = filteredTodos.filter(t => t.workspace_id === activeWorkspaceId || t.workspace_id === String(activeWorkspaceId));

  // Smart view Today
  if (activeSmartFilter === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    filteredTodos = filteredTodos.filter(t => t.due_date && t.due_date.split('T')[0] === todayStr);
  }

  // Smart view Overdue
  if (activeSmartFilter === 'overdue') {
    const todayStr = new Date().toISOString().split('T')[0];
    filteredTodos = filteredTodos.filter(t => t.status !== 'Completed' && t.status !== 'Canceled' && t.due_date && t.due_date.split('T')[0] < todayStr);
  }

  // Search query filter
  if (searchQuery) {
    filteredTodos = filteredTodos.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  const visibleSections = settings.visible_sections || ['Open', 'In Progress', 'Completed', 'Canceled'];

  // --- Render Mode: Main Dashboard Application ---
  return (
    <div className="app-container">
      {/* Hidden file selector for Task Import */}
      <input
        id="task-import-input"
        type="file"
        accept=".csv,.xlsx,.xls,.json,.txt"
        onChange={handleImportTasksFile}
        style={{ display: 'none' }}
      />

      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        todos={todos}
        onOpenCommandBar={() => setIsCommandBarOpen(true)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceChange={setActiveWorkspaceId}
        activeSmartFilter={activeSmartFilter}
        onSmartFilterChange={setActiveSmartFilter}
        pomodoroTimer={pomodoroTimer}
        onStopPomodoro={handleStopPomodoro}
      />

      {/* Primary Content Window */}
      <main className="main-content">
        
        {/* Top Header Row */}
        <div className="top-header">
          <div className="search-container">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search active tasks..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
            {/* Notification Bell Icon */}
            <div style={{ position: 'relative' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }} 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  if (!isNotificationsOpen) {
                    handleMarkNotificationsRead();
                  }
                }}
                title="Notifications"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span 
                    style={{ 
                      position: 'absolute', 
                      top: '-4px', 
                      right: '-4px', 
                      background: 'var(--color-canceled)', 
                      color: '#fff', 
                      fontSize: '9px', 
                      padding: '1px 5px', 
                      borderRadius: '10px', 
                      fontWeight: 'bold' 
                    }}
                  >
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <>
                  <div 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 400 }} 
                    onClick={() => setIsNotificationsOpen(false)} 
                  />
                  <div className="dropdown-menu" style={{ zIndex: 500, width: '280px', right: 0 }}>
                    <div className="dropdown-item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Alerts & Notifications</span>
                      {notifications.length > 0 && (
                        <button 
                          style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                          onClick={() => setNotifications([])}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      {notifications.map(n => (
                        <div 
                          key={n.id} 
                          style={{ 
                            padding: '8px 12px', 
                            borderBottom: '1px solid var(--border-light)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '2px',
                            background: n.read ? 'transparent' : 'rgba(var(--primary-rgb), 0.05)'
                          }}
                        >
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{n.title}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{n.body}</span>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                          No notifications
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button className="btn-primary" onClick={() => setIsCommandBarOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>New Command</span>
            </button>

            {/* 3-Dot (⋮) Menu Button */}
            <div style={{ position: 'relative' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Task Actions"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="1.5"></circle>
                  <circle cx="12" cy="5" r="1.5"></circle>
                  <circle cx="12" cy="19" r="1.5"></circle>
                </svg>
              </button>
              
              {isMenuOpen && (
                <>
                  {/* Backdrop overlay to close dropdown */}
                  <div 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 400 }} 
                    onClick={() => setIsMenuOpen(false)} 
                  />
                  
                  <div className="dropdown-menu" style={{ zIndex: 500 }}>
                    <div className="dropdown-item-header">Export Format</div>
                    <button className="dropdown-item" onClick={() => handleExportTasks('csv')}>CSV (.csv)</button>
                    <button className="dropdown-item" onClick={() => handleExportTasks('xlsx')}>Excel (.xlsx)</button>
                    <button className="dropdown-item" onClick={() => handleExportTasks('pdf')}>PDF (.pdf)</button>
                    <button className="dropdown-item" onClick={() => handleExportTasks('docx')}>Word (.docx)</button>
                    <button className="dropdown-item" onClick={() => handleExportTasks('txt')}>Plain Text (.txt)</button>
                    
                    <div className="dropdown-item-header" style={{ borderTop: '1px solid var(--border-light)', marginTop: '4px', paddingTop: '4px' }}>Import Tasks</div>
                    <button className="dropdown-item" onClick={() => document.getElementById('task-import-input').click()}>
                      Upload file...
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Views */}
        {activeView === 'board' && (
          <Board
            todos={filteredTodos}
            onUpdateTodo={handleUpdateTodo}
            onDeleteTodo={handleDeleteTodo}
            onAddTodo={handleAddTodo}
            visibleSections={visibleSections}
            onStartPomodoro={handleStartPomodoro}
          />
        )}

        {activeView === 'dashboard' && (
          <Stats todos={todos} settings={settings} />
        )}

        {activeView === 'settings' && (
          <Settings
            settings={settings}
            onSaveSetting={handleSaveSetting}
            onRefresh={refreshData}
            workspaces={workspaces}
            onAddWorkspace={handleAddWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
          />
        )}
      </main>

      {/* Floating command terminal panel overlay */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        onRefresh={refreshData}
      />
    </div>
  );
}

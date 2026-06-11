import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const PRESET_COLORS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Crimson', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' }
];

const validateShortcutFormat = (str) => {
  if (!str || typeof str !== 'string') return false;
  const parts = str.split('+');
  
  if (parts.length === 1) {
    const key = parts[0].trim().toLowerCase();
    const isFKey = /^f(1[0-9]|2[0-4]|[1-9])$/.test(key);
    const isSpecialKey = ['space', 'tab', 'enter', 'escape', 'backspace', 'delete', 'insert', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown'].includes(key);
    return isFKey || isSpecialKey;
  }
  
  const validModifiers = [
    'ctrl', 'control', 'alt', 'option', 'shift', 'cmd', 'command', 
    'commandorcontrol', 'cmdorctrl', 'super'
  ];
  
  const modifiers = parts.slice(0, -1);
  const key = parts[parts.length - 1].trim().toLowerCase();
  
  const allModifiersValid = modifiers.every(m => validModifiers.includes(m.trim().toLowerCase()));
  if (!allModifiersValid) return false;
  if (!key) return false;
  
  return true;
};

export default function Settings({ settings, onSaveSetting, onRefresh, workspaces = [], onAddWorkspace, onDeleteWorkspace }) {
  const [port, setPort] = useState(settings.port || '54321');
  const [themeColor, setThemeColor] = useState(settings.theme_color || '#6366f1');
  const [shortcut, setShortcut] = useState(settings.global_shortcut || 'CommandOrControl+Alt+Y');
  
  useEffect(() => {
    setPort(settings.port || '54321');
    setThemeColor(settings.theme_color || '#6366f1');
    setShortcut(settings.global_shortcut || 'CommandOrControl+Alt+Y');
  }, [settings]);
  
  // DB import states
  const [dbFile, setDbFile] = useState(null);
  const [showDbImportModal, setShowDbImportModal] = useState(false);

  // Workspace Creation State
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const handleAddWorkspaceSubmit = async (e) => {
    e.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) return;
    try {
      await onAddWorkspace(name);
      setNewWorkspaceName('');
      alert(`Workspace "${name}" added successfully.`);
    } catch (err) {
      alert('Failed to add workspace: ' + err.message);
    }
  };

  const handleDeleteWorkspaceClick = async (id, name) => {
    if (id === 1) {
      alert('The default "Personal" workspace cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete workspace "${name}"? All tasks inside this workspace will be deleted.`)) {
      return;
    }
    try {
      await onDeleteWorkspace(id);
      alert(`Workspace "${name}" deleted successfully.`);
    } catch (err) {
      alert('Failed to delete workspace: ' + err.message);
    }
  };

  // Advanced Phase 2 Backups states
  const [backups, setBackups] = useState([]);

  const fetchBackups = async () => {
    try {
      const host = api.getHost(settings.port);
      const res = await fetch(`${host}/api/backups`);
      if (res.ok) {
        const data = await res.json();
        setBackups(data || []);
      }
    } catch (err) {
      console.error('Failed to load backups list:', err);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [settings.port]);

  const handleAlwaysOnTopToggle = async (e) => {
    const checked = e.target.checked;
    await onSaveSetting('always_on_top', checked);
    if (api.isElectron) {
      await window.electronAPI.toggleAlwaysOnTop(checked);
    }
  };

  const handleTriggerBackup = async () => {
    try {
      const host = api.getHost(settings.port);
      const res = await fetch(`${host}/api/backups/trigger`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          alert('Backup created successfully.');
          fetchBackups();
          onRefresh();
        } else {
          alert('Failed to trigger database backup.');
        }
      }
    } catch (err) {
      alert('Error triggering database backup: ' + err.message);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm(`Are you sure you want to restore the backup file "${filename}"? This will overwrite your current active database completely.`)) {
      return;
    }
    try {
      const host = api.getHost(settings.port);
      const res = await fetch(`${host}/api/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          alert('Database successfully restored from backup.');
          window.location.reload();
        } else {
          alert('Failed to restore backup.');
        }
      }
    } catch (err) {
      alert('Error restoring backup: ' + err.message);
    }
  };
  
  // Parse sections visibility
  const visibleSections = settings.visible_sections || ['Open', 'In Progress', 'Completed', 'Canceled'];

  const handleToggleSection = (section) => {
    let updated;
    if (visibleSections.includes(section)) {
      updated = visibleSections.filter(s => s !== section);
    } else {
      updated = [...visibleSections, section];
    }
    if (updated.length === 0) return;
    onSaveSetting('visible_sections', updated);
  };

  const handleColorChange = (hex) => {
    setThemeColor(hex);
    onSaveSetting('theme_color', hex);
  };

  const handlePortSave = async (e) => {
    e.preventDefault();
    if (!port || isNaN(port)) {
      alert('Please enter a valid numeric port.');
      return;
    }
    await onSaveSetting('port', port);
    alert(`Port updated to ${port}. Server will restart shortly.`);
  };

  const handleAutostartToggle = (e) => {
    onSaveSetting('auto_start', e.target.checked);
  };

  const handleShortcutTest = async () => {
    const trimmed = shortcut.trim();
    if (!trimmed) {
      alert('Please enter a shortcut key combination to test.');
      return;
    }
    
    if (!validateShortcutFormat(trimmed)) {
      alert('Invalid shortcut format. Please use modifiers separated by "+" (e.g., "Ctrl+Alt+Y" or "CommandOrControl+Shift+Space").');
      return;
    }
    
    if (!api.isElectron) {
      alert(`Format is valid: "${trimmed}". Global OS hotkeys can only be tested and used inside the Electron desktop application, not in a standard web browser.`);
      return;
    }

    const isValid = await api.testShortcut(trimmed);
    if (isValid) {
      alert(`Success: The shortcut "${trimmed}" is valid and available. The mini ToDo window was toggled!`);
    } else {
      alert(`Warning: The shortcut "${trimmed}" is already taken by your OS or another application, or is formatted incorrectly.`);
    }
  };

  const handleShortcutSave = async (e) => {
    e.preventDefault();
    const trimmed = shortcut.trim();
    if (!trimmed) {
      alert('Shortcut key combination cannot be empty.');
      return;
    }

    if (!validateShortcutFormat(trimmed)) {
      alert('Invalid shortcut format. Please use modifiers separated by "+" (e.g., "Ctrl+Alt+Y" or "CommandOrControl+Shift+Space").');
      return;
    }

    if (api.isElectron) {
      // Call testShortcut to validate availability before saving
      const isValid = await api.testShortcut(trimmed);
      if (!isValid) {
        alert(`The shortcut "${trimmed}" could not be registered. It may be invalid, or already taken by your OS or another application. Registration aborted.`);
        return;
      }
    }

    const result = await onSaveSetting('global_shortcut', trimmed);
    if (result && result.shortcutRegistrationSuccess === false) {
      alert(`Warning: The hotkey "${trimmed}" is already taken by your OS or another application. Falling back to default.`);
      await onRefresh();
    } else {
      alert(`Global shortcut successfully updated: "${trimmed}"` + (api.isElectron ? ' and registered.' : ' (will be active in the desktop app).'));
      await onRefresh();
    }
  };

  // Export JSON backup
  const handleExportBackup = async () => {
    try {
      const data = await api.exportBackup();
      const jsonStr = JSON.stringify(data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(jsonStr);
      
      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', `yodo-task-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      api.sendNotification('Backup Exported', 'Your JSON task backup is downloaded successfully.');
    } catch (err) {
      alert('Failed to export backup: ' + err.message);
    }
  };

  // Import JSON backup
  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backupData = JSON.parse(evt.target.result);
        if (!backupData.todos || !backupData.settings) {
          throw new Error('Invalid backup file structure.');
        }
        
        const confirmRestore = window.confirm('Are you sure you want to restore this backup? This will overwrite all your current tasks and settings.');
        if (!confirmRestore) return;

        await api.importBackup(backupData);
        api.sendNotification('Backup Restored', 'Database restored successfully.');
        window.location.reload();
      } catch (err) {
        alert('Failed to import backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export physical SQLite .db file
  const handleExportDb = () => {
    const host = api.getHost(settings.port);
    const link = document.createElement('a');
    link.href = `${host}/api/backup/export-db`;
    link.download = 'yodo-task.db';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    api.sendNotification('Database Exported', 'SQLite database file backup downloaded.');
  };

  // Stage physical SQLite .db file for import
  const handleDbFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDbFile(file);
    setShowDbImportModal(true);
    e.target.value = ''; // Clear input
  };

  // Execute SQLite file upload/restore (Merge or Replace)
  const executeDbImport = async (mode) => {
    setShowDbImportModal(false);
    if (!dbFile) return;

    const warningText = mode === 'replace'
      ? 'WARNING: This will completely overwrite your current database, deleting all existing tasks and settings. Are you sure you want to proceed?'
      : 'This will merge tasks and missing settings from the backup file into your active database. Proceed?';

    if (!window.confirm(warningText)) {
      setDbFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const buffer = evt.target.result;
      try {
        const host = api.getHost(settings.port);
        const res = await fetch(`${host}/api/raw-upload/import-db?mode=${mode}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: buffer
        });

        const result = await res.json();
        if (result.success) {
          alert(result.message);
          window.location.reload();
        } else {
          alert('Import failed: ' + result.error);
        }
      } catch (err) {
        alert('Import error: ' + err.message);
      } finally {
        setDbFile(null);
      }
    };
    reader.readAsArrayBuffer(dbFile);
  };

  const styleInputText = {
    padding: '8px 12px',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
    background: 'var(--bg-app)',
    color: 'var(--text-main)',
    outline: 'none',
    fontSize: '13px',
    fontFamily: 'inherit',
    flex: 1
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Modal Overlay for DB Import Mode Selection */}
      {showDbImportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }} onClick={() => { setShowDbImportModal(false); setDbFile(null); }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            width: '420px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>SQLite Database Restore</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Please select the import migration strategy for your database file:
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn-secondary" 
                style={{ textAlign: 'left', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer' }}
                onClick={() => executeDbImport('merge')}
              >
                <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--primary)' }}>Merge Database Records</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Imports tasks and settings not present in the current database. Preserves local changes.</span>
              </button>
              
              <button 
                className="btn-secondary" 
                style={{ textAlign: 'left', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-light)', borderColor: 'var(--color-canceled)', borderRadius: '8px', cursor: 'pointer' }}
                onClick={() => executeDbImport('replace')}
              >
                <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--color-canceled)' }}>Replace Database Entirely</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overwrites the active database file completely. Wipes all current local records.</span>
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => { setShowDbImportModal(false); setDbFile(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Settings & Preferences</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Configure visual aesthetics, servers, shortcuts, and backup history.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Visual Settings Panel */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Aesthetics & Appearance</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure app accent styling and layout columns.</p>
          </div>
          
          {/* Accent Color picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Theme Accent Color</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(col => (
                <button
                  key={col.hex}
                  onClick={() => handleColorChange(col.hex)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: col.hex,
                    border: themeColor === col.hex ? '3px solid var(--text-main)' : '1px solid transparent',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.15s ease',
                    transform: themeColor === col.hex ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title={col.name}
                />
              ))}
              {/* Native picker wrapper */}
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--border-light)', overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '-6px',
                    width: '40px',
                    height: '40px',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer'
                  }}
                  title="Custom Accent"
                />
              </div>
            </div>
          </div>

          {/* Section Visibility toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Visible Board Columns</span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['Open', 'In Progress', 'Completed', 'Canceled'].map(sec => {
                const active = visibleSections.includes(sec);
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleToggleSection(sec)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border-light)',
                      background: active ? 'rgba(var(--primary-rgb), 0.08)' : 'var(--bg-app)',
                      color: active ? 'var(--primary)' : 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sec}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Server & System Panel */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>System & Desktop Settings</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure local hosting port, shortcuts, and background executions.</p>
          </div>

          {/* Settings option rows (Native Feel) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {/* Autostart check */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: api.isElectron ? 'var(--text-main)' : 'var(--text-muted)' }}>Launch on Startup</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Automatically start YoDo Task on boot.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_start === 'true' || settings.auto_start === true}
                onChange={handleAutostartToggle}
                disabled={!api.isElectron}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: api.isElectron ? 'pointer' : 'not-allowed' }}
              />
            </div>

            {/* Close to tray check */}
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: api.isElectron ? 'var(--text-main)' : 'var(--text-muted)' }}>Minimize to Tray</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Close button runs app in background.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.close_to_tray === 'true' || settings.close_to_tray === true}
                onChange={(e) => onSaveSetting('close_to_tray', e.target.checked)}
                disabled={!api.isElectron}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: api.isElectron ? 'pointer' : 'not-allowed' }}
              />
            </div>

            {/* Always on top check */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: api.isElectron ? 'var(--text-main)' : 'var(--text-muted)' }}>Mini Window Floats</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mini Spotlight stays always on top.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.always_on_top === 'true' || settings.always_on_top === true}
                onChange={handleAlwaysOnTopToggle}
                disabled={!api.isElectron}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: api.isElectron ? 'pointer' : 'not-allowed' }}
              />
            </div>

            {/* Auto backup check */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>Automatic Backups</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Create a daily SQLite backup.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_backup === 'true' || settings.auto_backup === true}
                onChange={(e) => onSaveSetting('auto_backup', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Port input form */}
          <form onSubmit={handlePortSave} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Local Web Server Port</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                style={styleInputText}
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
              <button type="submit" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600' }}>
                Save Port
              </button>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Allows sharing your board across other devices on the same network via: http://localhost:{port}
            </span>
          </form>

          {/* Global Shortcut Config */}
          <form onSubmit={handleShortcutSave} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Global Mini Window Hotkey</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                style={{ ...styleInputText, fontFamily: 'monospace' }}
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="e.g. CommandOrControl+Alt+Y"
                disabled={!api.isElectron}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleShortcutTest}
                disabled={!api.isElectron}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: api.isElectron ? 'pointer' : 'not-allowed' }}
              >
                Test Shortcut
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={!api.isElectron}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: api.isElectron ? 'pointer' : 'not-allowed' }}
              >
                Save
              </button>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Configure key combination (e.g. <code>Ctrl+Alt+Y</code> or <code>Ctrl+Shift+Space</code>) to summon the mini todo widget system-wide.
            </span>
          </form>
        </div>

        {/* Workspace Management Panel */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Workspaces & Boards</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage custom boards and task workspaces.</p>
          </div>

          {/* Add workspace form */}
          <form onSubmit={handleAddWorkspaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Create New Workspace</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                style={styleInputText}
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g. Shopping, Side Project"
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600' }}>
                Add Workspace
              </button>
            </div>
          </form>

          {/* Workspace list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Active Workspaces</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {workspaces.map((ws) => (
                <div 
                  key={ws.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '10px 14px', 
                    background: 'var(--bg-app)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-light)',
                    fontSize: '13px' 
                  }}
                >
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{ws.name}</span>
                  {ws.id !== 1 ? (
                    <button 
                      type="button"
                      onClick={() => handleDeleteWorkspaceClick(ws.id, ws.name)}
                      style={{ 
                        border: 'none', 
                        background: 'transparent', 
                        color: 'var(--color-canceled)', 
                        cursor: 'pointer', 
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '4px 8px'
                      }}
                    >
                      Delete
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Default</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Backup Restore Panel */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Data Backup & Migration</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Export physical SQLite databases, JSON task lists, or restore previous sessions.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* SQLite Section */}
            <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>SQLite Databases (.db)</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={handleExportDb} style={{ fontSize: '12px', padding: '8px 12px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '600' }}>
                  Export DB
                </button>
                <label className="btn-secondary" style={{ fontSize: '12px', padding: '8px 12px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', textAlign: 'center', fontWeight: '600' }}>
                  Import DB
                  <input
                    type="file"
                    accept=".db"
                    onChange={handleDbFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* JSON Section */}
            <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>JSON Backups (.json)</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={handleExportBackup} style={{ fontSize: '12px', padding: '8px 12px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '600' }}>
                  Export JSON
                </button>
                <label className="btn-secondary" style={{ fontSize: '12px', padding: '8px 12px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', textAlign: 'center', fontWeight: '600' }}>
                  Import JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Automatic Daily DB Backups List */}
            <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>Historical Daily Backups</h4>
                <button className="btn-primary" onClick={handleTriggerBackup} style={{ fontSize: '11px', padding: '4px 10px', fontWeight: '600' }}>
                  Backup Now
                </button>
              </div>
              
              {backups.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0' }}>No historical SQLite backups found.</span>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {backups.map((bk) => (
                    <div 
                      key={bk.filename} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 14px', 
                        background: 'var(--bg-card)', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border-light)', 
                        fontSize: '12px',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          background: 'rgba(var(--primary-rgb), 0.08)',
                          color: 'var(--primary)',
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)', wordBreak: 'break-all' }}>{bk.filename}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Size: {Math.round(bk.sizeBytes / 1024)} KB • Created: {new Date(bk.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="btn-secondary" 
                        onClick={() => handleRestoreBackup(bk.filename)} 
                        style={{ fontSize: '11px', padding: '4px 10px', borderColor: 'var(--primary)', color: 'var(--primary)', background: 'transparent', height: '28px', fontWeight: '600' }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

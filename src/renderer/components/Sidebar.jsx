import React from 'react';
import logoIcon from '../icon.png';

export default function Sidebar({
  activeView,
  onViewChange,
  todos,
  onOpenCommandBar,
  workspaces = [],
  activeWorkspaceId = 1,
  onWorkspaceChange,
  activeSmartFilter = null,
  onSmartFilterChange,
  pomodoroTimer = null,
  onStopPomodoro
}) {
  // Compute Completion Rate
  const total = todos.length;
  const completed = todos.filter(t => t.status === 'Completed').length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div 
      style={{
        width: '240px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-light)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Branding Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={logoIcon} 
            alt="YoDo Logo" 
            style={{ 
              width: '32px', 
              height: '32px', 
              objectFit: 'contain'
            }}
          />
          <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.5px' }}>
            YoDo Task
          </span>
        </div>

        {/* Action Button */}
        <button 
          className="btn-primary" 
          onClick={onOpenCommandBar}
          style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', borderRadius: '8px' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span>Command Bar</span>
          <span 
            style={{ 
              marginLeft: 'auto', 
              fontSize: '10px', 
              background: 'rgba(255,255,255,0.2)', 
              padding: '2px 5px', 
              borderRadius: '4px',
              fontWeight: 'normal'
            }}
          >
            Ctrl+A
          </span>
        </button>

        {/* Workspaces Switcher */}
        {workspaces.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.5px' }}>
              Workspaces
            </span>
            <select 
              value={activeWorkspaceId} 
              onChange={(e) => {
                onSmartFilterChange(null);
                onWorkspaceChange(Number(e.target.value));
                onViewChange('board');
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-light)',
                fontSize: '13px',
                fontWeight: '500',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button 
            onClick={() => {
              onSmartFilterChange(null);
              onViewChange('board');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 12px',
              background: (activeView === 'board' && !activeSmartFilter) ? 'var(--primary-light)' : 'transparent',
              color: (activeView === 'board' && !activeSmartFilter) ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: (activeView === 'board' && !activeSmartFilter) ? '600' : '500',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
            </svg>
            <span>Kanban Board</span>
          </button>

          <button 
            onClick={() => onViewChange('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 12px',
              background: activeView === 'dashboard' ? 'var(--primary-light)' : 'transparent',
              color: activeView === 'dashboard' ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: activeView === 'dashboard' ? '600' : '500',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>Analytics</span>
          </button>

          <button 
            onClick={() => onViewChange('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 12px',
              background: activeView === 'settings' ? 'var(--primary-light)' : 'transparent',
              color: activeView === 'settings' ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: activeView === 'settings' ? '600' : '500',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>
        </div>

        {/* Smart Filtered Views */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Filters
          </span>
          {[
            { id: 'today', name: 'Today' },
            { id: 'overdue', name: 'Overdue' },
            { id: 'archive', name: 'Archived' }
          ].map(view => {
            const isActive = activeSmartFilter === view.id;
            return (
              <button 
                key={view.id}
                onClick={() => {
                  onSmartFilterChange(isActive ? null : view.id);
                  onViewChange('board');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '8px 12px',
                  background: isActive ? 'var(--primary-light)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-main)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '500',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ opacity: isActive ? 1 : 0.6 }}>
                  {view.id === 'today' && (
                    <>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </>
                  )}
                  {view.id === 'overdue' && (
                    <>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </>
                  )}
                  {view.id === 'archive' && (
                    <>
                      <polyline points="21 8 21 21 3 21 3 8" />
                      <rect x="1" y="3" width="22" height="5" />
                      <line x1="10" y1="12" x2="14" y2="12" />
                    </>
                  )}
                </svg>
                <span>{view.name}</span>
                {view.id === 'overdue' && todos.filter(t => t.status !== 'Completed' && t.status !== 'Canceled' && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString())).length > 0 && (
                  <span style={{ marginLeft: 'auto', background: 'var(--color-canceled)', color: '#fff', fontSize: '9px', padding: '1px 5px', borderRadius: '10px', fontWeight: 'bold' }}>
                    {todos.filter(t => t.status !== 'Completed' && t.status !== 'Canceled' && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString())).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Pomodoro Timer Badge */}
        {pomodoroTimer && pomodoroTimer.isActive && (
          <div 
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              borderRadius: '10px',
              padding: '12px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-canceled)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                Focus Session
              </span>
              <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-canceled)' }}>
                {String(pomodoroTimer.minutes).padStart(2, '0')}:{String(pomodoroTimer.seconds).padStart(2, '0')}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pomodoroTimer.taskTitle}>
              Focusing: {pomodoroTimer.taskTitle}
            </span>
            <button 
              className="btn-secondary" 
              onClick={onStopPomodoro}
              style={{ 
                width: '100%', 
                padding: '4px 8px', 
                fontSize: '11px', 
                justifyContent: 'center', 
                borderColor: 'rgba(239,68,68,0.4)', 
                color: 'var(--color-canceled)' 
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Completion Dashboard Gauge */}
        <div 
          style={{
            background: 'var(--bg-card)',
            borderRadius: '10px',
            padding: '14px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500' }}>
            <span style={{ color: 'var(--text-muted)' }}>Progress</span>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{rate}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${rate}%`, 
                height: '100%', 
                background: 'var(--primary)',
                borderRadius: '3px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {completed} of {total} completed
          </span>
        </div>
      </div>
    </div>
  );
}

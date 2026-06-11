import React, { useState, useRef, useEffect } from 'react';

export default function TaskCard({ todo, onUpdate, onDelete, onStartPomodoro, viewMode = 'row' }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const inputRef = useRef(null);

  const handleCopyToClipboard = () => {
    const priority = todo.priority || 'Medium';
    const dueDate = todo.due_date ? todo.due_date : 'N/A';
    const formatted = `[${priority} Priority] Task: ${todo.title} (Due: ${dueDate}) - Status: ${todo.status}`;
    
    navigator.clipboard.writeText(formatted)
      .then(() => {
        alert('Task copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy task:', err);
      });
  };

  const handleExportSingleTask = () => {
    const priority = todo.priority || 'Medium';
    const dueDate = todo.due_date ? todo.due_date : 'N/A';
    const content = `YoDo Task Details\n=================\nTask ID: #${todo.id}\nTitle: ${todo.title}\nStatus: ${todo.status}\nPriority: ${priority}\nDue Date: ${dueDate}\nCreated At: ${todo.created_at || 'N/A'}\nUpdated At: ${todo.updated_at || 'N/A'}\n`;
    
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `task-${todo.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (!editTitle.trim()) {
      setEditTitle(todo.title);
      setIsEditing(false);
      return;
    }
    if (editTitle.trim() !== todo.title) {
      await onUpdate(todo.id, { title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(todo.title);
      setIsEditing(false);
    }
  };

  // Format Due Dates beautifully
  const getDueBadge = () => {
    if (!todo.due_date) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const dueStr = todo.due_date;

    const today = new Date(todayStr);
    const due = new Date(dueStr);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let badgeClass = 'task-due';
    let badgeText = dueStr;

    if (diffDays < 0) {
      badgeClass = 'task-due overdue';
      badgeText = `Overdue (${Math.abs(diffDays)}d ago)`;
    } else if (diffDays === 0) {
      badgeClass = 'task-due today';
      badgeText = 'Today';
    } else if (diffDays === 1) {
      badgeClass = 'task-due';
      badgeText = 'Tomorrow';
    } else if (diffDays > 1 && diffDays <= 7) {
      badgeClass = 'task-due';
      badgeText = `In ${diffDays} days`;
    }

    return (
      <div className={badgeClass} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>{badgeText}</span>
      </div>
    );
  };

  // Generate color-coded Priority pill
  const getPriorityBadge = () => {
    const priority = todo.priority || 'Medium';
    let color = 'var(--text-muted)';
    let bg = 'var(--bg-sidebar)';
    
    if (priority === 'High') {
      color = 'var(--color-canceled)';
      bg = 'var(--color-canceled-bg)';
    } else if (priority === 'Medium') {
      color = 'var(--color-progress)';
      bg = 'var(--color-progress-bg)';
    } else if (priority === 'Low') {
      color = 'var(--color-open)';
      bg = 'var(--color-open-bg)';
    }

    return (
      <span 
        style={{ 
          fontSize: '9px', 
          fontWeight: 'bold', 
          padding: '2px 6px', 
          borderRadius: '4px', 
          color, 
          backgroundColor: bg,
          textTransform: 'uppercase',
          letterSpacing: '0.2px'
        }}
      >
        {priority}
      </span>
    );
  };

  if (viewMode === 'column') {
    return (
      <div className="task-card">
        {/* Card Header: ID, Priority, and Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={todo.status === 'Completed'}
              onChange={() => onUpdate(todo.id, { status: todo.status === 'Completed' ? 'Open' : 'Completed' })}
              style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 'bold' }}>
              #{todo.id}
            </span>
            {getPriorityBadge()}
          </div>
          <div className="task-actions" style={{ display: 'flex', gap: '4px' }}>
            {todo.status !== 'Completed' && todo.status !== 'Canceled' && (
              <button 
                className="icon-btn" 
                onClick={() => onStartPomodoro && onStartPomodoro(todo.id, todo.title)} 
                title="Start Focus"
                style={{ color: 'var(--color-canceled)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
              </button>
            )}
            <button className="icon-btn" onClick={handleCopyToClipboard} title="Copy">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button className="icon-btn delete" onClick={() => onDelete(todo.id)} title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Card Body: Title */}
        <div style={{ margin: '6px 0' }}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="inline-edit-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              style={{ width: '100%' }}
            />
          ) : (
            <div 
              style={{ 
                fontWeight: '500',
                fontSize: '13px',
                color: 'var(--text-main)',
                lineHeight: '1.4',
                textDecoration: todo.status === 'Completed' ? 'line-through' : 'none',
                opacity: todo.status === 'Completed' ? 0.6 : 1,
                wordBreak: 'break-word'
              }}
              onDoubleClick={() => setIsEditing(true)} 
              title="Double click to rename"
            >
              {todo.title}
            </div>
          )}
        </div>

        {/* Card Footer: selectors and Due date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <select 
              style={{ 
                border: '1px solid var(--border-light)', 
                background: 'var(--bg-card)', 
                fontSize: '10px', 
                color: 'var(--text-main)',
                cursor: 'pointer',
                borderRadius: '4px',
                padding: '2px 4px',
                outline: 'none'
              }}
              value={todo.priority || 'Medium'}
              onChange={(e) => onUpdate(todo.id, { priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>

            <select 
              style={{ 
                border: '1px solid var(--border-light)', 
                background: 'var(--bg-card)', 
                fontSize: '10px', 
                color: 'var(--text-main)',
                cursor: 'pointer',
                borderRadius: '4px',
                padding: '2px 4px',
                outline: 'none'
              }}
              value={todo.status}
              onChange={(e) => onUpdate(todo.id, { status: e.target.value })}
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Canceled">Canceled</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {getDueBadge() || <div />}
            {/* Archive / Restore Button */}
            {(todo.status === 'Completed' || todo.status === 'Canceled' || todo.archived === 1 || todo.archived === 'true' || todo.archived === true) && (
              <button 
                className="icon-btn"
                onClick={() => onUpdate(todo.id, { archived: (todo.archived === 1 || todo.archived === 'true' || todo.archived === true) ? 0 : 1 })}
                title={(todo.archived === 1 || todo.archived === 'true' || todo.archived === true) ? "Restore" : "Archive"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="task-card-row">
      <div className="task-row-left">
        {/* Clickable Status Checkbox */}
        <input
          type="checkbox"
          checked={todo.status === 'Completed'}
          onChange={() => onUpdate(todo.id, { status: todo.status === 'Completed' ? 'Open' : 'Completed' })}
          style={{
            cursor: 'pointer',
            width: '16px',
            height: '16px',
            accentColor: 'var(--primary)'
          }}
          title={todo.status === 'Completed' ? 'Re-open task' : 'Complete task'}
        />

        {/* Task ID Tag */}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 'bold', minWidth: '28px' }}>
          #{todo.id}
        </span>

        {/* Priority Badge */}
        {getPriorityBadge()}

        {/* Inline Title Editor */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="inline-edit-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
        ) : (
          <div 
            className="task-title" 
            style={{ 
              flex: 1, 
              textDecoration: todo.status === 'Completed' ? 'line-through' : 'none',
              opacity: todo.status === 'Completed' ? 0.6 : 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            onDoubleClick={() => setIsEditing(true)} 
            title="Double click to rename"
          >
            {todo.title}
          </div>
        )}
      </div>

      <div className="task-row-right">
        {/* Dynamic Due Date Badge */}
        {getDueBadge() || <div style={{ width: '1px' }} />}

        {/* Priority Selector */}
        <select 
          style={{ 
            border: '1px solid var(--border-light)', 
            background: 'var(--bg-card)', 
            fontSize: '11px', 
            color: 'var(--text-main)',
            cursor: 'pointer',
            outline: 'none',
            fontWeight: '600',
            borderRadius: '4px',
            padding: '4px 8px'
          }}
          value={todo.priority || 'Medium'}
          onChange={(e) => onUpdate(todo.id, { priority: e.target.value })}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>

        {/* Status Dropdown selector */}
        <select 
          style={{ 
            border: '1px solid var(--border-light)', 
            background: 'var(--bg-card)', 
            fontSize: '11px', 
            color: 'var(--text-main)',
            cursor: 'pointer',
            outline: 'none',
            fontWeight: '600',
            borderRadius: '4px',
            padding: '4px 8px'
          }}
          value={todo.status}
          onChange={(e) => onUpdate(todo.id, { status: e.target.value })}
        >
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Canceled">Canceled</option>
        </select>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Pomodoro Focus play button */}
          {todo.status !== 'Completed' && todo.status !== 'Canceled' && (
            <button 
              className="icon-btn" 
              onClick={() => onStartPomodoro && onStartPomodoro(todo.id, todo.title)} 
              title="Start 25-min Pomodoro Focus"
              style={{ color: 'var(--color-canceled)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
            </button>
          )}

          {/* Copy to Clipboard button */}
          <button className="icon-btn" onClick={handleCopyToClipboard} title="Copy task to clipboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>

          {/* Single task export TXT button */}
          <button className="icon-btn" onClick={handleExportSingleTask} title="Export task as text file">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Archive / Restore Toggle button */}
          {todo.archived === 1 || todo.archived === 'true' || todo.archived === true ? (
            <button className="icon-btn" onClick={() => onUpdate(todo.id, { archived: 0 })} title="Restore task from Archive">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          ) : (
            (todo.status === 'Completed' || todo.status === 'Canceled') && (
              <button className="icon-btn" onClick={() => onUpdate(todo.id, { archived: 1 })} title="Move task to Archive">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </button>
            )
          )}

          <button className="icon-btn" onClick={() => setIsEditing(true)} title="Rename task">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          
          <button className="icon-btn delete" onClick={() => onDelete(todo.id)} title="Delete task">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

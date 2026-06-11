import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

export default function MiniWindow({ todos, onRefresh, onUpdateTodo, onAddTodo }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Auto focus input on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Filter tasks based on query (only active tasks)
  const activeTodos = todos.filter(t => t.status === 'Open' || t.status === 'In Progress');
  const filteredTodos = activeTodos.filter(t => 
    t.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Check if query matches a command pattern or is just a task title
    // For simplicity, we just add it as a new task!
    let title = query.trim();
    let status = 'Open';
    let dueDate = null;

    // Parse simple add keyword if typed (e.g. "add buy groceries")
    if (title.toLowerCase().startsWith('add ')) {
      title = title.substring(4).trim();
    }

    try {
      await onAddTodo({ title, status, dueDate });
      setQuery('');
      api.sendNotification('Task Added', `Task "${title}" created via mini window.`);
    } catch (err) {
      console.error('[MiniWindow] Add error:', err);
    }
  };

  const handleToggleTodo = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Completed' ? 'Open' : 'Completed';
    await onUpdateTodo(id, { status: nextStatus });
    api.sendNotification('Task Completed', `Checked off task #${id}.`);
  };

  return (
    <div className="mini-layout">
      {/* Mini Titlebar */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(0, 0, 0, 0.15)'
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#e5e7eb', letterSpacing: '-0.3px' }}>
          YoDo Task Quick Access
        </span>
        <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
          ESC to Close
        </span>
      </div>

      {/* Input section */}
      <form onSubmit={handleSubmit} style={{ padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '10px 12px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'rgba(255, 255, 255, 0.4)', marginRight: '10px' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks or type title + Enter to add..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: '#ffffff',
              fontSize: '14px',
              flex: 1
            }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </form>

      {/* Task List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
        {filteredTodos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTodos.slice(0, 10).map((todo) => (
              <div 
                key={todo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={todo.status === 'Completed'}
                    onChange={() => handleToggleTodo(todo.id, todo.status)}
                    style={{
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px',
                      accentColor: 'var(--primary)'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#e5e7eb' }}>
                    {todo.title}
                  </span>
                </div>
                
                <span 
                  style={{
                    fontSize: '9px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: todo.status === 'In Progress' ? 'var(--color-progress)' : 'var(--color-open)',
                    backgroundColor: todo.status === 'In Progress' ? 'var(--color-progress-bg)' : 'var(--color-open-bg)'
                  }}
                >
                  {todo.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'rgba(255, 255, 255, 0.4)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span style={{ fontSize: '12px' }}>
              {query.trim() ? `Press Enter to create: "${query}"` : 'No active tasks found'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

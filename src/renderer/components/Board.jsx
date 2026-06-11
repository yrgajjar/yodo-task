import React, { useState } from 'react';
import TaskCard from './TaskCard';

export default function Board({ todos, onUpdateTodo, onDeleteTodo, onAddTodo, visibleSections, onStartPomodoro }) {
  const columns = ['Open', 'In Progress', 'Completed', 'Canceled'];
  
  // Track which sections have the inline adder active
  const [activeAdderCol, setActiveAdderCol] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');

  const handleAddInline = async (status) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setActiveAdderCol(null);
      return;
    }

    // Duplicate Task Detection
    const isDuplicate = todos.some(t => t.title.toLowerCase().trim() === trimmedTitle.toLowerCase());
    if (isDuplicate) {
      const confirmAdd = window.confirm(`Warning: A task with the title "${trimmedTitle}" already exists. Do you still want to create this duplicate task?`);
      if (!confirmAdd) return;
    }
    
    await onAddTodo({
      title: trimmedTitle,
      status: status,
      dueDate: newDueDate || null,
      priority: newPriority
    });
    
    setNewTitle('');
    setNewDueDate('');
    setNewPriority('Medium');
    setActiveAdderCol(null);
  };

  const handleKeyDown = (e, status) => {
    if (e.key === 'Enter') {
      handleAddInline(status);
    } else if (e.key === 'Escape') {
      setActiveAdderCol(null);
      setNewTitle('');
      setNewDueDate('');
      setNewPriority('Medium');
    }
  };

  const [viewMode, setViewMode] = useState('column'); // 'column' (Kanban) or 'row' (list)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* View Toggle Bar */}
      <div className="view-toggle-container">
        <button 
          className={`view-toggle-btn ${viewMode === 'column' ? 'active' : ''}`}
          onClick={() => setViewMode('column')}
        >
          Column View
        </button>
        <button 
          className={`view-toggle-btn ${viewMode === 'row' ? 'active' : ''}`}
          onClick={() => setViewMode('row')}
        >
          Row View
        </button>
      </div>

      {viewMode === 'row' ? (
        <div className="board-rows">
          {columns.map((status) => {
            if (!visibleSections.includes(status)) return null;

            const columnTodos = todos.filter((t) => t.status === status);
            const dotClass = `status-dot ${status.toLowerCase().replace(' ', '')}`;

            return (
              <div key={status} className="board-row-section">
                {/* Row Section Header */}
                <div className="row-section-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={dotClass}></span>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>{status}</span>
                    <span className="column-count" style={{ marginLeft: '6px' }}>{columnTodos.length}</span>
                  </div>

                  {/* Quick Add Button in Header */}
                  {activeAdderCol !== status && (
                    <button 
                      className="icon-btn" 
                      onClick={() => setActiveAdderCol(status)}
                      title={`Add task to ${status}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Tasks Container */}
                <div className="row-cards-container">
                  {/* Quick Inline Task Adder */}
                  {activeAdderCol === status && (
                    <div 
                      className="task-card-row" 
                      style={{ 
                        border: '1px solid var(--primary)', 
                        cursor: 'default',
                      }}
                    >
                      <div className="task-row-left">
                        <input
                          type="text"
                          placeholder="Task title..."
                          className="inline-edit-input"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, status)}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                      </div>
                      <div className="task-row-right" style={{ gap: '8px' }}>
                        <select
                          style={{
                            fontSize: '11px',
                            border: '1px solid var(--border-light)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            background: 'var(--bg-app)',
                            color: 'var(--text-main)',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value)}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>

                        <input
                          type="date"
                          style={{
                            fontSize: '12px',
                            border: '1px solid var(--border-light)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            background: 'var(--bg-app)',
                            color: 'var(--text-main)',
                            outline: 'none'
                          }}
                          value={newDueDate}
                          onChange={(e) => setNewDueDate(e.target.value)}
                        />
                        <button 
                          className="btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleAddInline(status)}
                        >
                          Add
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => {
                            setActiveAdderCol(null);
                            setNewTitle('');
                            setNewDueDate('');
                            setNewPriority('Medium');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tasks List */}
                  {columnTodos.map((todo) => (
                    <TaskCard
                      key={todo.id}
                      todo={todo}
                      onUpdate={onUpdateTodo}
                      onDelete={onDeleteTodo}
                      onStartPomodoro={onStartPomodoro}
                      viewMode="row"
                    />
                  ))}

                  {columnTodos.length === 0 && activeAdderCol !== status && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No tasks in this section
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="board-columns-grid">
          {columns.map((status) => {
            if (!visibleSections.includes(status)) return null;

            const columnTodos = todos.filter((t) => t.status === status);
            const dotClass = `status-dot ${status.toLowerCase().replace(' ', '')}`;

            return (
              <div key={status} className="board-column">
                {/* Column Header */}
                <div className="board-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={dotClass}></span>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>{status}</span>
                    <span className="column-count" style={{ marginLeft: '6px' }}>{columnTodos.length}</span>
                  </div>

                  {activeAdderCol !== status && (
                    <button 
                      className="icon-btn" 
                      onClick={() => setActiveAdderCol(status)}
                      title={`Add task to ${status}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Column Tasks List */}
                <div className="board-column-tasks">
                  {/* Quick Inline Task Adder */}
                  {activeAdderCol === status && (
                    <div 
                      style={{ 
                        background: 'var(--bg-card)',
                        border: '1.5px solid var(--primary)', 
                        borderRadius: '8px',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: 'var(--shadow-md)'
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Task title..."
                        className="inline-edit-input"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, status)}
                        autoFocus
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select
                          style={{
                            fontSize: '11px',
                            border: '1px solid var(--border-light)',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            background: 'var(--bg-app)',
                            color: 'var(--text-main)',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value)}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>

                        <input
                          type="date"
                          style={{
                            fontSize: '11px',
                            border: '1px solid var(--border-light)',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            background: 'var(--bg-app)',
                            color: 'var(--text-main)',
                            outline: 'none'
                          }}
                          value={newDueDate}
                          onChange={(e) => setNewDueDate(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => {
                            setActiveAdderCol(null);
                            setNewTitle('');
                            setNewDueDate('');
                            setNewPriority('Medium');
                          }}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn-primary" 
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleAddInline(status)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {columnTodos.map((todo) => (
                    <TaskCard
                      key={todo.id}
                      todo={todo}
                      onUpdate={onUpdateTodo}
                      onDelete={onDeleteTodo}
                      onStartPomodoro={onStartPomodoro}
                      viewMode="column"
                    />
                  ))}

                  {columnTodos.length === 0 && activeAdderCol !== status && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-app)', border: '1px dashed var(--border-light)', borderRadius: '8px' }}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

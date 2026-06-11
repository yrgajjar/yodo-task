import React, { useState, useEffect, useRef } from 'react';

export default function QuickAdd({ onAddTodo, onClose }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus the input box automatically on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cmd = value.trim();
    if (!cmd) {
      onClose();
      return;
    }

    try {
      // Parse priority from title, e.g. "task name priority high"
      let priority = 'Medium';
      let title = cmd;

      if (/\bpriority\s+high\b/i.test(cmd)) {
        priority = 'High';
        title = cmd.replace(/\bpriority\s+high\b/i, '').trim();
      } else if (/\bpriority\s+low\b/i.test(cmd)) {
        priority = 'Low';
        title = cmd.replace(/\bpriority\s+low\b/i, '').trim();
      } else if (/\bpriority\s+medium\b/i.test(cmd)) {
        priority = 'Medium';
        title = cmd.replace(/\bpriority\s+medium\b/i, '').trim();
      }

      await onAddTodo({
        title,
        status: 'Open',
        priority,
        workspace_id: 1 // Default workspace Personal
      });

      // Clear input and close window
      setValue('');
      onClose();
    } catch (err) {
      console.error('[QuickAdd] Failed to add todo:', err);
      onClose();
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px',
      boxSizing: 'border-box'
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        background: 'rgba(23, 23, 23, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Quick add task... (e.g. Write presentation priority high)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}
          />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#737373',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '6px',
          marginTop: '4px'
        }}>
          <span>Press Enter to add task</span>
          <span>Esc to close</span>
        </div>
      </form>
    </div>
  );
}

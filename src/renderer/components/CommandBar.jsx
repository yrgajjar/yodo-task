import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

export default function CommandBar({ isOpen, onClose, onRefresh }) {
  const [value, setValue] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [parsedCommand, setParsedCommand] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setSuggestion('');
      setParsedCommand(null);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Command parser logic
  useEffect(() => {
    const text = value.trim();
    if (!text) {
      setSuggestion('');
      setParsedCommand(null);
      return;
    }

    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'add') {
      const rest = text.substring(3).trim();
      if (!rest) {
        setSuggestion("Will add task: '[type title...]'");
        setParsedCommand(null);
        return;
      }

      // Regex to detect "priority [low|medium|high]"
      const prioRegex = /priority\s+(low|medium|high)/i;
      const prioMatch = rest.match(prioRegex);
      
      let priority = 'Medium';
      let titleWithDue = rest;
      
      if (prioMatch) {
        priority = prioMatch[1].charAt(0).toUpperCase() + prioMatch[1].slice(1).toLowerCase();
        titleWithDue = rest.replace(prioRegex, '').trim();
      }

      // Regex to detect "due YYYY-MM-DD", "due today", "due tomorrow"
      const dueRegex = /due\s+(today|tomorrow|\d{4}-\d{2}-\d{2})/i;
      const match = titleWithDue.match(dueRegex);
      
      let title = titleWithDue;
      let dueDate = null;
      let dueDisplay = '';

      if (match) {
        title = titleWithDue.replace(dueRegex, '').trim();
        const dueVal = match[1].toLowerCase();
        
        const today = new Date();
        if (dueVal === 'today') {
          dueDate = today.toISOString().split('T')[0];
          dueDisplay = ' (due: Today)';
        } else if (dueVal === 'tomorrow') {
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          dueDate = tomorrow.toISOString().split('T')[0];
          dueDisplay = ' (due: Tomorrow)';
        } else {
          dueDate = dueVal;
          dueDisplay = ` (due: ${dueVal})`;
        }
      }

      setSuggestion(`Will add task: "${title}" [Priority: ${priority}]${dueDisplay}`);
      setParsedCommand({
        action: 'add',
        payload: { title, status: 'Open', dueDate, priority }
      });

    } else if (cmd === 'edit') {
      const id = parts[1];
      if (!id || isNaN(id)) {
        setSuggestion("Syntax error: 'edit [numeric_id] [new title]'");
        setParsedCommand(null);
        return;
      }

      const idIndex = text.indexOf(id);
      const newTitle = text.substring(idIndex + id.length).trim();

      if (!newTitle) {
        setSuggestion(`Will update task #${id}: "[type new title...]"`);
        setParsedCommand(null);
        return;
      }

      setSuggestion(`Will rename task #${id} to: "${newTitle}"`);
      setParsedCommand({
        action: 'edit',
        payload: { id: parseInt(id), fields: { title: newTitle } }
      });

    } else if (cmd === 'delete') {
      const id = parts[1];
      if (!id || isNaN(id)) {
        setSuggestion("Syntax error: 'delete [numeric_id]'");
        setParsedCommand(null);
        return;
      }

      setSuggestion(`Will delete task #${id}`);
      setParsedCommand({
        action: 'delete',
        payload: { id: parseInt(id) }
      });

    } else if (cmd === 'status') {
      const id = parts[1];
      if (!id || isNaN(id)) {
        setSuggestion("Syntax error: 'status [numeric_id] [Open | Progress | Completed | Canceled]'");
        setParsedCommand(null);
        return;
      }

      const rawStatus = parts.slice(2).join(' ').toLowerCase();
      let status = '';
      if (rawStatus.startsWith('o')) status = 'Open';
      else if (rawStatus.startsWith('i') || rawStatus.includes('prog')) status = 'In Progress';
      else if (rawStatus.startsWith('comp') || rawStatus.startsWith('d')) status = 'Completed';
      else if (rawStatus.startsWith('can')) status = 'Canceled';

      if (!status) {
        setSuggestion(`Will change task #${id} status to: '[type Open/Progress/Completed/Canceled]'`);
        setParsedCommand(null);
        return;
      }

      setSuggestion(`Will update status of task #${id} to: "${status}"`);
      setParsedCommand({
        action: 'status',
        payload: { id: parseInt(id), fields: { status } }
      });

    } else if (cmd === 'complete' || cmd === 'done') {
      const id = parts[1];
      if (!id || isNaN(id)) {
        setSuggestion(`Syntax error: '${cmd} [numeric_id]'`);
        setParsedCommand(null);
        return;
      }

      setSuggestion(`Will complete task #${id}`);
      setParsedCommand({
        action: 'status',
        payload: { id: parseInt(id), fields: { status: 'Completed' } }
      });
      
    } else {
      setSuggestion("Unknown keyword. Start typing: 'add ...', 'edit ...', 'delete ...', 'status ...'");
      setParsedCommand(null);
    }
  }, [value]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parsedCommand) return;

    try {
      const { action, payload } = parsedCommand;
      if (action === 'add') {
        await api.addTodo(payload);
        api.sendNotification('Task Created', `Added: "${payload.title}"`);
      } else if (action === 'edit') {
        await api.updateTodo(payload.id, payload.fields);
        api.sendNotification('Task Renamed', `Task #${payload.id} renamed.`);
      } else if (action === 'delete') {
        await api.deleteTodo(payload.id);
        api.sendNotification('Task Deleted', `Task #${payload.id} removed.`);
      } else if (action === 'status') {
        await api.updateTodo(payload.id, payload.fields);
        api.sendNotification('Status Updated', `Task #${payload.id} status changed to ${payload.fields.status}.`);
      }
      
      onRefresh();
      onClose();
    } catch (err) {
      console.error('[CommandBar] Action error:', err);
      setSuggestion(`Error: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="overlay" style={{ background: 'rgba(0,0,0,0.2)' }} onClick={onClose}>
      <div className="command-overlay" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="command-input-container">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '10px', color: 'var(--text-muted)' }}>
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-main-input"
            placeholder="Type command here... (e.g. add Design dashboard priority high due tomorrow)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="command-badge">CMD</span>
        </form>
        
        <div className="command-helper">
          <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>
            {suggestion || "Type a command to control your task list:"}
          </div>
          
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px' }}>
            Supported syntax structures:
          </div>
          
          <div className="command-syntax">
            <span className="syntax-tag">add [title] priority [low|medium|high] due [today|tomorrow|YYYY-MM-DD]</span>
            <span className="syntax-tag">edit [id] [new title]</span>
            <span className="syntax-tag">delete [id]</span>
            <span className="syntax-tag">status [id] [open|progress|completed|canceled]</span>
            <span className="syntax-tag">complete [id]</span>
          </div>
        </div>
      </div>
    </div>
  );
}

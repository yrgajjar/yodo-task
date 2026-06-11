import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Stats({ todos, settings }) {
  const [weeklyData, setWeeklyData] = useState({
    weeklyCompleted: [],
    totalSessions: 0,
    totalFocusMinutes: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchWeeklyStats = async () => {
      try {
        const host = api.getHost(settings?.port);
        const res = await fetch(`${host}/api/stats/weekly`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        if (active) {
          setWeeklyData(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching weekly stats:', err);
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchWeeklyStats();
    return () => { active = false; };
  }, [settings]);

  const total = todos.length;
  const open = todos.filter(t => t.status === 'Open').length;
  const progress = todos.filter(t => t.status === 'In Progress').length;
  const completed = todos.filter(t => t.status === 'Completed').length;
  const canceled = todos.filter(t => t.status === 'Canceled').length;

  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Deadline statistics
  const todayStr = new Date().toISOString().split('T')[0];
  let overdue = 0;
  let dueToday = 0;
  let dueUpcoming = 0;

  todos.forEach(todo => {
    if (!todo.due_date || todo.status === 'Completed' || todo.status === 'Canceled') return;
    
    if (todo.due_date < todayStr) {
      overdue++;
    } else if (todo.due_date === todayStr) {
      dueToday++;
    } else {
      const today = new Date(todayStr);
      const due = new Date(todo.due_date);
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        dueUpcoming++;
      }
    }
  });

  const maxCompletedCount = Math.max(...(weeklyData.weeklyCompleted?.map(d => d.completedCount) || [0]), 1);

  // Format focus minutes to readable string
  const formatFocusTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} mins`;
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs} hrs ${mins} mins` : `${hrs} hrs`;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Analytics & Productivity</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Real-time overview of your tasks and performance productivity.</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '6px' }}>Total Tasks</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-main)' }}>{total}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-completed)', fontWeight: '500', marginBottom: '6px' }}>Completed</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-completed)' }}>{completed}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-progress)', fontWeight: '500', marginBottom: '6px' }}>In Progress</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-progress)' }}>{progress}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-open)', fontWeight: '500', marginBottom: '6px' }}>Open Tasks</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-open)' }}>{open}</div>
        </div>
      </div>

      {/* Main Grid: Progress Dial and Deadlines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Performance Box */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Overall Efficiency</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', position: 'relative' }}>
            {/* Round completion gauge */}
            <div 
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `conic-gradient(var(--primary) ${rate * 3.6}deg, var(--bg-app) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)'
              }}
            >
              <div 
                style={{
                  width: '94px',
                  height: '94px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>{rate}%</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Done</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontWeight: 'bold', color: 'var(--color-completed)' }}>{completed}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Completed</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontWeight: 'bold', color: 'var(--color-canceled)' }}>{canceled}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Canceled</span>
            </div>
          </div>
        </div>

        {/* Deadlines Box */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Schedule & Deadlines</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-canceled)' }}></span>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Overdue Tasks</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-canceled)' }}>{overdue}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-progress)' }}></span>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Due Today</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-progress)' }}>{dueToday}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-open)' }}></span>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Due Within 7 Days</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-open)' }}>{dueUpcoming}</span>
            </div>
          </div>
        </div>
      </div>

      {/* New Row: Weekly completed task chart & Pomodoro focus summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* Weekly Completed Tasks Bar Chart */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Weekly Activity (Tasks Completed)</h3>
          
          {loading ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading weekly report...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '180px', justifyContent: 'space-between' }}>
              {/* Bars container */}
              <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
                {weeklyData.weeklyCompleted?.map((day, idx) => {
                  const pct = (day.completedCount / maxCompletedCount) * 100;
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        flex: 1, 
                        height: '100%', 
                        justifyContent: 'flex-end',
                        position: 'relative'
                      }}
                      title={`${day.completedCount} tasks completed on ${day.dateStr}`}
                    >
                      {/* Count tooltip on hover */}
                      <span 
                        style={{ 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: 'var(--text-muted)',
                          marginBottom: '4px'
                        }}
                      >
                        {day.completedCount}
                      </span>
                      
                      {/* Visual Bar */}
                      <div 
                        style={{ 
                          width: '60%', 
                          maxWidth: '28px',
                          height: `${Math.max(pct, 5)}%`, 
                          background: day.completedCount > 0 ? 'linear-gradient(180deg, var(--primary) 0%, rgba(var(--primary-rgb), 0.5) 100%)' : 'var(--border-light)', 
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease, background 0.3s ease',
                          boxShadow: day.completedCount > 0 ? '0 2px 4px rgba(var(--primary-rgb), 0.2)' : 'none'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              
              {/* Day names */}
              <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: '8px' }}>
                {weeklyData.weeklyCompleted?.map((day, idx) => (
                  <span key={idx} style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)' }}>
                    {day.dayName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pomodoro Focus Stats */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Pomodoro Productivity Focus</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', height: '180px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              {/* Cool ticking watch icon */}
              <div style={{ background: 'var(--color-canceled-bg)', color: 'var(--color-canceled)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>TOTAL FOCUS DURATION</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                  {loading ? '--' : formatFocusTime(weeklyData.totalFocusMinutes)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              {/* Checkmark icon for sessions */}
              <div style={{ background: 'var(--color-completed-bg)', color: 'var(--color-completed)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>COMPLETED SESSIONS</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                  {loading ? '--' : `${weeklyData.totalSessions} sessions`}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

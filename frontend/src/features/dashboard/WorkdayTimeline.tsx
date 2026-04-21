import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Timer, Coffee, Info } from 'lucide-react';
import { apiRequest } from '../../services/api';
import './WorkdayTimeline.css';

interface WorkdayTimelineProps {
  startTime?: string;
  endTime?: string;
  lateThreshold?: string;
  checkInTime?: string | Date | null;
  token?: string | null;
}

type BreakSession = {
  id: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
};

const BREAK_SCHEDULE_DATA = [
  { label: 'Lunch', start: '13:30', end: '14:30', display: '1:30 PM – 2:30 PM' },
  { label: 'Tea Break', start: '17:00', end: '17:30', display: '5:00 PM – 5:30 PM' },
];

function format12h(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

const WorkdayTimeline: React.FC<WorkdayTimelineProps> = ({
  startTime = "10:00",
  endTime = "19:00",
  lateThreshold = "10:10",
  checkInTime = null,
  token = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lateThresholdPct, setLateThresholdPct] = useState(0);
  const [checkInPct, setCheckInPct] = useState<number | null>(null);
  const [checkInLabel, setCheckInLabel] = useState<string>('');
  const [workedTime, setWorkedTime] = useState<{ hours: number; minutes: number } | null>(null);
  const [isShiftOver, setIsShiftOver] = useState(false);
  const [isShiftPending, setIsShiftPending] = useState(false);
  const [checkInIsLate, setCheckInIsLate] = useState(false);
  const [breakSessions, setBreakSessions] = useState<BreakSession[]>([]);

  // Hover Tooltip State
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);

  const loadBreaks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest<{ breakSessions: BreakSession[] }>('/attendance/break/today', { token });
      setBreakSessions(res.data?.breakSessions ?? []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    loadBreaks();
    const handler = () => loadBreaks();
    window.addEventListener('break-updated', handler);
    return () => window.removeEventListener('break-updated', handler);
  }, [loadBreaks]);

  useEffect(() => {
    const calculate = () => {
      const now = new Date();
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const [lateH, lateM] = lateThreshold.split(':').map(Number);

      const start = new Date(now); start.setHours(startH, startM, 0, 0);
      const end = new Date(now); end.setHours(endH, endM, 0, 0);
      const late = new Date(now); late.setHours(lateH, lateM, 0, 0);

      const totalMs = end.getTime() - start.getTime();
      const elapsedMs = now.getTime() - start.getTime();
      const latePct = ((late.getTime() - start.getTime()) / totalMs) * 100;

      const pct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
      setProgress(pct);
      setLateThresholdPct(latePct);
      setIsShiftOver(now > end);
      setIsShiftPending(now < start);

      if (checkInTime) {
        const ci = new Date(checkInTime);
        const ciToday = new Date(now);
        ciToday.setHours(ci.getHours(), ci.getMinutes(), ci.getSeconds(), 0);
        const workedMs = Math.max(0, now.getTime() - ciToday.getTime());
        const workedMins = Math.floor(workedMs / 60000);
        setWorkedTime({ hours: Math.floor(workedMins / 60), minutes: workedMins % 60 });
        const ciPct = Math.max(0, Math.min(100, ((ciToday.getTime() - start.getTime()) / totalMs) * 100));
        setCheckInPct(ciPct);
        setCheckInLabel(ci.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
        setCheckInIsLate(ciToday > late);
      } else {
        setWorkedTime(null); setCheckInPct(null); setCheckInLabel(''); setCheckInIsLate(false);
      }
    };

    calculate();
    const iv = setInterval(calculate, 30000);
    return () => clearInterval(iv);
  }, [startTime, endTime, lateThreshold, checkInTime]);

  const breakSessionsMapped = breakSessions.map(s => {
    const now = new Date();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const shiftStart = new Date(now); shiftStart.setHours(startH, startM, 0, 0);
    const shiftEnd = new Date(now); shiftEnd.setHours(endH, endM, 0, 0);
    const totalMs = shiftEnd.getTime() - shiftStart.getTime();

    const bStart = new Date(s.startTime);
    const bEnd = s.endTime ? new Date(s.endTime) : now;
    const startPct = Math.max(0, Math.min(100, ((bStart.getTime() - shiftStart.getTime()) / totalMs) * 100));
    const endPct = Math.max(0, Math.min(100, ((bEnd.getTime() - shiftStart.getTime()) / totalMs) * 100));

    return {
      id: s.id,
      startPct,
      endPct,
      isOpen: !s.endTime,
      startTimeLabel: bStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
      endTimeLabel: s.endTime ? new Date(s.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Ongoing'
    };
  });

  const scheduledBreakPcts = useMemo(() => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const totalMins = (endH * 60 + endM) - (startH * 60 + startM);
    const shiftStartMin = startH * 60 + startM;

    return BREAK_SCHEDULE_DATA.map(b => {
      const [bsH, bsM] = b.start.split(':').map(Number);
      const [beH, beM] = b.end.split(':').map(Number);
      const startPct = ((bsH * 60 + bsM) - shiftStartMin) / totalMins * 100;
      const endPct = ((beH * 60 + beM) - shiftStartMin) / totalMins * 100;
      return { ...b, startPct, endPct };
    });
  }, [startTime, endTime]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isExpanded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const clampedPct = Math.max(0, Math.min(100, pct));
    setHoverPos(clampedPct);

    // 1. Check if hovering over a scheduled window
    const sch = scheduledBreakPcts.find(b => clampedPct >= b.startPct && clampedPct <= b.endPct);
    if (sch) {
      const labelSuffix = sch.label.toLowerCase().includes('break') ? '' : ' Break';
      setHoverText(`${sch.label}${labelSuffix}`);
      return;
    }

    // 2. Check if hovering over an actual break
    const act = breakSessionsMapped.find(s => clampedPct >= s.startPct && clampedPct <= s.endPct);
    if (act) {
      setHoverText(`Actual Break`);
      return;
    }

    // 3. Fallback to specific time
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    const totalMins = endMins - startMins;
    const currentMins = startMins + (totalMins * (clampedPct / 100));
    const h = Math.floor(currentMins / 60);
    const m = Math.floor(currentMins % 60);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    setHoverText(`${displayH}:${m.toString().padStart(2, '0')} ${period}`);
  };

  const formatDuration = (h: number, m: number) => h > 0 ? `${h}h ${m}m` : `${m}m`;

  const statusLabel = isShiftOver ? 'Shift Ended' : isShiftPending ? 'Pending' : checkInIsLate ? 'Late' : checkInPct !== null ? 'Present' : 'Active';
  const statusClass = isShiftOver ? 'over' : isShiftPending ? 'pending' : checkInIsLate ? 'late' : 'active';

  return (
    <div className={`wdt-premium-v2 ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      {/* Dynamic Background Effects */}
      <div className="wdt-body-clipper">
        <div className="wdt-glass-shine" />
      </div>
      
      {/* Minimal Sleek Header */}
      <div className="wdt-header-minimal">
        <div className="wdt-minimal-title">
          <span className={`wdt-pulse-dot ${statusClass}`} />
          <h2 className="wdt-title-sleek">Workday Progress</h2>
          <span className="wdt-status-text">{statusLabel}</span>
        </div>
        <div className="wdt-minimal-meta">
          {workedTime && (
            <span className="wdt-time-compact">
               {formatDuration(workedTime.hours, workedTime.minutes)} worked
            </span>
          )}
        </div>
      </div>

      {/* The Central Gauge - Vibrant & Technical */}
      <div className="wdt-gauge-area">
        <div className="wdt-gauge-container">
          <div 
            className="wdt-main-rail"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverText(null)}
          >
            <div className="wdt-rail-glass" />
            
            {/* Scheduled Reference Layer */}
            {scheduledBreakPcts.map((b) => (
              <div 
                key={b.label}
                className="wdt-ghost-window"
                style={{ left: `${b.startPct}%`, width: `${b.endPct - b.startPct}%` }}
              >
                <div className="wdt-window-label">{b.label}</div>
              </div>
            ))}

            {/* Progress Layers */}
            <div 
              className={`wdt-fill-worked ${checkInPct !== null && checkInIsLate ? 'is-segmented' : ''}`} 
              style={{ 
                left: `${checkInPct || 0}%`, 
                width: `${Math.max(0, progress - (checkInPct || 0))}%` 
              }}
            >
              <div className="wdt-fill-glow" />
              {progress > 0 && progress < 100 && <div className="wdt-laser-head" />}
            </div>

            {checkInPct !== null && checkInIsLate && (
              <div 
                className="wdt-fill-late" 
                style={{ width: `${checkInPct}%` }} 
              />
            )}

            {/* Interactive Segments */}
            {breakSessionsMapped.map((seg) => (
              <div
                key={seg.id}
                className={`wdt-break-block ${seg.isOpen ? 'is-active' : ''}`}
                style={{
                  left: `${seg.startPct}%`,
                  width: `${Math.max(1, seg.endPct - seg.startPct)}%`,
                }}
              >
                <div className="wdt-break-inner" />
              </div>
            ))}

            {/* Pins - Conditional on Expansion */}
            {isExpanded && (
              <>
                <div className="wdt-marker-late" style={{ left: `${lateThresholdPct}%` }}>
                  <div className="wdt-marker-tooltip">Late Threshold: {format12h(lateThreshold)}</div>
                </div>

                {checkInPct !== null && (
                  <div className={`wdt-marker-checkin ${checkInIsLate ? 'is-late' : ''}`} style={{ left: `${checkInPct}%` }}>
                    <div className="wdt-checkin-tag">Checked In: {checkInLabel}</div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="wdt-gauge-footer">
             <span className="wdt-bound-label">{format12h(startTime)}</span>
             <div className="wdt-gauge-steps">
               {Array.from({length: 8}).map((_, i) => <div key={i} className="wdt-step" />)}
             </div>
             <span className="wdt-bound-label">{format12h(endTime)}</span>
          </div>
        </div>
      </div>

      {/* Info Tiles - The HUD Interface */}
      {isExpanded && (
        <div className="wdt-hud-grid">
           <div className="wdt-hud-tile">
              <div className="wdt-tile-icon"><Timer size={18} /></div>
              <div className="wdt-tile-content">
                 <span className="wdt-tile-title">Shift Window</span>
                 <div className="wdt-tile-val">{format12h(startTime)} – {format12h(endTime)}</div>
                 <div className="wdt-tile-sub">Threshold: {format12h(lateThreshold)}</div>
              </div>
           </div>

           <div className="wdt-hud-tile">
              <div className="wdt-tile-icon"><Coffee size={18} /></div>
              <div className="wdt-tile-content">
                 <span className="wdt-tile-title">Break Schedule</span>
                 <div className="wdt-schedule-mini">
                    {BREAK_SCHEDULE_DATA.map(b => (
                      <div key={b.label} className="wdt-mini-row">
                        <span>{b.label}</span>
                        <span className="bold">{b.display}</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="wdt-hud-tile">
              <div className="wdt-tile-icon"><Info size={18} /></div>
              <div className="wdt-tile-content">
                 <span className="wdt-tile-title">Stats Today</span>
                 <div className="wdt-stats-mini">
                    <div className="wdt-stat-item">
                       <span className="label">Breaks Took</span>
                       <span className="val badge">{breakSessions.length}</span>
                    </div>
                    <div className="wdt-stat-item">
                       <span className="label">Work Status</span>
                       <span className={`val accent-${statusClass}`}>{statusLabel}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Dynamic Hover Interaction (Collapsed Only) */}
      {!isExpanded && hoverText && (
        <div className="wdt-hover-bubble" style={{ left: `${hoverPos}%` }}>
          {hoverText}
        </div>
      )}

      {/* Control Actions */}
      <div className="wdt-actions-v2">
        <button className="wdt-expand-btn" onClick={() => setIsExpanded(!isExpanded)}>
          <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
    </div>
  );
};

export default WorkdayTimeline;

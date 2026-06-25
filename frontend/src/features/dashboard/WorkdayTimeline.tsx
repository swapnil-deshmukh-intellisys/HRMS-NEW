import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, Lock, Unlock, Moon, Sun, Power, LogOut, Coffee, Utensils } from 'lucide-react';
import { apiRequest } from '../../services/api';
import './WorkdayTimeline.css';
import type { BreakSession, DesktopActivityLog } from '../../types';

interface WorkdayTimelineProps {
  employeeId?: number;
  startTime?: string;
  endTime?: string;
  lateThreshold?: string;
  checkInTime?: string | Date | null;
  checkOutTime?: string | Date | null;
  workedMinutes?: number | null;
  penaltyMinutes?: number | null;
  token?: string | null;
  customBreakSessions?: BreakSession[];
  dateContext?: string;
}

const BREAK_SCHEDULE_DATA = [
  { label: 'Morning Tea Break', start: '10:45', end: '11:00', display: '10:45 AM – 11:00 AM' },
  { label: 'Lunch', start: '13:00', end: '13:40', display: '1:00 PM – 1:40 PM' },
  { label: 'Evening Tea Break', start: '16:10', end: '16:30', display: '4:10 PM – 4:30 PM' },
];

function format12h(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

const getBreakName = (dateInput: Date | string): string => {
  const date = new Date(dateInput);
  const hour = date.getHours();
  const minute = date.getMinutes();
  if (hour === 10 || (hour === 11 && minute <= 15)) {
    return "Morning Tea Break";
  } else if (hour === 12 || hour === 13) {
    return "Lunch Break";
  } else {
    return "Evening Tea Break";
  }
};


const WorkdayTimeline: React.FC<WorkdayTimelineProps> = ({
  employeeId,
  startTime = "09:00",
  endTime = "18:00",
  lateThreshold = "09:00",
  checkInTime = null,
  checkOutTime = null,
  workedMinutes = null,
  penaltyMinutes = null,
  token = null,
  customBreakSessions,
  dateContext,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checkInPct, setCheckInPct] = useState<number | null>(null);
  const [checkInLabel, setCheckInLabel] = useState<string>('');
  const [checkOutPct, setCheckOutPct] = useState<number | null>(null);
  const [checkOutLabel, setCheckOutLabel] = useState<string>('');
  const [workedTime, setWorkedTime] = useState<{ hours: number; minutes: number } | null>(null);
  const [isShiftOver, setIsShiftOver] = useState(false);
  const [isShiftPending, setIsShiftPending] = useState(false);
  const [checkInIsLate, setCheckInIsLate] = useState(false);
  const [breakSessions, setBreakSessions] = useState<BreakSession[]>([]);

  const [desktopLogs, setDesktopLogs] = useState<DesktopActivityLog[]>([]);

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

  const loadDesktopLogs = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (employeeId) qs.append('employeeId', employeeId.toString());
      if (dateContext) qs.append('date', dateContext);
      
      const endpoint = `/attendance/desktop-activity-log?${qs.toString()}`;
      const res = await apiRequest<{ events: DesktopActivityLog[] }>(endpoint, { token: token || undefined });
      setDesktopLogs(res.data?.events ?? []);
    } catch { /* ignore */ }
  }, [employeeId, dateContext, token]);

  useEffect(() => {
    loadDesktopLogs();
  }, [loadDesktopLogs]);

  useEffect(() => {
    if (customBreakSessions) {
      setBreakSessions(customBreakSessions);
      return;
    }
    loadBreaks();
    const handler = () => loadBreaks();
    window.addEventListener('break-updated', handler);
    return () => window.removeEventListener('break-updated', handler);
  }, [customBreakSessions, loadBreaks]);

  useEffect(() => {
    const calculate = () => {
      const baseDate = dateContext ? new Date(dateContext + 'T00:00:00') : new Date();
      const now = dateContext ? new Date(dateContext + 'T23:59:59') : new Date();
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const [lateH, lateM] = lateThreshold.split(':').map(Number);

      const start = new Date(baseDate); start.setHours(startH, startM, 0, 0);
      const end = new Date(baseDate); end.setHours(endH, endM, 0, 0);
      const late = new Date(baseDate); late.setHours(lateH, lateM, 0, 0);

      const totalMs = end.getTime() - start.getTime();
      
      let elapsedMs = now.getTime() - start.getTime();
      if (checkOutTime) {
        const co = new Date(checkOutTime);
        const coToday = new Date(baseDate);
        coToday.setHours(co.getHours(), co.getMinutes(), co.getSeconds(), 0);
        elapsedMs = coToday.getTime() - start.getTime();
      }

      const pct = Math.max(0, (elapsedMs / totalMs) * 100);
      setProgress(checkInTime ? pct : 0);
      setIsShiftOver(checkOutTime ? true : now > end);
      setIsShiftPending(now < start);

      if (checkInTime) {
        const ci = new Date(checkInTime);
        const ciToday = new Date(baseDate);
        ciToday.setHours(ci.getHours(), ci.getMinutes(), ci.getSeconds(), 0);
        
        let workedMins = Math.max(0, Math.floor((now.getTime() - ciToday.getTime()) / 60000));
        if (checkOutTime && typeof workedMinutes === 'number') {
          workedMins = workedMinutes;
        } else if (checkOutTime) {
          const co = new Date(checkOutTime);
          const coToday = new Date(baseDate);
          coToday.setHours(co.getHours(), co.getMinutes(), co.getSeconds(), 0);
          workedMins = Math.max(0, Math.floor((coToday.getTime() - ciToday.getTime()) / 60000));
        }

        setWorkedTime({ hours: Math.floor(workedMins / 60), minutes: workedMins % 60 });
        const ciPct = Math.max(0, Math.min(100, ((ciToday.getTime() - start.getTime()) / totalMs) * 100));
        setCheckInPct(ciPct);
        setCheckInLabel(ci.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
        setCheckInIsLate(ciToday > late);
      } else {
        setWorkedTime(null); setCheckInPct(null); setCheckInLabel(''); setCheckInIsLate(false);
      }

      if (checkOutTime) {
        const co = new Date(checkOutTime);
        const coToday = new Date(baseDate);
        coToday.setHours(co.getHours(), co.getMinutes(), co.getSeconds(), 0);
        const coPct = Math.max(0, Math.min(100, ((coToday.getTime() - start.getTime()) / totalMs) * 100));
        setCheckOutPct(coPct);
        setCheckOutLabel(co.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
      } else {
        setCheckOutPct(null); setCheckOutLabel('');
      }
    };

    calculate();

    if (checkOutTime || dateContext) {
      return;
    }

    const iv = setInterval(calculate, 30000);
    return () => clearInterval(iv);
  }, [startTime, endTime, lateThreshold, checkInTime, checkOutTime, workedMinutes, dateContext]);

  const breakSessionsMapped = breakSessions.map(s => {
    const baseDate = dateContext ? new Date(dateContext + 'T00:00:00') : new Date();
    const now = dateContext ? new Date(dateContext + 'T23:59:59') : new Date();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const shiftStart = new Date(baseDate); shiftStart.setHours(startH, startM, 0, 0);
    const shiftEnd = new Date(baseDate); shiftEnd.setHours(endH, endM, 0, 0);
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

  const desktopSegments = useMemo(() => {
    if (!desktopLogs.length) return [];
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const baseDate = dateContext ? new Date(dateContext + 'T00:00:00') : new Date();
    const shiftStart = new Date(baseDate); shiftStart.setHours(startH, startM, 0, 0);
    const shiftEnd = new Date(baseDate); shiftEnd.setHours(endH, endM, 0, 0);
    const totalMs = shiftEnd.getTime() - shiftStart.getTime();

    const segments: Array<{ type: 'active' | 'idle' | 'locked', startPct: number, endPct: number, durationMs: number }> = [];

    // Base start point is check-in or first log
    let lastTime = checkInTime ? new Date(checkInTime) : new Date(desktopLogs[0].timestamp);
    // Ensure lastTime has the correct dateContext
    lastTime.setFullYear(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

    let currentState: 'active' | 'idle' | 'locked' = 'active';

    for (const log of desktopLogs) {
      const logTime = new Date(log.timestamp);
      logTime.setFullYear(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

      if (logTime < lastTime) continue;

      if (logTime.getTime() > lastTime.getTime()) {
        const startPct = Math.max(0, Math.min(100, ((lastTime.getTime() - shiftStart.getTime()) / totalMs) * 100));
        const endPct = Math.max(0, Math.min(100, ((logTime.getTime() - shiftStart.getTime()) / totalMs) * 100));
        if (endPct > startPct) {
          segments.push({ type: currentState, startPct, endPct, durationMs: logTime.getTime() - lastTime.getTime() });
        }
      }

      if (log.eventType === 'LOCK' || log.eventType === 'SLEEP') currentState = 'locked';
      else if (log.eventType === 'UNLOCK' || log.eventType === 'WAKE') currentState = 'active';
      else if (log.eventType === 'IDLE_START') currentState = 'idle';
      else if (log.eventType === 'IDLE_END') currentState = 'active';
      else if (log.eventType === 'SHUTDOWN') currentState = 'locked';

      lastTime = logTime;
    }

    const finalEnd = checkOutTime ? new Date(checkOutTime) : new Date();
    finalEnd.setFullYear(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    
    // Only add final segment if we haven't checked out and the shift isn't completely over
    // or if we have a checkout time to bound it
    if (finalEnd.getTime() > lastTime.getTime()) {
        const startPct = Math.max(0, Math.min(100, ((lastTime.getTime() - shiftStart.getTime()) / totalMs) * 100));
        const endPct = Math.max(0, Math.min(100, ((finalEnd.getTime() - shiftStart.getTime()) / totalMs) * 100));
        if (endPct > startPct) {
          segments.push({ type: currentState, startPct, endPct, durationMs: finalEnd.getTime() - lastTime.getTime() });
        }
    }

    return segments;
  }, [desktopLogs, startTime, endTime, dateContext, checkInTime, checkOutTime]);

  const combinedLogItems = useMemo(() => {
    const items: Array<{
      key: string;
      timestamp: Date;
      icon: React.ReactNode;
      desc: string;
    }> = [];

    // 1. Check In
    if (checkInTime) {
      items.push({
        key: 'check-in',
        timestamp: new Date(checkInTime),
        icon: <CheckCircle size={14} color="var(--wdt-accent-emerald)" strokeWidth={2.5} />,
        desc: 'Checked In',
      });
    }

    // 2. Check Out
    if (checkOutTime) {
      items.push({
        key: 'check-out',
        timestamp: new Date(checkOutTime),
        icon: <LogOut size={14} color="var(--wdt-accent-rose)" />,
        desc: 'Checked Out',
      });
    }

    // 3. Desktop Activity Logs
    desktopLogs.forEach((log) => {
      const isLock = log.eventType === 'LOCK' || log.eventType === 'SLEEP';
      const isUnlock = log.eventType === 'UNLOCK' || log.eventType === 'WAKE';
      const isIdleStart = log.eventType === 'IDLE_START';
      const isIdleEnd = log.eventType === 'IDLE_END';
      
      let icon = <Power size={14} color="var(--wdt-accent-rose)" />;
      let desc = 'Shutdown';
      
      if (isLock) {
        icon = <Lock size={14} color="#8b5cf6" />;
        desc = log.eventType === 'LOCK' ? 'Screen Locked' : 'System Sleep';
      } else if (isUnlock) {
        icon = <Unlock size={14} color="var(--wdt-accent-emerald)" />;
        desc = log.eventType === 'UNLOCK' ? 'Screen Unlocked' : 'System Wake';
      } else if (isIdleStart) {
        icon = <Moon size={14} color="#64748b" />;
        desc = 'Went Idle';
      } else if (isIdleEnd) {
        icon = <Sun size={14} color="#f59e0b" />;
        desc = 'Returned from Idle';
      }

      items.push({
        key: `desktop-${log.id}`,
        timestamp: new Date(log.timestamp),
        icon,
        desc,
      });
    });

    // 4. Break Sessions
    breakSessions.forEach((session) => {
      const startD = new Date(session.startTime);
      const name = getBreakName(startD);

      items.push({
        key: `break-start-${session.id}`,
        timestamp: startD,
        icon: name.includes('Lunch') ? <Utensils size={14} color="#3b82f6" /> : <Coffee size={14} color="#f59e0b" />,
        desc: `${name} Started`,
      });

      if (session.endTime) {
        const endD = new Date(session.endTime);
        items.push({
          key: `break-end-${session.id}`,
          timestamp: endD,
          icon: name.includes('Lunch') ? <Utensils size={14} color="var(--wdt-accent-emerald)" /> : <Coffee size={14} color="var(--wdt-accent-emerald)" />,
          desc: `${name} Ended`,
        });
      }
    });

    // Sort chronologically
    return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [checkInTime, checkOutTime, desktopLogs, breakSessions]);

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

    // 2.5. Check if hovering over a desktop activity segment
    const seg = desktopSegments.find(s => clampedPct >= s.startPct && clampedPct <= s.endPct);
    if (seg) {
      const desc = seg.type === 'locked' ? 'Screen Locked' :
                   seg.type === 'idle' ? 'Went Idle' : 'Active / Working';
      const durMin = Math.round(seg.durationMs / 60000);
      const durStr = durMin > 0 ? ` (${durMin}m)` : '';
      setHoverText(`${desc}${durStr}`);
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
  const requiredMins = 540 + (penaltyMinutes || 0);
  const isOvertime = workedTime ? (workedTime.hours * 60 + workedTime.minutes) > requiredMins : false;

  const statusLabel = checkOutTime ? 'Completed' : isShiftOver ? 'Shift Ended' : isShiftPending ? 'Pending' : checkInIsLate ? 'Late' : checkInPct !== null ? 'Present' : 'Active';
  const statusClass = checkOutTime ? 'over' : isShiftOver ? 'over' : isShiftPending ? 'pending' : checkInIsLate ? 'late' : 'active';

  return (
    <div className={`card wdt-premium-v2 ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <div className="wdt-body-clipper">
        <div className="wdt-glass-shine" />
      </div>

      <div className={`wdt-header-minimal ${!isExpanded ? 'wdt-header-collapsed' : ''}`}>
          <div className="wdt-minimal-title">
            <span className={`wdt-pulse-dot ${statusClass}`} />
            <h3 className="wdt-title-sleek">Workday Progress</h3>
            <span className="wdt-status-text">{statusLabel}</span>
          </div>
          <div className="wdt-minimal-meta">
            {workedTime && (
              <span className="wdt-time-compact">
                {formatDuration(workedTime.hours, workedTime.minutes)} worked
                {penaltyMinutes ? ` (includes ${penaltyMinutes}m penalty)` : ''}
                {isOvertime && (
                  <span className="wdt-overtime-badge">
                    +{formatDuration(
                      Math.floor((workedTime.hours * 60 + workedTime.minutes - requiredMins) / 60),
                      (workedTime.hours * 60 + workedTime.minutes - requiredMins) % 60
                    )} OT
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      <div className="wdt-bar-interface-row">
        <div className="wdt-gauge-area">
          <div className="wdt-gauge-container">
            <div
              className={`wdt-main-rail ${isOvertime ? 'wdt-main-rail--overtime' : ''}`}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverText(null)}
            >
              <div className="wdt-rail-glass" />
              
              <div className="wdt-rail-content">
                {checkInPct !== null && checkInIsLate && (
                  <div 
                    className="wdt-fill-late" 
                    style={{ width: `${checkInPct}%` }}
                  >
                    <div className="wdt-fill-glow" />
                  </div>
                )}

                {scheduledBreakPcts.map((b) => (
                  <div
                    key={b.label}
                    className="wdt-ghost-window"
                    style={{ left: `${b.startPct}%`, width: `${b.endPct - b.startPct}%` }}
                  >
                    {isExpanded && <div className="wdt-window-label">{b.label}</div>}
                  </div>
                ))}

                {desktopSegments.length > 0 ? (
                  desktopSegments.map((seg, i) => (
                    <div
                      key={i}
                      className={`wdt-fill-segment wdt-fill-segment--${seg.type}`}
                      style={{ left: `${seg.startPct}%`, width: `${seg.endPct - seg.startPct}%` }}
                    >
                      <div className="wdt-fill-glow" />
                    </div>
                  ))
                ) : (
                  <div
                    className={`wdt-fill-worked ${checkInPct !== null && checkInIsLate ? 'is-segmented' : ''}`}
                    style={{
                      left: `${checkInPct || 0}%`,
                      width: `${Math.max(0, Math.min(100 - (checkInPct || 0), progress - (checkInPct || 0)))}%`
                    }}
                  >
                    <div className="wdt-fill-glow" />
                  </div>
                )}

                {checkOutTime && progress < 100 && (
                  <div
                    className="wdt-fill-early-checkout-unfilled"
                    style={{
                      left: `${progress}%`,
                      width: `${100 - progress}%`
                    }}
                  />
                )}

                {breakSessionsMapped.map((seg) => (
                  <div
                    key={seg.id}
                    className={`wdt-break-block ${seg.isOpen ? 'is-active' : ''}`}
                    style={{
                      left: `${seg.startPct}%`,
                      width: `${Math.max(1, seg.endPct - seg.startPct)}%`,
                    }}
                  >
                    <div className="wdt-fill-glow" />
                  </div>
                ))}
              </div>

              {isExpanded && checkInPct !== null && (
                <div className={`wdt-marker-checkin ${checkInIsLate ? 'is-late' : ''}`} style={{ left: `${checkInPct}%` }}>
                  <div 
                    className="wdt-checkin-tag"
                    style={{
                      left: checkInPct < 10 ? '0' : checkInPct > 90 ? 'auto' : '50%',
                      right: checkInPct > 90 ? '0' : 'auto',
                      transform: checkInPct < 10 ? 'translateX(0)' : checkInPct > 90 ? 'translateX(0)' : 'translateX(-50%)'
                    }}
                  >
                    Checked In: {checkInLabel}
                  </div>
                </div>
              )}

              {isExpanded && checkOutPct !== null && (
                <div className="wdt-marker-checkout" style={{ left: `${checkOutPct}%` }}>
                  <div 
                    className="wdt-checkout-tag"
                    style={{
                      left: checkOutPct < 10 ? '0' : checkOutPct > 90 ? 'auto' : '50%',
                      right: checkOutPct > 90 ? '0' : 'auto',
                      transform: checkOutPct < 10 ? 'translateX(0)' : checkOutPct > 90 ? 'translateX(0)' : 'translateX(-50%)'
                    }}
                  >
                    Checked Out: {checkOutLabel}
                  </div>
                </div>
              )}

              {!isExpanded && hoverText && (
                <div className="wdt-hover-bubble" style={{ left: `${hoverPos}%` }}>
                  {hoverText}
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="wdt-gauge-footer">
                <span className="wdt-bound-label">{format12h(startTime)}</span>
                <div className="wdt-gauge-steps">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="wdt-step" />)}
                </div>
                <span className="wdt-bound-label">{format12h(endTime)}</span>
              </div>
            )}
          </div>
        </div>

        <button className="wdt-toggle-icon-btn" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="wdt-expanded-layout">
          <div className="wdt-event-log-panel">
            <h3 className="wdt-panel-title">Event Log</h3>
            <div className="wdt-log-list">
              {combinedLogItems.map((item) => (
                <div key={item.key} className="wdt-log-item">
                  <span className="wdt-log-time">{item.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  <span className="wdt-log-icon">{item.icon}</span>
                  <span className="wdt-log-desc">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="wdt-summary-panel">
            <h3 className="wdt-panel-title">Day Summary</h3>
            <div className="wdt-summary-cards">
              <div className="wdt-summary-card">
                <span className="wdt-sc-label">Productive Time</span>
                <span className="wdt-sc-value">{workedTime ? formatDuration(workedTime.hours, workedTime.minutes) : '--'}</span>
              </div>
              <div className="wdt-summary-card">
                <span className="wdt-sc-label">Break Time</span>
                <span className="wdt-sc-value">
                  {breakSessions.length > 0 ? `${breakSessions.reduce((acc, s) => acc + s.durationMinutes, 0)}m` : '--'}
                </span>
              </div>
              <div className="wdt-summary-card">
                <span className="wdt-sc-label">Events Logged</span>
                <span className="wdt-sc-value">{desktopLogs.length}</span>
              </div>
            </div>
            
            {/* Break Schedule mapping just to keep the old info available */}
            <div className="wdt-summary-schedule">
              <span className="wdt-sc-label">Break Schedule</span>
              {BREAK_SCHEDULE_DATA.map(b => (
                <div key={b.label} className="wdt-mini-row">
                  <span>{b.label}</span>
                  <span className="bold">{b.display}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkdayTimeline;

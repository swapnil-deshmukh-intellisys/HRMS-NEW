import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Timer, Coffee, Info } from 'lucide-react';
import { apiRequest } from '../../services/api';
import './WorkdayTimeline.css';

interface WorkdayTimelineProps {
  startTime?: string;
  endTime?: string;
  lateThreshold?: string;
  checkInTime?: string | Date | null;
  checkOutTime?: string | Date | null;
  workedMinutes?: number | null;
  penaltyMinutes?: number | null;
  token?: string | null;
}

type BreakSession = {
  id: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
};

const BREAK_SCHEDULE_DATA = [
  { label: 'Lunch', start: '13:00', end: '13:45', display: '1:00 PM – 1:45 PM' },
  { label: 'Tea Break', start: '16:15', end: '16:30', display: '4:15 PM – 4:30 PM' },
];

function format12h(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

const WorkdayTimeline: React.FC<WorkdayTimelineProps> = ({
  startTime = "09:00",
  endTime = "18:00",
  lateThreshold = "09:00",
  checkInTime = null,
  checkOutTime = null,
  workedMinutes = null,
  penaltyMinutes = null,
  token = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
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
      
      let elapsedMs = now.getTime() - start.getTime();
      if (checkOutTime) {
        const co = new Date(checkOutTime);
        const coToday = new Date(now);
        coToday.setHours(co.getHours(), co.getMinutes(), co.getSeconds(), 0);
        elapsedMs = coToday.getTime() - start.getTime();
      }

      const pct = Math.max(0, (elapsedMs / totalMs) * 100);
      setProgress(checkInTime ? pct : 0);
      setIsShiftOver(checkOutTime ? true : now > end);
      setIsShiftPending(now < start);

      if (checkInTime) {
        const ci = new Date(checkInTime);
        const ciToday = new Date(now);
        ciToday.setHours(ci.getHours(), ci.getMinutes(), ci.getSeconds(), 0);
        
        let workedMins = Math.max(0, Math.floor((now.getTime() - ciToday.getTime()) / 60000));
        if (checkOutTime && typeof workedMinutes === 'number') {
          workedMins = workedMinutes;
        } else if (checkOutTime) {
          const co = new Date(checkOutTime);
          const coToday = new Date(now);
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
    };

    calculate();

    if (checkOutTime) {
      return;
    }

    const iv = setInterval(calculate, 30000);
    return () => clearInterval(iv);
  }, [startTime, endTime, lateThreshold, checkInTime, checkOutTime, workedMinutes]);

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
  const requiredMins = 540 + (penaltyMinutes || 0);
  const isOvertime = workedTime ? (workedTime.hours * 60 + workedTime.minutes) > requiredMins : false;

  const statusLabel = checkOutTime ? 'Completed' : isShiftOver ? 'Shift Ended' : isShiftPending ? 'Pending' : checkInIsLate ? 'Late' : checkInPct !== null ? 'Present' : 'Active';
  const statusClass = checkOutTime ? 'over' : isShiftOver ? 'over' : isShiftPending ? 'pending' : checkInIsLate ? 'late' : 'active';

  return (
    <div className={`card wdt-premium-v2 ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <div className="wdt-body-clipper">
        <div className="wdt-glass-shine" />
      </div>

      {isExpanded && (
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
      )}

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

                <div
                  className={`wdt-fill-worked ${checkInPct !== null && checkInIsLate ? 'is-segmented' : ''}`}
                  style={{
                    left: `${checkInPct || 0}%`,
                    width: `${Math.max(0, Math.min(100 - (checkInPct || 0), progress - (checkInPct || 0)))}%`
                  }}
                >
                  <div className="wdt-fill-glow" />
                </div>

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
        <div className="wdt-hud-grid">
          <div className="wdt-hud-tile">
            <div className="wdt-tile-icon"><Timer size={18} /></div>
            <div className="wdt-tile-content">
              <span className="wdt-tile-title">Shift Window</span>
              <div className="wdt-tile-val">{format12h(startTime)} – {format12h(endTime)}</div>
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
                  <span className="label">Check In</span>
                  <span className="val">{checkInLabel || '--:--'}</span>
                </div>
                <div className="wdt-stat-item">
                  <span className="label">Breaks Took</span>
                  <span className="val badge">{breakSessions.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkdayTimeline;

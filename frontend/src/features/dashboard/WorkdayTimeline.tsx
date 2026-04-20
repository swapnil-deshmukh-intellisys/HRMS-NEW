import React, { useState, useEffect } from 'react';
import './WorkdayTimeline.css';

interface WorkdayTimelineProps {
  startTime?: string;
  endTime?: string;
  lateThreshold?: string;
}

const WorkdayTimeline: React.FC<WorkdayTimelineProps> = ({
  startTime = "10:00",
  endTime = "19:00",
  lateThreshold = "10:10",
}) => {
  const [progress, setProgress] = useState(0);
  const [lateThresholdPct, setLateThresholdPct] = useState(0);
  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0 });
  const [remaining, setRemaining] = useState({ hours: 0, minutes: 0 });
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [isShiftOver, setIsShiftOver] = useState(false);
  const [isShiftPending, setIsShiftPending] = useState(false);
  const [isLate, setIsLate] = useState(false);

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

      // Late threshold as % of total shift
      const latePct = ((late.getTime() - start.getTime()) / totalMs) * 100;

      let pct = (elapsedMs / totalMs) * 100;
      pct = Math.max(0, Math.min(100, pct));

      const elapsedMins = Math.max(0, Math.floor(elapsedMs / 60000));
      const remainingMins = Math.max(0, Math.floor((totalMs - elapsedMs) / 60000));

      setProgress(pct);
      setLateThresholdPct(latePct);
      setElapsed({ hours: Math.floor(elapsedMins / 60), minutes: elapsedMins % 60 });
      setRemaining({ hours: Math.floor(remainingMins / 60), minutes: remainingMins % 60 });
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      setIsShiftOver(now > end);
      setIsShiftPending(now < start);
      setIsLate(now > late);
    };

    calculate();
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [startTime, endTime, lateThreshold]);

  const formatDuration = (h: number, m: number) =>
    h > 0 ? `${h}h ${m}m` : `${m}m`;

  const statusLabel = isShiftOver
    ? "Shift Completed"
    : isShiftPending
    ? "Shift Not Started"
    : isLate
    ? "Late"
    : "On Time";

  const statusClass = isShiftOver
    ? "over"
    : isShiftPending
    ? "pending"
    : isLate
    ? "late"
    : "active";

  return (
    <div className="wdt-container">
      {/* Header Row */}
      <div className="wdt-header">
        <div className="wdt-title-group">
          <span className="wdt-icon">◷</span>
          <div>
            <p className="wdt-eyebrow">Workday Timeline</p>
            <p className="wdt-subtitle">
              {startTime} – {endTime}&nbsp;&nbsp;·&nbsp;&nbsp;Grace period until {lateThreshold}
            </p>
          </div>
        </div>
        <div className="wdt-status-group">
          <div className={`wdt-status-pill ${statusClass}`}>
            <span className={`wdt-status-dot ${statusClass}`}></span>
            {statusLabel}
          </div>
          <div className="wdt-clock">{currentTimeStr}</div>
        </div>
      </div>

      {/* Progress Track */}
      <div className="wdt-track-wrapper">
        <div className="wdt-track">
          {/* Green filled bar */}
          <div
            className="wdt-fill"
            style={{ width: `${progress}%` }}
          >
            {progress > 0 && progress < 100 && (
              <div className="wdt-cursor">
                <div className="wdt-cursor-ring"></div>
              </div>
            )}
          </div>

          {/* Late threshold marker */}
          <div
            className="wdt-late-marker"
            style={{ left: `${lateThresholdPct}%` }}
            title={`Late after ${lateThreshold}`}
          >
            <div className="wdt-late-marker-line"></div>
            <span className="wdt-late-marker-label">{lateThreshold}</span>
          </div>
        </div>

        {/* Time anchors */}
        <div className="wdt-anchors">
          <span>{startTime}</span>
          <span>{endTime}</span>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="wdt-stats">
        <div className="wdt-stat">
          <span className={`wdt-stat-value ${isLate && !isShiftOver && !isShiftPending ? 'late' : 'elapsed'}`}>
            {formatDuration(elapsed.hours, elapsed.minutes)}
          </span>
          <span className="wdt-stat-label">Elapsed</span>
        </div>
        <div className="wdt-stat right">
          <span className="wdt-stat-value remaining">
            {isShiftOver ? "—" : formatDuration(remaining.hours, remaining.minutes)}
          </span>
          <span className="wdt-stat-label">Remaining</span>
        </div>
      </div>
    </div>
  );
};

export default WorkdayTimeline;

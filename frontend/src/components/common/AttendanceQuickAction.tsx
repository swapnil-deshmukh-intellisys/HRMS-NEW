import "./AttendanceQuickAction.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../services/api";
import type { Attendance } from "../../types";
import { ATTENDANCE_EVENT, dispatchAttendanceUpdated, getAttendanceUpdatedDetail, getSelfAttendanceActionState } from "./attendanceQuickActionUtils";
import { formatAttendanceTime } from "../../utils/format";
import { FileText, ShieldCheck, Check } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import Modal from "./Modal";
import { useApp } from "../../context/AppContext";

type AttendanceQuickActionProps = {
  token: string | null;
  currentEmployeeId: number | null;
  className?: string;
  size?: "compact" | "default";
  onStateChange?: (attendance: Attendance | null) => void;
};

export default function AttendanceQuickAction({
  token,
  currentEmployeeId,
  className = "",
  size = "default",
  onStateChange,
}: AttendanceQuickActionProps) {
  const [attendanceToday, setAttendanceToday] = useState<Attendance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const { isTimeDrifted } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [assignedEmails, setAssignedEmails] = useState<any[]>([]);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [todaysUpdateInput, setTodaysUpdateInput] = useState("");
  const [useSupportUpdate, setUseSupportUpdate] = useState(false);
  const [useManualUpdate, setUseManualUpdate] = useState(true);
  const [supportData, setSupportData] = useState({
    dataExtracted: "",
    emailsSent: "",
    outlookMetrics: {} as Record<number, { dataExtracted: string; mailsCount: string }>
  });
  const latestLoadRequestRef = useRef(0);
  const attendanceVersionRef = useRef(0);
  const { refreshSession, updateLastActivity } = useAuth();

  const fetchAssignedEmails = useCallback(async () => {
    if (!currentEmployeeId || !token) return;
    
    try {
      setFetchingEmails(true);
      const response = await apiRequest<any>(`/employees/${currentEmployeeId}`, { token });
      const allEmails = response.data.outlookEmails || [];
      
      // Filter for TEC and TUT clients
      const filtered = allEmails.filter((item: any) => {
        const clientCode = item.client?.code?.toUpperCase();
        const clientName = item.client?.name?.toUpperCase();
        return clientCode === "TEC" || clientCode === "TUT" || 
               clientName?.includes("TEC") || clientName?.includes("TUT");
      });
      
      setAssignedEmails(filtered);
      
      // Initialize metrics for each assigned email
      const initialMetrics: Record<number, { dataExtracted: string; mailsCount: string }> = {};
      filtered.forEach((email: any) => {
        initialMetrics[email.id] = { dataExtracted: "", mailsCount: "" };
      });
      setSupportData(prev => ({ ...prev, outlookMetrics: initialMetrics }));
    } catch (err) {
      console.error("Failed to fetch assigned emails:", err);
    } finally {
      setFetchingEmails(false);
    }
  }, [currentEmployeeId, token]);

  useEffect(() => {
    if (showCheckoutModal) {
      void fetchAssignedEmails();
    }
  }, [showCheckoutModal, fetchAssignedEmails]);

  const handleOutlookMetricChange = (emailId: number, field: 'dataExtracted' | 'mailsCount', value: string) => {
    setSupportData(prev => ({
      ...prev,
      outlookMetrics: {
        ...prev.outlookMetrics,
        [emailId]: {
          ...((prev.outlookMetrics[emailId] as any) || { dataExtracted: "", mailsCount: "" }),
          [field]: value
        }
      }
    }));
  };

  const syncAttendanceState = useCallback(
    (nextAttendance: Attendance | null) => {
      setAttendanceToday(nextAttendance);
      onStateChange?.(nextAttendance);
    },
    [onStateChange],
  );

  const loadAttendance = useCallback(async (shouldDispatch = false) => {
    if (!currentEmployeeId) {
      syncAttendanceState(null);
      return;
    }

    const requestId = ++latestLoadRequestRef.current;
    const versionAtStart = attendanceVersionRef.current;

    try {
      const response = await apiRequest<any>("/attendance/today", { token });
      if (requestId !== latestLoadRequestRef.current || versionAtStart !== attendanceVersionRef.current) {
        return;
      }

      const nextAttendance = response.data.attendanceToday ?? null;
      if (nextAttendance) {
        nextAttendance.overtimeSession = response.data.overtimeSession ?? null;
      }
      syncAttendanceState(nextAttendance);
      if (shouldDispatch) {
        dispatchAttendanceUpdated(nextAttendance);
      }
    } catch {
      if (requestId !== latestLoadRequestRef.current || versionAtStart !== attendanceVersionRef.current) {
        return;
      }
    }
  }, [currentEmployeeId, syncAttendanceState, token]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    const handleAttendanceUpdated = (event: Event) => {
      const detail = getAttendanceUpdatedDetail(event);

      if (detail) {
        attendanceVersionRef.current += 1;
        syncAttendanceState(detail.attendanceToday);
        return;
      }

      void loadAttendance();
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, [loadAttendance, syncAttendanceState]);

  useEffect(() => {
    if (!attendanceToday?.checkInTime || attendanceToday.checkOutTime) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, [attendanceToday?.checkInTime, attendanceToday?.checkOutTime]);

  const actionState = useMemo(() => getSelfAttendanceActionState(attendanceToday), [attendanceToday]);

  const liveWorkedDuration = useMemo(() => {
    if (!attendanceToday?.checkInTime || attendanceToday.checkOutTime) {
      return null;
    }

    const checkInTime = new Date(attendanceToday.checkInTime).getTime();
    const workedMinutes = Math.max(0, Math.floor((now - checkInTime) / 60000));
    const hours = Math.floor(workedMinutes / 60);
    const minutes = workedMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `${hours}h`;
    }

    return `${minutes}m`;
  }, [attendanceToday?.checkInTime, attendanceToday?.checkOutTime, now]);
  async function handleClick() {
    if (!actionState.actionPath || actionState.disabled || submitting || isTimeDrifted) {
      return;
    }

    if (actionState.label === "Check out") {
      setShowCheckoutModal(true);
      return;
    }

    if (actionState.requiresConfirmation) {
      let confirmMessage = `Are you sure you want to ${actionState.label.toLowerCase()}?`;
      if (actionState.label === "Check in") {
        confirmMessage = "Are you sure you want to check in? This will start your attendance timer for the day.";
      }

      if (window.confirm(confirmMessage)) {
        await submitAction();
      }
      return;
    }

    await submitAction();
  }

  async function handleCheckoutSubmit(event: React.FormEvent) {
    event.preventDefault();
    
    if (!useSupportUpdate && !useManualUpdate) {
      setActionError("Please select at least one update method.");
      return;
    }

    if (useManualUpdate && !todaysUpdateInput.trim()) {
      setActionError("Please provide your daily update text.");
      return;
    }

    if (useSupportUpdate) {
      if (assignedEmails.length === 0) {
        if (!supportData.dataExtracted || !supportData.emailsSent) {
          setActionError("Please provide all required support metrics.");
          return;
        }
      } else {
        const hasSomeValue = assignedEmails.some(email => {
          const metric = supportData.outlookMetrics[email.id];
          return metric && (metric.dataExtracted.trim() || metric.mailsCount.trim());
        });
        if (!hasSomeValue) {
          setActionError("Please provide support metrics for at least one Outlook ID.");
          return;
        }
      }
    }

    let finalUpdate = "";
    
    if (useSupportUpdate) {
      if (assignedEmails.length > 0) {
        const metricLines = assignedEmails.map(email => {
          const metric = supportData.outlookMetrics[email.id] || { dataExtracted: "", mailsCount: "" };
          const dataStr = metric.dataExtracted.trim() ? `Data: ${metric.dataExtracted}` : "Data: 0";
          const mailsStr = metric.mailsCount.trim() ? `Mails: ${metric.mailsCount}` : "Mails: 0";
          return `${email.name} (${email.client?.code || 'N/A'}): ${dataStr}, ${mailsStr}`;
        }).join(", ");
        
        finalUpdate += `[SUPPORT UPDATE] Outlook Details: [${metricLines}]\n`;
      } else {
        finalUpdate += `[SUPPORT UPDATE] Data Extracted: ${supportData.dataExtracted} | Emails Sent: ${supportData.emailsSent}\n`;
      }
    }

    if (useManualUpdate) {
      finalUpdate += todaysUpdateInput.trim();
    }

    await submitAction({ todaysUpdate: finalUpdate.trim() });
    
    setShowCheckoutModal(false);
    setTodaysUpdateInput("");
    setUseSupportUpdate(false);
    setUseManualUpdate(true);
    setAssignedEmails([]);
    setSupportData({
      dataExtracted: "",
      emailsSent: "",
      outlookMetrics: {}
    });
  }

  async function submitAction(body: Record<string, any> = {}) {
    if (!actionState.actionPath || actionState.disabled || submitting || isTimeDrifted) {
      return;
    }

    try {
      setSubmitting(true);
      setActionError("");
      attendanceVersionRef.current += 1;
      
      // Update last activity before making the request
      updateLastActivity();
      
      const response = await apiRequest<any>(actionState.actionPath, {
        method: "POST",
        token,
        body,
      });
      
      const data = response.data;
      let nextAttendance = attendanceToday;
      if (data && typeof data === "object") {
        if ("attendanceDate" in data) {
          nextAttendance = data;
          if (nextAttendance && attendanceToday) {
            nextAttendance.overtimeSession = attendanceToday.overtimeSession;
          }
        } else if ("startTime" in data) {
          if (nextAttendance) {
            nextAttendance = {
              ...nextAttendance,
              overtimeSession: data,
            };
          }
        }
      }

      syncAttendanceState(nextAttendance);
      dispatchAttendanceUpdated(nextAttendance);
      void loadAttendance();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update attendance.";
      
      // Check if it's a session-related error
      if (errorMessage.includes('500') || errorMessage.includes('Internal server error') || 
          errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setActionError("Session expired or server error. Please refresh the page and try again.");
        // Try to refresh session
        try {
          await refreshSession();
        } catch (sessionError) {
          console.error('Session refresh failed:', sessionError);
        }
      } else {
        setActionError(errorMessage);
      }
      
      await loadAttendance();
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentEmployeeId) {
    return null;
  }

  return (
    <>
      <div className={`attendance-quick-action-wrap attendance-quick-action-wrap--${size}`.trim()}>
        {attendanceToday?.checkInTime && !attendanceToday.checkOutTime ? (
          <div className="attendance-quick-action-meta" aria-live="polite">
            <span className="attendance-quick-action-meta__time">In {formatAttendanceTime(attendanceToday.checkInTime)}</span>
            <strong className="attendance-quick-action-meta__worked">{liveWorkedDuration}</strong>
          </div>
        ) : null}
        <button
          type="button"
          className={`attendance-quick-action attendance-quick-action--${size} ${actionState.toneClass} ${className}`.trim()}
          onClick={handleClick}
          disabled={actionState.disabled || submitting || isTimeDrifted}
          aria-label={isTimeDrifted ? "Your device clock is out of sync. Please enable automatic time synchronization to log attendance." : actionState.hint}
          title={isTimeDrifted ? "Your device clock is out of sync. Please enable automatic time synchronization to log attendance." : actionState.hint}
        >
          {submitting ? "Updating..." : actionState.label}
        </button>
        {(actionError || isTimeDrifted) ? (
          <p className="attendance-quick-action-error" role="alert">
            {isTimeDrifted ? "Your device clock is out of sync. Please enable automatic time synchronization to log attendance." : actionError}
          </p>
        ) : null}
      </div>

      <Modal
        open={showCheckoutModal}
        onClose={() => {
          setShowCheckoutModal(false);
          setTodaysUpdateInput("");
          setActionError("");
        }}
        title="Check out"
        className="checkout-modal"
      >
        <form onSubmit={handleCheckoutSubmit} className="stack">
          <div className="checkout-choice-grid">
            <div 
              className={`checkout-choice-card ${useSupportUpdate ? 'active' : ''}`}
              onClick={() => setUseSupportUpdate(!useSupportUpdate)}
            >
              <div className="choice-header">
                <span className="choice-title">Support Update</span>
                {useSupportUpdate ? <Check size={16} color="var(--color-accent)" /> : <ShieldCheck size={16} color="var(--color-text-secondary)" />}
              </div>
              <p className="choice-desc">Structured metrics for data extraction and email support.</p>
            </div>

            <div 
              className={`checkout-choice-card ${useManualUpdate ? 'active' : ''}`}
              onClick={() => setUseManualUpdate(!useManualUpdate)}
            >
              <div className="choice-header">
                <span className="choice-title">Write Your Own</span>
                {useManualUpdate ? <Check size={16} color="var(--color-accent)" /> : <FileText size={16} color="var(--color-text-secondary)" />}
              </div>
              <p className="choice-desc">Free-form text update for general tasks and activities.</p>
            </div>
          </div>

          {useSupportUpdate && (
            <div className="support-metrics-section">
              {!fetchingEmails && assignedEmails.length === 0 && (
                <div className="metrics-row">
                  <label>
                    Data Extracted
                    <input 
                      type="number" 
                      placeholder="0"
                      value={supportData.dataExtracted}
                      onChange={e => setSupportData(prev => ({ ...prev, dataExtracted: e.target.value }))}
                    />
                  </label>
                  <label>
                    Emails Sent
                    <input 
                      type="number" 
                      placeholder="0"
                      value={supportData.emailsSent}
                      onChange={e => setSupportData(prev => ({ ...prev, emailsSent: e.target.value }))}
                    />
                  </label>
                </div>
              )}

              {fetchingEmails ? (
                <div className="muted" style={{ fontSize: '12px' }}>Loading assigned Outlook IDs...</div>
              ) : assignedEmails.length > 0 ? (
                <>
                  <div className="section-label" style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    Assigned Outlook IDs (TEC/TUT)
                  </div>
                  <div className="outlook-ids-container" style={{ gridTemplateColumns: '1fr' }}>
                    {assignedEmails.map((email) => (
                      <div key={email.id} className="outlook-id-subcard" style={{
                        background: 'white',
                        border: '1.5px solid var(--color-border-default)',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-text-strong)' }}>
                          {email.name} <span style={{ opacity: 0.6 }}>({email.client?.code})</span>
                        </div>
                        <div className="metrics-row" style={{ gap: '12px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700' }}>
                            Data Extracted
                            <input 
                              type="number" 
                              placeholder="0"
                              value={supportData.outlookMetrics[email.id]?.dataExtracted || ""}
                              onChange={e => handleOutlookMetricChange(email.id, 'dataExtracted', e.target.value)}
                            />
                          </label>
                          <label style={{ fontSize: '11px', fontWeight: '700' }}>
                            Mails Count
                            <input 
                              type="number" 
                              placeholder="0"
                              value={supportData.outlookMetrics[email.id]?.mailsCount || ""}
                              onChange={e => handleOutlookMetricChange(email.id, 'mailsCount', e.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                  No Outlook IDs from TEC/TUT assigned to you.
                </div>
              )}
            </div>
          )}

          {useManualUpdate && (
            <label>
              Manual Update
              <textarea
                value={todaysUpdateInput}
                onChange={(e) => setTodaysUpdateInput(e.target.value)}
                placeholder="Briefly mention other tasks you performed..."
                required={!useSupportUpdate}
                rows={useSupportUpdate ? 3 : 5}
                style={{ resize: 'none' }}
              />
            </label>
          )}

          <div className="button-row" style={{ marginTop: '8px', justifyContent: 'flex-end', display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setShowCheckoutModal(false);
                setTodaysUpdateInput("");
                setActionError("");
              }}
              disabled={submitting}
              style={{ minWidth: '100px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ minWidth: '120px' }}
            >
              {submitting ? "Checking out..." : "Finalize & Out"}
            </button>
          </div>
          {actionError ? (
            <p className="error-text" style={{ marginTop: '12px' }}>{actionError}</p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}

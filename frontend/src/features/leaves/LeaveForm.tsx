import "./LeaveForm.css";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Employee, LeaveBalance, LeaveType } from "../../types";
import { countWords, LEAVE_REASON_MAX_WORDS, LEAVE_REASON_MIN_WORDS } from "./reasonValidation";
import { formatLeaveDays } from "../../utils/format";

export type LeaveFormValues = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startDayDuration: "FULL_DAY" | "HALF_DAY";
  endDayDuration: "FULL_DAY" | "HALF_DAY";
  startHalfDayPeriod?: "FIRST_HALF" | "SECOND_HALF";
  endHalfDayPeriod?: "FIRST_HALF" | "SECOND_HALF";
  reason: string;
};

type LeaveFormProps = {
  form: LeaveFormValues;
  attachmentName?: string;
  leaveTypes: LeaveType[];
  balances?: LeaveBalance[];
  isSubmitting?: boolean;
  currentEmployee?: Employee | null;
  onChange: (nextForm: LeaveFormValues) => void;
  onAttachmentChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function formatLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMinSelectableDate() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  if (currentHour > 13 || (currentHour === 13 && currentMinute >= 30)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return formatLocalIsoDate(tomorrow);
  }
  return formatLocalIsoDate(now);
}

export default function LeaveForm({ form, attachmentName, leaveTypes, balances, isSubmitting = false, currentEmployee, onChange, onAttachmentChange, onSubmit }: LeaveFormProps) {
  const [isMultipleDays, setIsMultipleDays] = useState(() => form.startDate !== form.endDate);

  const isSingleDay = !isMultipleDays;
  const reasonWordCount = useMemo(() => countWords(form.reason), [form.reason]);
  const [leaveTypeMenuOpen, setLeaveTypeMenuOpen] = useState(false);
  const [showAllLeaveTypes, setShowAllLeaveTypes] = useState(false);
  const leaveTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const leaveTypePriority = useMemo(
    () => ["sl", "cl", "maternity", "paternity", "bereavement"],
    [],
  );

  const allowedLeaveTypes = useMemo(() => {
    const gender = currentEmployee?.gender?.trim().toUpperCase() ?? "";
    return leaveTypes.filter((leaveType) => {
      const name = leaveType.name.toLowerCase();
      const code = leaveType.code.toLowerCase();
      if (gender === "MALE" && (name.includes("maternity") || code.includes("maternity"))) {
        return false;
      }
      if (gender === "FEMALE" && (name.includes("paternity") || code.includes("paternity"))) {
        return false;
      }
      return true;
    });
  }, [leaveTypes, currentEmployee?.gender]);

  const primaryLeaveTypes = useMemo(
    () => {
      const getPriority = (leaveType: LeaveType) => {
        const normalizedName = leaveType.name.trim().toLowerCase();
        const normalizedCode = leaveType.code.trim().toLowerCase();

        return leaveTypePriority.findIndex(
          (priorityKey) => normalizedCode === priorityKey || normalizedName.includes(priorityKey),
        );
      };

      return [...allowedLeaveTypes]
        .map((leaveType) => ({ leaveType, priority: getPriority(leaveType) }))
        .filter((item) => item.priority !== -1)
        .sort((left, right) => left.priority - right.priority)
        .map((item) => item.leaveType);
    },
    [leaveTypePriority, allowedLeaveTypes],
  );

  const remainingLeaveTypes = useMemo(
    () => allowedLeaveTypes.filter((leaveType) => !primaryLeaveTypes.some((primaryType) => primaryType.id === leaveType.id)),
    [allowedLeaveTypes, primaryLeaveTypes],
  );

  const visibleLeaveTypes = showAllLeaveTypes ? allowedLeaveTypes : primaryLeaveTypes;
  const selectedLeaveType = useMemo(
    () => allowedLeaveTypes.find((leaveType) => String(leaveType.id) === form.leaveTypeId) ?? null,
    [form.leaveTypeId, allowedLeaveTypes],
  );

  useEffect(() => {
    if (selectedLeaveType && remainingLeaveTypes.some((leaveType) => leaveType.id === selectedLeaveType.id)) {
      setShowAllLeaveTypes(true);
    }
  }, [remainingLeaveTypes, selectedLeaveType]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!leaveTypeMenuRef.current?.contains(event.target as Node)) {
        setLeaveTypeMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLeaveTypeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <form className="stack leave-form-content" style={{ gap: "20px" }} onSubmit={onSubmit}>
      <div className="leave-info-alert" style={{
        background: "var(--color-surface-hover)",
        padding: "16px",
        borderRadius: "var(--radius-md)",
        fontSize: "13px",
        color: "var(--color-text-secondary)",
        lineHeight: "1.5"
      }}>
        <ul style={{ margin: 0, paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <li>Paid balance shortage converts seamlessly to unpaid leave.</li>
          <li>For multi-day requests, specify half-day start/end dates if needed.</li>
          <li>Sick leaves exceeding 2 days require a medical proof attachment.</li>
        </ul>
      </div>



      <div className="leave-form-card__field" ref={leaveTypeMenuRef}>
        <span className="leave-form-card__field-label">Leave type</span>
        <input type="hidden" name="leaveTypeId" value={form.leaveTypeId} required />
        <button
          type="button"
          className={[
            "leave-form-card__select-trigger",
            !selectedLeaveType ? "leave-form-card__select-trigger--placeholder" : "",
            leaveTypeMenuOpen ? "leave-form-card__select-trigger--open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={isSubmitting}
          onClick={() => setLeaveTypeMenuOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={leaveTypeMenuOpen}
        >
          <span className="leave-form-card__select-trigger-copy">
            <span className="leave-form-card__select-trigger-title">{selectedLeaveType?.name ?? "Select leave type"}</span>
            {selectedLeaveType ? <span className="leave-form-card__select-trigger-meta">{selectedLeaveType.code}</span> : null}
          </span>
          <ChevronDown
            size={18}
            strokeWidth={2}
            className={[
              "leave-form-card__select-icon",
              leaveTypeMenuOpen ? "leave-form-card__select-icon--open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </button>

        {leaveTypeMenuOpen ? (
          <div className="leave-form-card__select-popover" role="listbox" aria-label="Leave type options">
            {visibleLeaveTypes.map((leaveType) => {
              const isSelected = String(leaveType.id) === form.leaveTypeId;
              let quotaText = "";
              if (balances && (leaveType.code === "SL" || leaveType.code === "CL")) {
                const balance = balances.find((b) => b.leaveType.id === leaveType.id);
                if (balance) {
                  quotaText = ` – ${formatLeaveDays(balance.visibleDays ?? balance.remainingDays)} left`;
                }
              }

              return (
                <button
                  key={leaveType.id}
                  type="button"
                  className={[
                    "leave-form-card__select-option",
                    isSelected ? "leave-form-card__select-option--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={isSubmitting}
                  onClick={() => {
                    onChange({ ...form, leaveTypeId: String(leaveType.id) });
                    setLeaveTypeMenuOpen(false);
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="leave-form-card__select-option-copy">
                    <span className="leave-form-card__select-option-title">{leaveType.name}</span>
                    <span className="leave-form-card__select-option-meta">{leaveType.code}{quotaText}</span>
                  </span>
                  {isSelected ? <Check size={16} strokeWidth={2.2} /> : null}
                </button>
              );
            })}

            {!showAllLeaveTypes && remainingLeaveTypes.length ? (
              <button
                type="button"
                className="leave-form-card__select-option leave-form-card__select-option--more"
                disabled={isSubmitting}
                onClick={() => setShowAllLeaveTypes(true)}
              >
                <span className="leave-form-card__select-option-copy">
                  <span className="leave-form-card__select-option-title">See more...</span>
                  <span className="leave-form-card__select-option-meta">
                    Reveal {remainingLeaveTypes.length} more leave type{remainingLeaveTypes.length > 1 ? "s" : ""}
                  </span>
                </span>
                <ChevronDown size={16} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="leave-duration-type-selector">
        <button
          type="button"
          className={`leave-duration-tab ${!isMultipleDays ? "active" : ""}`}
          disabled={isSubmitting}
          onClick={() => {
            setIsMultipleDays(false);
            onChange({ ...form, endDate: form.startDate, endDayDuration: form.startDayDuration });
          }}
        >
          One Day Leave
        </button>
        <button
          type="button"
          className={`leave-duration-tab ${isMultipleDays ? "active" : ""}`}
          disabled={isSubmitting}
          onClick={() => {
            setIsMultipleDays(true);
            try {
              const d = new Date(form.startDate);
              d.setDate(d.getDate() + 1);
              const tomorrowStr = formatLocalIsoDate(d);
              onChange({ ...form, endDate: tomorrowStr });
            } catch (err) {
              const tomorrowStr = "2026-05-24";
              onChange({ ...form, endDate: tomorrowStr });
            }
          }}
        >
          Multiple Days Leave
        </button>
      </div>

      {isMultipleDays ? (
        <div className="grid cols-2" style={{ gap: "16px" }}>
          <label className="date-range-picker__label">
            Start date
            <input 
              type="date" 
              className="leave-form-card__select"
              value={form.startDate}
              disabled={isSubmitting}
              min={getMinSelectableDate()}
              onChange={(e) => {
                const selectedDate = e.target.value;
                let nextEnd = form.endDate;
                if (selectedDate > form.endDate) {
                  nextEnd = selectedDate;
                }
                onChange({ ...form, startDate: selectedDate, endDate: nextEnd });
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1.5px solid var(--color-border-default)",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-primary)"
              }}
            />
          </label>
          <label className="date-range-picker__label">
            End date
            <input 
              type="date" 
              className="leave-form-card__select"
              value={form.endDate}
              disabled={isSubmitting}
              min={form.startDate || getMinSelectableDate()}
              onChange={(e) => {
                onChange({ ...form, endDate: e.target.value });
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1.5px solid var(--color-border-default)",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-primary)"
              }}
            />
          </label>
        </div>
      ) : (
        <label className="date-range-picker__label">
          Leave date
          <input 
            type="date" 
            className="leave-form-card__select"
            value={form.startDate}
            disabled={isSubmitting}
            min={getMinSelectableDate()}
            onChange={(e) => {
              const selectedDate = e.target.value;
              onChange({ ...form, startDate: selectedDate, endDate: selectedDate });
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--color-border-default)",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-primary)"
            }}
          />
        </label>
      )}
      {isSingleDay ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label>
            Duration
            <select className="leave-form-card__select"
              value={form.startDayDuration}
              disabled={isSubmitting}
              onChange={(event) => {
                const nextDuration = event.target.value as LeaveFormValues["startDayDuration"];
                onChange({ ...form, startDayDuration: nextDuration, endDayDuration: nextDuration });
              }}
            >
              <option value="FULL_DAY">Full day</option>
              <option value="HALF_DAY">Half day</option>
            </select>
          </label>
          {form.startDayDuration === "HALF_DAY" && (
            <label style={{ marginLeft: "16px", marginTop: "-4px" }}>
              Half Day Period
              <select className="leave-form-card__select"
                value={form.startHalfDayPeriod ?? "FIRST_HALF"}
                disabled={isSubmitting}
                onChange={(event) => {
                  const val = event.target.value as "FIRST_HALF" | "SECOND_HALF";
                  onChange({ ...form, startHalfDayPeriod: val, endHalfDayPeriod: val });
                }}
              >
                <option value="FIRST_HALF">First Half (Morning)</option>
                <option value="SECOND_HALF">Second Half (Afternoon)</option>
              </select>
            </label>
          )}
        </div>
      ) : (
        <div className="grid cols-2">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label>
              Start day
              <select className="leave-form-card__select"
                value={form.startDayDuration}
                disabled={isSubmitting}
                onChange={(event) => onChange({ ...form, startDayDuration: event.target.value as LeaveFormValues["startDayDuration"] })}
              >
                <option value="FULL_DAY">Full day</option>
                <option value="HALF_DAY">Half day</option>
              </select>
            </label>
            {form.startDayDuration === "HALF_DAY" && (
              <label style={{ marginLeft: "16px", marginTop: "-4px" }}>
                Start Day Period
                <select className="leave-form-card__select"
                  value={form.startHalfDayPeriod ?? "FIRST_HALF"}
                  disabled={isSubmitting}
                  onChange={(event) => onChange({ ...form, startHalfDayPeriod: event.target.value as "FIRST_HALF" | "SECOND_HALF" })}
                >
                  <option value="FIRST_HALF">First Half</option>
                  <option value="SECOND_HALF">Second Half</option>
                </select>
              </label>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label>
              End day
              <select className="leave-form-card__select"
                value={form.endDayDuration}
                disabled={isSubmitting}
                onChange={(event) => onChange({ ...form, endDayDuration: event.target.value as LeaveFormValues["endDayDuration"] })}
              >
                <option value="FULL_DAY">Full day</option>
                <option value="HALF_DAY">Half day</option>
              </select>
            </label>
            {form.endDayDuration === "HALF_DAY" && (
              <label style={{ marginLeft: "16px", marginTop: "-4px" }}>
                End Day Period
                <select className="leave-form-card__select"
                  value={form.endHalfDayPeriod ?? "FIRST_HALF"}
                  disabled={isSubmitting}
                  onChange={(event) => onChange({ ...form, endHalfDayPeriod: event.target.value as "FIRST_HALF" | "SECOND_HALF" })}
                >
                  <option value="FIRST_HALF">First Half</option>
                  <option value="SECOND_HALF">Second Half</option>
                </select>
              </label>
            )}
          </div>
        </div>
      )}
      <label>
        Reason
        <textarea value={form.reason} onChange={(event) => onChange({ ...form, reason: event.target.value })} rows={4} required disabled={isSubmitting} />
        <span className="muted">
          {reasonWordCount} words. Keep it between {LEAVE_REASON_MIN_WORDS} and {LEAVE_REASON_MAX_WORDS} words.
        </span>
      </label>
      <label>
        Attachment (optional)
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          disabled={isSubmitting}
          onChange={(event) => onAttachmentChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {attachmentName ? <p className="muted">Selected file: {attachmentName}</p> : null}
      {isSubmitting ? <p className="leave-form-card__status">Submitting your leave request...</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting leave request..." : "Submit leave request"}
      </button>
    </form>
  );
}

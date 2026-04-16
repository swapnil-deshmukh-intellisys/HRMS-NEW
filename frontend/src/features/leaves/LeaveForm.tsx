import "./LeaveForm.css";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { LeaveBalance, LeaveType } from "../../types";
import DateRangePicker from "./DateRangePicker";
import { countWords, LEAVE_REASON_MAX_WORDS, LEAVE_REASON_MIN_WORDS } from "./reasonValidation";
import { formatLeaveDays } from "../../utils/format";

export type LeaveFormValues = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startDayDuration: "FULL_DAY" | "HALF_DAY";
  endDayDuration: "FULL_DAY" | "HALF_DAY";
  reason: string;
};

type LeaveFormProps = {
  form: LeaveFormValues;
  attachmentName?: string;
  leaveTypes: LeaveType[];
  balances?: LeaveBalance[];
  isSubmitting?: boolean;
  onChange: (nextForm: LeaveFormValues) => void;
  onAttachmentChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function LeaveForm({ form, attachmentName, leaveTypes, balances, isSubmitting = false, onChange, onAttachmentChange, onSubmit }: LeaveFormProps) {
  const isSingleDay = form.startDate && form.endDate && form.startDate === form.endDate;
  const reasonWordCount = useMemo(() => countWords(form.reason), [form.reason]);
  const [leaveTypeMenuOpen, setLeaveTypeMenuOpen] = useState(false);
  const [showAllLeaveTypes, setShowAllLeaveTypes] = useState(false);
  const leaveTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const leaveTypePriority = useMemo(
    () => ["sl", "cl", "maternity", "paternity", "bereavement"],
    [],
  );

  const primaryLeaveTypes = useMemo(
    () => {
      const getPriority = (leaveType: LeaveType) => {
        const normalizedName = leaveType.name.trim().toLowerCase();
        const normalizedCode = leaveType.code.trim().toLowerCase();

        return leaveTypePriority.findIndex(
          (priorityKey) => normalizedCode === priorityKey || normalizedName.includes(priorityKey),
        );
      };

      return [...leaveTypes]
        .map((leaveType) => ({ leaveType, priority: getPriority(leaveType) }))
        .filter((item) => item.priority !== -1)
        .sort((left, right) => left.priority - right.priority)
        .map((item) => item.leaveType);
    },
    [leaveTypePriority, leaveTypes],
  );

  const remainingLeaveTypes = useMemo(
    () => leaveTypes.filter((leaveType) => !primaryLeaveTypes.some((primaryType) => primaryType.id === leaveType.id)),
    [leaveTypes, primaryLeaveTypes],
  );

  const visibleLeaveTypes = showAllLeaveTypes ? leaveTypes : primaryLeaveTypes;
  const selectedLeaveType = useMemo(
    () => leaveTypes.find((leaveType) => String(leaveType.id) === form.leaveTypeId) ?? null,
    [form.leaveTypeId, leaveTypes],
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
      <DateRangePicker
        startDate={form.startDate}
        endDate={form.endDate}
        onChange={({ startDate, endDate }) => onChange({ ...form, startDate, endDate })}
      />
      {isSingleDay ? (
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
      ) : (
        <div className="grid cols-2">
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

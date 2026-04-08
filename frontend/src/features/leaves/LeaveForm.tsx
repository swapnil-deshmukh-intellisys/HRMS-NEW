import "./LeaveForm.css";
import type { FormEvent } from "react";
import type { LeaveType } from "../../types";

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
  onChange: (nextForm: LeaveFormValues) => void;
  onAttachmentChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function LeaveForm({ form, attachmentName, leaveTypes, onChange, onAttachmentChange, onSubmit }: LeaveFormProps) {
  const isSingleDay = form.startDate && form.endDate && form.startDate === form.endDate;

  return (
    <form className="card stack compact-form leave-form-card" onSubmit={onSubmit}>
      <h3>Apply leave</h3>
      <p className="muted">If your paid balance is not enough, the remaining days will be submitted as unpaid leave.</p>
      <p className="muted">For multi-day leave, you can mark the start day and end day as half day if needed.</p>
      <p className="muted">For sick leave of 2 or more consecutive days, upload the medical certificate with the request.</p>
      <label>
        Leave type
        <select value={form.leaveTypeId} onChange={(event) => onChange({ ...form, leaveTypeId: event.target.value })} required>
          <option value="">Select leave type</option>
          {leaveTypes.map((leaveType) => (
            <option key={leaveType.id} value={leaveType.id}>
              {leaveType.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Start date
        <input value={form.startDate} onChange={(event) => onChange({ ...form, startDate: event.target.value })} type="date" required />
      </label>
      <label>
        End date
        <input value={form.endDate} onChange={(event) => onChange({ ...form, endDate: event.target.value })} type="date" required />
      </label>
      {isSingleDay ? (
        <label>
          Duration
          <select
            value={form.startDayDuration}
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
            <select
              value={form.startDayDuration}
              onChange={(event) => onChange({ ...form, startDayDuration: event.target.value as LeaveFormValues["startDayDuration"] })}
            >
              <option value="FULL_DAY">Full day</option>
              <option value="HALF_DAY">Half day</option>
            </select>
          </label>
          <label>
            End day
            <select
              value={form.endDayDuration}
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
        <textarea value={form.reason} onChange={(event) => onChange({ ...form, reason: event.target.value })} rows={4} required />
      </label>
      <label>
        Attachment (optional)
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(event) => onAttachmentChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {attachmentName ? <p className="muted">Selected file: {attachmentName}</p> : null}
      <button type="submit">Submit leave request</button>
    </form>
  );
}

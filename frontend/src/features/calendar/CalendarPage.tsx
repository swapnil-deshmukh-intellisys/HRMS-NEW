import "./CalendarPage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import MessageCard from "../../components/common/MessageCard";
import { apiRequest } from "../../services/api";
import type { CalendarDay, CalendarException, Role } from "../../types";

type CalendarPageProps = {
  token: string | null;
  role: Role;
};

type CalendarResponse = {
  month: number;
  year: number;
  days: CalendarDay[];
  exceptions: CalendarException[];
};

function formatMonthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function toDateInputValue(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage({ token, role }: CalendarPageProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [workingSaturdayModalOpen, setWorkingSaturdayModalOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    date: "",
    name: "",
    description: "",
  });
  const [workingSaturdayForm, setWorkingSaturdayForm] = useState({
    date: "",
    name: "",
    description: "",
  });
  const canManageCalendar = role === "ADMIN" || role === "HR";

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<CalendarResponse>(`/calendar?month=${visibleMonth.month}&year=${visibleMonth.year}`, { token });
      setDays(response.data.days);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load calendar.");
    } finally {
      setLoading(false);
    }
  }, [token, visibleMonth.month, visibleMonth.year]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const weeks = useMemo(() => {
    if (!days.length) {
      return [];
    }

    const leadingBlankCount = (days[0]!.weekday + 6) % 7;
    const leadingBlanks = Array.from({ length: leadingBlankCount }, () => null);
    const calendarCells = [...leadingBlanks, ...days];
    const rows: Array<Array<CalendarDay | null>> = [];

    for (let index = 0; index < calendarCells.length; index += 7) {
      rows.push(calendarCells.slice(index, index + 7));
    }

    return rows;
  }, [days]);

  function shiftMonth(direction: -1 | 1) {
    setVisibleMonth((current) => {
      const nextDate = new Date(current.year, current.month - 1 + direction, 1);
      return {
        year: nextDate.getFullYear(),
        month: nextDate.getMonth() + 1,
      };
    });
  }

  async function handleCreateHoliday() {
    try {
      setError("");
      setMessage("");
      await apiRequest("/calendar/holidays", {
        method: "POST",
        token,
        body: holidayForm,
      });
      setMessage("Holiday saved.");
      setHolidayModalOpen(false);
      setHolidayForm({ date: "", name: "", description: "" });
      await loadCalendar();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save holiday.");
    }
  }

  async function handleCreateWorkingSaturday() {
    try {
      setError("");
      setMessage("");
      await apiRequest("/calendar/working-saturdays", {
        method: "POST",
        token,
        body: workingSaturdayForm,
      });
      setMessage("Working Saturday saved.");
      setWorkingSaturdayModalOpen(false);
      setWorkingSaturdayForm({ date: "", name: "", description: "" });
      await loadCalendar();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save working Saturday.");
    }
  }

  async function handleRemoveException(id: number) {
    try {
      setError("");
      setMessage("");
      await apiRequest(`/calendar/${id}`, {
        method: "DELETE",
        token,
      });
      setMessage("Calendar exception removed.");
      await loadCalendar();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to remove calendar exception.");
    }
  }

  function openHolidayModal() {
    setHolidayForm((current) => ({
      ...current,
      date: current.date || toDateInputValue(visibleMonth.year, visibleMonth.month, 1),
    }));
    setHolidayModalOpen(true);
  }

  function openWorkingSaturdayModal() {
    const firstSaturday = days.find((day) => day.weekday === 6);
    setWorkingSaturdayForm((current) => ({
      ...current,
      date: current.date || (firstSaturday ? toDateInputValue(visibleMonth.year, visibleMonth.month, firstSaturday.dayNumber) : ""),
    }));
    setWorkingSaturdayModalOpen(true);
  }

  function getDayClassName(day: CalendarDay) {
    return `calendar-day-card calendar-day-card--${day.status.toLowerCase().replace(/_/g, "-")}`;
  }

  return (
    <section className="stack calendar-page">
      {error ? <MessageCard title="Calendar issue" tone="error" message={error} /> : null}
      {message ? <p className="success-text">{message}</p> : null}
      <article className="card calendar-page__surface">
        <div className="calendar-page__header">
          <div>
            <p className="eyebrow">Calendar</p>
            <h3>{formatMonthTitle(visibleMonth.year, visibleMonth.month)}</h3>
          </div>
          <div className="calendar-page__actions">
            <div className="button-row">
              <button type="button" className="secondary calendar-action-button" onClick={() => shiftMonth(-1)}>
                Previous
              </button>
              <button type="button" className="secondary calendar-action-button" onClick={() => shiftMonth(1)}>
                Next
              </button>
            </div>
            {canManageCalendar ? (
              <div className="button-row">
                <button type="button" className="secondary calendar-action-button" onClick={openWorkingSaturdayModal}>
                  Working Saturday
                </button>
                <button type="button" className="calendar-action-button calendar-action-button--primary" onClick={openHolidayModal}>
                  Add holiday
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="calendar-legend">
          <span><i className="calendar-legend__dot calendar-legend__dot--working" />Working</span>
          <span><i className="calendar-legend__dot calendar-legend__dot--off" />Off</span>
          <span><i className="calendar-legend__dot calendar-legend__dot--holiday" />Holiday</span>
          <span><i className="calendar-legend__dot calendar-legend__dot--working-saturday" />Working Saturday</span>
        </div>
        {loading ? (
          <div className="page-loading">
            <span className="skeleton-line skeleton-line--title" />
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--long" />
          </div>
        ) : (
          <>
            <div className="calendar-grid calendar-grid--labels">
              {weekdayLabels.map((label) => (
                <span key={label} className="calendar-grid__label">
                  {label}
                </span>
              ))}
            </div>
            <div className="calendar-grid calendar-grid--days">
              {weeks.flatMap((week, weekIndex) =>
                Array.from({ length: 7 }).map((_, dayIndex) => {
                  const day = week[dayIndex] ?? null;
                  if (!day) {
                    return <div key={`blank-${weekIndex}-${dayIndex}`} className="calendar-day-card calendar-day-card--blank" />;
                  }

                  return (
                    <div key={day.date} className={getDayClassName(day)}>
                      <div className="calendar-day-card__header">
                        <strong>{day.dayNumber}</strong>
                        <span>{day.status.replace(/_/g, " ")}</span>
                      </div>
                      {day.exception?.name ? <p className="calendar-day-card__name">{day.exception.name}</p> : null}
                      {canManageCalendar && day.exception ? (
                        <button type="button" className="secondary calendar-day-card__remove calendar-action-button" onClick={() => handleRemoveException(day.exception!.id)}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                  );
                }),
              )}
            </div>
          </>
        )}
      </article>
      <Modal open={holidayModalOpen} title="Add holiday" onClose={() => setHolidayModalOpen(false)}>
        <div className="stack calendar-form">
          <label>
            Date
            <input type="date" value={holidayForm.date} onChange={(event) => setHolidayForm((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label>
            Holiday name
            <input value={holidayForm.name} onChange={(event) => setHolidayForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea rows={3} value={holidayForm.description} onChange={(event) => setHolidayForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="button-row">
            <button type="button" className="secondary calendar-action-button" onClick={() => setHolidayModalOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="calendar-action-button calendar-action-button--primary"
              onClick={handleCreateHoliday}
              disabled={!holidayForm.date || !holidayForm.name.trim()}
            >
              Save holiday
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={workingSaturdayModalOpen} title="Mark Saturday as working" onClose={() => setWorkingSaturdayModalOpen(false)}>
        <div className="stack calendar-form">
          <label>
            Saturday date
            <input
              type="date"
              value={workingSaturdayForm.date}
              onChange={(event) => setWorkingSaturdayForm((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label>
            Note
            <input value={workingSaturdayForm.name} onChange={(event) => setWorkingSaturdayForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={workingSaturdayForm.description}
              onChange={(event) => setWorkingSaturdayForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <div className="button-row">
            <button type="button" className="secondary calendar-action-button" onClick={() => setWorkingSaturdayModalOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="calendar-action-button calendar-action-button--primary"
              onClick={handleCreateWorkingSaturday}
              disabled={!workingSaturdayForm.date}
            >
              Save working Saturday
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

import "./CalendarPage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
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

function formatDateLong(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string | Date) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDayStatusLabel(status: CalendarDay["status"]) {
  if (status === "WORKING_SATURDAY") {
    return "WORKING SATURDAY";
  }
  if (status === "WORKING") {
    return "";
  }
  return status.replace(/_/g, " ");
}

export default function CalendarPage({ token, role }: CalendarPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [selectedDayDetails, setSelectedDayDetails] = useState<CalendarDay | null>(null);
  const canManageCalendar = role === "ADMIN" || role === "HR";

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest<CalendarResponse>(`/calendar?month=${visibleMonth.month}&year=${visibleMonth.year}`, { token });
      setDays(response.data.days);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to load calendar.");
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
      await apiRequest("/calendar/holidays", {
        method: "POST",
        token,
        body: holidayForm,
      });
      toast.success("Holiday saved.");
      setHolidayModalOpen(false);
      setHolidayForm({ date: "", name: "", description: "" });
      await loadCalendar();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to save holiday.");
    }
  }

  async function handleCreateWorkingSaturday() {
    try {
      await apiRequest("/calendar/working-saturdays", {
        method: "POST",
        token,
        body: workingSaturdayForm,
      });
      toast.success("Working Saturday saved.");
      setWorkingSaturdayModalOpen(false);
      setWorkingSaturdayForm({ date: "", name: "", description: "" });
      await loadCalendar();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to save working Saturday.");
    }
  }

  async function handleRemoveException(id: number) {
    if (!window.confirm("Are you sure you want to remove this calendar exception/holiday? This may affect attendance calculations for this day.")) {
      return;
    }
    try {
      await apiRequest(`/calendar/${id}`, {
        method: "DELETE",
        token,
      });
      toast.success("Calendar exception removed.");
      await loadCalendar();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to remove calendar exception.");
    }
  }

  function openHolidayModal() {
    setHolidayForm((current) => ({
      ...current,
      date: current.date || toDateInputValue(visibleMonth.year, visibleMonth.month, 1),
    }));
    setHolidayModalOpen(true);
  }

  const monthSaturdays = useMemo(() => {
    return days.filter(day => day.weekday === 6);
  }, [days]);

  function openWorkingSaturdayModal() {
    const firstSaturday = monthSaturdays[0];
    setWorkingSaturdayForm((current) => ({
      ...current,
      date: current.date || (firstSaturday ? toDateInputValue(visibleMonth.year, visibleMonth.month, firstSaturday.dayNumber) : ""),
    }));
    setWorkingSaturdayModalOpen(true);
  }

  function getDayClassName(day: CalendarDay) {
    const now = new Date();
    const isToday = day.dayNumber === now.getDate() && 
                    visibleMonth.month === (now.getMonth() + 1) && 
                    visibleMonth.year === now.getFullYear();
    
    return `calendar-day-card calendar-day-card--${day.status.toLowerCase().replace(/_/g, "-")} ${isToday ? "calendar-day-card--today" : ""}`;
  }

  return (
    <section className="stack calendar-page">
      <article className="calendar-page__surface">
        <div className="calendar-page__header">
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {location.state?.fromLeaves && (
              <button
                type="button"
                className="secondary calendar-action-button"
                onClick={() => navigate("/leaves")}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 12px", height: "38px" }}
              >
                <ArrowLeft size={16} />
                <span>Back to Leaves</span>
              </button>
            )}
            <div>
              <p className="eyebrow">Calendar</p>
              <h3>{formatMonthTitle(visibleMonth.year, visibleMonth.month)}</h3>
            </div>
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
            <div className="calendar-board">
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
                          <span>{getDayStatusLabel(day.status)}</span>
                        </div>
                        {day.exception?.name && day.status !== "WORKING_SATURDAY" ? <p className="calendar-day-card__name">{day.exception.name}</p> : null}
                        
                        {day.leaves && day.leaves.length > 0 ? (
                          <div className="calendar-day-leaves">
                            <span className="calendar-day-leaves__title">Who's out:</span>
                            {day.leaves.slice(0, 1).map(leave => (
                              <span key={leave.id} className="calendar-day-leaves__item">
                                {leave.employee.firstName} {leave.employee.lastName[0]}.
                              </span>
                            ))}
                            <button
                              type="button"
                              className="calendar-day-leaves__more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDayDetails(day);
                              }}
                            >
                              {day.leaves.length > 1 ? `+${day.leaves.length - 1} more...` : "see more..."}
                            </button>
                          </div>
                        ) : null}

                        {canManageCalendar && day.exception ? (
                          <button
                            type="button"
                            className="calendar-day-card__remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRemoveException(day.exception!.id);
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    );
                  }),
                )}
              </div>
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
          <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Select Saturday</div>
          <div className="saturday-grid">
            {monthSaturdays.map(sat => {
              const isoDate = toDateInputValue(visibleMonth.year, visibleMonth.month, sat.dayNumber);
              const isSelected = workingSaturdayForm.date === isoDate;
              return (
                <button
                  key={isoDate}
                  type="button"
                  className={`saturday-opt ${isSelected ? 'active' : ''}`}
                  onClick={() => setWorkingSaturdayForm(prev => ({ ...prev, date: isoDate }))}
                >
                  <span className="sat-date">{sat.dayNumber}</span>
                  <span className="sat-month">{formatMonthTitle(visibleMonth.year, visibleMonth.month).split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
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
      <Modal 
        open={selectedDayDetails !== null} 
        title={`Day Details — ${selectedDayDetails ? formatDateShort(selectedDayDetails.date) : ""}`} 
        onClose={() => setSelectedDayDetails(null)}
        className="day-details-modal"
      >
        {selectedDayDetails ? (
          <div className="stack day-details-content">
            <div className="day-details-header-card">
              <h4 className="day-details-date">
                {formatDateLong(selectedDayDetails.date)}
              </h4>
              <div className="day-details-badges">
                <span className={`day-status-badge day-status-badge--${selectedDayDetails.status.toLowerCase().replace(/_/g, "-")}`}>
                  {getDayStatusLabel(selectedDayDetails.status) || "Regular Workday"}
                </span>
              </div>
            </div>

            {selectedDayDetails.exception ? (
              <div className={`day-exception-box day-exception-box--${selectedDayDetails.exception.type.toLowerCase().replace(/_/g, "-")}`}>
                <h5 className="day-exception-title">
                  {selectedDayDetails.exception.type === "HOLIDAY" ? "🎉 Holiday Event" : "🛠️ Working Saturday Event"}
                  {selectedDayDetails.exception.name ? `: ${selectedDayDetails.exception.name}` : ""}
                </h5>
                {selectedDayDetails.exception.description ? (
                  <p className="day-exception-desc">{selectedDayDetails.exception.description}</p>
                ) : (
                  <p className="day-exception-desc italic">No description provided.</p>
                )}
              </div>
            ) : null}

            <div className="day-leaves-section">
              <div className="day-leaves-header">
                <h5>👥 Who's Out ({selectedDayDetails.leaves?.length || 0})</h5>
              </div>
              {selectedDayDetails.leaves && selectedDayDetails.leaves.length > 0 ? (
                <div className="day-leaves-list">
                  {selectedDayDetails.leaves.map((leave) => {
                    const initials = `${leave.employee.firstName[0] || ""}${leave.employee.lastName[0] || ""}`.toUpperCase();
                    return (
                      <div key={leave.id} className="day-leave-row-card">
                        <div className="day-leave-avatar-col">
                          <div className="day-leave-avatar">{initials}</div>
                        </div>
                        <div className="day-leave-info-col">
                          <span className="day-leave-emp-name">
                            {leave.employee.firstName} {leave.employee.lastName}
                          </span>
                          <span className="day-leave-duration">
                            📅 Leave Period: {formatDateShort(leave.startDate)} to {formatDateShort(leave.endDate)}
                          </span>
                        </div>
                        <div className="day-leave-badge-col">
                          <span className="day-leave-row-badge">On Leave</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="day-leaves-empty">
                  <div className="empty-emoji">☀️</div>
                  <p>Everyone is working today. No employee leaves scheduled!</p>
                </div>
              )}
            </div>

            <div className="button-row" style={{ marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="calendar-action-button secondary" 
                onClick={() => setSelectedDayDetails(null)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

import "./DateRangePicker.css";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type DateRangePickerProps = {
  startDate: string;
  endDate: string;
  onChange: (nextRange: { startDate: string; endDate: string }) => void;
};

type CalendarDay = {
  iso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatIso(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatRangeLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return "Select leave dates";
  }

  const start = parseDate(startDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const end = parseDate(endDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return startDate === endDate ? start : `${start} - ${end}`;
}

function buildCalendarDays(visibleMonth: Date) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    days.push({
      iso: formatIso(current),
      dayNumber: current.getDate(),
      inCurrentMonth: current.getMonth() === month,
    });
  }

  return days;
}

export default function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const todayIso = formatIso(new Date());
  const currentMonth = useMemo(() => startOfMonth(parseDate(todayIso)), [todayIso]);
  const [open, setOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDate(startDate || todayIso));
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setDraftStartDate(startDate);
      setSelectingEnd(false);
      setVisibleMonth(parseDate(startDate || todayIso));
    }
  }, [open, startDate, todayIso]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (!open) {
      return undefined;
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const canViewPreviousMonth = visibleMonth > currentMonth;

  function handleDaySelect(dayIso: string) {
    if (dayIso < todayIso) {
      return;
    }

    if (!selectingEnd) {
      setDraftStartDate(dayIso);
      setSelectingEnd(true);
      onChange({ startDate: dayIso, endDate: dayIso });
      return;
    }

    if (!draftStartDate || dayIso < draftStartDate) {
      setDraftStartDate(dayIso);
      setSelectingEnd(true);
      onChange({ startDate: dayIso, endDate: dayIso });
      return;
    }

    onChange({ startDate: draftStartDate, endDate: dayIso });
    setOpen(false);
  }

  function isInRange(dayIso: string) {
    return Boolean(startDate && endDate && dayIso >= startDate && dayIso <= endDate);
  }

  function isRangeEdge(dayIso: string) {
    return dayIso === startDate || dayIso === endDate;
  }

  return (
    <div className="date-range-picker" ref={pickerRef}>
      <label className="date-range-picker__label">
        Leave dates
        <button
          type="button"
          className={`date-range-picker__trigger${open ? " date-range-picker__trigger--open" : ""}`}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="date-range-picker__trigger-copy">
            <CalendarDays size={16} strokeWidth={2} />
            <span>{formatRangeLabel(startDate, endDate)}</span>
          </span>
          <span className="date-range-picker__trigger-meta">
            {startDate && endDate ? `${Math.floor((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86400000) + 1} day(s)` : ""}
          </span>
        </button>
      </label>

      {open ? (
        <div className="date-range-picker__popover" role="dialog" aria-label="Select leave date range">
          <div className="date-range-picker__toolbar">
            <button
              type="button"
              className="date-range-picker__nav"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              aria-label="Previous month"
              disabled={!canViewPreviousMonth}
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              className="date-range-picker__nav"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="date-range-picker__weekdays" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="date-range-picker__grid">
            {calendarDays.map((day) => {
              const isPastDate = day.iso < todayIso;
              const selected = isRangeEdge(day.iso);
              const inRange = isInRange(day.iso);
              const isDraftStart = selectingEnd && draftStartDate === day.iso && startDate === endDate;
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={[
                    "date-range-picker__day",
                    day.inCurrentMonth ? "" : "date-range-picker__day--muted",
                    isPastDate ? "date-range-picker__day--disabled" : "",
                    inRange ? "date-range-picker__day--in-range" : "",
                    selected || isDraftStart ? "date-range-picker__day--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleDaySelect(day.iso)}
                  aria-pressed={inRange}
                  disabled={isPastDate}
                >
                  {day.dayNumber}
                </button>
              );
            })}
          </div>

          <p className="date-range-picker__hint">
            Pick today or a future start date, then click the end date in the same calendar.
          </p>
        </div>
      ) : null}
    </div>
  );
}

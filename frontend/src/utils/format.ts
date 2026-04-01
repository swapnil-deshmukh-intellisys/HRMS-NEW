export function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";
}

export function formatDateLabel(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";
}

export function isToday(value?: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function formatWeekday(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        weekday: "long",
      })
    : "-";
}

export function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "-";
}

export function formatTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "-";
}

export function formatAttendanceTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : "-";
}

export function formatMetricKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

export function formatLeaveDays(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${normalized} day${value === 1 ? "" : "s"}`;
}

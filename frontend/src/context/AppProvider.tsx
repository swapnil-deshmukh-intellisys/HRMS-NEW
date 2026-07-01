import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../services/api";
import type { Role, Notification, CalendarException, LiveStatus } from "../types";
import { ATTENDANCE_EVENT, getAttendanceUpdatedDetail } from "../components/common/attendanceQuickActionUtils";
import { AppContext, type DashboardSummary, type AnalyticsData } from "./useApp";

export function AppProvider({ children, token, role }: { children: ReactNode; token: string | null; role: Role }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<Record<number, LiveStatus>>({});
  const [calendarExceptions, setCalendarExceptions] = useState<CalendarException[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const analyticsLastFetched = React.useRef<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [isTimeDrifted, setIsTimeDrifted] = useState<boolean>(false);
  const [timeSyncLoading, setTimeSyncLoading] = useState<boolean>(false);

  const getCalibratedNow = useCallback(() => {
    return new Date(Date.now() + serverTimeOffset);
  }, [serverTimeOffset]);

  const syncServerTime = useCallback(async () => {
    try {
      setTimeSyncLoading(true);
      const startTime = Date.now();
      const response = await apiRequest<{ serverTime: string; timezone: string }>("/system/time");
      const endTime = Date.now();
      
      const serverTimeMs = new Date(response.data.serverTime).getTime();
      const rtt = endTime - startTime;
      const latency = rtt / 2;
      
      const offset = (serverTimeMs + latency) - endTime;
      setServerTimeOffset(offset);
      
      const isDrifted = Math.abs(offset) > 5 * 60 * 1000;
      setIsTimeDrifted(isDrifted);
    } catch (err) {
      console.error("[AppProvider] Failed to sync server time:", err);
    } finally {
      setTimeSyncLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncServerTime();
    
    const interval = setInterval(() => {
      void syncServerTime();
    }, 5 * 60 * 1000);
    
    const handleFocus = () => {
      void syncServerTime();
    };
    window.addEventListener("focus", handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncServerTime]);

  const refreshSummary = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");
      
      // 🚀 Hydration Check: If useAuth already fetched this during startup, use it!
      const cachedData = (window as any).__HRMS_BOOTSTRAP_DATA__;
      if (cachedData && cachedData.user?.role === role) {
        setSummary(cachedData.summary);
        setNotifications(cachedData.notifications);
        setAnnouncements(cachedData.announcements || []);
        setCalendarExceptions(cachedData.exceptions || []);
        // Clear the cache to ensure future "refreshSummary" calls actually hit the API
        (window as any).__HRMS_BOOTSTRAP_DATA__ = null;
        return;
      }

      const response = await apiRequest<{
        summary: DashboardSummary;
        notifications: Notification[];
        announcements: any[];
        exceptions: CalendarException[];
      }>("/system/bootstrap", { token });
      
      setSummary(response.data.summary);
      setNotifications(response.data.notifications);
      setAnnouncements(response.data.announcements || []);
      setCalendarExceptions(response.data.exceptions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace data");
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  const markNotificationAsRead = useCallback(async (id: number) => {
    if (!token) return;
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "POST", token });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, [token]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!token) return;
    try {
      await apiRequest("/notifications/read-all", { method: "POST", token });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }, [token]);

  const refreshLiveStatuses = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiRequest<LiveStatus[]>("/attendance/live-status", { token });
      const mapping: Record<number, LiveStatus> = {};
      response.data.forEach((status) => {
        mapping[status.employeeId] = status;
      });
      setLiveStatuses(mapping);
    } catch (err) {
      console.error("[AppProvider] Failed to fetch live statuses:", err);
    }
  }, [token]);

  const fetchAnalyticsData = useCallback(async (force = false) => {
    if (!token) return;

    // Basic Cache Logic: If fetched in the last 5 minutes, reuse unless forced
    const now = Date.now();
    if (!force && (now - analyticsLastFetched.current < 5 * 60 * 1000)) {
      return;
    }

    try {
      setLoading(true);
      // We use minimal=true because we already have the summary in the context
      const response = await apiRequest<AnalyticsData>("/dashboard/employee?minimal=true", { token });
      setAnalyticsData({
        ...response.data,
        lastFetched: now
      });
      analyticsLastFetched.current = now;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void refreshSummary();
    } else {
      setSummary(null);
      setNotifications([]);
    }
  }, [token, refreshSummary]);

  useEffect(() => {
    if (token) {
      void refreshLiveStatuses();
      const interval = setInterval(refreshLiveStatuses, 10000);
      return () => clearInterval(interval);
    } else {
      setLiveStatuses({});
    }
  }, [token, refreshLiveStatuses]);

  // Sync state instantly when the browser tab/window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (token) {
        void refreshLiveStatuses();
        void refreshSummary();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [token, refreshLiveStatuses, refreshSummary]);

  useEffect(() => {
    const handleBreakUpdated = () => {
      void refreshLiveStatuses();
      void refreshSummary();
    };
    window.addEventListener("break-updated", handleBreakUpdated);
    return () => window.removeEventListener("break-updated", handleBreakUpdated);
  }, [refreshLiveStatuses, refreshSummary]);

  useEffect(() => {
    const handleAttendanceUpdated = (event: Event) => {
      const detail = getAttendanceUpdatedDetail(event);
      if (detail?.attendanceToday) {
        setSummary((current) => current ? ({
          ...current,
          attendanceToday: detail.attendanceToday
        }) : null);
      }
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, []);

  useEffect(() => {
    const handleReconnected = () => {
      console.log("[AppProvider] Reconnection event detected. Syncing workspace summary...");
      void refreshSummary();
    };
    window.addEventListener("hrms-reconnected", handleReconnected);
    return () => window.removeEventListener("hrms-reconnected", handleReconnected);
  }, [refreshSummary]);

  const value = useMemo(() => ({
    summary,
    notifications,
    announcements,
    liveStatuses,
    loading,
    error,
    refreshSummary,
    refreshLiveStatuses,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    analyticsData,
    fetchAnalyticsData,
    calendarExceptions,
    token,
    serverTimeOffset,
    getCalibratedNow,
    isTimeDrifted,
    timeSyncLoading
  }), [
    summary,
    notifications,
    announcements,
    liveStatuses,
    loading,
    error,
    refreshSummary,
    refreshLiveStatuses,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    analyticsData,
    fetchAnalyticsData,
    calendarExceptions,
    token,
    serverTimeOffset,
    getCalibratedNow,
    isTimeDrifted,
    timeSyncLoading
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

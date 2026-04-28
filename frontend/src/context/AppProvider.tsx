import { useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../services/api";
import type { Role, Notification } from "../types";
import { ATTENDANCE_EVENT, getAttendanceUpdatedDetail } from "../components/common/attendanceQuickActionUtils";
import { AppContext, type DashboardSummary, type AnalyticsData } from "./useApp";

export function AppProvider({ children, token, role }: { children: ReactNode; token: string | null; role: Role }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiRequest<Notification[]>("/notifications", { token });
      setNotifications(response.data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [token]);

  const refreshSummary = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");
      
      // Fetch both summary and notifications
      const [summaryRes] = await Promise.all([
        apiRequest<DashboardSummary>("/dashboard/employee-summary", { token }),
        fetchNotifications()
      ]);
      
      const nextSummary = { ...summaryRes.data };

      // Handle HR/Admin specific fallbacks if backend does not yet include these fields in the base summary
      if ((role === "HR" || role === "ADMIN") && typeof nextSummary.pendingCorrectionRequests !== "number") {
        try {
          const regularizationResponse = await apiRequest<Array<{ status: string }>>("/attendance/regularizations", { token });
          nextSummary.pendingCorrectionRequests = regularizationResponse.data.filter((item) => item.status === "PENDING").length;
        } catch {
          nextSummary.pendingCorrectionRequests = 0;
        }
      }

      if ((role === "HR" || role === "ADMIN") && typeof nextSummary.pendingIncentiveApprovals !== "number") {
        try {
          const incentivesResponse = await apiRequest<Array<{ status: string }>>("/payroll/incentives", { token });
          nextSummary.pendingIncentiveApprovals = incentivesResponse.data.filter((item) => item.status === "PENDING").length;
        } catch {
          nextSummary.pendingIncentiveApprovals = 0;
        }
      }

      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [token, role, fetchNotifications]);

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

  const fetchAnalyticsData = useCallback(async (force = false) => {
    if (!token) return;

    // Basic Cache Logic: If fetched in the last 5 minutes, reuse unless forced
    const now = Date.now();
    if (!force && analyticsData?.lastFetched && (now - analyticsData.lastFetched < 5 * 60 * 1000)) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [token, analyticsData]);

  useEffect(() => {
    if (token) {
      void refreshSummary();
    } else {
      setSummary(null);
      setNotifications([]);
    }
  }, [token, refreshSummary]);

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

  const value = useMemo(() => ({
    summary,
    notifications,
    loading,
    error,
    refreshSummary,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    analyticsData,
    fetchAnalyticsData
  }), [summary, notifications, loading, error, refreshSummary, markNotificationAsRead, markAllNotificationsAsRead, analyticsData, fetchAnalyticsData]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

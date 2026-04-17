import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../services/api";
import type { Role, Attendance, CalendarDay, LeaveRequest } from "../types";
import { ATTENDANCE_EVENT, getAttendanceUpdatedDetail } from "../components/common/attendanceQuickActionUtils";

export type DashboardSummary = {
  pendingLeaves: number;
  pendingTeamLeaves: number;
  payrollCount: number;
  scopedTeamCount: number;
  isTeamLead: boolean;
  pendingCorrectionRequests: number;
  pendingIncentiveApprovals: number;
  attendanceToday: Attendance | null;
  employees?: number;
  teamCount?: number;
  departments?: number;
  pendingApprovals?: number;
  currentEmployee?: {
    id: number;
    firstName: string;
    lastName: string;
    department?: { name: string };
    manager?: { firstName: string; lastName: string };
  };
  leaveRequests?: LeaveRequest[];
};

export type AnalyticsData = {
  attendanceRecords: Attendance[];
  calendarDays: CalendarDay[];
  lastFetched?: number;
};

type AppContextType = {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string;
  refreshSummary: () => Promise<void>;
  analyticsData: AnalyticsData | null;
  fetchAnalyticsData: (force?: boolean) => Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children, token, role }: { children: ReactNode; token: string | null; role: Role }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshSummary = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<DashboardSummary>("/dashboard/employee-summary", { token });
      
      const nextSummary = { ...response.data };

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
  }, [token, role]);

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
    loading,
    error,
    refreshSummary,
    analyticsData,
    fetchAnalyticsData
  }), [summary, loading, error, refreshSummary, analyticsData, fetchAnalyticsData]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

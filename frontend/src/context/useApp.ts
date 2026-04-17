import { createContext, useContext } from "react";
import type { Attendance, CalendarDay, LeaveRequest } from "../types";

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

export type AppContextType = {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string;
  refreshSummary: () => Promise<void>;
  analyticsData: AnalyticsData | null;
  fetchAnalyticsData: (force?: boolean) => Promise<void>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

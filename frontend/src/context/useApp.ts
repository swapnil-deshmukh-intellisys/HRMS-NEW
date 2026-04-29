import { createContext, useContext } from "react";
import type { Attendance, CalendarDay, LeaveRequest, Employee, Notification } from "../types";

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
  currentEmployee?: Employee | null;
  leaveRequests?: LeaveRequest[];
};

export type AnalyticsData = {
  attendanceRecords: Attendance[];
  calendarDays: CalendarDay[];
  lastFetched?: number;
};

export type AppContextType = {
  summary: DashboardSummary | null;
  notifications: Notification[];
  loading: boolean;
  error: string;
  refreshSummary: () => Promise<void>;
  markNotificationAsRead: (id: number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
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

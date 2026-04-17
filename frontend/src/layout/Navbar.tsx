import "./Navbar.css";
import { Bell, LogOut, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AttendanceQuickAction from "../components/common/AttendanceQuickAction";
import Button from "../components/common/Button";
import type { Role } from "../types";
import { useApp } from "../context/AppContext";

type NavbarProps = {
  title: string;
  navOpen: boolean;
  onToggleNav: () => void;
  token: string | null;
  currentEmployeeId: number | null;
  role: Role;
  onLogout: () => void | Promise<void>;
};

export default function Navbar({ title, navOpen, onToggleNav, token, currentEmployeeId, role, onLogout }: NavbarProps) {
  const navigate = useNavigate();
  const { summary, loading: notificationsLoading, error: notificationsError, refreshSummary } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const canSearchEmployees = role !== "EMPLOYEE";

  const notifications = useMemo(() => {
    if (!summary) return [];

    const items: Array<{ id: string; title: string; description: string; action: () => void }> = [];

    if ((summary.pendingLeaves ?? 0) > 0) {
      items.push({
        id: "pending-leaves",
        title: role === "HR" || role === "ADMIN" ? "Leave approvals pending" : "Leave request update",
        description:
          role === "HR" || role === "ADMIN"
            ? `${summary.pendingLeaves} leave request(s) are pending review.`
            : `You have ${summary.pendingLeaves} pending leave request(s).`,
        action: () => navigate("/leaves"),
      });
    }

    const shouldShowTeamLeadItems = role === "MANAGER" || (role === "EMPLOYEE" && Boolean(summary.isTeamLead));

    if ((summary.pendingTeamLeaves ?? 0) > 0 && shouldShowTeamLeadItems) {
      items.push({
        id: "team-pending-leaves",
        title: "Team approvals pending",
        description: `${summary.pendingTeamLeaves} team leave request(s) need review.`,
        action: () => navigate("/leaves"),
      });
    }

    if ((summary.scopedTeamCount ?? 0) > 0 && shouldShowTeamLeadItems) {
      items.push({
        id: "team-size",
        title: "Team scope snapshot",
        description: `You currently have ${summary.scopedTeamCount} team member(s) in scope.`,
        action: () => navigate("/team"),
      });
    }

    if ((summary.payrollCount ?? 0) > 0 && role !== "EMPLOYEE") {
      items.push({
        id: "payroll-records",
        title: "Payroll records available",
        description: `${summary.payrollCount} payroll record(s) currently in system.`,
        action: () => navigate("/payroll"),
      });
    }

    if ((summary.pendingCorrectionRequests ?? 0) > 0) {
      items.push({
        id: "pending-corrections",
        title: "Correction requests pending",
        description: `${summary.pendingCorrectionRequests} attendance correction request(s) need review.`,
        action: () => navigate("/attendance"),
      });
    }

    if ((summary.pendingIncentiveApprovals ?? 0) > 0 && (role === "HR" || role === "ADMIN")) {
      items.push({
        id: "pending-incentives",
        title: "Incentive approvals pending",
        description: `${summary.pendingIncentiveApprovals} incentive request(s) are waiting for action.`,
        action: () => navigate("/incentives"),
      });
    }

    const priorityOrder: Record<string, number> = {
      "pending-corrections": 1,
      "pending-leaves": 2,
      "pending-incentives": 3,
      "payroll-records": 4,
      "team-pending-leaves": 5,
      "team-size": 6,
    };

    return items.sort((a, b) => (priorityOrder[a.id] ?? 99) - (priorityOrder[b.id] ?? 99));
  }, [navigate, role, summary]);

  const totalPendingCount = useMemo(() => {
    if (!summary) return 0;
    
    // Only sum indicators that represent actual "pending actions"
    return (
      (summary.pendingLeaves ?? 0) +
      (summary.pendingTeamLeaves ?? 0) +
      (summary.pendingCorrectionRequests ?? 0) +
      (summary.pendingIncentiveApprovals ?? 0)
    );
  }, [summary]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!token) return;
  }, [token]);

  function handleEmployeeSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();

    navigate(trimmedSearchTerm ? `/employees?search=${encodeURIComponent(trimmedSearchTerm)}` : "/employees");
  }

  async function handleBellClick() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);

    if (nextOpen) {
      void refreshSummary();
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-copy">
        <Button className="mobile-nav-toggle" variant="secondary" type="button" onClick={onToggleNav}>
          {navOpen ? "Close menu" : "Menu"}
        </Button>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <div className="topbar-attendance-action">
          <AttendanceQuickAction token={token} currentEmployeeId={currentEmployeeId} size="compact" />
        </div>
        {canSearchEmployees ? (
          <form className="topbar-search-wrap" aria-label="Search employees by name" onSubmit={handleEmployeeSearchSubmit}>
            <Search className="topbar-search-icon" size={16} strokeWidth={2} />
            <input
              className="topbar-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employees by name"
            />
          </form>
        ) : null}
        <div className="topbar-notifications" ref={notificationsRef}>
          <Button
            type="button"
            className="topbar-icon-button topbar-notification-button"
            variant="secondary"
            aria-label="Notifications"
            onClick={() => {
              void handleBellClick();
            }}
          >
            <Bell size={18} strokeWidth={2} />
            {totalPendingCount > 0 ? (
              <span className="topbar-notification-badge" aria-hidden="true">
                {totalPendingCount > 99 ? "99+" : totalPendingCount}
              </span>
            ) : null}
          </Button>
          {notificationsOpen ? (
            <div className="topbar-notification-popover">
              <div className="topbar-notification-popover__header">
                <strong>Notifications</strong>
                <button type="button" className="secondary" onClick={() => void refreshSummary()} disabled={notificationsLoading}>
                  Refresh
                </button>
              </div>
              {notificationsLoading ? <p className="muted">Loading updates...</p> : null}
              {notificationsError ? <p className="error-text">{notificationsError}</p> : null}
              {!notificationsLoading && !notificationsError ? (
                notifications.length ? (
                  <div className="topbar-notification-list">
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="topbar-notification-item"
                        onClick={() => {
                          item.action();
                          setNotificationsOpen(false);
                        }}
                      >
                        <span className="topbar-notification-item__title">{item.title}</span>
                        <span className="topbar-notification-item__desc">{item.description}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No new notifications.</p>
                )
              ) : null}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          className="topbar-icon-button"
          variant="secondary"
          aria-label="Open profile"
          onClick={() => {
            if (currentEmployeeId) {
              navigate(`/employees/${currentEmployeeId}`);
            }
          }}
          disabled={!currentEmployeeId}
        >
          <UserRound size={18} strokeWidth={2} />
        </Button>
        <Button
          type="button"
          className="topbar-icon-button topbar-logout-button"
          variant="secondary"
          aria-label="Logout"
          onClick={onLogout}
        >
          <LogOut size={18} strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}

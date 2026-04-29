import "./Navbar.css";
import { Bell, LogOut, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AttendanceQuickAction from "../components/common/AttendanceQuickAction";
import BreakQuickAction from "../components/common/BreakQuickAction";
import Button from "../components/common/Button";
import type { Role } from "../types";
import { useApp } from "../context/AppContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

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
  const { summary, notifications, loading: notificationsLoading, error: notificationsError, refreshSummary, markNotificationAsRead, markAllNotificationsAsRead } = useApp();
  const { subscribeUser, isSubscribing } = usePushNotifications(token);
  const [searchTerm, setSearchTerm] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const canSearchEmployees = role !== "EMPLOYEE";

  const totalUnreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

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
          <BreakQuickAction
            token={token}
            isCheckedIn={Boolean(summary?.attendanceToday?.checkInTime)}
            isCheckedOut={Boolean(summary?.attendanceToday?.checkOutTime)}
          />
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
            {totalUnreadCount > 0 ? (
              <span className="topbar-notification-badge" aria-hidden="true">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            ) : null}
          </Button>
          {notificationsOpen ? (
            <div className="topbar-notification-popover">
              <div className="topbar-notification-popover__header">
                <strong>Notifications</strong>
                <div className="topbar-notification-popover__actions">
                  <button type="button" className="secondary" onClick={() => void markAllNotificationsAsRead()} disabled={totalUnreadCount === 0}>
                    Mark all read
                  </button>
                  <button 
                    type="button" 
                    className="secondary" 
                    onClick={async () => {
                      try {
                        await subscribeUser();
                        alert("Desktop notifications enabled!");
                      } catch (err: any) {
                        alert(err.message || "Failed to enable notifications");
                      }
                    }} 
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? "Enabling..." : "Desktop Alerts"}
                  </button>
                  <button type="button" className="secondary" onClick={() => void refreshSummary()} disabled={notificationsLoading}>
                    Refresh
                  </button>
                </div>
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
                        className={`topbar-notification-item ${!item.isRead ? "unread" : ""}`}
                        onClick={() => {
                          if (!item.isRead) {
                            void markNotificationAsRead(item.id);
                          }
                          if (item.link) {
                            navigate(item.link);
                          }
                          setNotificationsOpen(false);
                        }}
                      >
                        <div className="topbar-notification-item__content">
                          <span className="topbar-notification-item__title">
                            {item.title}
                            {!item.isRead && <span className="unread-dot" />}
                          </span>
                          <span className="topbar-notification-item__desc">{item.message}</span>
                          <span className="topbar-notification-item__time">
                            {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No notifications yet.</p>
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
          onClick={() => {
            if (window.confirm("Are you sure you want to log out? Your current session will be ended.")) {
              void onLogout();
            }
          }}
        >
          <LogOut size={18} strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}

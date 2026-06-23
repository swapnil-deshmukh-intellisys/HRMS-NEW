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

function getNotificationIcon(type: string): { emoji: string; className: string } {
  switch (type) {
    case "TASK":
      return { emoji: "📋", className: "notif-icon--task" };
    case "LEAVE":
      return { emoji: "🏖️", className: "notif-icon--leave" };
    case "ATTENDANCE":
      return { emoji: "⏰", className: "notif-icon--attendance" };
    case "PAYROLL":
      return { emoji: "💰", className: "notif-icon--payroll" };
    case "ANNOUNCEMENT":
      return { emoji: "📢", className: "notif-icon--announcement" };
    case "INCENTIVE":
      return { emoji: "🎁", className: "notif-icon--incentive" };
    default:
      return { emoji: "🔔", className: "notif-icon--default" };
  }
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

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
  const { summary, notifications, loading: notificationsLoading, error: notificationsError, refreshSummary, markNotificationAsRead, markAllNotificationsAsRead, getCalibratedNow } = useApp();
  const { subscribeUser, isSubscribing } = usePushNotifications(token);
  const [searchTerm, setSearchTerm] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const [currentTime, setCurrentTime] = useState(() => getCalibratedNow ? getCalibratedNow() : new Date());

  useEffect(() => {
    if (!getCalibratedNow) return;
    const timer = setInterval(() => {
      setCurrentTime(getCalibratedNow());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(timer);
  }, [getCalibratedNow]);

  const shiftTimeText = useMemo(() => {
    const attendance = summary?.attendanceToday;
    if (!attendance?.checkInTime) return null;

    const checkIn = new Date(attendance.checkInTime);
    const checkOut = attendance.checkOutTime ? new Date(attendance.checkOutTime) : null;
    
    // Calculate elapsed time in minutes
    const end = checkOut || currentTime;
    const elapsedMs = end.getTime() - checkIn.getTime();
    const elapsedMins = Math.max(0, Math.floor(elapsedMs / 60000));

    // Calculate required time in minutes (default 9 hours = 540 minutes, plus penalties)
    const requiredMins = 540 + (attendance.penaltyMinutes || 0);

    const formatTime = (totalMins: number) => {
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${h}h ${m}m`;
    };

    return `${formatTime(elapsedMins)} / ${formatTime(requiredMins)}`;
  }, [summary?.attendanceToday, currentTime]);
  const lastScrollY = useRef(0);
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
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show if scrolling up, hide if scrolling down (and past a threshold)
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
        setNotificationsOpen(false); // Close notifications if open and scrolling
      } else {
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className={`topbar ${!isVisible ? "topbar--hidden" : ""}`}>
      <div className="topbar-copy">
        <Button className="mobile-nav-toggle" variant="secondary" type="button" onClick={onToggleNav}>
          {navOpen ? "Close menu" : "Menu"}
        </Button>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <div className="topbar-attendance-action">
          {shiftTimeText ? (
            <div className="topbar-shift-timer" title="Shift time elapsed / Required shift time today">
              <span className="topbar-shift-timer__label">Shift:</span>
              <span className="topbar-shift-timer__value">{shiftTimeText}</span>
            </div>
          ) : null}
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
                  <button 
                    type="button" 
                    className="text-action-btn" 
                    onClick={() => void markAllNotificationsAsRead()} 
                    disabled={totalUnreadCount === 0}
                  >
                    Mark all read
                  </button>
                  <button 
                    type="button" 
                    className="text-action-btn" 
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
                    {isSubscribing ? "Enabling..." : "Alerts"}
                  </button>
                  <button 
                    type="button" 
                    className="text-action-btn" 
                    onClick={() => void refreshSummary()} 
                    disabled={notificationsLoading}
                  >
                    {notificationsLoading ? "..." : "Refresh"}
                  </button>
                </div>
              </div>
              {notificationsLoading ? <p className="muted">Loading updates...</p> : null}
              {notificationsError ? <p className="error-text">{notificationsError}</p> : null}
              {!notificationsLoading && !notificationsError ? (
                notifications.length ? (
                  <div className="topbar-notification-list">
                    <div className="topbar-notification-list__label">Last 7 days activity</div>
                    {notifications.map((item) => {
                      const iconInfo = getNotificationIcon(item.type);
                      return (
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
                          <div className="topbar-notification-item__icon-wrapper">
                            <div className={`topbar-notification-item__icon ${iconInfo.className}`}>
                              {iconInfo.emoji}
                            </div>
                          </div>
                          <div className="topbar-notification-item__content">
                            <div className="topbar-notification-item__top">
                              <span className="topbar-notification-item__title">
                                {item.title}
                                {!item.isRead && <span className="unread-dot" />}
                              </span>
                              <span className="topbar-notification-item__time">
                                {getRelativeTime(item.createdAt)}
                              </span>
                            </div>
                            <span className="topbar-notification-item__desc">{item.message}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="topbar-notification-empty">
                    <div className="topbar-notification-empty__icon">🔔</div>
                    <p className="topbar-notification-empty__title">You're all caught up!</p>
                    <p className="topbar-notification-empty__desc">No new notifications in the last 7 days.</p>
                  </div>
                )
              ) : null}
              <div className="topbar-notification-popover__footer">
                <button 
                  type="button" 
                  className="topbar-notification-view-all"
                  onClick={() => {
                    navigate("/notifications");
                    setNotificationsOpen(false);
                  }}
                >
                  View All Notifications
                </button>
              </div>
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

import { useEffect, useState } from "react";
import { Bell, CheckSquare, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import type { Notification } from "../../types";
import { useApp } from "../../context/AppContext";
import Button from "../../components/common/Button";
import "./NotificationsPage.css";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { token, markAllNotificationsAsRead, notifications: recentNotifications } = useApp();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAllNotifications() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // We fetch all notifications from the backend
        const response = await apiRequest<Notification[]>("/notifications", { token });
        setNotifications(response.data || []);
      } catch (err: any) {
        setError(err.message || "Failed to load notifications");
        // Fallback to recent notifications if the API fails
        if (recentNotifications.length > 0) {
          setNotifications(recentNotifications);
        }
      } finally {
        setLoading(false);
      }
    }
    void fetchAllNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (id: number) => {
    if (!token) return;
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "POST", token });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err: any) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token || unreadCount === 0) return;
    try {
      await apiRequest("/notifications/read-all", { method: "POST", token });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      void markAllNotificationsAsRead();
    } catch (err: any) {
      console.error("Failed to mark all as read", err);
    }
  };

  function getNotificationIcon(type: string) {
    switch (type) {
      case "TASK": return { emoji: "📋", className: "notif-icon--task" };
      case "LEAVE": return { emoji: "🏖️", className: "notif-icon--leave" };
      case "ATTENDANCE": return { emoji: "⏰", className: "notif-icon--attendance" };
      case "PAYROLL": return { emoji: "💰", className: "notif-icon--payroll" };
      case "ANNOUNCEMENT": return { emoji: "📢", className: "notif-icon--announcement" };
      case "INCENTIVE": return { emoji: "🎁", className: "notif-icon--incentive" };
      default: return { emoji: "🔔", className: "notif-icon--default" };
    }
  }

  function formatFullDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div className="notifications-header-title">
          <div className="notifications-header-icon-wrapper">
            <Bell size={24} strokeWidth={2} />
          </div>
          <div>
            <h1>All Notifications</h1>
            <p>Stay updated on tasks, leaves, and announcements</p>
          </div>
        </div>
        <div className="notifications-header-actions">
          <Button
            variant="secondary"
            onClick={() => void handleMarkAllRead()}
            disabled={unreadCount === 0 || loading}
          >
            <CheckSquare size={16} />
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="notifications-content">
        {loading ? (
          <div className="notifications-loading">
            <div className="loader"></div>
            <p>Loading notifications...</p>
          </div>
        ) : error && notifications.length === 0 ? (
          <div className="notifications-error">
            <p>{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">🎉</div>
            <h2>You're all caught up!</h2>
            <p>You don't have any notifications at the moment.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((item) => {
              const iconInfo = getNotificationIcon(item.type);
              return (
                <div key={item.id} className={`notification-card ${!item.isRead ? "unread" : ""}`}>
                  <div className={`notification-card-icon ${iconInfo.className}`}>
                    {iconInfo.emoji}
                  </div>
                  <div className="notification-card-content">
                    <div className="notification-card-top">
                      <h3>
                        {item.title}
                        {!item.isRead && <span className="unread-badge">New</span>}
                      </h3>
                      <span className="notification-card-time">{formatFullDateTime(item.createdAt)}</span>
                    </div>
                    <p className="notification-card-desc">{item.message}</p>
                    
                    <div className="notification-card-actions">
                      {item.link ? (
                        <button 
                          className="notification-btn notification-btn-primary"
                          onClick={() => {
                            if (!item.isRead) handleMarkAsRead(item.id);
                            navigate(item.link as string);
                          }}
                        >
                          View Details
                        </button>
                      ) : null}
                      {!item.isRead ? (
                        <button 
                          className="notification-btn notification-btn-secondary"
                          onClick={() => handleMarkAsRead(item.id)}
                        >
                          Mark as Read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

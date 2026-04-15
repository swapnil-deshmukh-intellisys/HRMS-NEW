import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import "./SessionWarning.css";

interface SessionWarningProps {
  onRefresh?: () => void;
}

export default function SessionWarning({ onRefresh }: SessionWarningProps) {
  const { sessionWarning, refreshSession, logout } = useAuth();

  useEffect(() => {
    // Update last activity on user interaction
    const handleUserActivity = () => {
      const { updateLastActivity } = useAuth();
      updateLastActivity();
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, []);

  if (!sessionWarning) return null;

  return (
    <div className="session-warning-overlay">
      <div className="session-warning-card">
        <div className="session-warning-header">
          <h3>Session Expiring Soon</h3>
          <span className="warning-icon">!</span>
        </div>
        <div className="session-warning-content">
          <p>Your session will expire in less than 5 minutes due to inactivity.</p>
          <p>To continue working, please refresh your session or log out and log back in.</p>
        </div>
        <div className="session-warning-actions">
          <button 
            className="btn btn-primary" 
            onClick={() => {
              refreshSession();
              if (onRefresh) onRefresh();
            }}
          >
            Refresh Session
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={logout}
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}

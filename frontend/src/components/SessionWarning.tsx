import { useEffect } from "react";
import "./SessionWarning.css";

interface SessionWarningProps {
  sessionWarning: boolean;
  onRefreshSession: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onUserActivity?: () => void;
}

export default function SessionWarning({ sessionWarning, onRefreshSession, onLogout, onUserActivity }: SessionWarningProps) {
  useEffect(() => {
    const handleUserActivity = () => {
      onUserActivity?.();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, [onUserActivity]);

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
              void onRefreshSession();
            }}
          >
            Refresh Session
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              void onLogout();
            }}
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}

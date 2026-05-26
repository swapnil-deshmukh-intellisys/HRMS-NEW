import { useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import "./ConnectionStatus.css";

interface ConnectionStatusProps {
  onRetry?: () => void;
}

export default function ConnectionStatus({ onRetry }: ConnectionStatusProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleManualRetry = () => {
    if (isRetrying) return;
    setIsRetrying(true);
    if (onRetry) {
      onRetry();
    }
    setTimeout(() => {
      setIsRetrying(false);
    }, 1500);
  };

  return (
    <div className="connection-error-overlay">
      <div className="connection-error-card">
        <div className="connection-error-illustration">
          <div className="pulse-circle pulse-circle-outer"></div>
          <div className="pulse-circle pulse-circle-inner"></div>
          <div className="connection-icon-wrapper">
            <WifiOff size={32} className="connection-icon" />
          </div>
        </div>

        <div className="connection-error-content">
          <h3>Syncing with Server...</h3>
          <p>
            We are experiencing temporary difficulties connecting to your workspace. 
            Attempting to restore your session automatically.
          </p>
        </div>

        <button 
          type="button" 
          onClick={handleManualRetry} 
          className={`connection-retry-btn ${isRetrying ? "retrying" : ""}`}
          disabled={isRetrying}
        >
          <RefreshCw size={16} className={`retry-icon ${isRetrying ? "spin" : ""}`} />
          {isRetrying ? "Reconnecting..." : "Retry Now"}
        </button>
      </div>
    </div>
  );
}

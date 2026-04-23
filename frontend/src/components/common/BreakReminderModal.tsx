import { useState } from "react";
import Modal from "./Modal";
import { Coffee, BellRing, XCircle } from "lucide-react";
import "./BreakReminderModal.css";

type BreakReminderModalProps = {
  open: boolean;
  onClose: () => void;
  onStartBreak: () => Promise<void>;
  onSnooze: (minutes: number) => void;
};

export default function BreakReminderModal({ open, onClose, onStartBreak, onSnooze }: BreakReminderModalProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [snoozeMinutes, setSnoozeMinutes] = useState(5);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onStartBreak();
      onClose();
    } catch (err) {
      console.error("Failed to start break from reminder:", err);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Modal open={open} title="Scheduled Break" onClose={onClose}>
      <div className="break-reminder-content stack">
        <div className="break-reminder-hero">
           <div className="break-reminder-icon-wrap">
              <Coffee size={40} className="break-reminder-icon" />
           </div>
           <h3>Recharge Time!</h3>
           <p className="muted">
             It’s your scheduled break time. Stepping away for a few minutes improves focus. Would you like to take a break now?
           </p>
        </div>

        <div className="break-reminder-actions stack">
          <button 
            className="break-reminder-btn break-reminder-btn--primary" 
            onClick={handleStart}
            disabled={isStarting}
          >
            <Coffee size={18} />
            {isStarting ? "Logging Break..." : "Start Break Now"}
          </button>
          
          <div className="snooze-selector">
             <span className="snooze-label">Or snooze for:</span>
             <div className="snooze-options">
                {[5, 10, 15].map(mins => (
                  <button 
                    key={mins}
                    className={`snooze-opt ${snoozeMinutes === mins ? 'active' : ''}`}
                    onClick={() => setSnoozeMinutes(mins)}
                  >
                    {mins}m
                  </button>
                ))}
             </div>
          </div>

          <div className="button-row">
            <button 
              className="break-reminder-btn break-reminder-btn--secondary" 
              onClick={() => onSnooze(snoozeMinutes)}
            >
              <BellRing size={16} />
              Snooze
            </button>
            <button className="break-reminder-btn break-reminder-btn--outline" onClick={onClose}>
              <XCircle size={16} />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

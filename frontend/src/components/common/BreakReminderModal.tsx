import { useState, useEffect } from "react";
import Button from "./Button";
import Modal from "./Modal";
import { Coffee, BellRing, XCircle } from "lucide-react";
import "./BreakReminderModal.css";

type BreakReminderModalProps = {
  open: boolean;
  onClose: () => void;
  onStartBreak: () => Promise<void>;
  onSnooze: () => void;
};

export default function BreakReminderModal({ open, onClose, onStartBreak, onSnooze }: BreakReminderModalProps) {
  const [isStarting, setIsStarting] = useState(false);

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
             It’s your scheduled break time. Stepping away for a few minutes improves focus and reduces stress. Would you like to take a break now?
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
          
          <div className="button-row">
            <button className="break-reminder-btn break-reminder-btn--secondary" onClick={onSnooze}>
              <BellRing size={16} />
              Snooze (5 mins)
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

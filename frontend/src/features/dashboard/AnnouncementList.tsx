import { useEffect, useState, useCallback } from "react";
import { Megaphone, X, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "../../services/api";
import "./Announcement.css";

type Announcement = {
  id: number;
  title: string;
  content: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  createdAt: string;
  createdBy: {
    firstName: true;
    lastName: true;
    jobTitle: true;
  };
};

export default function AnnouncementList({ token, refreshSignal }: { token?: string | null; refreshSignal?: number }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAllVisible, setIsAllVisible] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const response = await apiRequest<Announcement[]>("/announcements", { token });
      setAnnouncements(response.data);
    } catch (err) {
      console.error("Failed to fetch announcements", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements, refreshSignal]);

  if (loading || announcements.length === 0) return null;

  const [latest, ...older] = announcements;

  if (!isVisible) {
    return (
      <div className="announcement-container collapsed">
        <div className="announcement-controls centered">
          <button 
            className="announcement-toggle has-count"
            onClick={() => setIsVisible(true)}
          >
            <div className="announcement-toggle-copy">
              <Megaphone size={16} />
              <span>View Announcements ({announcements.length})</span>
            </div>
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="announcement-container">
      {/* Header with Hide All button */}
      <div className="announcement-controls top-controls">
        <button 
          className="announcement-btn-text"
          onClick={() => setIsVisible(false)}
        >
          <X size={14} /> Hide All
        </button>
      </div>

      {/* Latest Announcement - Always Visible when container is visible */}
      <div className="announcement-list latest-only">
        <AnnouncementItem announcement={latest} isLatest />
      </div>

      {/* Expansion Controls - Only show if there are more announcements */}
      {older.length > 0 && (
        <div className="announcement-controls">
          <button 
            className="announcement-toggle"
            onClick={() => setIsAllVisible(!isAllVisible)}
          >
            <div className="announcement-toggle-copy">
              <Megaphone size={16} />
              <span>{isAllVisible ? "Show Less" : `Show All Older (${older.length})`}</span>
            </div>
            {isAllVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      )}

      {/* Older Announcements */}
      {isAllVisible && older.length > 0 && (
        <div className="announcement-list older-list">
          {older.map((announcement) => (
            <AnnouncementItem key={announcement.id} announcement={announcement} />
          ))}
        </div>
      )}
    </div>
  );
}


function AnnouncementItem({ announcement, isLatest }: { announcement: Announcement; isLatest?: boolean }) {
  return (
    <div className={`announcement-item ${announcement.priority.toLowerCase()} ${isLatest ? 'latest' : ''}`}>
      <div className="announcement-content">
        <div className="announcement-icon-wrap">
          {announcement.priority === "URGENT" ? <AlertCircle size={18} /> : <Megaphone size={18} />}
        </div>
        <div className="announcement-body">
          <div className="announcement-meta">
            <span className="priority-tag">
              {isLatest && <span className="new-badge">NEW</span>}
              {announcement.priority}
            </span>
            <span className="bullet">•</span>
            <span className="time-tag">
              <Clock size={12} /> {new Date(announcement.createdAt).toLocaleDateString([], { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(announcement.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
          <h5 className="announcement-title">{announcement.title}</h5>
          <p className="announcement-text">{announcement.content}</p>
        </div>
      </div>
    </div>
  );
}



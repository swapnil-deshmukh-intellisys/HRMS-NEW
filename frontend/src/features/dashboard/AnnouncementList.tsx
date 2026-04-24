import { useEffect, useState, useCallback } from "react";
import { Megaphone, X as CloseIcon, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
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

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const fetchAnnouncements = useCallback(async () => {
    try {
      const response = await apiRequest<Announcement[]>("/announcements", { token });
      const data = response.data;
      setAnnouncements(data);
      
      // Auto-collapse if no announcements from today
      const hasToday = data.some(a => isToday(a.createdAt));
      if (!hasToday) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
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

  const todayAnnouncements = announcements.filter(a => isToday(a.createdAt));
  const olderAnnouncements = announcements.filter(a => !isToday(a.createdAt));

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
      {/* Announcements from today - Always visible outside "See More" */}
      <div className="announcement-list latest-only">
        {todayAnnouncements.length > 0 ? (
          todayAnnouncements.map((announcement, index) => (
            <AnnouncementItem 
              key={announcement.id}
              announcement={announcement} 
              isLatest 
              onHide={index === 0 ? () => setIsVisible(false) : undefined}
            >
              {index === todayAnnouncements.length - 1 && olderAnnouncements.length > 0 && (
                <div className="announcement-card-actions">
                  <button 
                    className="announcement-toggle-btn"
                    onClick={() => setIsAllVisible(!isAllVisible)}
                  >
                    <span>{isAllVisible ? "Show less" : `Show all (${olderAnnouncements.length})`}</span>
                    {isAllVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              )}
            </AnnouncementItem>
          ))
        ) : (
          /* If someone clicked "View Announcements" but none from today, show the most recent one as hero anyway or just start the list? 
             The requirement says "If an announcement is created today, it should be displayed at the top... outside of the See More list."
             If we clicked "View Announcements" and there's nothing from today, 
             the original code would show the most recent one. 
          */
          announcements.length > 0 && (
            <AnnouncementItem 
              announcement={announcements[0]} 
              isLatest 
              onHide={() => setIsVisible(false)}
            >
              {announcements.length > 1 && (
                <div className="announcement-card-actions">
                  <button 
                    className="announcement-toggle-btn"
                    onClick={() => setIsAllVisible(!isAllVisible)}
                  >
                    <span>{isAllVisible ? "Show less" : `Show all (${announcements.length - 1})`}</span>
                    {isAllVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              )}
            </AnnouncementItem>
          )
        )}
      </div>

      {/* Older Announcements (within 7 day window) */}
      {isAllVisible && (
        <div className="announcement-list older-list">
          {(todayAnnouncements.length > 0 ? olderAnnouncements : announcements.slice(1)).map((announcement) => (
            <AnnouncementItem key={announcement.id} announcement={announcement} />
          ))}
        </div>
      )}
    </div>
  );
}


function AnnouncementItem({ announcement, isLatest, children, onHide }: { announcement: Announcement; isLatest?: boolean; children?: React.ReactNode; onHide?: () => void }) {
  return (
    <div className={`announcement-item ${announcement.priority.toLowerCase()} ${isLatest ? 'latest' : ''}`}>
      <div className="announcement-item-wrapper">
        <div className="announcement-meta">
          {isLatest && <span className="new-badge">NEW</span>}
          <span className="priority-tag">{announcement.priority}</span>
          <span className="bullet">•</span>
          <span className="time-tag">
            <Clock size={12} /> {new Date(announcement.createdAt).toLocaleDateString([], { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(announcement.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
          {onHide && (
            <button 
              className="announcement-hide-inline-btn"
              onClick={onHide}
              title="Hide All"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        
        <div className="announcement-body">
          <div className="announcement-title-row">
            <div className="announcement-icon-wrap">
              {announcement.priority === "URGENT" ? <AlertCircle size={18} /> : <Megaphone size={18} />}
            </div>
            <h5 className="announcement-title">{announcement.title}</h5>
          </div>
          <div className="announcement-text">
            {announcement.content}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}







import { useState } from "react";
import { Megaphone, Send, AlertTriangle, Info } from "lucide-react";
import { apiRequest } from "../../services/api";
import "./Announcement.css";

type Priority = "NORMAL" | "HIGH" | "URGENT";

export default function AnnouncementForm({ token, onCreated }: { token: string | null; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setLoading(true);
    setError(null);
    try {
      await apiRequest("/announcements", {
        method: "POST",
        token,
        body: { title, content, priority }
      });
      setTitle("");
      setContent("");
      setPriority("NORMAL");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create announcement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="card broadcast-studio-card">
      <div className="broadcast-studio__aura" />
      
      <div className="announcement-form-header">
        <div className="announcement-form-icon">
          <Megaphone size={22} strokeWidth={2.5} />
        </div>
        <div className="broadcast-studio-title">
          <p className="broadcast-studio__eyebrow">Communication Center</p>
          <h4>Broadcast Studio</h4>
          <p className="broadcast-studio__subtitle">Post updates to the entire organization in real-time.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="announcement-form">
        <div className="broadcast-input-group">
          <div className="broadcast-input-wrapper">
             <input
               type="text"
               className="broadcast-input broadcast-input--title"
               placeholder="Announcement Headline"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               required
             />
             <div className="broadcast-input-line" />
          </div>

          <div className="broadcast-input-wrapper">
             <textarea
               className="broadcast-input broadcast-input--content"
               placeholder="Write your message here... (Markdown supported)"
               value={content}
               onChange={(e) => setContent(e.target.value)}
               required
               rows={4}
             />
             <div className="broadcast-input-line" />
          </div>
        </div>

        <div className="announcement-form-footer">
          <div className="broadcast-controls">
            <label className="broadcast-controls__label">Priority Level</label>
            <div className="priority-segmented-control">
              <button
                type="button"
                className={`priority-chip normal ${priority === "NORMAL" ? "active" : ""}`}
                onClick={() => setPriority("NORMAL")}
              >
                <div className="priority-indicator" />
                <span>Normal</span>
              </button>
              <button
                type="button"
                className={`priority-chip high ${priority === "HIGH" ? "active" : ""}`}
                onClick={() => setPriority("HIGH")}
              >
                <div className="priority-indicator" />
                <span>High</span>
              </button>
              <button
                type="button"
                className={`priority-chip urgent ${priority === "URGENT" ? "active" : ""}`}
                onClick={() => setPriority("URGENT")}
              >
                <AlertTriangle size={12} className="priority-icon" />
                <span>Urgent</span>
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !title || !content} 
            className={`broadcast-submit-btn ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <span className="broadcast-loader" />
            ) : (
              <>
                <span>Publish Announcement</span>
                <Send size={18} className="send-icon" />
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="broadcast-error">
             <Info size={14} />
             <span>{error}</span>
          </div>
        )}
      </form>
    </article>
  );
}
